import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

function sumPaymentRows(rows) {
  return rows.reduce(
    (acc, row) => {
      const cash = Number(row.cash || 0);
      const card = Number(row.card || 0);
      const hicaps = Number(row.hicaps || 0);
      const other = Number(row.other || 0);

      acc.cash += cash;
      acc.card += card;
      acc.hicaps += hicaps;
      acc.other += other;
      acc.total += cash + card + hicaps + other;

      return acc;
    },
    { cash: 0, card: 0, hicaps: 0, other: 0, total: 0 }
  );
}

function totalRowAmount(row) {
  return (
    Number(row?.cash || 0) +
    Number(row?.card || 0) +
    Number(row?.hicaps || 0) +
    Number(row?.other || 0)
  );
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function computePayoutForJob({ job, paymentRow, refundRows, policiesById }) {
  const paymentTotal = totalRowAmount(paymentRow);
  const refundedTotal = refundRows.reduce(
    (sum, row) => sum + totalRowAmount(row),
    0
  );
  const netAmount = Math.max(paymentTotal - refundedTotal, 0);

  if (netAmount <= 0) {
    return {
      shouldCount: false,
      paymentTotal,
      refundedTotal,
      effectiveAmount: 0,
      payout: 0,
      reason: "fully_refunded",
    };
  }

  const policy =
    policiesById.get(String(job.staff?.payout_policy_id || "")) || null;

  if (!policy || !policy.is_active) {
    return {
      shouldCount: true,
      paymentTotal,
      refundedTotal,
      effectiveAmount: netAmount,
      payout: 0,
      reason: "no_policy",
      policy: null,
    };
  }

  let effectiveAmount = netAmount;

  if (policy.refund_behavior === "full_pay") {
    effectiveAmount = paymentTotal;
  } else if (policy.refund_behavior === "exclude_full") {
    effectiveAmount = netAmount;
  } else if (policy.refund_behavior === "prorate") {
    effectiveAmount = netAmount;
  }

  let payout = 0;

  if (policy.payout_type === "fixed_per_job") {
    const serviceFixedPayout = Number(job.services?.staff_payout_fixed || 0);
    const policyFixedAmount = Number(policy.fixed_amount || 0);

    payout = serviceFixedPayout > 0 ? serviceFixedPayout : policyFixedAmount;
  } else if (policy.payout_type === "percent") {
    payout = (effectiveAmount * Number(policy.percent || 0)) / 100;
  } else if (policy.payout_type === "per_hour") {
    const durationMinutes = Number(job.services?.duration || 0);
    payout = (durationMinutes / 60) * Number(policy.hourly_rate || 0);
  }

  return {
    shouldCount: true,
    paymentTotal,
    refundedTotal,
    effectiveAmount,
    payout: roundMoney(payout),
    reason: "ok",
    policy,
  };
}

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select(`
        id,
        store_id,
        date,
        status,
        job_group_id,
        staff_id,
        service_id,
        services (
          id,
          name,
          price,
          duration,
          staff_payout_fixed
        ),
        staff:staff!jobs_staff_id_fkey (
          id,
          name,
          name_display,
          payout_policy_id
        )
      `)
      .eq("store_id", store.id)
      .eq("date", date);

    if (jobsError) {
      return NextResponse.json({ error: jobsError.message }, { status: 500 });
    }

    const safeJobs = Array.isArray(jobs) ? jobs : [];

    const staffIds = [
      ...new Set(
        safeJobs
          .map((job) => job.staff?.id)
          .filter((value) => value !== null && value !== undefined)
      ),
    ];

    const policyIds = [
      ...new Set(
        safeJobs
          .map((job) => job.staff?.payout_policy_id)
          .filter((value) => value !== null && value !== undefined)
      ),
    ];

    let policies = [];
    if (policyIds.length > 0) {
      const { data: policiesData, error: policiesError } = await supabase
        .from("store_payout_policies")
        .select(`
          id,
          store_id,
          name,
          payout_type,
          fixed_amount,
          percent,
          hourly_rate,
          refund_behavior,
          is_active
        `)
        .eq("store_id", store.id)
        .in("id", policyIds);

      if (policiesError) {
        return NextResponse.json(
          { error: policiesError.message },
          { status: 500 }
        );
      }

      policies = Array.isArray(policiesData) ? policiesData : [];
    }

    const policiesById = new Map(
      policies.map((policy) => [String(policy.id), policy])
    );

    const jobIds = safeJobs.map((job) => job.id);
    const groupIds = [
      ...new Set(
        safeJobs
          .map((job) => job.job_group_id)
          .filter((value) => value !== null && value !== undefined)
      ),
    ];

    let payments = [];

    if (jobIds.length > 0 || groupIds.length > 0) {
      let paymentsQuery = supabase
        .from("payments")
        .select(`
          id,
          store_id,
          job_id,
          job_group_id,
          cash,
          card,
          hicaps,
          other,
          transaction_type,
          status,
          parent_payment_id,
          notes,
          created_at
        `)
        .eq("store_id", store.id);

      if (jobIds.length > 0 && groupIds.length > 0) {
        paymentsQuery = paymentsQuery.or(
          `job_id.in.(${jobIds.join(",")}),job_group_id.in.(${groupIds.join(",")})`
        );
      } else if (jobIds.length > 0) {
        paymentsQuery = paymentsQuery.in("job_id", jobIds);
      } else if (groupIds.length > 0) {
        paymentsQuery = paymentsQuery.in("job_group_id", groupIds);
      }

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;

      if (paymentsError) {
        return NextResponse.json(
          { error: paymentsError.message },
          { status: 500 }
        );
      }

      payments = Array.isArray(paymentsData) ? paymentsData : [];
    }

    const activePaymentRows = payments.filter(
      (row) => row.transaction_type === "payment" && row.status === "active"
    );

    const activeRefundRows = payments.filter(
      (row) => row.transaction_type === "refund" && row.status === "active"
    );

    const activeDepositRows = payments.filter(
      (row) => row.transaction_type === "deposit" && row.status === "active"
    );

    const activeCancellationFeeRows = payments.filter(
      (row) =>
        row.transaction_type === "cancellation_fee" && row.status === "active"
    );

    const activeVoidRows = payments.filter(
      (row) => row.transaction_type === "void" && row.status === "active"
    );

    const paymentTotals = sumPaymentRows(activePaymentRows);
    const refundTotals = sumPaymentRows(activeRefundRows);
    const depositTotals = sumPaymentRows(activeDepositRows);
    const cancellationFeeTotals = sumPaymentRows(activeCancellationFeeRows);
    const voidTotals = sumPaymentRows(activeVoidRows);

    const totalJobs = safeJobs.length;
    const paidJobs = safeJobs.filter((job) => job.status === "paid").length;
    const pendingJobs = safeJobs.filter((job) => job.status === "pending").length;
    const cancelledJobs = safeJobs.filter(
      (job) => job.status === "cancelled"
    ).length;
    const noShowJobs = safeJobs.filter((job) => job.status === "no_show").length;

    const outstanding = safeJobs
      .filter((job) => job.status === "pending")
      .reduce((sum, job) => sum + Number(job.services?.price || 0), 0);

    const netRevenue =
      paymentTotals.total +
      depositTotals.total +
      cancellationFeeTotals.total -
      refundTotals.total;

    const paymentRowsByJobId = new Map();
    activePaymentRows.forEach((row) => {
      if (row.job_id !== null && row.job_id !== undefined) {
        paymentRowsByJobId.set(String(row.job_id), row);
      }
    });

    const refundRowsByParentPaymentId = new Map();
    activeRefundRows.forEach((row) => {
      const key = String(row.parent_payment_id || "");
      const existing = refundRowsByParentPaymentId.get(key) || [];
      existing.push(row);
      refundRowsByParentPaymentId.set(key, existing);
    });

    const staffPayoutMap = new Map();

    staffIds.forEach((staffId) => {
      const staffInfo =
        safeJobs.find((job) => String(job.staff?.id) === String(staffId))?.staff ||
        null;

      staffPayoutMap.set(String(staffId), {
        staff_id: staffId,
        staff_name: staffInfo?.name_display || staffInfo?.name || "Unknown staff",
        policy_name: null,
        policy_type: null,
        refund_behavior: null,
        paid_jobs_count: 0,
        fully_refunded_jobs_count: 0,
        gross_sales: 0,
        refunds: 0,
        effective_sales: 0,
        payout_total: 0,
      });
    });

    safeJobs.forEach((job) => {
      const staffId = job.staff?.id;
      if (!staffId) return;

      const entry = staffPayoutMap.get(String(staffId));
      if (!entry) return;

      const policy =
        policiesById.get(String(job.staff?.payout_policy_id || "")) || null;

      if (policy) {
        entry.policy_name = policy.name || null;
        entry.policy_type = policy.payout_type || null;
        entry.refund_behavior = policy.refund_behavior || null;
      }

      const paymentRow = paymentRowsByJobId.get(String(job.id));
      if (!paymentRow) return;

      const refundRows =
        refundRowsByParentPaymentId.get(String(paymentRow.id)) || [];

      const result = computePayoutForJob({
        job,
        paymentRow,
        refundRows,
        policiesById,
      });

      if (!result.shouldCount && result.reason === "fully_refunded") {
        entry.fully_refunded_jobs_count += 1;
        return;
      }

      entry.paid_jobs_count += 1;
      entry.gross_sales = roundMoney(entry.gross_sales + result.paymentTotal);
      entry.refunds = roundMoney(entry.refunds + result.refundedTotal);
      entry.effective_sales = roundMoney(
        entry.effective_sales + result.effectiveAmount
      );
      entry.payout_total = roundMoney(entry.payout_total + result.payout);
    });

    const staffPayouts = Array.from(staffPayoutMap.values()).sort((a, b) =>
      a.staff_name.localeCompare(b.staff_name)
    );

    const totalStaffPayout = roundMoney(
      staffPayouts.reduce(
        (sum, staff) => sum + Number(staff.payout_total || 0),
        0
      )
    );

    const storeKeeps = roundMoney(netRevenue - totalStaffPayout);

    return NextResponse.json(
      {
        store_id: store.id,
        date,
        stats: {
          totalJobs,
          paidJobs,
          pendingJobs,
          cancelledJobs,
          noShowJobs,
          outstanding: roundMoney(outstanding),
          netRevenue: roundMoney(netRevenue),
          totalStaffPayout,
          storeKeeps,
        },
        byMethod: {
          cash: roundMoney(
            paymentTotals.cash +
              depositTotals.cash +
              cancellationFeeTotals.cash -
              refundTotals.cash
          ),
          card: roundMoney(
            paymentTotals.card +
              depositTotals.card +
              cancellationFeeTotals.card -
              refundTotals.card
          ),
          hicaps: roundMoney(
            paymentTotals.hicaps +
              depositTotals.hicaps +
              cancellationFeeTotals.hicaps -
              refundTotals.hicaps
          ),
          other: roundMoney(
            paymentTotals.other +
              depositTotals.other +
              cancellationFeeTotals.other -
              refundTotals.other
          ),
        },
        transactions: {
          payments: paymentTotals,
          refunds: refundTotals,
          deposits: depositTotals,
          cancellationFees: cancellationFeeTotals,
          voids: voidTotals,
        },
        staffPayouts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/s/[slug]/end-day-summary error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}