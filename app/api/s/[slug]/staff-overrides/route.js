import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveStoreFromParams } from "@/lib/storeResolver";

function normalizeTime(value) {
  if (!value) return null;
  return String(value).substring(0, 8);
}

function normalizeGuarantee(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export async function POST(request, context) {
  try {
    const store = await resolveStoreFromParams(
      context.params
    );

    if (!store) {
      return NextResponse.json(
        { error: "Store not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const {
      staff_id,
      override_date,
      is_working,
      start_time,
      end_time,
      display_order,
      note,
      daily_guarantee_override,
    } = body;

    if (!staff_id) {
      return NextResponse.json(
        { error: "staff_id is required" },
        { status: 400 }
      );
    }

    if (!override_date) {
      return NextResponse.json(
        { error: "override_date is required" },
        { status: 400 }
      );
    }

    const normalizedGuarantee =
      normalizeGuarantee(
        daily_guarantee_override
      );

    const payload = {
      store_id: store.id,

      staff_id,

      override_date,

      is_working:
        is_working === undefined
          ? true
          : Boolean(is_working),

      start_time:
        is_working === false
          ? null
          : normalizeTime(start_time),

      end_time:
        is_working === false
          ? null
          : normalizeTime(end_time),

      display_order:
        display_order !== undefined &&
        display_order !== null
          ? Number(display_order)
          : 0,

      note: note || null,

      daily_guarantee_override:
        normalizedGuarantee,
    };

    const { data: existingOverride, error: existingError } =
      await supabase
        .from("staff_shift_overrides")
        .select("id")
        .eq("store_id", store.id)
        .eq("staff_id", staff_id)
        .eq("override_date", override_date)
        .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    let result;
    let saveError;

    if (existingOverride?.id) {
      const response = await supabase
        .from("staff_shift_overrides")
        .update(payload)
        .eq("id", existingOverride.id)
        .select("*")
        .single();

      result = response.data;
      saveError = response.error;
    } else {
      const response = await supabase
        .from("staff_shift_overrides")
        .insert(payload)
        .select("*")
        .single();

      result = response.data;
      saveError = response.error;
    }

    if (saveError) {
      return NextResponse.json(
        { error: saveError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    console.error(
      "POST /api/s/[slug]/staff-overrides error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Server error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(
      context.params
    );

    if (!store) {
      return NextResponse.json(
        { error: "Store not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(
      request.url
    );

    const override_date =
      searchParams.get("date");

    if (!override_date) {
      return NextResponse.json(
        {
          error:
            "date query param is required",
        },
        { status: 400 }
      );
    }

    const { data, error } =
      await supabase
        .from("staff_shift_overrides")
        .select(`
          *,
          staff (
            id,
            name,
            name_display,
            staff_code
          )
        `)
        .eq("store_id", store.id)
        .eq(
          "override_date",
          override_date
        )
        .order("display_order", {
          ascending: true,
        });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      Array.isArray(data)
        ? data
        : [],
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "GET /api/s/[slug]/staff-overrides error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Server error",
      },
      { status: 500 }
    );
  }
}