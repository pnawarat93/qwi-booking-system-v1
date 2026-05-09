import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { resolveStoreFromParams } from "@/lib/storeResolver";

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

function getWeekdayFromDate(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(utcDate.getTime())) return null;
  return utcDate.getUTCDay(); // 0 = Sunday ... 6 = Saturday
}

function normalizeTime(value) {
  if (!value) return null;
  return String(value).substring(0, 8);
}

async function getEffectiveStaffForDate(storeId, date) {
  const weekday = getWeekdayFromDate(date);

  if (weekday === null) {
    throw new Error("Invalid date format");
  }

  const [
    { data: rosterRows, error: rosterError },
    { data: overrideRows, error: overrideError },
  ] = await Promise.all([
    supabase
      .from("staff_rosters")
      .select(`
        id,
        store_id,
        staff_id,
        weekday,
        is_working,
        start_time,
        end_time,
        display_order,
        note,
        is_active,
        staff (
          id,
          name,
          name_display,
          staff_code,
          is_active,
          store_id
        )
      `)
      .eq("store_id", storeId)
      .eq("weekday", weekday)
      .eq("is_active", true),

    supabase
      .from("staff_shift_overrides")
      .select(`
        id,
        store_id,
        staff_id,
        override_date,
        is_working,
        start_time,
        end_time,
        display_order,
        note,
        staff (
          id,
          name,
          name_display,
          staff_code,
          is_active,
          store_id
        )
      `)
      .eq("store_id", storeId)
      .eq("override_date", date),
  ]);

  if (rosterError) throw new Error(rosterError.message);
  if (overrideError) throw new Error(overrideError.message);

  const rosterMap = new Map();

  (Array.isArray(rosterRows) ? rosterRows : []).forEach((row) => {
    const member = Array.isArray(row.staff) ? row.staff[0] : row.staff;

    if (!member) return;
    if (member.store_id !== storeId) return;
    if (member.is_active === false) return;

    rosterMap.set(String(row.staff_id), {
      staff_id: row.staff_id,
      name: member.name,
      name_display: member.name_display,
      staff_code: member.staff_code,
      is_working: row.is_working,
      start_time: normalizeTime(row.start_time),
      end_time: normalizeTime(row.end_time),
      display_order: row.display_order ?? 0,
      note: row.note || null,
      source: "roster",
      roster_id: row.id,
      override_id: null,
    });
  });

  const mergedMap = new Map(rosterMap);

  (Array.isArray(overrideRows) ? overrideRows : []).forEach((row) => {
    const member = Array.isArray(row.staff) ? row.staff[0] : row.staff;
    const existing = mergedMap.get(String(row.staff_id));

    if (!member) return;
    if (member.store_id !== storeId) return;
    if (member.is_active === false) return;

    mergedMap.set(String(row.staff_id), {
      staff_id: row.staff_id,
      name: member.name,
      name_display: member.name_display,
      staff_code: member.staff_code,
      is_working: row.is_working,
      start_time: row.is_working ? normalizeTime(row.start_time) : null,
      end_time: row.is_working ? normalizeTime(row.end_time) : null,
      display_order:
        row.display_order !== null && row.display_order !== undefined
          ? row.display_order
          : existing?.display_order ?? 0,
      note: row.note || existing?.note || null,
      source: "override",
      roster_id: existing?.roster_id ?? null,
      override_id: row.id,
    });
  });

  return Array.from(mergedMap.values())
    .filter((row) => row.is_working === true)
    .sort((a, b) => {
      const aOrder = a.display_order ?? 0;
      const bOrder = b.display_order ?? 0;

      if (aOrder !== bOrder) return aOrder - bOrder;

      const aName = a.name_display || a.name || "";
      const bName = b.name_display || b.name || "";
      return aName.localeCompare(bName);
    });
}

