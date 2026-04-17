import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveStoreFromParams } from "@/lib/storeResolver";

function getWeekdayFromDate(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(utcDate.getTime())) return null;
  return utcDate.getUTCDay(); // 0 = Sunday ... 6 = Saturday
}

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "date is required" },
        { status: 400 }
      );
    }

    const weekday = getWeekdayFromDate(date);

    if (weekday === null) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // 1) Check special date override first
    const { data: specialDateRow, error: specialDateError } = await supabase
      .from("store_special_dates")
      .select(`
        id,
        store_id,
        special_date,
        is_closed,
        open_time,
        close_time,
        note
      `)
      .eq("store_id", store.id)
      .eq("special_date", date)
      .maybeSingle();

    if (specialDateError) {
      return NextResponse.json(
        { error: specialDateError.message },
        { status: 500 }
      );
    }

    if (specialDateRow) {
      return NextResponse.json(
        {
          store_id: store.id,
          date,
          weekday,
          is_open: !specialDateRow.is_closed,
          open_time: specialDateRow.is_closed
            ? null
            : specialDateRow.open_time,
          close_time: specialDateRow.is_closed
            ? null
            : specialDateRow.close_time,
          source: "special_date",
          note: specialDateRow.note || null,
        },
        { status: 200 }
      );
    }

    // 2) Fallback to weekly business hours
    const { data: weeklyRow, error: weeklyError } = await supabase
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
      .eq("store_id", store.id)
      .eq("weekday", weekday)
      .maybeSingle();

    if (weeklyError) {
      return NextResponse.json(
        { error: weeklyError.message },
        { status: 500 }
      );
    }

    if (!weeklyRow) {
      return NextResponse.json(
        {
          store_id: store.id,
          date,
          weekday,
          is_open: false,
          open_time: null,
          close_time: null,
          source: "none",
          note: "No business hours configured for this day",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        store_id: store.id,
        date,
        weekday,
        is_open: weeklyRow.is_open,
        open_time: weeklyRow.is_open ? weeklyRow.open_time : null,
        close_time: weeklyRow.is_open ? weeklyRow.close_time : null,
        source: "weekly",
        note: weeklyRow.note || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/s/[slug]/business-hours error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}