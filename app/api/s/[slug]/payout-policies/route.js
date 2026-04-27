import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("store_payout_policies")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("GET payout policies error:", error);
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

    const payload = {
      store_id: store.id,
      name: body.name || "New Policy",
      payout_type: body.payout_type || "fixed_per_job",
      fixed_amount: body.fixed_amount || 0,
      percent: body.percent || 0,
      hourly_rate: body.hourly_rate || 0,
      refund_behavior: body.refund_behavior || "normal",
      is_active: true,
    };

    const { data, error } = await supabase
      .from("store_payout_policies")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST payout policy error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}