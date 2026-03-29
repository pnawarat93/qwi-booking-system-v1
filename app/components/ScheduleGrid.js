"use client";

import React, { useEffect, useMemo, useState } from "react";
import BookingCard from "./BookingCard";
import BookingDetailsModal from "./BookingDetailsModal";

const startHour = 8;
const endHour = 20;
const SLOT_MINUTES = 5;
const SLOT_HEIGHT = 32;
const TIME_COLUMN_WIDTH = 80;
const STAFF_COLUMN_WIDTH = 280;

const ACTIVE_GRID_STATUSES = ["pending", "paid"];
const INACTIVE_DAY_STATUSES = ["cancelled", "no_show"];

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

  const safeTime = timeString.substring(0, 5);
  const [hours, minutes] = safeTime.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  return hours * 60 + minutes;
}

function getTopOffsetPx(timeString) {
  const bookingMinutes = timeToMinutes(timeString);
  if (bookingMinutes === null) return 0;

  const dayStartMinutes = startHour * 60;
  const diffMinutes = bookingMinutes - dayStartMinutes;

  return (diffMinutes / SLOT_MINUTES) * SLOT_HEIGHT;
}

function getHeightPx(durationMinutes) {
  const safeDuration = Number(durationMinutes) || 30;
  return (safeDuration / SLOT_MINUTES) * SLOT_HEIGHT;
}

export default function ScheduleGrid({
  selectedDate = new Date().toISOString().split("T")[0],
}) {
  const [staffList, setStaffList] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      try {
        const [staffRes, bookingsRes] = await Promise.all([
          fetch("/api/staffs"),
          fetch(`/api/booking?date=${selectedDate}`),
        ]);

        const staffData = await staffRes.json();
        const bookingsData = await bookingsRes.json();

        if (Array.isArray(staffData)) setStaffList(staffData);
        if (Array.isArray(bookingsData)) setBookings(bookingsData);
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [selectedDate, refreshKey]);

  const timeSlots = useMemo(() => generateTimeSlots(startHour, endHour), []);

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

  const totalRows = timeSlots.length;
  const gridHeight = totalRows * SLOT_HEIGHT;
  const totalGridWidth =
    TIME_COLUMN_WIDTH + staffList.length * STAFF_COLUMN_WIDTH;

  function openBookingDetails(booking) {
    setSelectedBooking(booking);
  }

  function closeBookingDetails() {
    setSelectedBooking(null);
  }

  function handleSaveBooking(updatedBooking) {
    setBookings((prev) =>
      prev.map((booking) =>
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
          : booking
      )
    );

    setSelectedBooking((prev) =>
      prev && String(prev.id) === String(updatedBooking.id)
        ? {
            ...prev,
            ...updatedBooking,
            services: {
              ...prev.services,
              name:
                updatedBooking.service_name ??
                prev.services?.name ??
                prev.service_name,
            },
          }
        : prev
    );

    // Later:
    // await fetch(`/api/booking/${updatedBooking.id}`, {
    //   method: "PATCH",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(updatedBooking),
    // });

    if (INACTIVE_DAY_STATUSES.includes(updatedBooking.status?.toLowerCase())) {
      setSelectedBooking(null);
    }
  }

  if (loading && bookings.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center bg-white italic text-gray-500">
        Loading schedule...
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white">
      <div className="h-full overflow-auto">
        <div
          className="relative"
          style={{
            width: totalGridWidth,
            minWidth: totalGridWidth,
          }}
        >
          <div
            className="sticky top-0 z-20 grid bg-gray-50"
            style={{
              gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(${staffList.length}, ${STAFF_COLUMN_WIDTH}px)`,
            }}
          >
            <div className="border-b px-3 py-3 text-sm font-semibold text-gray-600">
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
                className="border-b border-l px-4 py-3 text-center text-sm font-semibold text-gray-800"
              >
                {staff.name}
              </div>
            ))}
          </div>

          <div className="relative">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(${staffList.length}, ${STAFF_COLUMN_WIDTH}px)`,
              }}
            >
              {timeSlots.map((slot) => (
                <React.Fragment key={slot.label}>
                  <div
                    className={`flex items-center justify-end border-r px-3 text-xs ${
                      slot.isMajor
                        ? "border-t border-gray-300 bg-gray-50/50 text-gray-700"
                        : "border-t border-gray-100 text-gray-400"
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
                </React.Fragment>
              ))}
            </div>

            {staffList.map((staff, staffIndex) => {
              const staffBookings = activeBookings.filter(
                (booking) => String(booking.staff_id) === String(staff.id)
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
                          service_name={
                            booking.services?.name || booking.service_name
                          }
                          time={booking.time?.substring(0, 5)}
                          duration={
                            booking.duration ?? booking.services?.duration
                          }
                          status={booking.status?.toLowerCase()}
                        />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <BookingDetailsModal
        booking={selectedBooking}
        open={Boolean(selectedBooking)}
        onClose={closeBookingDetails}
        onSave={handleSaveBooking}
      />

      <div className="border-t bg-white px-4 py-2 text-xs text-gray-500">
        Total bookings: {bookings.length} | Active on grid: {activeBookings.length} |
        Cancelled / No-show: {inactiveDayBookings.length}
      </div>
    </div>
  );
}