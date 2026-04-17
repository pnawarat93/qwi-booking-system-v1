import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

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
      .from("store_business_hours")
      .select(`
        id,
        store_id,
        weekday,
        is_open,
        open_time,
        close_time,
        note
      `)
      .eq("store_id", store.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];

    const byWeekday = new Map(
      rows.map((row) => [
        Number(row.weekday),
        {
          id: row.id,
          store_id: row.store_id,
          weekday: Number(row.weekday),
          is_open: Boolean(row.is_open),
          open_time: normalizeTime(row.open_time),
          close_time: normalizeTime(row.close_time),
          note: row.note || null,
          source: "weekly_default",
        },
      ])
    );

    const fallbackOpenTime = normalizeTime(store.open_time) || "10:00:00";
    const fallbackCloseTime = normalizeTime(store.close_time) || "20:00:00";

    const items = WEEKDAYS.map((weekday) => {
      const found = byWeekday.get(weekday);

      if (found) return found;

      return {
        id: null,
        store_id: store.id,
        weekday,
        is_open: true,
        open_time: fallbackOpenTime,
        close_time: fallbackCloseTime,
        note: null,
        source: "store_fallback",
      };
    });

    return NextResponse.json(
      {
        store_id: store.id,
        items,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/s/[slug]/weekly-business-hours error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}