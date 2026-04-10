import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

function normalizeStatus(status) {
  return String(status || "pending").toLowerCase();
}

function timeToMinutes(timeString) {
  if (!timeString) return null;

  const safeTime = String(timeString).substring(0, 5);
  const [hours, minutes] = safeTime.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function bookingsOverlap(aStart, aDuration, bStart, bDuration) {
  const aEnd = aStart + aDuration;
  const bEnd = bStart + bDuration;
  return aStart < bEnd && aEnd > bStart;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const { data, error } = await supabase
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
      .eq("date", date)
      .order("time", { ascending: true });

    if (error) {
      console.error("GET /api/booking error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET /api/booking server error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const customer_name = body.customer_name || "Walk-in";
    const customer_phone = body.customer_phone || "";
    const notes = body.notes || "";
    const service_id = Number(body.service_id);
    const is_walk_in = Boolean(body.is_walk_in);
    const date = body.date;
    const time = body.time;
    const party_size = Number(body.party_size || 1);
    const status = normalizeStatus(body.status || "pending");

    const selectedStaffIds = Array.isArray(body.staff_ids)
      ? body.staff_ids
          .map((id) => Number(id))
          .filter((id) => !Number.isNaN(id))
      : [];

    if (!service_id || !date || !time || !party_size) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1) Get service duration
    const { data: serviceRow, error: serviceError } = await supabase
      .from("services")
      .select("id, duration")
      .eq("id", service_id)
      .single();

    if (serviceError || !serviceRow) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 400 }
      );
    }

    const serviceDuration = Number(serviceRow.duration || 30);
    const targetStart = timeToMinutes(time);

    // 2) Get today's working staff from staff_shifts
    const { data: shiftRows, error: shiftError } = await supabase
      .from("staff_shifts")
      .select(`
        staff_id,
        is_working,
        users (
          id,
          name,
          name_display,
          staff_code
        )
      `)
      .eq("shift_date", date)
      .eq("is_working", true)
      .order("display_order", { ascending: true });

    if (shiftError) {
      console.error("POST /api/booking staff_shifts error:", shiftError);
      return NextResponse.json({ error: shiftError.message }, { status: 500 });
    }

    const workingStaff = (shiftRows || [])
      .filter((row) => row.users)
      .map((row) => ({
        id: row.users.id,
        name: row.users.name_display || row.users.name,
      }));

    if (workingStaff.length === 0) {
      return NextResponse.json(
        { error: "No staff available for this date" },
        { status: 400 }
      );
    }

    // 3) Get existing active bookings for the same date
    const { data: existingBookings, error: existingError } = await supabase
      .from("jobs")
      .select(`
        id,
        staff_id,
        time,
        status,
        services (
          duration
        )
      `)
      .eq("date", date)
      .in("status", ["pending", "paid"]);

    if (existingError) {
      console.error("POST /api/booking existing bookings error:", existingError);
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    function isStaffFree(staffId) {
      return !(existingBookings || []).some((booking) => {
        if (String(booking.staff_id) !== String(staffId)) return false;

        const existingStart = timeToMinutes(booking.time);
        const existingDuration = Number(booking.services?.duration || 30);

        if (existingStart === null || targetStart === null) return false;

        return bookingsOverlap(
          targetStart,
          serviceDuration,
          existingStart,
          existingDuration
        );
      });
    }

    // 4) Validate selected staff (if any)
    const selectedWorkingStaffIds = selectedStaffIds.filter((staffId) =>
      workingStaff.some((staff) => String(staff.id) === String(staffId))
    );

    const selectedFreeStaffIds = selectedWorkingStaffIds.filter((staffId) =>
      isStaffFree(staffId)
    );

    if (selectedStaffIds.length > 0 && selectedFreeStaffIds.length !== selectedStaffIds.length) {
      return NextResponse.json(
        { error: "One or more selected staff are not available" },
        { status: 400 }
      );
    }

    // 5) Fill remaining slots automatically
    const assignedStaffIds = [...selectedFreeStaffIds];

    const autoCandidates = workingStaff
      .filter((staff) => !assignedStaffIds.includes(staff.id))
      .filter((staff) => isStaffFree(staff.id))
      .map((staff) => staff.id);

    while (assignedStaffIds.length < party_size && autoCandidates.length > 0) {
      assignedStaffIds.push(autoCandidates.shift());
    }

    if (assignedStaffIds.length < party_size) {
      return NextResponse.json(
        { error: "Not enough available staff for this booking" },
        { status: 400 }
      );
    }

    // 6) Create job group if needed
    let job_group_id = null;

    if (party_size > 1) {
      const { data: groupRow, error: groupError } = await supabase
        .from("job_groups")
        .insert({})
        .select()
        .single();

      if (groupError) {
        console.error("POST /api/booking job_groups insert error:", groupError);
        return NextResponse.json({ error: groupError.message }, { status: 500 });
      }

      job_group_id = groupRow.id;
    }

    // 7) Build rows
    const rowsToInsert = assignedStaffIds.map((staffId, index) => {
      const wasRequested = selectedFreeStaffIds.includes(staffId);

      return {
        customer_name,
        customer_phone,
        notes,
        service_id,
        is_walk_in,
        date,
        time,
        party_size,
        status,
        staff_id: staffId,
        job_group_id,
        requested_staff_id: wasRequested ? staffId : null,
        is_staff_requested: wasRequested,
      };
    });

    const { data: insertedRows, error: insertError } = await supabase
      .from("jobs")
      .insert(rowsToInsert)
      .select();

    if (insertError) {
      console.error("POST /api/booking jobs insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(insertedRows || [], { status: 201 });
  } catch (error) {
    console.error("POST /api/booking server error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}