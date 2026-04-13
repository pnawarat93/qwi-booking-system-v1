import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";
import { supabase } from "@/lib/supabase";

export async function POST(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    // Check store-level PINs first (if columns exist in DB),
    // then fall back to environment variables for backward compatibility.
    const ownerPin = store.owner_pin || process.env.OWNER_PIN;
    const staffPin = store.staff_pin || process.env.STAFF_PIN;

    if (ownerPin && pin === ownerPin) {
      return NextResponse.json({
        user: {
          id: "owner",
          name: "Owner",
          role: "owner",
          store_id: store.id,
          store_slug: store.slug,
        },
      });
    }

    if (staffPin && pin === staffPin) {
      return NextResponse.json({
        user: {
          id: "staff",
          name: "Staff",
          role: "staff",
          store_id: store.id,
          store_slug: store.slug,
        },
      });
    }

    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  } catch (error) {
    console.error("POST /api/s/[slug]/auth/login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
