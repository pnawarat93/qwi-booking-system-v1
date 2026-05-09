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

async function getRoleById(storeId, payoutPolicyId) {
  if (!payoutPolicyId) return null;

  const { data, error } = await supabase
    .from("store_payout_policies")
    .select(`
      id,
      name,
      role_name,
      payout_type,
      is_active
    `)
    .eq("store_id", storeId)
    .eq("id", payoutPolicyId)
    .single();

  if (error) {
    return null;
  }

  return data || null;
}

function normalizeStaffRow(row, role = null) {
  return {
    ...row,

    role_name:
      role?.role_name ||
      role?.name ||
      null,
  };
}

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json(
        { error: "Store not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);

    const status =
      searchParams.get("status") || "active";

    let query = supabase
      .from("staff")
      .select(STAFF_SELECT)
      .eq("store_id", store.id)
      .order("name_display", {
        ascending: true,
        nullsFirst: false,
      })
      .order("name", {
        ascending: true,
      });

    if (status === "active") {
      query = query.eq("is_active", true);
    } else if (status === "inactive") {
      query = query.eq("is_active", false);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const payoutPolicyIds = [
      ...new Set(
        (data || [])
          .map((row) => row.payout_policy_id)
          .filter(Boolean)
      ),
    ];

    let rolesMap = new Map();

    if (payoutPolicyIds.length > 0) {
      const {
        data: roles,
        error: rolesError,
      } = await supabase
        .from("store_payout_policies")
        .select(`
          id,
          name,
          role_name
        `)
        .in("id", payoutPolicyIds);

      if (!rolesError && Array.isArray(roles)) {
        rolesMap = new Map(
          roles.map((role) => [
            String(role.id),
            role,
          ])
        );
      }
    }

    const normalized = (data || []).map((row) =>
      normalizeStaffRow(
        row,
        row.payout_policy_id
          ? rolesMap.get(
              String(row.payout_policy_id)
            )
          : null
      )
    );

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("GET staff error:", error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);

    if (!store) {
      return NextResponse.json(
        { error: "Store not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const displayName = String(
      body.name_display || ""
    ).trim();

    if (!displayName) {
      return NextResponse.json(
        {
          error: "Display name is required",
        },
        { status: 400 }
      );
    }

    const payoutPolicyId = body.payout_policy_id
      ? Number(body.payout_policy_id)
      : null;

    if (!payoutPolicyId) {
      return NextResponse.json(
        {
          error:
            "Employment role is required",
        },
        { status: 400 }
      );
    }

    const role = await getRoleById(
      store.id,
      payoutPolicyId
    );

    if (!role) {
      return NextResponse.json(
        {
          error:
            "Selected employment role does not exist",
        },
        { status: 400 }
      );
    }

    const payload = {
      name: displayName,

      role: "staff",

      name_display: displayName,

      name_legal:
        normalizeNullableText(
          body.name_legal
        ),

      staff_code:
        normalizeNullableText(
          body.staff_code
        ),

      // keep for compatibility only
      employment_type:
        body.employment_type ||
        "temporary",

      start_date:
        body.start_date || null,

      end_date:
        body.end_date || null,

      abn: normalizeNullableText(
        body.abn
      ),

      tfn: normalizeNullableText(
        body.tfn
      ),

      is_active:
        body.is_active ?? true,

      payout_policy_id:
        payoutPolicyId,

      store_id: store.id,
    };

    const { data, error } =
      await supabase
        .from("staff")
        .insert(payload)
        .select(STAFF_SELECT)
        .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      normalizeStaffRow(
        data,
        role
      ),
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST staff error:",
      error
    );

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}