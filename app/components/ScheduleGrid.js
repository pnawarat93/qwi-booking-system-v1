"use client";

import React, { useEffect, useMemo, useState } from "react";
import BookingCard from "./BookingCard";
import BookingDetailsModal from "./BookingDetailsModal";
import { getSydneyTodayDate } from "@/lib/sydneyDate";
import { storeApiUrl } from "@/lib/storeApi";

function apiPath(slug, path) {
  return slug ? storeApiUrl(slug, path) : `/api${path}`;
}

const SLOT_MINUTES = 5;
const SLOT_HEIGHT = 32;
const TIME_COLUMN_WIDTH = 80;
const STAFF_COLUMN_WIDTH = 280;
const UNASSIGNED_COLUMN_WIDTH = 180;

const ACTIVE_GRID_STATUSES = ["pending", "paid"];
const INACTIVE_DAY_STATUSES = ["cancelled", "no_show"];
const NEEDS_REASSIGN_STATUSES = ["pending", "paid"];

function timeStringToHour(timeString, fallback) {
  if (!timeString) return fallback;
  const safe = String(timeString).substring(0, 2);
  const hour = Number(safe);
  return Number.isNaN(hour) ? fallback : hour;
}

function generateTimeSlots(startHour, endHour) {
  const slots = [];

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
      const hh = String(hour).padStart(2, "0");
      const mm = String(minute).padStart(2, "0");

      slots.push({
        label: `${hh}:${mm}`,
        minute,
        isMajor: minute === 0 || minute === 30,
      });
    }
  }

  return slots;
}

