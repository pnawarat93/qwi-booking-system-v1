import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

function normalizeTime(value) {
  if (!value) return null;
  return String(value).substring(0, 8);
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const weekdayParam = searchParams.get("weekday");

    let query = supabase
      .from("staff_rosters")
      .select(`
        id,
        created_at,
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
          employment_type
        )
      `)
      .eq("store_id", store.id)
      .order("weekday", { ascending: true })
      .order("display_order", { ascending: true });

    if (weekdayParam !== null) {
      query = query.eq("weekday", Number(weekdayParam));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/s/[slug]/staff-rosters error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : null;

    if (!rows) {
      return NextResponse.json(
        { error: "rows array is required" },
        { status: 400 }
      );
    }

    const normalizedRows = rows.map((row) => {
      const staff_id = Number(row.staff_id);
      const weekday = Number(row.weekday);
      const is_working =
        row.is_working === undefined ? true : Boolean(row.is_working);

      if (!staff_id || Number.isNaN(weekday) || weekday < 0 || weekday > 6) {
        throw new Error("Each row requires valid staff_id and weekday");
      }

      return {
        store_id: store.id,
        staff_id,
        weekday,
        is_working,
        start_time: is_working ? normalizeTime(row.start_time) : null,
        end_time: is_working ? normalizeTime(row.end_time) : null,
        display_order: toNullableNumber(row.display_order) ?? 0,
        note: row.note || null,
        is_active: row.is_active === undefined ? true : Boolean(row.is_active),
      };
    });

    const uniqueStaffIds = [...new Set(normalizedRows.map((row) => row.staff_id))];

    if (uniqueStaffIds.length > 0) {
      const { data: staffRows, error: staffError } = await supabase
        .from("staff")
        .select("id")
        .eq("store_id", store.id)
        .in("id", uniqueStaffIds);

      if (staffError) {
        return NextResponse.json({ error: staffError.message }, { status: 500 });
      }

      const validStaffIds = new Set((staffRows || []).map((row) => row.id));

      const invalidStaff = uniqueStaffIds.filter((id) => !validStaffIds.has(id));
      if (invalidStaff.length > 0) {
        return NextResponse.json(
          { error: "Some staff_id values are invalid for this store" },
          { status: 400 }
        );
      }
    }

    const incomingKeys = new Set(
      normalizedRows.map((row) => `${row.staff_id}-${row.weekday}`)
    );

    const { data: existingRows, error: existingError } = await supabase
      .from("staff_rosters")
      .select("id, staff_id, weekday")
      .eq("store_id", store.id);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const rowsToDelete = (existingRows || [])
      .filter((row) => !incomingKeys.has(`${row.staff_id}-${row.weekday}`))
      .map((row) => row.id);

    if (rowsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("staff_rosters")
        .delete()
        .eq("store_id", store.id)
        .in("id", rowsToDelete);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    if (normalizedRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("staff_rosters")
        .upsert(normalizedRows, {
          onConflict: "store_id,staff_id,weekday",
        });

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }
    }

    const { data: refreshedRows, error: refreshError } = await supabase
      .from("staff_rosters")
      .select(`
        id,
        created_at,
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
          employment_type
        )
      `)
      .eq("store_id", store.id)
      .order("weekday", { ascending: true })
      .order("display_order", { ascending: true });

    if (refreshError) {
      return NextResponse.json({ error: refreshError.message }, { status: 500 });
    }

    return NextResponse.json(refreshedRows || []);
  } catch (error) {
    console.error("PUT /api/s/[slug]/staff-rosters error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}