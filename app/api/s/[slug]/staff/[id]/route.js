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

    const params = await context.params;
    const staffId = Number(params?.id);

    const body = await request.json();

    const payload = {
      name: body.name_display,
      name_display: body.name_display,
      name_legal: normalizeNullableText(body.name_legal),
      staff_code: normalizeNullableText(body.staff_code),
      employment_type: body.employment_type,
      start_date: body.start_date,
      end_date: body.end_date,
      abn: normalizeNullableText(body.abn),
      tfn: normalizeNullableText(body.tfn),
      is_active: body.is_active,

      // ✅ NEW
      payout_policy_id: body.payout_policy_id || null,
    };

    const { data, error } = await supabase
      .from("staff")
      .update(payload)
      .eq("id", staffId)
      .eq("store_id", store.id)
      .select(STAFF_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PATCH staff error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}