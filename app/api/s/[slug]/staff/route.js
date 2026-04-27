import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

const STAFF_SELECT = `
  id,
  name,
  role,
  name_display,
  name_legal,
  staff_code,
  is_active,
  start_date,
  end_date,
  abn,
  tfn,
  employment_type,
  payout_policy_id,
  store_id,
  created_at
`;

function normalizeNullableText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";

    let query = supabase
      .from("staff")
      .select(STAFF_SELECT)
      .eq("store_id", store.id)
      .order("name_display", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (status === "active") {
      query = query.eq("is_active", true);
    } else if (status === "inactive") {
      query = query.eq("is_active", false);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("GET staff error:", error);
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
      name: body.name_display,
      role: "staff",
      name_display: body.name_display,
      name_legal: normalizeNullableText(body.name_legal),
      staff_code: normalizeNullableText(body.staff_code),
      employment_type: body.employment_type || "temporary",
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      abn: normalizeNullableText(body.abn),
      tfn: normalizeNullableText(body.tfn),
      is_active: body.is_active ?? true,

      // ✅ NEW
      payout_policy_id: body.payout_policy_id || null,

      store_id: store.id,
    };

    const { data, error } = await supabase
      .from("staff")
      .insert(payload)
      .select(STAFF_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST staff error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}