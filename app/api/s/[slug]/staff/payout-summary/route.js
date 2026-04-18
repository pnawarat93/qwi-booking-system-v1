import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
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

    if (from > to) {
      return NextResponse.json(
        { error: "from cannot be later than to" },
        { status: 400 }
      );
    }

    const [{ data: staffList, error: staffError }, { data: rows, error: rowsError }] =
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
            abn,
            tfn
          `)
          .eq("store_id", store.id)
          .order("name_display", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true }),
        supabase
          .from("store_day_report_rows")
          .select(`
            id,
            day_date,
            job_id,
            staff_id,
            staff_name,
            duration,
            staff_payout,
            status
          `)
          .eq("store_id", store.id)
          .gte("day_date", from)
          .lte("day_date", to),
      ]);

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 500 });
    }

    if (rowsError) {
      return NextResponse.json({ error: rowsError.message }, { status: 500 });
    }

    const staffMap = new Map();
    (staffList || []).forEach((member) => {
      staffMap.set(member.id, {
        staff_id: member.id,
        staff_name: member.name_display || member.name || "Unnamed staff",
        staff_code: member.staff_code || null,
        is_active: Boolean(member.is_active),
        employment_type: member.employment_type || null,
        abn: member.abn || null,
        tfn: member.tfn || null,
        jobs_count: 0,
        total_minutes: 0,
        payout_total: 0,
      });
    });

    (rows || []).forEach((row) => {
      const key = row.staff_id;
      if (!key) return;

      const existing =
        staffMap.get(key) ||
        {
          staff_id: key,
          staff_name: row.staff_name || "Unknown staff",
          staff_code: null,
          is_active: false,
          employment_type: null,
          abn: null,
          tfn: null,
          jobs_count: 0,
          total_minutes: 0,
          payout_total: 0,
        };

      existing.jobs_count += 1;
      existing.total_minutes += Number(row.duration || 0);
      existing.payout_total += Number(row.staff_payout || 0);

      if (!existing.staff_name && row.staff_name) {
        existing.staff_name = row.staff_name;
      }

      staffMap.set(key, existing);
    });

    let payoutRows = Array.from(staffMap.values());

    payoutRows = payoutRows.filter((row) => row.jobs_count > 0);

    if (activeOnly) {
      payoutRows = payoutRows.filter((row) => row.is_active);
    }

    if (abnOnly) {
      payoutRows = payoutRows.filter((row) => Boolean(row.abn));
    }

    payoutRows.sort((a, b) => a.staff_name.localeCompare(b.staff_name));

    const summary = payoutRows.reduce(
      (acc, row) => {
        acc.total_staff += 1;
        acc.total_jobs += Number(row.jobs_count || 0);
        acc.total_minutes += Number(row.total_minutes || 0);
        acc.total_payout += Number(row.payout_total || 0);
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
    console.error("GET /api/s/[slug]/staff/payout-summary error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}