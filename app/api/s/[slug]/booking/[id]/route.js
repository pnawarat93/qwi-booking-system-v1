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
  return utcDate.getUTCDay();
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

async function getBusinessHoursForDate(store, date) {
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

  if (specialDateError) throw new Error(specialDateError.message);
  if (businessHourError) throw new Error(businessHourError.message);

  let isOpen = true;
  let openTime = store.open_time || "09:00:00";
  let closeTime = store.close_time || "20:00:00";
  let note = null;

  if (specialDateRow) {
    isOpen = !specialDateRow.is_closed;
    openTime = specialDateRow.open_time || openTime;
    closeTime = specialDateRow.close_time || closeTime;
    note = specialDateRow.note || null;
  } else if (businessHourRow) {
    isOpen = businessHourRow.is_open;
    openTime = businessHourRow.open_time || openTime;
    closeTime = businessHourRow.close_time || closeTime;
    note = businessHourRow.note || null;
  }

  return {
    is_open: isOpen,
    open_time: openTime,
    close_time: closeTime,
    note,
  };
}

export async function PATCH(request, context) {
  try {
    const params = await context.params;
    const { slug, id } = params;

    if (!slug || !id) {
      return NextResponse.json(
        { error: "Missing store slug or booking id" },
        { status: 400 }
      );
    }

    const store = await resolveStoreFromParams(context.params);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json();

    const { data: existingBooking, error: existingBookingError } = await supabase
      .from("jobs")
      .select(`
        *,
        services (
          id,
          duration
        )
      `)
      .eq("id", id)
      .eq("store_id", store.id)
      .single();

    if (existingBookingError || !existingBooking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

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

    const mergedBooking = {
      ...existingBooking,
      ...updatePayload,
    };

    const mergedDate = mergedBooking.date;
    const mergedTime = mergedBooking.time;
    const mergedStaffId = mergedBooking.staff_id;
    const mergedServiceId = Number(mergedBooking.service_id);

    if (!mergedDate || !mergedTime || !mergedServiceId) {
      return NextResponse.json(
        { error: "Booking requires valid date, time, and service" },
        { status: 400 }
      );
    }

    const { data: serviceRow, error: serviceError } = await supabase
      .from("services")
      .select("id, duration")
      .eq("id", mergedServiceId)
      .eq("store_id", store.id)
      .single();

    if (serviceError || !serviceRow) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 400 }
      );
    }

    const serviceDuration = Number(serviceRow.duration || 30);
    const targetStart = timeToMinutes(mergedTime);

    if (targetStart === null) {
      return NextResponse.json({ error: "Invalid time" }, { status: 400 });
    }

    const hours = await getBusinessHoursForDate(store, mergedDate);

    if (!hours.is_open) {
      return NextResponse.json(
        { error: "Store is closed on this date" },
        { status: 400 }
      );
    }

    const openMinutes = timeToMinutes(hours.open_time);
    const closeMinutes = timeToMinutes(hours.close_time);

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

    if (mergedStaffId !== null && mergedStaffId !== undefined) {
      const effectiveStaff = await getEffectiveStaffForDate(store.id, mergedDate);

      const selectedStaff = effectiveStaff.find(
        (staff) => String(staff.staff_id) === String(mergedStaffId)
      );

      if (!selectedStaff) {
        return NextResponse.json(
          { error: "Selected staff is not working on this date" },
          { status: 400 }
        );
      }

      const shiftStart = timeToMinutes(selectedStaff.start_time || "00:00");
      const shiftEnd = timeToMinutes(selectedStaff.end_time || "23:59");

      if (shiftStart !== null && targetStart < shiftStart) {
        return NextResponse.json(
          { error: "Selected staff is not available at this time" },
          { status: 400 }
        );
      }

      if (
        shiftEnd !== null &&
        targetStart + serviceDuration > shiftEnd
      ) {
        return NextResponse.json(
          { error: "Selected staff is not available at this time" },
          { status: 400 }
        );
      }

      const { data: otherBookings, error: otherBookingsError } = await supabase
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
        .eq("store_id", store.id)
        .eq("date", mergedDate)
        .eq("staff_id", mergedStaffId)
        .in("status", ["pending", "paid"]);

      if (otherBookingsError) {
        return NextResponse.json(
          { error: otherBookingsError.message },
          { status: 500 }
        );
      }

      const hasConflict = (otherBookings || []).some((booking) => {
        if (String(booking.id) === String(id)) return false;

        const existingStart = timeToMinutes(booking.time);
        const existingDuration = Number(booking.services?.duration || 30);

        if (existingStart === null) return false;

        return bookingsOverlap(
          targetStart,
          serviceDuration,
          existingStart,
          existingDuration
        );
      });

      if (hasConflict) {
        return NextResponse.json(
          { error: "This staff member already has another booking at this time" },
          { status: 400 }
        );
      }
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("jobs")
      .update(updatePayload)
      .eq("id", id)
      .eq("store_id", store.id)
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
      .eq("id", id)
      .eq("store_id", store.id)
      .single();

    if (fetchError) {
      console.error("PATCH jobs re-fetch error:", fetchError);
      return NextResponse.json(updatedRow, { status: 200 });
    }

    return NextResponse.json(fullBooking, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/s/[slug]/booking/[id] server error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}