import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

function normalizePolicy(row) {
  return {
    ...row,

    role_name:
      row.role_name ||
      row.name ||
      "Role",
  };
}

export async function GET(request, context) {
  try {
    const store =
      await resolveStoreFromParams(
        context.params
      );

    if (!store) {
      return NextResponse.json(
        {
          error:
            "Store not found",
        },
        { status: 404 }
      );
    }

    const { data, error } =
      await supabase
        .from(
          "store_payout_policies"
        )
        .select("*")
        .eq(
          "store_id",
          store.id
        )
        .order("created_at", {
          ascending: true,
        });

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      Array.isArray(data)
        ? data.map(
            normalizePolicy
          )
        : []
    );
  } catch (error) {
    console.error(
      "GET payout policies error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request,
  context
) {
  try {
    const store =
      await resolveStoreFromParams(
        context.params
      );

    if (!store) {
      return NextResponse.json(
        {
          error:
            "Store not found",
        },
        { status: 404 }
      );
    }

    const body =
      await request.json();

    const payoutType =
      body.payout_type ||
      "fixed_per_job";

    const roleName =
      String(
        body.role_name ||
          body.name ||
          ""
      ).trim();

    if (!roleName) {
      return NextResponse.json(
        {
          error:
            "Role name is required",
        },
        { status: 400 }
      );
    }

    if (
      ![
        "fixed_per_job",
        "percent",
      ].includes(
        payoutType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid payout type",
        },
        { status: 400 }
      );
    }

    const payload = {
      store_id: store.id,

      // keep old column for compatibility
      name: roleName,

      role_name: roleName,

      payout_type:
        payoutType,

      fixed_amount:
        payoutType ===
        "fixed_per_job"
          ? Number(
              body.fixed_amount ||
                0
            )
          : 0,

      percent:
        payoutType ===
        "percent"
          ? Number(
              body.percent ||
                0
            )
          : 0,

      // hidden for now
      hourly_rate: 0,

      // hidden for now
      refund_behavior:
        "exclude_full",

      is_active: true,
    };

    const { data, error } =
      await supabase
        .from(
          "store_payout_policies"
        )
        .insert(payload)
        .select("*")
        .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      normalizePolicy(
        data
      ),
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST payout policy error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Server error",
      },
      { status: 500 }
    );
  }
}