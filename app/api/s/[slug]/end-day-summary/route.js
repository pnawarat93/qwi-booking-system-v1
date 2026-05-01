import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

const DEFAULT_DAILY_GUARANTEE_CONFIG = {
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0,
};

function getDayKey(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[day];
}

function getDailyGuarantee(store, dateStr) {
  if (!store?.enable_daily_guarantee) return 0;

  const config = {
    ...DEFAULT_DAILY_GUARANTEE_CONFIG,
    ...(store.daily_guarantee_config || {}),
  };

  const key = getDayKey(dateStr);
  return Number(config[key] || 0);
}

function getWeekdayFromDate(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(utcDate.getTime())) return null;
  return utcDate.getUTCDay();
}

async function getEffectiveStaffForDate(storeId, date) {
  const weekday = getWeekdayFromDate(date);

  if (weekday === null) {
    throw new Error("Invalid date format");
  }

  const [
    { data: rosterRows, error: rosterError },
    { data: overrideRows, error: overrideError },
  ] = await Promise.all([
    supabase
      .from("staff_rosters")
      .select(`
        id,
        store_id,
        staff_id,
        weekday,
        is_working,
        display_order,
        is_active,
        staff (
          id,
          name,
          name_display,
          is_active,
          store_id
        )
      `)
      .eq("store_id", storeId)
      .eq("weekday", weekday)
      .eq("is_active", true),

    supabase
      .from("staff_shift_overrides")
      .select(`
        id,
        store_id,
        staff_id,
        override_date,
        is_working,
        display_order,
        staff (
          id,
          name,
          name_display,
          is_active,
          store_id
        )
      `)
      .eq("store_id", storeId)
      .eq("override_date", date),
  ]);

  if (rosterError) throw new Error(rosterError.message);
  if (overrideError) throw new Error(overrideError.message);

  const staffMap = new Map();

  (Array.isArray(rosterRows) ? rosterRows : []).forEach((row) => {
    const member = Array.isArray(row.staff) ? row.staff[0] : row.staff;

    if (!member) return;
    if (member.store_id !== storeId) return;
    if (member.is_active === false) return;

    staffMap.set(String(row.staff_id), {
      id: row.staff_id,
      name: member.name,
      name_display: member.name_display,
      is_working: row.is_working,
      display_order: row.display_order ?? 0,
      source: "roster",
    });
  });

  (Array.isArray(overrideRows) ? overrideRows : []).forEach((row) => {
    const member = Array.isArray(row.staff) ? row.staff[0] : row.staff;
    const existing = staffMap.get(String(row.staff_id));

    if (!member) return;
    if (member.store_id !== storeId) return;
    if (member.is_active === false) return;

    staffMap.set(String(row.staff_id), {
      id: row.staff_id,
      name: member.name,
      name_display: member.name_display,
      is_working: row.is_working,
      display_order:
        row.display_order !== null && row.display_order !== undefined
          ? row.display_order
          : existing?.display_order ?? 0,
      source: "override",
    });
  });

  return Array.from(staffMap.values())
    .filter((staff) => staff.is_working === true)
    .sort((a, b) => {
      const aOrder = a.display_order ?? 0;
      const bOrder = b.display_order ?? 0;

      if (aOrder !== bOrder) return aOrder - bOrder;

      const aName = a.name_display || a.name || "";
      const bName = b.name_display || b.name || "";
      return aName.localeCompare(bName);
    });
}

function sumPaymentRows(rows) {
  return rows.reduce(
    (acc, row) => {
      const cash = Number(row.cash || 0);
      const card = Number(row.card || 0);
      const hicaps = Number(row.hicaps || 0);
      const transfer = Number(row.transfer || 0);
      const other = Number(row.other || 0);

      acc.cash += cash;
      acc.card += card;
      acc.hicaps += hicaps;
      acc.transfer += transfer;
      acc.other += other;
      acc.total += cash + card + hicaps + transfer + other;

      return acc;
    },
    { cash: 0, card: 0, hicaps: 0, transfer: 0, other: 0, total: 0 }
  );
}

