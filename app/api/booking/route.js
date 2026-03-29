import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

function normalizeStatus(status) {
  return String(status || "pending").toLowerCase();
}

function timeStringToMinutes(timeValue) {
  if (!timeValue) return null;

  const safeTime = String(timeValue).slice(0, 5);
  const [h, m] = safeTime.split(":").map(Number);

  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export async function POST(request) {
  try {
    const body = await request.json();

    const isWalkIn = Boolean(body.is_walk_in);
    const partySize = Number(body.party_size || 1);
    const status = normalizeStatus(body.status);

    if (!body.service_id || !body.date || !body.time) {
      return NextResponse.json(
        { error: "service_id, date, and time are required" },
        { status: 400 }
      );
    }

    // 1) Fetch service duration
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, name, duration, price")
      .eq("id", body.service_id)
      .single();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "Invalid service_id" },
        { status: 400 }
      );
    }

    const duration = service.duration;

    // WALK-IN FLOW
    // Front desk already chooses staff for speed.
    if (isWalkIn) {
      if (!body.staff_id) {
        return NextResponse.json(
          { error: "staff_id is required for walk-in" },
          { status: 400 }
        );
      }

      const walkInPayload = {
        customer_name: body.customer_name || "Walk-in",
        customer_phone: body.customer_phone || "",
        service_id: Number(body.service_id),
        is_walk_in: true,
        date: body.date,
        time: body.time,
        party_size: partySize,
        status,
        staff_id: Number(body.staff_id),
      };

      const { data, error } = await supabase
        .from("jobs")
        .insert([walkInPayload])
        .select("*, services(name, duration), users(name)")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(
        { message: "Walk-in created successfully", data },
        { status: 201 }
      );
    }

    // ONLINE / NORMAL BOOKING FLOW
    const requiredStaffIds = Array.from(
      new Set(
        Array.isArray(body.staff_ids)
          ? body.staff_ids.map(Number)
          : body.staff_id
            ? [Number(body.staff_id)]
            : []
      )
    );

    // 2) Fetch all staff
    const { data: staffs, error: staffError } = await supabase
      .from("users")
      .select("id")
      .eq("role", "Staff");

    if (staffError || !staffs || staffs.length === 0) {
      return NextResponse.json(
        { error: "No staff available" },
        { status: 500 }
      );
    }

    // 3) Fetch all active bookings for this date
    const { data: bookings, error: bookingsError } = await supabase
      .from("jobs")
      .select("staff_id, time, status, services(duration)")
      .eq("date", body.date)
      .in("status", ["pending", "paid"]);

    if (bookingsError) {
      return NextResponse.json(
        { error: bookingsError.message },
        { status: 500 }
      );
    }

    // 4) Calculate available staff
    const requestedStart = timeStringToMinutes(body.time);
    const requestedEnd = requestedStart + duration;

    let availableStaffIds = staffs.map((s) => s.id);

    if (bookings && bookings.length > 0) {
      bookings.forEach((booking) => {
        if (!booking.time || !booking.staff_id) return;

        const bookingStart = timeStringToMinutes(booking.time);
        const bookingDuration = booking.services?.duration || 60;
        const bookingEnd = bookingStart + bookingDuration;

        const overlaps =
          requestedStart < bookingEnd && requestedEnd > bookingStart;

        if (overlaps) {
          availableStaffIds = availableStaffIds.filter(
            (id) => id !== booking.staff_id
          );
        }
      });
    }

    const allRequiredStaffAvailable = requiredStaffIds.every((id) =>
      availableStaffIds.includes(id)
    );

    if (!allRequiredStaffAvailable) {
      return NextResponse.json(
        {
          error:
            "One or more required staff members are not available at the requested time",
        },
        { status: 400 }
      );
    }

    if (availableStaffIds.length < partySize) {
      return NextResponse.json(
        { error: "Not enough staff available for the requested time" },
        { status: 400 }
      );
    }

    // 5) Select required number of staff
    let selectedStaffIds = [...requiredStaffIds];
    availableStaffIds = availableStaffIds.filter(
      (id) => !selectedStaffIds.includes(id)
    );

    while (selectedStaffIds.length < partySize) {
      const randomIndex = Math.floor(Math.random() * availableStaffIds.length);
      selectedStaffIds.push(availableStaffIds[randomIndex]);
      availableStaffIds.splice(randomIndex, 1);
    }

    // 6) Create jobs
    const { staff_ids, staff_id, ...jobPayload } = body;

    const jobsToInsert = selectedStaffIds.map((selectedStaffId) => ({
      ...jobPayload,
      customer_name: body.customer_name || "Walk-in",
      customer_phone: body.customer_phone || "",
      service_id: Number(body.service_id),
      is_walk_in: Boolean(body.is_walk_in),
      date: body.date,
      time: body.time,
      party_size: partySize,
      status,
      staff_id: selectedStaffId,
    }));

    const { data, error } = await supabase
      .from("jobs")
      .insert(jobsToInsert)
      .select("*, services(name, duration), users(name)");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Booking created successfully", data },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("*, services(name, duration, price), users(name)")
    .eq("date", date)
    .order("time", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}