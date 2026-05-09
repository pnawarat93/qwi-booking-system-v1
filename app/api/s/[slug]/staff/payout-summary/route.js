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

    const [{ data: staffList }, { data: rows }] = await Promise.all([
      supabase
        .from("staff")
        .select(`
          id,
          name,
          name_display,
          staff_code,
          is_active,
          employment_type,
          payout_policy_id,
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
          staff_payout,
          payout_role_name,
          payout_final
        `)
        .eq("store_id", store.id)
        .gte("day_date", from)
        .lte("day_date", to),
    ]);

    const staffPolicyIds = [
      ...new Set(
        (staffList || [])
          .map((staff) => staff.payout_policy_id)
          .filter(Boolean)
      ),
    ];

    let policyMap = new Map();

    if (staffPolicyIds.length > 0) {
      const { data: policies } = await supabase
        .from("store_payout_policies")
        .select("id, name, role_name")
        .eq("store_id", store.id)
        .in("id", staffPolicyIds);

      policyMap = new Map(
        (policies || []).map((policy) => [
          String(policy.id),
          policy,
        ])
      );
    }

    const staffLookup = new Map(
      (staffList || []).map((staff) => {
        const policy = staff.payout_policy_id
          ? policyMap.get(String(staff.payout_policy_id))
          : null;

        return [
          staff.id,
          {
            ...staff,
            role_name: policy?.role_name || policy?.name || null,
          },
        ];
      })
    );

    const staffMap = new Map();

    (rows || []).forEach((row) => {
      if (!row.staff_id) return;

      if (!staffMap.has(row.staff_id)) {
        const staff = staffLookup.get(row.staff_id) || {};

        staffMap.set(row.staff_id, {
          staff_id: row.staff_id,
          staff_name:
            row.staff_name ||
            staff.name_display ||
            staff.name ||
            "-",
          staff_code: staff.staff_code || "-",
          is_active: staff.is_active,
          employment_type: staff.employment_type,
          payout_policy_id: staff.payout_policy_id,
          role_name:
            row.payout_role_name ||
            staff.role_name ||
            null,
          abn: staff.abn || "",
          jobs_count: 0,
          total_minutes: 0,
          payout_total: 0,
        });
      }

      const entry = staffMap.get(row.staff_id);

      entry.jobs_count += 1;
      entry.total_minutes += Number(row.duration || 0);

      /*
        IMPORTANT:
        This summary must read from completed end-day snapshots only.
        Do not recalculate guarantee, role, service payout, refund behavior,
        or adjustments here, otherwise old reports can change after owner
        edits settings later.
      */
      entry.payout_total += Number(
        row.payout_final ?? row.staff_payout ?? 0
      );

      if (!entry.role_name && row.payout_role_name) {
        entry.role_name = row.payout_role_name;
      }
    });

    let payoutRows = Array.from(staffMap.values());

    if (activeOnly) {
      payoutRows = payoutRows.filter((row) => row.is_active);
    }

    if (abnOnly) {
      payoutRows = payoutRows.filter((row) => row.abn);
    }

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
    console.error("GET staff payout summary error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}