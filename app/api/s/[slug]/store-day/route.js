import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
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
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("store_days")
      .select("*")
      .eq("store_id", store.id)
      .eq("day_date", date)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        store_id: store.id,
        date,
        store_day: data || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/s/[slug]/store-day error:", error);
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
    const { day_date, start_till = 0, opening_note = null } = body;

    if (!day_date) {
      return NextResponse.json(
        { error: "day_date is required" },
        { status: 400 }
      );
    }

    const startTillNumber = Number(start_till);

    if (!Number.isFinite(startTillNumber) || startTillNumber < 0) {
      return NextResponse.json(
        { error: "start_till must be a valid number greater than or equal to 0" },
        { status: 400 }
      );
    }

    const { data: existingDay, error: existingError } = await supabase
      .from("store_days")
      .select("*")
      .eq("store_id", store.id)
      .eq("day_date", day_date)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existingDay?.is_open) {
      return NextResponse.json(
        { error: "This store day is already open", store_day: existingDay },
        { status: 409 }
      );
    }

    if (existingDay) {
      const { data, error } = await supabase
        .from("store_days")
        .update({
          is_open: true,
          opened_at: new Date().toISOString(),
          start_till: startTillNumber,
          opening_note,
          closed_at: null,
          end_till: null,
          closing_note: null,
        })
        .eq("id", existingDay.id)
        .eq("store_id", store.id)
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(
        {
          message: "Store day opened successfully",
          store_day: data,
        },
        { status: 200 }
      );
    }

    const { data, error } = await supabase
      .from("store_days")
      .insert({
        store_id: store.id,
        day_date,
        is_open: true,
        opened_at: new Date().toISOString(),
        start_till: startTillNumber,
        opening_note,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: "Store day opened successfully",
        store_day: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/s/[slug]/store-day error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}