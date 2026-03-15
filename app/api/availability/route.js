import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  // Fetch bookings for the date, joining with services to get duration
  const { data, error } = await supabase
    .from('jobs')
    .select('time, services(duration)')
    .eq('date', date)
    .neq('status', 'cancelled');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}