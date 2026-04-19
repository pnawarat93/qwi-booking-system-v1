import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveStoreFromParams } from "@/lib/storeResolver";

function normalizeTime(value) {
  if (!value) return null;
  return String(value).substring(0, 8);
}

export async function PATCH(request, context) {
  try {
    const params = await context.params;
    const recordId = Number(params?.id);

    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    if (!recordId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();

    const payload = {
      special_date: body.special_date,
      is_closed:
        body.is_closed === undefined ? false : Boolean(body.is_closed),
      open_time:
        body.is_closed === true ? null : normalizeTime(body.open_time),
      close_time:
        body.is_closed === true ? null : normalizeTime(body.close_time),
      note: body.note?.trim() || null,
    };

    const { data, error } = await supabase
      .from("store_special_dates")
      .update(payload)
      .eq("id", recordId)
      .eq("store_id", store.id)
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
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH /api/s/[slug]/special-dates/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    const params = await context.params;
    const recordId = Number(params?.id);

    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    if (!recordId) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("store_special_dates")
      .delete()
      .eq("id", recordId)
      .eq("store_id", store.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/s/[slug]/special-dates/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}