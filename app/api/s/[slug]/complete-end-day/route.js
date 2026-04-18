import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

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

function timeToMinutes(timeString) {
  if (!timeString) return null;
  const safeTime = String(timeString).substring(0, 5);
  const [hours, minutes] = safeTime.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:00`;
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

export async function POST(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const date = body?.date;
    const endTillRaw = body?.end_till;
    const closingNote = body?.closing_note || null;

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const endTill =
      endTillRaw === undefined || endTillRaw === null || endTillRaw === ""
        ? null
        : Number(endTillRaw);

    if (endTill !== null && (!Number.isFinite(endTill) || endTill < 0)) {
      return NextResponse.json(
        { error: "end_till must be a valid non-negative number" },
        { status: 400 }
      );
    }

    const [
      { data: storeDay, error: storeDayError },
      { data: jobs, error: jobsError },
    ] = await Promise.all([
      supabase
        .from("store_days")
        .select(`
          id,
          store_id,
          day_date,
          is_open,
          opened_at,
          closed_at,
          start_till,
          end_till,
          opening_note,
          closing_note
        `)
        .eq("store_id", store.id)
        .eq("day_date", date)
        .maybeSingle(),

      supabase
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
        .order("id", { ascending: true }),
    ]);

    if (storeDayError) {
      return NextResponse.json({ error: storeDayError.message }, { status: 500 });
    }

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

    const totalJobs = safeJobs.length;
    const paidJobs = safeJobs.filter((job) => job.status === "paid").length;
    const pendingJobs = safeJobs.filter((job) => job.status === "pending").length;
    const cancelledJobs = safeJobs.filter((job) => job.status === "cancelled").length;
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

    const staffPayoutMap = new Map();

    safeJobs.forEach((job) => {
      const staffId = job.staff?.id;
      if (!staffId) return;

      if (!staffPayoutMap.has(String(staffId))) {
        staffPayoutMap.set(String(staffId), {
          staff_id: staffId,
          staff_name: job.staff?.name_display || job.staff?.name || "Unknown staff",
          payout_total: 0,
        });
      }
    });

    const rowPayloads = safeJobs.map((job, index) => {
      const paymentRow =
        paymentRowsByJobId.get(String(job.id)) ||
        (job.job_group_id
          ? paymentRowsByGroupId.get(String(job.job_group_id))
          : null);

      const refundRows = paymentRow
        ? refundRowsByParentPaymentId.get(String(paymentRow.id)) || []
        : [];

      const payoutResult = paymentRow
        ? computePayoutForJob({
            job,
            paymentRow,
            refundRows,
            policiesById,
          })
        : {
            paymentTotal: 0,
            refundedTotal: 0,
            effectiveAmount: 0,
            payout: 0,
          };

      const startMinutes = timeToMinutes(job.time);
      const duration = Number(job.services?.duration || 0);
      const endMinutes =
        startMinutes !== null && duration > 0 ? startMinutes + duration : null;

      const staffName = job.staff?.name_display || job.staff?.name || "";

      const paymentCash = Number(paymentRow?.cash || 0);
      const paymentCard = Number(paymentRow?.card || 0);
      const paymentHicaps = Number(paymentRow?.hicaps || 0);
      const paymentTransfer = Number(paymentRow?.transfer || 0);
      const paymentOther = Number(paymentRow?.other || 0);

      if (job.staff?.id && payoutResult.payout > 0) {
        const entry = staffPayoutMap.get(String(job.staff.id));
        if (entry) {
          entry.payout_total = roundMoney(
            Number(entry.payout_total || 0) + Number(payoutResult.payout || 0)
          );
        }
      }

      return {
        store_id: store.id,
        day_date: date,
        job_id: job.id,
        job_group_id: job.job_group_id || null,
        row_order: index + 1,
        customer_name: job.customer_name || "",
        service_name: job.services?.name || "",
        start_time: job.time ? `${String(job.time).substring(0, 8)}` : null,
        end_time: endMinutes !== null ? minutesToTime(endMinutes) : null,
        duration: duration || 0,
        status: job.status || "",
        staff_id: job.staff?.id || null,
        staff_name: staffName,
        service_price: roundMoney(job.services?.price || 0),
        cash: roundMoney(paymentCash),
        card: roundMoney(paymentCard),
        hicaps: roundMoney(paymentHicaps),
        transfer: roundMoney(paymentTransfer),
        other: roundMoney(paymentOther),
        payment_total: roundMoney(payoutResult.paymentTotal || 0),
        refund_total: roundMoney(payoutResult.refundedTotal || 0),
        effective_total: roundMoney(payoutResult.effectiveAmount || 0),
        staff_payout: roundMoney(payoutResult.payout || 0),
        payment_staff_note: paymentRow?.staff_note || null,
        payment_reference_code: paymentRow?.reference_code || null,
        notes: job.notes || null,
      };
    });

    const totalStaffPayout = roundMoney(
      Array.from(staffPayoutMap.values()).reduce(
        (sum, row) => sum + Number(row.payout_total || 0),
        0
      )
    );

    const storeKeeps = roundMoney(netRevenue - totalStaffPayout);

    const startTill = Number(storeDay?.start_till || 0);
    const finalEndTill =
      endTill !== null ? endTill : Number(storeDay?.end_till || 0);

    const reportPayload = {
      store_id: store.id,
      day_date: date,
      store_day_id: storeDay?.id || null,
      start_till: roundMoney(startTill),
      end_till: roundMoney(finalEndTill),
      total_jobs: totalJobs,
      paid_jobs: paidJobs,
      pending_jobs: pendingJobs,
      cancelled_jobs: cancelledJobs,
      no_show_jobs: noShowJobs,
      net_revenue: roundMoney(netRevenue),
      total_staff_payout: roundMoney(totalStaffPayout),
      store_keeps: roundMoney(storeKeeps),
      cash_total: roundMoney(
        paymentTotals.cash +
          depositTotals.cash +
          cancellationFeeTotals.cash -
          refundTotals.cash
      ),
      card_total: roundMoney(
        paymentTotals.card +
          depositTotals.card +
          cancellationFeeTotals.card -
          refundTotals.card
      ),
      hicaps_total: roundMoney(
        paymentTotals.hicaps +
          depositTotals.hicaps +
          cancellationFeeTotals.hicaps -
          refundTotals.hicaps
      ),
      transfer_total: roundMoney(
        paymentTotals.transfer +
          depositTotals.transfer +
          cancellationFeeTotals.transfer -
          refundTotals.transfer
      ),
      other_total: roundMoney(
        paymentTotals.other +
          depositTotals.other +
          cancellationFeeTotals.other -
          refundTotals.other
      ),
      outstanding: roundMoney(outstanding),
      payments_total: roundMoney(paymentTotals.total),
      refunds_total: roundMoney(refundTotals.total),
      deposits_total: roundMoney(depositTotals.total),
      cancellation_fees_total: roundMoney(cancellationFeeTotals.total),
      voids_total: roundMoney(voidTotals.total),
      closed_at: new Date().toISOString(),
      notes: closingNote,
    };

    const { data: reportRow, error: reportError } = await supabase
      .from("store_day_reports")
      .upsert(reportPayload, {
        onConflict: "store_id,day_date",
      })
      .select()
      .single();

    if (reportError) {
      return NextResponse.json({ error: reportError.message }, { status: 500 });
    }

    const { error: deleteRowsError } = await supabase
      .from("store_day_report_rows")
      .delete()
      .eq("store_day_report_id", reportRow.id);

    if (deleteRowsError) {
      return NextResponse.json(
        { error: deleteRowsError.message },
        { status: 500 }
      );
    }

    if (rowPayloads.length > 0) {
      const rowsToInsert = rowPayloads.map((row) => ({
        ...row,
        store_day_report_id: reportRow.id,
      }));

      const { error: insertRowsError } = await supabase
        .from("store_day_report_rows")
        .insert(rowsToInsert);

      if (insertRowsError) {
        return NextResponse.json(
          { error: insertRowsError.message },
          { status: 500 }
        );
      }
    }

    if (storeDay?.id) {
      const { error: updateStoreDayError } = await supabase
        .from("store_days")
        .update({
          is_open: false,
          closed_at: new Date().toISOString(),
          end_till: finalEndTill,
          closing_note: closingNote,
        })
        .eq("id", storeDay.id)
        .eq("store_id", store.id);

      if (updateStoreDayError) {
        return NextResponse.json(
          { error: updateStoreDayError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        report_id: reportRow.id,
        date,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/s/[slug]/complete-end-day error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}