import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request) {
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
    .eq("shift_date", date)
    .eq("is_working", true)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}