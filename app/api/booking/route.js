import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request) {
  const body = await request.json();
  const { data, error } = await supabase.from('jobs').insert([body]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: "Booking created successfully", data }, { status: 201 });
 }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('*, services(name, duration), users(name)')
    .eq('date', date)
    .neq('status', 'Cancelled');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}