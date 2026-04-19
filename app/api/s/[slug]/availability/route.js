import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

export async function GET(request, context) {
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
    .from("jobs")
    .select("time, staff_id, service_duration_snapshot, services(duration)")
    .eq("store_id", store.id)
    .eq("date", date)
    .neq("status", "cancelled");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}