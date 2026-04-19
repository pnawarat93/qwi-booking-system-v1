import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

const SERVICE_SELECT = `
  id,
  name,
  duration,
  price,
  created_at,
  staff_payout_fixed,
  store_id,
  is_active
`;

function normalizeNumber(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

export async function PATCH(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const params = await context.params;
    const serviceId = Number(params?.id);

    if (!serviceId) {
      return NextResponse.json({ error: "Invalid service id" }, { status: 400 });
    }

    const body = await request.json();

    const name = String(body.name || "").trim();
    const duration = normalizeNumber(body.duration);
    const price = normalizeNumber(body.price);
    const staff_payout_fixed = normalizeNumber(body.staff_payout_fixed, null);
    const is_active =
      typeof body.is_active === "boolean" ? body.is_active : true;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    if (!duration || duration <= 0) {
      return NextResponse.json(
        { error: "duration must be greater than 0" },
        { status: 400 }
      );
    }

    if (price === null || price < 0) {
      return NextResponse.json(
        { error: "price must be 0 or greater" },
        { status: 400 }
      );
    }

    const payload = {
      name,
      duration,
      price,
      staff_payout_fixed,
      is_active,
    };

    const { data, error } = await supabase
      .from("services")
      .update(payload)
      .eq("id", serviceId)
      .eq("store_id", store.id)
      .select(SERVICE_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/s/[slug]/services/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}