function timeToMinutes(timeString) {
  if (!timeString) return null;

  const safeTime = String(timeString).substring(0, 5);
  const [hours, minutes] = safeTime.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function getHeightPx(durationMinutes) {
  const safeDuration = Number(durationMinutes) || 30;
  return (safeDuration / SLOT_MINUTES) * SLOT_HEIGHT;
}

function compareDateStrings(a, b) {
  if (!a || !b) return 0;
  return a.localeCompare(b);
}

export default function ScheduleGrid({
  selectedDate = getSydneyTodayDate(),
  onDataChange,
  refreshToken = 0,
  externalSelectedBooking = null,
  onExternalBookingHandled,
  storeSlug,
}) {
  const [staffList, setStaffList] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [businessHours, setBusinessHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());

  const todaySydney = getSydneyTodayDate();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      try {
        const [staffRes, bookingsRes, hoursRes] = await Promise.all([
          fetch(apiPath(storeSlug, `/effective-staff?date=${selectedDate}`)),
          fetch(apiPath(storeSlug, `/booking?date=${selectedDate}`)),
          fetch(apiPath(storeSlug, `/business-hours?date=${selectedDate}`)),
        ]);

        const staffData = await staffRes.json();
        const bookingsData = await bookingsRes.json();
        const hoursData = await hoursRes.json();

        if (!staffRes.ok) {
          throw new Error(staffData?.error || "Failed to load staff");
        }

        if (!bookingsRes.ok) {
          throw new Error(bookingsData?.error || "Failed to load bookings");
        }

        if (!hoursRes.ok) {
          throw new Error(hoursData?.error || "Failed to load business hours");
        }

        const normalizedStaff = Array.isArray(staffData?.items)
          ? staffData.items.map((staff) => ({
              id: staff.staff_id,
              name: staff.name_display || staff.name,
              staff_code: staff.staff_code || null,
              start_time: staff.start_time,
              end_time: staff.end_time,
              display_order: staff.display_order || 0,
              note: staff.note || "",
              source: staff.source || "roster",
              is_working: staff.is_working,
            }))
          : [];

        setStaffList(normalizedStaff);
        setBookings(Array.isArray(bookingsData) ? bookingsData : []);
        setBusinessHours(hoursData || null);
      } catch (error) {
        console.error("Error fetching admin data:", error);
        setStaffList([]);
        setBookings([]);
        setBusinessHours(null);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [selectedDate, refreshKey, refreshToken, storeSlug]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (externalSelectedBooking) {
      setSelectedBooking(externalSelectedBooking);
      onExternalBookingHandled?.();
    }
  }, [externalSelectedBooking, onExternalBookingHandled]);

  const isStoreOpenThatDay = businessHours?.is_open !== false;

  const dynamicStartHour = useMemo(() => {
    return timeStringToHour(businessHours?.open_time, 8);
  }, [businessHours]);

  const dynamicEndHour = useMemo(() => {
    return timeStringToHour(businessHours?.close_time, 20);
  }, [businessHours]);

  const timeSlots = useMemo(() => {
    if (!isStoreOpenThatDay) return [];
    return generateTimeSlots(dynamicStartHour, dynamicEndHour);
  }, [dynamicStartHour, dynamicEndHour, isStoreOpenThatDay]);

  const activeBookings = useMemo(() => {
    return bookings.filter((booking) =>
      ACTIVE_GRID_STATUSES.includes(booking.status?.toLowerCase())
    );
  }, [bookings]);

  const inactiveDayBookings = useMemo(() => {
    return bookings.filter((booking) =>
      INACTIVE_DAY_STATUSES.includes(booking.status?.toLowerCase())
    );
  }, [bookings]);

  const workingStaffIds = useMemo(() => {
    return new Set(staffList.map((staff) => String(staff.id)));
  }, [staffList]);

  const unassignedBookings = useMemo(() => {
    const dateComparison = compareDateStrings(selectedDate, todaySydney);
    const isPastDay = dateComparison < 0;
    const isToday = dateComparison === 0;
    const isFutureDay = dateComparison > 0;

    if (isPastDay) return [];

    const nowSydney = new Date(nowTick);
    const currentMinutesToday =
      nowSydney.getHours() * 60 + nowSydney.getMinutes();

    return bookings.filter((booking) => {
      const status = booking.status?.toLowerCase();

      if (!NEEDS_REASSIGN_STATUSES.includes(status)) return false;
      if (!booking.staff_id) return true;
      if (workingStaffIds.has(String(booking.staff_id))) return false;

      if (isFutureDay) return true;

      if (isToday) {
        const startMinutes = timeToMinutes(booking.time);
        const durationMinutes = Number(
          booking.duration ?? booking.services?.duration ?? 30
        );

        if (startMinutes === null) return true;

        const endMinutes = startMinutes + durationMinutes;
        return currentMinutesToday < endMinutes;
      }

      return false;
    });
  }, [bookings, workingStaffIds, selectedDate, todaySydney, nowTick]);

  useEffect(() => {
    onDataChange?.({
      bookings,
      activeBookings,
      inactiveBookings: inactiveDayBookings,
      unassignedBookings,
    });
  }, [
    bookings,
    activeBookings,
    inactiveDayBookings,
    unassignedBookings,
    onDataChange,
  ]);

  const totalRows = timeSlots.length;
  const gridHeight = totalRows * SLOT_HEIGHT;
  const totalGridWidth =
    TIME_COLUMN_WIDTH +
    staffList.length * STAFF_COLUMN_WIDTH +
    UNASSIGNED_COLUMN_WIDTH;

  function getTopOffsetPx(timeString) {
    const bookingMinutes = timeToMinutes(timeString);
    if (bookingMinutes === null) return 0;

    const dayStartMinutes = dynamicStartHour * 60;
    const diffMinutes = bookingMinutes - dayStartMinutes;

    return (diffMinutes / SLOT_MINUTES) * SLOT_HEIGHT;
  }

  function openBookingDetails(booking) {
    setSelectedBooking(booking);
  }

  function closeBookingDetails() {
    setSelectedBooking(null);
  }

  async function handleSaveBooking(updatedBooking) {
    const previousBookings = bookings;
    const previousSelectedBooking = selectedBooking;

    const optimisticBooking = (booking) =>
      String(booking.id) === String(updatedBooking.id)
        ? {
            ...booking,
            ...updatedBooking,
            services: {
              ...booking.services,
              name:
                updatedBooking.service_name ??
                booking.services?.name ??
                booking.service_name,
            },
          }
        : booking;

    setBookings((prev) => prev.map(optimisticBooking));

    try {
      const res = await fetch(apiPath(storeSlug, `/booking/${updatedBooking.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_name: updatedBooking.customer_name,
          customer_phone: updatedBooking.customer_phone,
          service_id: updatedBooking.service_id,
          staff_id: updatedBooking.staff_id,
          date: updatedBooking.date,
          time: updatedBooking.time,
          party_size: updatedBooking.party_size,
          status: updatedBooking.status,
          is_walk_in: updatedBooking.is_walk_in,
          notes: updatedBooking.notes,
        }),
      });

      const result = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(result?.error || "Failed to update booking");
      }

      const savedBooking = result;

      setBookings((prev) =>
        prev.map((booking) =>
          String(booking.id) === String(savedBooking.id) ? savedBooking : booking
        )
      );

      setSelectedBooking(null);
    } catch (error) {
      console.error(error);
      setBookings(previousBookings);
      setSelectedBooking(previousSelectedBooking);
      alert(error.message || "Could not save booking changes.");
    }
  }

  if (loading && bookings.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center bg-white italic text-gray-500">
        Loading schedule...
      </div>
    );
  }

  if (!isStoreOpenThatDay) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white p-6">
        <div className="max-w-xl rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
          <h3 className="text-lg font-semibold text-amber-900">
            Store is closed on this date
          </h3>
          <p className="mt-2 text-sm text-amber-800">
            {businessHours?.note || "No business hours available for this day."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden bg-white">
      <div className="relative h-full overflow-auto">
        <div
          className="relative"
          style={{
            width: totalGridWidth,
            minWidth: totalGridWidth,
          }}
        >
          <div
            className="sticky top-0 z-30 grid bg-gray-50"
            style={{
              gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(${staffList.length}, ${STAFF_COLUMN_WIDTH}px) ${UNASSIGNED_COLUMN_WIDTH}px`,
            }}
          >
            <div className="sticky left-0 z-40 border-b bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-600">
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="text-[10px] uppercase tracking-tighter text-blue-500 hover:underline"
              >
                Refresh
              </button>
            </div>

            {staffList.map((staff) => (
              <div
                key={staff.id}
                className="border-b border-l bg-gray-50 px-4 py-3 text-center text-sm font-semibold text-gray-800"
              >
                {staff.name}
              </div>
            ))}

            <div className="border-b border-l border-amber-200 bg-amber-50 px-2 py-3 text-center text-sm font-semibold text-amber-700">
              Unassigned
            </div>
          </div>

          <div className="relative">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(${staffList.length}, ${STAFF_COLUMN_WIDTH}px) ${UNASSIGNED_COLUMN_WIDTH}px`,
              }}
            >
              {timeSlots.map((slot) => (
                <React.Fragment key={slot.label}>
                  <div
                    className={`sticky left-0 z-10 flex items-center justify-end border-r px-3 text-xs ${
                      slot.isMajor
                        ? "border-t border-gray-300 bg-gray-50 text-gray-700"
                        : "border-t border-gray-100 bg-white text-gray-400"
                    }`}
                    style={{ height: SLOT_HEIGHT }}
                  >
                    <div className="pr-1">{slot.isMajor ? slot.label : ""}</div>
                  </div>

                  {staffList.map((staff) => (
                    <div
                      key={`${staff.id}-${slot.label}`}
                      className={`border-l bg-white ${
                        slot.isMajor
                          ? "border-t border-gray-300"
                          : "border-t border-gray-100"
                      }`}
                      style={{ height: SLOT_HEIGHT }}
                    />
                  ))}

                  <div
                    className={`border-l border-amber-100 bg-amber-50/30 ${
                      slot.isMajor
                        ? "border-t border-gray-300"
                        : "border-t border-gray-100"
                    }`}
                    style={{ height: SLOT_HEIGHT }}
                  />
                </React.Fragment>
              ))}
            </div>

            {staffList.map((staff, staffIndex) => {
              const staffBookings = activeBookings.filter(
                (booking) =>
                  String(booking.staff_id) === String(staff.id) &&
                  workingStaffIds.has(String(booking.staff_id))
              );

              return (
                <div
                  key={staff.id}
                  className="absolute top-0"
                  style={{
                    left: TIME_COLUMN_WIDTH + staffIndex * STAFF_COLUMN_WIDTH,
                    width: STAFF_COLUMN_WIDTH,
                    height: gridHeight,
                  }}
                >
                  {staffBookings.map((booking) => {
                    const top = getTopOffsetPx(booking.time);
                    const height = getHeightPx(
                      booking.duration ?? booking.services?.duration
                    );

                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => openBookingDetails(booking)}
                        className="absolute left-2 right-2 z-10 text-left"
                        style={{
                          top: top + 2,
                          height: Math.max(height - 4, 28),
                        }}
                      >
                        <BookingCard
                          customer_name={booking.customer_name}
                          customer_phone={booking.customer_phone}
                          service_name={
                            booking.services?.name || booking.service_name
                          }
                          time={booking.time?.substring(0, 5)}
                          duration={
                            booking.duration ?? booking.services?.duration
                          }
                          status={booking.status?.toLowerCase()}
                          notes={booking.notes}
                          is_staff_requested={Boolean(
                            booking.requested_staff_id ||
                              booking.is_staff_requested
                          )}
                          requested_staff_name={
                            booking.requested_staff?.name_display ||
                            booking.requested_staff?.name ||
                            ""
                          }
                        />
                      </button>
                    );
                  })}
                </div>
              );
            })}

            <div
              className="absolute top-0"
              style={{
                left: TIME_COLUMN_WIDTH + staffList.length * STAFF_COLUMN_WIDTH,
                width: UNASSIGNED_COLUMN_WIDTH,
                height: gridHeight,
              }}
            >
              {unassignedBookings.map((booking) => {
                const top = getTopOffsetPx(booking.time);
                const height = getHeightPx(
                  booking.duration ?? booking.services?.duration
                );

                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => openBookingDetails(booking)}
                    className="absolute left-1.5 right-1.5 z-10 text-left"
                    style={{
                      top: top + 2,
                      height: Math.max(height - 4, 28),
                    }}
                  >
                    <div className="h-full rounded-lg ring-1 ring-amber-300">
                      <BookingCard
                        customer_name={booking.customer_name}
                        customer_phone={booking.customer_phone}
                        service_name={
                          booking.services?.name || booking.service_name
                        }
                        time={booking.time?.substring(0, 5)}
                        duration={booking.duration ?? booking.services?.duration}
                        status={booking.status?.toLowerCase()}
                        notes={booking.notes}
                        compact
                        is_staff_requested={Boolean(
                          booking.requested_staff_id ||
                            booking.is_staff_requested
                        )}
                        requested_staff_name={
                          booking.requested_staff?.name_display ||
                          booking.requested_staff?.name ||
                          ""
                        }
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <BookingDetailsModal
        booking={selectedBooking}
        open={Boolean(selectedBooking)}
        onClose={closeBookingDetails}
        onSave={handleSaveBooking}
        availableStaffOptions={staffList}
        allBookings={bookings}
        storeSlug={storeSlug}
      />
    </div>
  );
}