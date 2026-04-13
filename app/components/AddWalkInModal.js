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
  const [shiftStaff, setShiftStaff] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const sydneyToday = useMemo(() => getSydneyTodayDate(), []);
  const defaultTime = useMemo(() => {
    return selectedDate === sydneyToday ? getSydneyRoundedNowTime() : "09:00";
  }, [selectedDate, sydneyToday]);

  const [formData, setFormData] = useState({
    customer_name: "Walk-in",
    customer_phone: "",
    service_id: "",
    staff_id: "",
    date: selectedDate,
    time: defaultTime,
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
        const [servicesRes, shiftRes, bookingsRes] = await Promise.all([
          fetch(apiPath(storeSlug, "/services")),
          fetch(apiPath(storeSlug, `/staff-shifts?date=${formData.date}`)),
          fetch(apiPath(storeSlug, `/booking?date=${formData.date}`)),
        ]);

        const servicesData = await servicesRes.json();
        const shiftData = await shiftRes.json();
        const bookingsData = await bookingsRes.json();

        setServices(Array.isArray(servicesData) ? servicesData : []);

        const normalizedShiftStaff = Array.isArray(shiftData)
          ? shiftData
              .filter((shift) => shift.users && shift.is_working)
              .map((shift) => ({
                id: shift.users.id,
                name: shift.users.name_display || shift.users.name,
                staff_code: shift.users.staff_code || null,
                start_time: shift.start_time,
                end_time: shift.end_time,
                display_order: shift.display_order || 0,
              }))
              .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
          : [];

        setShiftStaff(normalizedShiftStaff);
        setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      } catch (error) {
        console.error("Failed to load walk-in options:", error);
        setServices([]);
        setShiftStaff([]);
        setBookings([]);
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, [open, formData.date]);

  const selectedService = useMemo(() => {
    return services.find((service) => String(service.id) === String(formData.service_id));
  }, [services, formData.service_id]);

  const availableStaffList = useMemo(() => {
    if (!selectedService || !formData.time) {
      return shiftStaff;
    }

    const targetStart = timeToMinutes(formData.time);
    const targetDuration = Number(selectedService.duration || 30);

    if (targetStart === null) return shiftStaff;

    return shiftStaff.filter((staff) => {
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
  }, [shiftStaff, bookings, selectedService, formData.time]);

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
                disabled={loadingOptions}
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
                disabled={loadingOptions}
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
              disabled={saving}
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