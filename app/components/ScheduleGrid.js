import React, { useEffect, useState } from "react";
import BookingCard from "./BookingCard";

const startHour = 8;
const endHour = 20;

function generateTimeSlots(startHour, endHour) {
  const slots = [];

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
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

export default function ScheduleGrid({ selectedDate = new Date().toISOString().split("T")[0] }) {
  const [staffList, setStaffList] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [staffRes, bookingsRes] = await Promise.all([
          fetch("/api/staff"),
          fetch(`/api/booking?date=${selectedDate}`)
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

    // Polling every 30 seconds for "real-time" updates
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [selectedDate, refreshKey]);

  const timeSlots = generateTimeSlots(startHour, endHour);

  if (loading && bookings.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center bg-white italic text-gray-500">
        Loading schedule...
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto bg-white border-t">
      <div
        className="grid min-w-[900px]"
        style={{
          gridTemplateColumns: `80px repeat(${staffList.length}, minmax(220px, 1fr))`,
        }}
      >
        <div className="sticky top-0 z-30 border-b bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-600">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="text-[10px] text-blue-500 uppercase tracking-tighter hover:underline"
          >
            Refresh
          </button>
        </div>

        {staffList.map((staff) => (
          <div
            key={staff.id}
            className="sticky top-0 z-30 border-b border-l bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800 text-center"
          >
            {staff.name}
          </div>
        ))}

        {timeSlots.map((slot) => (
          <React.Fragment key={slot.label}>
            <div
              className={`h-8 px-3 text-xs flex items-center justify-end border-r ${slot.isMajor
                  ? "border-t border-gray-300 text-gray-700 bg-gray-50/50"
                  : "border-t border-gray-100 text-gray-400"
                }`}
            >
              <div className="pr-1">
                {slot.isMajor || slot.label.endsWith(":00.000") ? slot.label : ""}
              </div>
            </div>

            {staffList.map((staff) => {
              const booking = bookings.find(
                (item) => item.staff_id === staff.id && item.time.substring(0, 5) === slot.label
              );

              return (
                <div
                  key={`${staff.id}-${slot.label}`}
                  className={`relative h-8 border-l ${slot.isMajor ? "border-t border-gray-300" : "border-t border-gray-100"
                    } bg-white`}
                >
                  {booking && (
                    <div className="absolute left-1 right-1 top-[2px] z-20">
                      <BookingCard
                        customer_name={booking.customer_name}
                        service_name={booking.services?.name}
                        time={booking.time.substring(0, 5)}
                        duration={booking.services?.duration}
                        status={booking.status?.toLowerCase()}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}