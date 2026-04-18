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

export async function PATCH(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const params = await context.params;
    const staffId = Number(params?.id);

    if (!staffId) {
      return NextResponse.json({ error: "Invalid staff id" }, { status: 400 });
    }

    const body = await request.json();

    const name_display = String(body.name_display || "").trim();
    const name_legal = normalizeNullableText(body.name_legal);
    const staff_code = normalizeNullableText(body.staff_code);
    const employment_type = String(body.employment_type || "temporary").trim();
    const start_date = body.start_date || null;
    const end_date = body.end_date || null;
    const abn = normalizeNullableText(body.abn);
    const tfn = normalizeNullableText(body.tfn);
    const is_active =
      typeof body.is_active === "boolean" ? body.is_active : true;

    if (!name_display) {
      return NextResponse.json(
        { error: "name_display is required" },
        { status: 400 }
      );
    }

    const payload = {
      name: name_legal || name_display,
      name_display,
      name_legal,
      staff_code,
      employment_type,
      start_date,
      end_date,
      abn,
      tfn,
      is_active,
    };

    const { data, error } = await supabase
      .from("staff")
      .update(payload)
      .eq("id", staffId)
      .eq("store_id", store.id)
      .select(STAFF_SELECT)
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This staff code is already in use." },
          { status: 400 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH /api/s/[slug]/staff/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}