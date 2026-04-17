import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

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

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    const { data, error } = await supabase
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
      .eq("override_date", date)
      .order("display_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/s/[slug]/staff-overrides error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json();

    const staff_id = Number(body.staff_id);
    const override_date = body.override_date;
    const is_working =
      body.is_working === undefined ? true : Boolean(body.is_working);
    const start_time = is_working ? normalizeTime(body.start_time) : null;
    const end_time = is_working ? normalizeTime(body.end_time) : null;
    const display_order =
      body.display_order === undefined || body.display_order === null || body.display_order === ""
        ? null
        : Number(body.display_order);
    const note = body.note || null;

    if (!staff_id || !override_date) {
      return NextResponse.json(
        { error: "staff_id and override_date are required" },
        { status: 400 }
      );
    }

    if (is_working && (!start_time || !end_time)) {
      return NextResponse.json(
        { error: "start_time and end_time are required when is_working is true" },
        { status: 400 }
      );
    }

    const { data: staffRow, error: staffError } = await supabase
      .from("staff")
      .select("id, store_id, is_active")
      .eq("id", staff_id)
      .eq("store_id", store.id)
      .single();

    if (staffError || !staffRow) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    const payload = {
      store_id: store.id,
      staff_id,
      override_date,
      is_working,
      start_time,
      end_time,
      display_order,
      note,
    };

    const { data, error } = await supabase
      .from("staff_shift_overrides")
      .upsert(payload, {
        onConflict: "store_id,staff_id,override_date",
      })
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
        staff (
          id,
          name,
          name_display,
          staff_code,
          is_active,
          employment_type
        )
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/s/[slug]/staff-overrides error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json();

    const staff_id = Number(body.staff_id);
    const override_date = body.override_date;

    if (!staff_id || !override_date) {
      return NextResponse.json(
        { error: "staff_id and override_date are required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("staff_shift_overrides")
      .delete()
      .eq("store_id", store.id)
      .eq("staff_id", staff_id)
      .eq("override_date", override_date);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/s/[slug]/staff-overrides error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}