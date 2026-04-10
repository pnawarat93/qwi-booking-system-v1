import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(request) {
  try {
    const body = await request.json();

    const staff_id = Number(body.staff_id);
    const shift_date = body.shift_date;
    const is_working = Boolean(body.is_working);

    if (!staff_id || !shift_date) {
      return NextResponse.json(
        { error: "staff_id and shift_date are required" },
        { status: 400 }
      );
    }

    const { data: existingShift, error: fetchError } = await supabase
      .from("staff_shifts")
      .select("id, staff_id, shift_date, is_working")
      .eq("staff_id", staff_id)
      .eq("shift_date", shift_date)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (existingShift) {
      const { data, error } = await supabase
        .from("staff_shifts")
        .update({ is_working })
        .eq("id", existingShift.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    const { data, error } = await supabase
      .from("staff_shifts")
      .insert({
        staff_id,
        shift_date,
        is_working,
        display_order: 999,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/staff-shifts/toggle error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}