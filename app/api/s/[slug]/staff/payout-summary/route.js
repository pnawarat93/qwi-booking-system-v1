import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

/* =========================
   DAILY GUARANTEE
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
  const d = new Date(dateStr);
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[d.getDay()];
}

function getDailyGuarantee(store, dateStr) {
  if (!store?.enable_daily_guarantee) return 0;

  const config = {
    ...DEFAULT_DAILY_GUARANTEE_CONFIG,
    ...(store.daily_guarantee_config || {}),
  };

  return Number(config[getDayKey(dateStr)] || 0);
}

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const activeOnly = searchParams.get("activeOnly") === "true";
    const abnOnly = searchParams.get("abnOnly") === "true";

    if (!from || !to) {
      return NextResponse.json(
        { error: "from and to are required" },
        { status: 400 }
      );
    }

    if (!isValidDate(from) || !isValidDate(to)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    /* =========================
       GET STORE CONFIG
    ========================= */

    const { data: storeConfig } = await supabase
      .from("stores")
      .select("enable_daily_guarantee, daily_guarantee_config")
      .eq("id", store.id)
      .single();

    /* =========================
       GET DATA
    ========================= */

    const [{ data: staffList }, { data: rows }] =
      await Promise.all([
        supabase
          .from("staff")
          .select(`
            id,
            name,
            name_display,
            staff_code,
            is_active,
            employment_type,
            abn
          `)
          .eq("store_id", store.id),

        supabase
          .from("store_day_report_rows")
          .select(`
            day_date,
            staff_id,
            staff_name,
            duration,
            staff_payout
          `)
          .eq("store_id", store.id)
          .gte("day_date", from)
          .lte("day_date", to),
      ]);

    /* =========================
       GROUP BY STAFF + DAY
    ========================= */

    const staffDayMap = new Map();

    (rows || []).forEach((row) => {
      if (!row.staff_id) return;

      const key = `${row.staff_id}_${row.day_date}`;

      if (!staffDayMap.has(key)) {
        staffDayMap.set(key, {
          staff_id: row.staff_id,
          staff_name: row.staff_name,
          day_date: row.day_date,
          payout: 0,
          minutes: 0,
          jobs: 0,
        });
      }

      const entry = staffDayMap.get(key);

      entry.payout += Number(row.staff_payout || 0);
      entry.minutes += Number(row.duration || 0);
      entry.jobs += 1;
    });

    /* =========================
       APPLY GUARANTEE PER DAY
    ========================= */

    const staffMap = new Map();

    staffDayMap.forEach((day) => {
      const guarantee = getDailyGuarantee(storeConfig, day.day_date);

      let final = day.payout;

      if (storeConfig?.enable_daily_guarantee) {
        final = Math.max(day.payout, guarantee);
      }

      if (!staffMap.has(day.staff_id)) {
        staffMap.set(day.staff_id, {
          staff_id: day.staff_id,
          staff_name: day.staff_name,
          jobs_count: 0,
          total_minutes: 0,
          payout_total: 0,
        });
      }

      const staff = staffMap.get(day.staff_id);

      staff.jobs_count += day.jobs;
      staff.total_minutes += day.minutes;
      staff.payout_total += final;
    });

    let payoutRows = Array.from(staffMap.values());

    /* =========================
       FILTER
    ========================= */

    const staffLookup = new Map(
      (staffList || []).map((s) => [s.id, s])
    );

    payoutRows = payoutRows.map((row) => ({
      ...row,
      ...staffLookup.get(row.staff_id),
    }));

    if (activeOnly) {
      payoutRows = payoutRows.filter((r) => r.is_active);
    }

    if (abnOnly) {
      payoutRows = payoutRows.filter((r) => r.abn);
    }

    /* =========================
       SUMMARY
    ========================= */

    const summary = payoutRows.reduce(
      (acc, row) => {
        acc.total_staff += 1;
        acc.total_jobs += row.jobs_count;
        acc.total_minutes += row.total_minutes;
        acc.total_payout += row.payout_total;
        return acc;
      },
      {
        from,
        to,
        total_staff: 0,
        total_jobs: 0,
        total_minutes: 0,
        total_payout: 0,
      }
    );

    return NextResponse.json({
      summary,
      rows: payoutRows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}