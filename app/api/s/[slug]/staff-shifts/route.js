import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

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

    const { data, error } = await supabase
      .from("staff_shifts")
      .select(`
        id,
        store_id,
        staff_id,
        shift_date,
        start_time,
        end_time,
        is_working,
        display_order,
        notes,
        users (
          id,
          name,
          name_display,
          staff_code,
          role,
          is_active,
          employment_type
        )
      `)
      .eq("store_id", store.id)
      .eq("shift_date", date)
      .order("display_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/s/[slug]/staff-shifts error:", error);
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
    const shift_date = body.shift_date;
    const start_time = body.start_time || null;
    const end_time = body.end_time || null;
    const display_order = Number(body.display_order || 0);
    const notes = body.notes || "";

    if (!staff_id || !shift_date) {
      return NextResponse.json(
        { error: "staff_id and shift_date are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("staff_shifts")
      .upsert(
        {
          staff_id,
          shift_date,
          start_time,
          end_time,
          is_working: true,
          display_order,
          notes,
          store_id: store.id,
        },
        {
          onConflict: "staff_id,shift_date",
        }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/s/[slug]/staff-shifts error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
