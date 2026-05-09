import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveStoreFromParams } from "@/lib/storeResolver";

function getWeekdayFromDate(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(utcDate.getTime())) return null;
  return utcDate.getUTCDay(); // 0 = Sunday ... 6 = Saturday
}

function normalizeTime(value) {
  if (!value) return null;
  return String(value).substring(0, 8);
}

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const includeAll = searchParams.get("include_all") === "true";

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    const weekday = getWeekdayFromDate(date);

    if (weekday === null) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
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
          start_time,
          end_time,
          display_order,
          note,
          is_active,
          staff (
            id,
            name,
            name_display,
            staff_code,
            is_active,
            store_id
          )
        `)
        .eq("store_id", store.id)
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
          start_time,
          end_time,
          display_order,
          note,
          daily_guarantee_override,
          staff (
            id,
            name,
            name_display,
            staff_code,
            is_active,
            store_id
          )
        `)
        .eq("store_id", store.id)
        .eq("override_date", date),
    ]);

    if (rosterError) {
      return NextResponse.json({ error: rosterError.message }, { status: 500 });
    }

    if (overrideError) {
      return NextResponse.json(
        { error: overrideError.message },
        { status: 500 }
      );
    }

    const rosterMap = new Map();

    (Array.isArray(rosterRows) ? rosterRows : []).forEach((row) => {
      const member = Array.isArray(row.staff) ? row.staff[0] : row.staff;

      if (!member) return;
      if (member.store_id !== store.id) return;
      if (member.is_active === false) return;

      rosterMap.set(String(row.staff_id), {
        staff_id: row.staff_id,
        name: member.name,
        name_display: member.name_display,
        staff_code: member.staff_code,
        is_working: row.is_working,
        start_time: normalizeTime(row.start_time),
        end_time: normalizeTime(row.end_time),
        display_order: row.display_order ?? 0,
        note: row.note || null,
        daily_guarantee_override: null,
        source: "roster",
        roster_id: row.id,
        override_id: null,
      });
    });

    const mergedMap = new Map(rosterMap);

    (Array.isArray(overrideRows) ? overrideRows : []).forEach((row) => {
      const member = Array.isArray(row.staff) ? row.staff[0] : row.staff;
      const existing = mergedMap.get(String(row.staff_id));

      if (!member) return;
      if (member.store_id !== store.id) return;
      if (member.is_active === false) return;

      mergedMap.set(String(row.staff_id), {
        staff_id: row.staff_id,
        name: member.name,
        name_display: member.name_display,
        staff_code: member.staff_code,
        is_working: row.is_working,
        start_time: row.is_working ? normalizeTime(row.start_time) : null,
        end_time: row.is_working ? normalizeTime(row.end_time) : null,
        display_order:
          row.display_order !== null && row.display_order !== undefined
            ? row.display_order
            : existing?.display_order ?? 0,
        note: row.note || existing?.note || null,
        daily_guarantee_override:
          row.daily_guarantee_override !== null &&
          row.daily_guarantee_override !== undefined
            ? Number(row.daily_guarantee_override)
            : null,
        source: "override",
        roster_id: existing?.roster_id ?? null,
        override_id: row.id,
      });
    });

    let effectiveStaff = Array.from(mergedMap.values());

    if (!includeAll) {
      effectiveStaff = effectiveStaff.filter(
        (row) => row.is_working === true
      );
    }

    effectiveStaff.sort((a, b) => {
      if (a.is_working !== b.is_working) {
        return a.is_working ? -1 : 1;
      }

      const aOrder = a.display_order ?? 0;
      const bOrder = b.display_order ?? 0;

      if (aOrder !== bOrder) return aOrder - bOrder;

      const aName = a.name_display || a.name || "";
      const bName = b.name_display || b.name || "";

      return aName.localeCompare(bName);
    });

    return NextResponse.json(
      {
        store_id: store.id,
        date,
        weekday,
        count: effectiveStaff.length,
        items: effectiveStaff,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/s/[slug]/effective-staff error:", error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}