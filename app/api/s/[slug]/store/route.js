import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveStoreFromParams } from "@/lib/storeResolver";

const DEFAULT_DAILY_GUARANTEE_CONFIG = {
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0,
};

function normalizeTime(value) {
  if (!value) return null;
  return String(value).substring(0, 8);
}

function normalizeDailyGuaranteeConfig(value) {
  return {
    ...DEFAULT_DAILY_GUARANTEE_CONFIG,
    ...(value || {}),
  };
}

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("stores")
      .select(`
        id,
        created_at,
        name,
        phone,
        address,
        open_time,
        close_time,
        slug,
        enable_daily_guarantee,
        daily_guarantee_config
      `)
      .eq("id", store.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ...data,
        open_time: normalizeTime(data?.open_time),
        close_time: normalizeTime(data?.close_time),
        enable_daily_guarantee: data?.enable_daily_guarantee ?? false,
        daily_guarantee_config: normalizeDailyGuaranteeConfig(
          data?.daily_guarantee_config
        ),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/s/[slug]/store error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json();

    const payload = {
      name: body.name?.trim() || store.name,
      phone: body.phone?.trim() || null,
      address: body.address?.trim() || null,
      enable_daily_guarantee: Boolean(body.enable_daily_guarantee),
      daily_guarantee_config: normalizeDailyGuaranteeConfig(
        body.daily_guarantee_config
      ),
    };

    const { data, error } = await supabase
      .from("stores")
      .update(payload)
      .eq("id", store.id)
      .select(`
        id,
        created_at,
        name,
        phone,
        address,
        open_time,
        close_time,
        slug,
        enable_daily_guarantee,
        daily_guarantee_config
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
        enable_daily_guarantee: data?.enable_daily_guarantee ?? false,
        daily_guarantee_config: normalizeDailyGuaranteeConfig(
          data?.daily_guarantee_config
        ),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH /api/s/[slug]/store error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}