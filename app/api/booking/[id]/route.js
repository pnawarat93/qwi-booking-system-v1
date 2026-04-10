import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

function normalizeStatus(status) {
  return String(status || "pending").toLowerCase();
}

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing booking id" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const updatePayload = {};

    if (body.customer_name !== undefined) {
      updatePayload.customer_name = body.customer_name || "Walk-in";
    }

    if (body.customer_phone !== undefined) {
      updatePayload.customer_phone = body.customer_phone || "";
    }

    if (
      body.service_id !== undefined &&
      body.service_id !== null &&
      body.service_id !== ""
    ) {
      updatePayload.service_id = Number(body.service_id);
    }

    if (body.staff_id !== undefined) {
      updatePayload.staff_id =
        body.staff_id === null || body.staff_id === ""
          ? null
          : Number(body.staff_id);
    }

    if (body.date !== undefined) {
      updatePayload.date = body.date;
    }

    if (body.time !== undefined) {
      updatePayload.time = body.time;
    }

    if (
      body.party_size !== undefined &&
      body.party_size !== null &&
      body.party_size !== ""
    ) {
      updatePayload.party_size = Number(body.party_size);
    }

    if (body.status !== undefined) {
      updatePayload.status = normalizeStatus(body.status);
    }

    if (body.is_walk_in !== undefined) {
      updatePayload.is_walk_in = Boolean(body.is_walk_in);
    }

    if (body.notes !== undefined) {
      updatePayload.notes = body.notes;
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("jobs")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("PATCH jobs update error:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    const { data: fullBooking, error: fetchError } = await supabase
      .from("jobs")
      .select(`
        *,
        services (
          id,
          name,
          duration,
          price
        ),
        assigned_staff:users!jobs_staff_id_fkey (
          id,
          name,
          name_display,
          staff_code
        ),
        requested_staff:users!jobs_requested_staff_id_fkey (
          id,
          name,
          name_display,
          staff_code
        )
      `)
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("PATCH jobs re-fetch error:", fetchError);
      return NextResponse.json(updatedRow, { status: 200 });
    }

    return NextResponse.json(fullBooking, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/booking/[id] server error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}