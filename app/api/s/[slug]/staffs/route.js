import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("staff")
      .select("id, name, name_display, staff_code, is_active, employment_type")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("name_display", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/s/[slug]/staffs error:", error);
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

    const name_display = (body.name_display || "").trim();
    const staff_code = (body.staff_code || "").trim() || null;
    const employment_type = (body.employment_type || "temporary").trim();

    if (!name_display) {
      return NextResponse.json(
        { error: "name_display is required" },
        { status: 400 }
      );
    }

    const payload = {
      name: name_display,
      name_display,
      staff_code,
      employment_type,
      is_active: true,
      role: "staff",
      store_id: store.id,
    };

    const { data, error } = await supabase
      .from("staff")
      .insert(payload)
      .select("id, name, name_display, staff_code, is_active, employment_type")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/s/[slug]/staffs error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}