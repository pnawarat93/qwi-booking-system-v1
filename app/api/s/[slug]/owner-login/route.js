import { NextResponse } from "next/server";
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

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const userId = authData.user.id;

    // 2. Verify this user is the owner of the requested store
    const { data: ownerRecord, error: ownerError } = await supabase
      .from("stores")
      .select("id, name, slug, owner_id")
      .eq("slug", store.slug)
      .eq("owner_id", userId)
      .single();

    if (ownerError || !ownerRecord) {
      return NextResponse.json(
        { error: "You are not the owner of this store" },
        { status: 403 }
      );
    }

    // 3. Issue a JWT session cookie
    await createSession({
      id: userId,
      email: authData.user.email,
      store_id: ownerRecord.id,
      store_slug: ownerRecord.slug,
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
