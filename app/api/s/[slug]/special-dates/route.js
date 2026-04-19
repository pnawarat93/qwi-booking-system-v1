import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
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

    const { data, error } = await supabase
      .from("store_special_dates")
      .select(`
        id,
        created_at,
        store_id,
        special_date,
        is_closed,
        open_time,
        close_time,
        note
      `)
      .eq("store_id", store.id)
      .order("special_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (Array.isArray(data) ? data : []).map((row) => ({
      ...row,
      open_time: normalizeTime(row.open_time),
      close_time: normalizeTime(row.close_time),
    }));

    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error("GET /api/s/[slug]/special-dates error:", error);
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

    const special_date = body.special_date;
    const is_closed =
      body.is_closed === undefined ? false : Boolean(body.is_closed);
    const open_time = is_closed ? null : normalizeTime(body.open_time);
    const close_time = is_closed ? null : normalizeTime(body.close_time);
    const note = body.note?.trim() || null;

    if (!special_date) {
      return NextResponse.json(
        { error: "special_date is required" },
        { status: 400 }
      );
    }

    const payload = {
      store_id: store.id,
      special_date,
      is_closed,
      open_time,
      close_time,
      note,
    };

    const { data, error } = await supabase
      .from("store_special_dates")
      .insert(payload)
      .select(`
        id,
        created_at,
        store_id,
        special_date,
        is_closed,
        open_time,
        close_time,
        note
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ...data,
        open_time: normalizeTime(data?.open_time),
        close_time: normalizeTime(data?.close_time),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/s/[slug]/special-dates error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}