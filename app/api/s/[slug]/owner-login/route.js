import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { resolveStoreFromParams } from "@/lib/storeResolver";
import { supabase } from "@/lib/supabase";
import { createSession } from "@/lib/session";

export async function POST(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // 1. Get owner by email from the manual 'owners' table
    const { data: owner, error: fetchError } = await supabase
      .from("owners")
      .select("*")
      .eq("email", email)
      .single();

    if (fetchError || !owner) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 2. Verify password using bcrypt (same method as portal)
    const isValidPassword = await bcrypt.compare(password, owner.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }
    if (!owner.email_verified_at) {
      return NextResponse.json(
        { error: "Please verify your email before logging in" },
        { status: 403 }
      );
    }

    // 3. Verify this owner actually owns the requested store
    // Comparing the owner.id with store.owner_id
    if (String(owner.id) !== String(store.owner_id)) {
      return NextResponse.json(
        { error: "You are not the owner of this store" },
        { status: 403 }
      );
    }

    // 4. Update last login (optional but good for consistency)
    await supabase
      .from("owners")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", owner.id);

    // 5. Issue a JWT session cookie
    const { password: _, ...ownerData } = owner;
    await createSession({
      ...ownerData,
      store_id: store.id,
      store_slug: store.slug,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/s/[slug]/owner-login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}