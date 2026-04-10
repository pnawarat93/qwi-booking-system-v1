import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, name_display, staff_code, is_active, employment_type")
      .eq("is_active", true)
      .order("name_display", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/staffs error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
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
    };

    const { data, error } = await supabase
      .from("users")
      .insert(payload)
      .select("id, name, name_display, staff_code, is_active, employment_type")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("POST /api/staffs error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}