import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveStoreFromParams } from "@/lib/storeResolver";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStoreJson(payload, options = {}) {
  return NextResponse.json(payload, {
    ...options,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      ...(options.headers || {}),
    },
  });
}

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return noStoreJson({ error: "Store not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return noStoreJson({ error: "date is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("store_days")
      .select("*")
      .eq("store_id", store.id)
      .eq("day_date", date)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return noStoreJson({ error: error.message }, { status: 500 });
    }

    return noStoreJson(
      {
        store_id: store.id,
        date,
        store_day: data || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/s/[slug]/store-day error:", error);
    return noStoreJson({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return noStoreJson({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json();
    const { day_date, start_till = 0, opening_note = null } = body;

    if (!day_date) {
      return noStoreJson({ error: "day_date is required" }, { status: 400 });
    }

    const startTillNumber = Number(start_till);

    if (!Number.isFinite(startTillNumber) || startTillNumber < 0) {
      return noStoreJson(
        { error: "start_till must be a valid number greater than or equal to 0" },
        { status: 400 }
      );
    }

    const { data: existingDay, error: existingError } = await supabase
      .from("store_days")
      .select("*")
      .eq("store_id", store.id)
      .eq("day_date", day_date)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return noStoreJson({ error: existingError.message }, { status: 500 });
    }

    if (existingDay?.is_open) {
      return noStoreJson(
        {
          message: "This store day is already open",
          store_day: existingDay,
        },
        { status: 200 }
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
        return noStoreJson({ error: error.message }, { status: 500 });
      }

      return noStoreJson(
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
      return noStoreJson({ error: error.message }, { status: 500 });
    }

    return noStoreJson(
      {
        message: "Store day opened successfully",
        store_day: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/s/[slug]/store-day error:", error);
    return noStoreJson({ error: "Server error" }, { status: 500 });
  }
}