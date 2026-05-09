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

function normalizeNullableDate(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function getRoleById(storeId, payoutPolicyId) {
  if (!payoutPolicyId) return null;

  const { data, error } = await supabase
    .from("store_payout_policies")
    .select("id, name, role_name, payout_type, is_active")
    .eq("store_id", storeId)
    .eq("id", payoutPolicyId)
    .single();

  if (error) return null;
  return data || null;
}

function normalizeStaffRow(row, role = null) {
  return {
    ...row,
    role_name: role?.role_name || role?.name || null,
  };
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

    if (!name_display) {
      return NextResponse.json(
        { error: "name_display is required" },
        { status: 400 }
      );
    }

    const payoutPolicyId = body.payout_policy_id
      ? Number(body.payout_policy_id)
      : null;

    if (!payoutPolicyId) {
      return NextResponse.json(
        { error: "Employment role is required" },
        { status: 400 }
      );
    }

    const role = await getRoleById(store.id, payoutPolicyId);

    if (!role) {
      return NextResponse.json(
        { error: "Selected employment role does not exist" },
        { status: 400 }
      );
    }

    const payload = {
      name: name_legal || name_display,
      name_display,
      name_legal,
      staff_code,
      employment_type,
      start_date: normalizeNullableDate(body.start_date),
      end_date: normalizeNullableDate(body.end_date),
      abn: normalizeNullableText(body.abn),
      tfn: normalizeNullableText(body.tfn),
      is_active: typeof body.is_active === "boolean" ? body.is_active : true,
      payout_policy_id: payoutPolicyId,
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

    return NextResponse.json(normalizeStaffRow(data, role));
  } catch (error) {
    console.error("PATCH /api/s/[slug]/staff/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}