export async function GET(request, context) {
  try {
    const store = await resolveStoreFromParams(context.params);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("jobs")
      .select(`
        *,
        service_name_snapshot,
        service_duration_snapshot,
        service_price_snapshot,
        staff_payout_snapshot,
        services (
          id,
          name,
          duration,
          price
        ),
        assigned_staff:staff!jobs_staff_id_fkey (
          id,
          name,
          name_display,
          staff_code
        ),
        requested_staff:staff!jobs_requested_staff_id_fkey (
          id,
          name,
          name_display,
          staff_code
        )
      `)
      .eq("store_id", store.id)
      .eq("date", date)
      .order("time", { ascending: true });

    if (error) {
      console.error("GET booking error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("GET booking server error:", error);
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
      ? body.staff_ids.map(Number).filter((id) => !Number.isNaN(id))
      : body.staff_id !== undefined && body.staff_id !== null && body.staff_id !== ""
      ? [Number(body.staff_id)].filter((id) => !Number.isNaN(id))
      : [];

    if (!service_id || !date || !time || !party_size) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1) Service snapshot values
    const { data: serviceRow, error: serviceError } = await supabase
      .from("services")
      .select("id, name, duration, price, staff_payout_fixed")
      .eq("id", service_id)
      .eq("store_id", store.id)
      .single();

    if (serviceError || !serviceRow) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 400 }
      );
    }

    const serviceDuration = Number(serviceRow.duration || 30);
    const targetStart = timeToMinutes(time);

    if (targetStart === null) {
      return NextResponse.json(
        { error: "Invalid time" },
        { status: 400 }
      );
    }

    // 2) Business hours for that date
    const weekday = getWeekdayFromDate(date);

    const [
      { data: specialDateRow, error: specialDateError },
      { data: businessHourRow, error: businessHourError },
    ] = await Promise.all([
      supabase
        .from("store_special_dates")
        .select("special_date, is_closed, open_time, close_time, note")
        .eq("store_id", store.id)
        .eq("special_date", date)
        .maybeSingle(),

      supabase
        .from("store_business_hours")
        .select("weekday, is_open, open_time, close_time, note")
        .eq("store_id", store.id)
        .eq("weekday", weekday)
        .maybeSingle(),
    ]);

    if (specialDateError) {
      return NextResponse.json({ error: specialDateError.message }, { status: 500 });
    }

    if (businessHourError) {
      return NextResponse.json({ error: businessHourError.message }, { status: 500 });
    }

    let isOpen = true;
    let openTime = store.open_time || "09:00:00";
    let closeTime = store.close_time || "20:00:00";

    if (specialDateRow) {
      isOpen = !specialDateRow.is_closed;
      openTime = specialDateRow.open_time || openTime;
      closeTime = specialDateRow.close_time || closeTime;
    } else if (businessHourRow) {
      isOpen = businessHourRow.is_open;
      openTime = businessHourRow.open_time || openTime;
      closeTime = businessHourRow.close_time || closeTime;
    }

    if (!isOpen) {
      return NextResponse.json(
        { error: "Store is closed on this date" },
        { status: 400 }
      );
    }

    const openMinutes = timeToMinutes(openTime);
    const closeMinutes = timeToMinutes(closeTime);

    if (
      openMinutes !== null &&
      closeMinutes !== null &&
      (targetStart < openMinutes || targetStart + serviceDuration > closeMinutes)
    ) {
      return NextResponse.json(
        { error: "Booking time is outside business hours" },
        { status: 400 }
      );
    }

    // 3) Effective staff for that date
    const effectiveStaff = await getEffectiveStaffForDate(store.id, date);

    if (effectiveStaff.length === 0) {
      return NextResponse.json(
        { error: "No staff available for this date" },
        { status: 400 }
      );
    }

    // 4) Existing active bookings
    const { data: existingBookings, error: existingError } = await supabase
      .from("jobs")
      .select(`
        id,
        staff_id,
        time,
        status,
        service_duration_snapshot,
        services (
          duration
        )
      `)
      .eq("store_id", store.id)
      .eq("date", date)
      .in("status", ["pending", "paid"]);

    if (existingError) {
      console.error("POST booking existing bookings error:", existingError);
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    function isStaffFree(staffId) {
      return !(existingBookings || []).some((booking) => {
        if (String(booking.staff_id) !== String(staffId)) return false;

        const existingStart = timeToMinutes(booking.time);
        const existingDuration = Number(
          booking.service_duration_snapshot || booking.services?.duration || 30
        );

        if (existingStart === null) return false;

        return bookingsOverlap(
          targetStart,
          serviceDuration,
          existingStart,
          existingDuration
        );
      });
    }

    function isStaffWithinShift(staffRow) {
      const shiftStart = timeToMinutes(staffRow.start_time || "00:00");
      const shiftEnd = timeToMinutes(staffRow.end_time || "23:59");

      if (shiftStart !== null && targetStart < shiftStart) return false;
      if (shiftEnd !== null && targetStart + serviceDuration > shiftEnd) {
        return false;
      }

      return true;
    }

    const workingStaff = effectiveStaff
      .filter(isStaffWithinShift)
      .map((staff) => ({
        id: staff.staff_id,
        name: staff.name_display || staff.name,
        staff_code: staff.staff_code,
      }));

    if (workingStaff.length === 0) {
      return NextResponse.json(
        { error: "No staff available for this time" },
        { status: 400 }
      );
    }

    // 5) Validate selected staff
    const selectedWorkingStaffIds = selectedStaffIds.filter((staffId) =>
      workingStaff.some((staff) => String(staff.id) === String(staffId))
    );

    if (selectedStaffIds.length > 0 && selectedWorkingStaffIds.length !== selectedStaffIds.length) {
      return NextResponse.json(
        { error: "One or more selected staff are not working at this time" },
        { status: 400 }
      );
    }

    const selectedFreeStaffIds = selectedWorkingStaffIds.filter((staffId) =>
      isStaffFree(staffId)
    );

    if (selectedStaffIds.length > 0 && selectedFreeStaffIds.length !== selectedStaffIds.length) {
      return NextResponse.json(
        { error: "One or more selected staff are not available" },
        { status: 400 }
      );
    }

    // 6) Fill remaining slots automatically
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

    // 7) Create job group if needed
    let job_group_id = null;

    if (party_size > 1) {
      const { data: groupRow, error: groupError } = await supabase
        .from("job_groups")
        .insert({ store_id: store.id })
        .select()
        .single();

      if (groupError) {
        console.error("POST booking job_groups insert error:", groupError);
        return NextResponse.json({ error: groupError.message }, { status: 500 });
      }

      job_group_id = groupRow.id;
    }

    // 8) Insert jobs with service snapshots
    const rowsToInsert = assignedStaffIds.map((staffId) => {
      const wasRequested = is_walk_in
        ? false
        : selectedFreeStaffIds.includes(staffId);

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
        store_id: store.id,

        service_name_snapshot: serviceRow.name || null,
        service_duration_snapshot: Number(serviceRow.duration || 0),
        service_price_snapshot: serviceRow.price ?? null,
        staff_payout_snapshot: serviceRow.staff_payout_fixed ?? null,
      };
    });

    const { data: insertedRows, error: insertError } = await supabase
      .from("jobs")
      .insert(rowsToInsert)
      .select();

    if (insertError) {
      console.error("POST booking jobs insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(insertedRows || [], { status: 201 });
  } catch (error) {
    console.error("POST booking server error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}