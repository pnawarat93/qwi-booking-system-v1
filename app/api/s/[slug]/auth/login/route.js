import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { resolveStoreFromParams } from "@/lib/storeResolver";

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

    const ownerPin = store.owner_pin || process.env.OWNER_PIN;

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

    const staffPinMatches = store.staff_pin_hash
      ? await bcrypt.compare(pin, store.staff_pin_hash)
      : process.env.STAFF_PIN && pin === process.env.STAFF_PIN;

    if (staffPinMatches) {
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