function totalRowAmount(row) {
  return (
    Number(row?.cash || 0) +
    Number(row?.card || 0) +
    Number(row?.hicaps || 0) +
    Number(row?.transfer || 0) +
    Number(row?.other || 0)
  );
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function getJobServicePrice(job) {
  return Number(job.service_price_snapshot ?? job.services?.price ?? 0);
}

function getJobServiceDuration(job) {
  return Number(job.service_duration_snapshot ?? job.services?.duration ?? 0);
}

function getJobStaffPayoutFixed(job) {
  return Number(
    job.staff_payout_snapshot ?? job.services?.staff_payout_fixed ?? 0
  );
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
      policy: null,
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
    const serviceFixedPayout = getJobStaffPayoutFixed(job);
    const policyFixedAmount = Number(policy.fixed_amount || 0);
    payout = serviceFixedPayout > 0 ? serviceFixedPayout : policyFixedAmount;
  } else if (policy.payout_type === "percent") {
    payout = (effectiveAmount * Number(policy.percent || 0)) / 100;
  } else if (policy.payout_type === "per_hour") {
    const durationMinutes = getJobServiceDuration(job);
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

    const { data: storeConfig, error: storeConfigError } = await supabase
      .from("stores")
      .select("enable_daily_guarantee, daily_guarantee_config")
      .eq("id", store.id)
      .single();

    if (storeConfigError) {
      return NextResponse.json(
        { error: storeConfigError.message },
        { status: 500 }
      );
    }

    const dailyGuarantee = getDailyGuarantee(storeConfig, date);

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select(`
        id,
        store_id,
        date,
        time,
        status,
        notes,
        customer_name,
        customer_phone,
        job_group_id,
        staff_id,
        service_id,
        service_name_snapshot,
        service_duration_snapshot,
        service_price_snapshot,
        staff_payout_snapshot,
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
      .eq("date", date)
      .order("time", { ascending: true })
      .order("id", { ascending: true });

    if (jobsError) {
      return NextResponse.json({ error: jobsError.message }, { status: 500 });
    }

    const safeJobs = Array.isArray(jobs) ? jobs : [];

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
        .select("*")
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
          transfer,
          other,
          transaction_type,
          status,
          parent_payment_id,
          notes,
          staff_note,
          reference_code,
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

    const paymentRowsByJobId = new Map();
    activePaymentRows.forEach((row) => {
      if (row.job_id !== null && row.job_id !== undefined) {
        paymentRowsByJobId.set(String(row.job_id), row);
      }
    });

    const paymentRowsByGroupId = new Map();
    activePaymentRows.forEach((row) => {
      if (row.job_group_id !== null && row.job_group_id !== undefined) {
        paymentRowsByGroupId.set(String(row.job_group_id), row);
      }
    });

    const refundRowsByParentPaymentId = new Map();
    activeRefundRows.forEach((row) => {
      const key = String(row.parent_payment_id || "");
      const existing = refundRowsByParentPaymentId.get(key) || [];
      existing.push(row);
      refundRowsByParentPaymentId.set(key, existing);
    });

    const totalJobs = safeJobs.length;
    const paidJobs = safeJobs.filter((job) => job.status === "paid").length;
    const pendingJobs = safeJobs.filter((job) => job.status === "pending").length;
    const cancelledJobs = safeJobs.filter(
      (job) => job.status === "cancelled"
    ).length;
    const noShowJobs = safeJobs.filter((job) => job.status === "no_show").length;

    const outstanding = safeJobs
      .filter((job) => job.status === "pending")
      .reduce((sum, job) => sum + getJobServicePrice(job), 0);

    const netRevenue =
      paymentTotals.total +
      depositTotals.total +
      cancellationFeeTotals.total -
      refundTotals.total;

    const staffMap = new Map();

    const workingStaff = await getEffectiveStaffForDate(store.id, date);

    workingStaff.forEach((staff) => {
      staffMap.set(String(staff.id), {
        staff_id: staff.id,
        staff_name: staff.name_display || staff.name || "Unknown staff",
        policy_name: "No policy",
        paid_jobs_count: 0,
        fully_refunded_jobs_count: 0,
        gross_sales: 0,
        refunds: 0,
        effective_sales: 0,
        calculated_payout_total: 0,
        payout_total: 0,
        daily_guarantee: dailyGuarantee,
        guarantee_top_up: 0,
      });
    });

    safeJobs.forEach((job) => {
      const staffId = job.staff?.id;
      if (!staffId) return;

      if (!staffMap.has(String(staffId))) {
        staffMap.set(String(staffId), {
          staff_id: staffId,
          staff_name: job.staff?.name_display || job.staff?.name || "Unknown staff",
          policy_name: "No policy",
          paid_jobs_count: 0,
          fully_refunded_jobs_count: 0,
          gross_sales: 0,
          refunds: 0,
          effective_sales: 0,
          calculated_payout_total: 0,
          payout_total: 0,
          daily_guarantee: dailyGuarantee,
          guarantee_top_up: 0,
        });
      }

      const entry = staffMap.get(String(staffId));

      const paymentRow =
        paymentRowsByJobId.get(String(job.id)) ||
        (job.job_group_id
          ? paymentRowsByGroupId.get(String(job.job_group_id))
          : null);

      if (!paymentRow) return;

      const refundRows =
        refundRowsByParentPaymentId.get(String(paymentRow.id)) || [];

      const result = computePayoutForJob({
        job,
        paymentRow,
        refundRows,
        policiesById,
      });

      const policyName =
        result.policy?.name ||
        policiesById.get(String(job.staff?.payout_policy_id || ""))?.name ||
        "No policy";

      entry.policy_name = policyName;
      entry.gross_sales = roundMoney(entry.gross_sales + result.paymentTotal);
      entry.refunds = roundMoney(entry.refunds + result.refundedTotal);
      entry.effective_sales = roundMoney(
        entry.effective_sales + result.effectiveAmount
      );

      if (result.reason === "fully_refunded") {
        entry.fully_refunded_jobs_count += 1;
        return;
      }

      if (result.shouldCount) {
        entry.paid_jobs_count += 1;
        entry.calculated_payout_total = roundMoney(
          entry.calculated_payout_total + result.payout
        );
      }
    });

    const staffPayouts = Array.from(staffMap.values()).map((staff) => {
      const calculated = roundMoney(staff.calculated_payout_total);

      let final = calculated;
      let topUp = 0;

      if (storeConfig?.enable_daily_guarantee) {
        final = Math.max(calculated, staff.daily_guarantee);
        topUp = roundMoney(final - calculated);
      }

      return {
        ...staff,
        calculated_payout_total: calculated,
        payout_total: roundMoney(final),
        guarantee_top_up: topUp,
      };
    });

    const totalStaffPayout = roundMoney(
      staffPayouts.reduce((sum, staff) => sum + Number(staff.payout_total || 0), 0)
    );

    const storeKeeps = roundMoney(netRevenue - totalStaffPayout);

    return NextResponse.json({
      date,
      dailyGuarantee,
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
        transfer: roundMoney(
          paymentTotals.transfer +
            depositTotals.transfer +
            cancellationFeeTotals.transfer -
            refundTotals.transfer
        ),
        other: roundMoney(
          paymentTotals.other +
            depositTotals.other +
            cancellationFeeTotals.other -
            refundTotals.other
        ),
      },
      transactions: {
        payments: {
          total: roundMoney(paymentTotals.total),
          cash: roundMoney(paymentTotals.cash),
          card: roundMoney(paymentTotals.card),
          hicaps: roundMoney(paymentTotals.hicaps),
          transfer: roundMoney(paymentTotals.transfer),
          other: roundMoney(paymentTotals.other),
        },
        refunds: {
          total: roundMoney(refundTotals.total),
          cash: roundMoney(refundTotals.cash),
          card: roundMoney(refundTotals.card),
          hicaps: roundMoney(refundTotals.hicaps),
          transfer: roundMoney(refundTotals.transfer),
          other: roundMoney(refundTotals.other),
        },
        deposits: {
          total: roundMoney(depositTotals.total),
          cash: roundMoney(depositTotals.cash),
          card: roundMoney(depositTotals.card),
          hicaps: roundMoney(depositTotals.hicaps),
          transfer: roundMoney(depositTotals.transfer),
          other: roundMoney(depositTotals.other),
        },
        cancellationFees: {
          total: roundMoney(cancellationFeeTotals.total),
          cash: roundMoney(cancellationFeeTotals.cash),
          card: roundMoney(cancellationFeeTotals.card),
          hicaps: roundMoney(cancellationFeeTotals.hicaps),
          transfer: roundMoney(cancellationFeeTotals.transfer),
          other: roundMoney(cancellationFeeTotals.other),
        },
        voids: {
          total: roundMoney(voidTotals.total),
          cash: roundMoney(voidTotals.cash),
          card: roundMoney(voidTotals.card),
          hicaps: roundMoney(voidTotals.hicaps),
          transfer: roundMoney(voidTotals.transfer),
          other: roundMoney(voidTotals.other),
        },
      },
      staffPayouts,
      totalStaffPayout,
    });
  } catch (error) {
    console.error("GET /api/s/[slug]/end-day-summary error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}