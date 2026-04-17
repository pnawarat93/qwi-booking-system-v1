"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSydneyRoundedNowTime,
  getSydneyTodayDate,
} from "@/lib/sydneyDate";
import { storeApiUrl } from "@/lib/storeApi";

function apiPath(slug, path) {
  return slug ? storeApiUrl(slug, path) : `/api${path}`;
}

const ACTIVE_BOOKING_STATUSES = ["pending", "paid"];

function safeTimeLabel(value, fallback = "09:00") {
  if (!value) return fallback;
  return String(value).substring(0, 5);
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

export default function AddWalkInModal({
  open,
  selectedDate,
  onClose,
  onCreated,
  storeSlug,
}) {
  const [services, setServices] = useState([]);
  const [effectiveStaff, setEffectiveStaff] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [businessHours, setBusinessHours] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const sydneyToday = useMemo(() => getSydneyTodayDate(), []);
  const initialDefaultTime = useMemo(() => {
    return selectedDate === sydneyToday ? getSydneyRoundedNowTime() : "09:00";
  }, [selectedDate, sydneyToday]);

  const [formData, setFormData] = useState({
    customer_name: "Walk-in",
    customer_phone: "",
    service_id: "",
    staff_id: "",
    date: selectedDate,
    time: initialDefaultTime,
    party_size: 1,
    status: "pending",
    is_walk_in: true,
  });

  useEffect(() => {
    if (!open) return;

    const nextDefaultTime =
      selectedDate === sydneyToday ? getSydneyRoundedNowTime() : "09:00";

    setFormData({
      customer_name: "Walk-in",
      customer_phone: "",
      service_id: "",
      staff_id: "",
      date: selectedDate,
      time: nextDefaultTime,
      party_size: 1,
      status: "pending",
      is_walk_in: true,
    });
  }, [open, selectedDate, sydneyToday]);

  useEffect(() => {
    if (!open || !formData.date) return;

    async function loadOptions() {
      setLoadingOptions(true);

      try {
        const [servicesRes, hoursRes, staffRes, bookingsRes] = await Promise.all([
          fetch(apiPath(storeSlug, "/services")),
          fetch(apiPath(storeSlug, `/business-hours?date=${formData.date}`)),
          fetch(apiPath(storeSlug, `/effective-staff?date=${formData.date}`)),
          fetch(apiPath(storeSlug, `/booking?date=${formData.date}`)),
        ]);

        const servicesData = await servicesRes.json();
        const hoursData = await hoursRes.json();
        const staffData = await staffRes.json();
        const bookingsData = await bookingsRes.json();

        setServices(Array.isArray(servicesData) ? servicesData : []);
        setBusinessHours(hoursData || null);

        if (hoursData?.is_open === false) {
          setEffectiveStaff([]);
          setBookings([]);
          setFormData((prev) => ({
            ...prev,
            staff_id: "",
            time:
              prev.date === sydneyToday ? getSydneyRoundedNowTime() : "09:00",
          }));
          return;
        }

        const normalizedStaff = Array.isArray(staffData?.items)
          ? staffData.items.map((staff) => ({
              id: staff.staff_id,
              name: staff.name_display || staff.name,
              staff_code: staff.staff_code || null,
              start_time: staff.start_time,
              end_time: staff.end_time,
              display_order: staff.display_order || 0,
              source: staff.source || "roster",
              note: staff.note || "",
            }))
          : [];

        setEffectiveStaff(normalizedStaff);
        setBookings(Array.isArray(bookingsData) ? bookingsData : []);

        setFormData((prev) => {
          const fallbackTime =
            prev.date === sydneyToday
              ? getSydneyRoundedNowTime()
              : safeTimeLabel(hoursData?.open_time, "09:00");

          const currentTimeMinutes = timeToMinutes(prev.time);
          const openMinutes = timeToMinutes(hoursData?.open_time);
          const closeMinutes = timeToMinutes(hoursData?.close_time);

          let nextTime = prev.time;

          if (
            currentTimeMinutes === null ||
            (openMinutes !== null && currentTimeMinutes < openMinutes) ||
            (closeMinutes !== null && currentTimeMinutes >= closeMinutes)
          ) {
            nextTime = fallbackTime;
          }

          return {
            ...prev,
            time: nextTime,
          };
        });
      } catch (error) {
        console.error("Failed to load walk-in options:", error);
        setServices([]);
        setEffectiveStaff([]);
        setBookings([]);
        setBusinessHours(null);
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, [open, formData.date, storeSlug, sydneyToday]);

  const selectedService = useMemo(() => {
    return services.find(
      (service) => String(service.id) === String(formData.service_id)
    );
  }, [services, formData.service_id]);

  const availableStaffList = useMemo(() => {
    if (businessHours?.is_open === false) return [];

    if (!selectedService || !formData.time) {
      return effectiveStaff;
    }

    const targetStart = timeToMinutes(formData.time);
    const targetDuration = Number(selectedService.duration || 30);
    const openMinutes = timeToMinutes(businessHours?.open_time);
    const closeMinutes = timeToMinutes(businessHours?.close_time);

    if (targetStart === null) return effectiveStaff;

    if (openMinutes !== null && targetStart < openMinutes) return [];
    if (closeMinutes !== null && targetStart + targetDuration > closeMinutes) {
      return [];
    }

    return effectiveStaff.filter((staff) => {
      const shiftStart = timeToMinutes(staff.start_time || "00:00");
      const shiftEnd = timeToMinutes(staff.end_time || "23:59");

      if (shiftStart !== null && targetStart < shiftStart) return false;
      if (shiftEnd !== null && targetStart + targetDuration > shiftEnd) {
        return false;
      }

      const hasConflict = bookings.some((booking) => {
        if (!ACTIVE_BOOKING_STATUSES.includes(booking.status?.toLowerCase())) {
          return false;
        }

        if (String(booking.staff_id) !== String(staff.id)) {
          return false;
        }

        const bookingStart = timeToMinutes(booking.time);
        const bookingDuration = Number(
          booking.duration ?? booking.services?.duration ?? 30
        );

        if (bookingStart === null) return false;

        return bookingsOverlap(
          targetStart,
          targetDuration,
          bookingStart,
          bookingDuration
        );
      });

      return !hasConflict;
    });
  }, [effectiveStaff, bookings, selectedService, formData.time, businessHours]);

  useEffect(() => {
    if (!formData.staff_id) return;

    const stillAvailable = availableStaffList.some(
      (staff) => String(staff.id) === String(formData.staff_id)
    );

    if (!stillAvailable) {
      setFormData((prev) => ({
        ...prev,
        staff_id: "",
      }));
    }
  }, [availableStaffList, formData.staff_id]);

  if (!open) return null;

  function updateField(field, value) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (businessHours?.is_open === false) {
      alert("Store is closed on this date.");
      return;
    }

    if (!formData.service_id || !formData.staff_id) {
      alert("Please select service and staff.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        service_id: Number(formData.service_id),
        staff_id: Number(formData.staff_id),
        date: formData.date,
        time: formData.time,
        party_size: Number(formData.party_size),
        status: formData.status,
        is_walk_in: true,
      };

      const res = await fetch(apiPath(storeSlug, "/booking"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const createdBooking = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(createdBooking?.error || "Failed to create walk-in booking");
      }

      onCreated?.(createdBooking);
      onClose?.();
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not create walk-in.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add walk-in</h2>
            <p className="mt-1 text-sm text-gray-500">
              Quick add for today’s grid
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
          {formData.date && businessHours?.is_open === false && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Store is closed on this date.</p>
              <p className="mt-1">
                {businessHours?.note || "Please choose another date."}
              </p>
            </div>
          )}

          {formData.date && businessHours?.is_open && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Hours for this date: {safeTimeLabel(businessHours.open_time)} -{" "}
              {safeTimeLabel(businessHours.close_time)}
              {businessHours?.note ? ` · ${businessHours.note}` : ""}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Customer name
              </label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => updateField("customer_name", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Walk-in customer"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                type="text"
                value={formData.customer_phone}
                onChange={(e) => updateField("customer_phone", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Optional for now"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Service
              </label>
              <select
                value={formData.service_id}
                onChange={(e) => updateField("service_id", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                disabled={loadingOptions || businessHours?.is_open === false}
              >
                <option value="">Select service</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.duration} mins)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Staff
              </label>
              <select
                value={formData.staff_id}
                onChange={(e) => updateField("staff_id", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                disabled={loadingOptions || businessHours?.is_open === false}
              >
                <option value="">Select staff</option>
                {availableStaffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                    {staff.staff_code ? ` (${staff.staff_code})` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Shows only staff working on this date and free at this time.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateField("date", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Time
              </label>
              <input
                type="time"
                step="300"
                value={formData.time}
                onChange={(e) => updateField("time", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                disabled={businessHours?.is_open === false}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Party size
              </label>
              <input
                type="number"
                min="1"
                value={formData.party_size}
                onChange={(e) => updateField("party_size", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => updateField("status", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="pending">pending</option>
                <option value="paid">paid</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || businessHours?.is_open === false}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add walk-in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}