import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

/* =========================
   NEW: Daily Guarantee Utils
========================= */

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
  const day = date.getDay(); // 0 = Sunday

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

/* =========================
   Existing helpers (unchanged)
========================= */

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
  return Number(job.staff_payout_snapshot ?? job.services?.staff_payout_fixed ?? 0);
}

/* =========================
   Existing payout logic
========================= */

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

/* =========================
   MAIN GET
========================= */

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

    // 👉 NEW: fetch guarantee config from DB
    const { data: storeConfig } = await supabase
      .from("stores")
      .select("enable_daily_guarantee, daily_guarantee_config")
      .eq("id", store.id)
      .single();

    const dailyGuarantee = getDailyGuarantee(storeConfig, date);

    /* =========================
       Existing logic (UNCHANGED)
    ========================= */

    const { data: jobs } = await supabase
      .from("jobs")
      .select(`
        id,
        store_id,
        date,
        status,
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
      .eq("date", date);

    const safeJobs = jobs || [];

    const policyIds = [
      ...new Set(
        safeJobs
          .map((job) => job.staff?.payout_policy_id)
          .filter(Boolean)
      ),
    ];

    let policies = [];
    if (policyIds.length > 0) {
      const { data } = await supabase
        .from("store_payout_policies")
        .select("*")
        .in("id", policyIds);

      policies = data || [];
    }

    const policiesById = new Map(
      policies.map((p) => [String(p.id), p])
    );

    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .eq("store_id", store.id);

    const activePaymentRows = (payments || []).filter(
      (r) => r.transaction_type === "payment" && r.status === "active"
    );

    const paymentRowsByJobId = new Map();
    activePaymentRows.forEach((row) => {
      paymentRowsByJobId.set(String(row.job_id), row);
    });

    const staffMap = new Map();

    safeJobs.forEach((job) => {
      const staffId = job.staff?.id;
      if (!staffId) return;

      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, {
          staff_id: staffId,
          staff_name: job.staff?.name_display || "Unknown",
          calculated_payout_total: 0,
          payout_total: 0,
          daily_guarantee: dailyGuarantee,
          guarantee_top_up: 0,
        });
      }

      const entry = staffMap.get(staffId);

      const paymentRow = paymentRowsByJobId.get(String(job.id));
      if (!paymentRow) return;

      const result = computePayoutForJob({
        job,
        paymentRow,
        refundRows: [],
        policiesById,
      });

      if (!result.shouldCount) return;

      entry.calculated_payout_total += result.payout;
    });

    /* =========================
       NEW: Apply Guarantee
    ========================= */

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
        payout_total: final,
        guarantee_top_up: topUp,
      };
    });

    const totalStaffPayout = roundMoney(
      staffPayouts.reduce((sum, s) => sum + s.payout_total, 0)
    );

    return NextResponse.json({
      date,
      dailyGuarantee,
      staffPayouts,
      totalStaffPayout,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}