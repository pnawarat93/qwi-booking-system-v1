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
      is_walk_in: true,
    });
  }, [open, selectedDate, sydneyToday]);

  useEffect(() => {
    if (!open || !formData.date) return;

    async function loadOptions() {
      setLoadingOptions(true);

      try {
        const [servicesRes, hoursRes, staffRes, bookingsRes] =
          await Promise.all([
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
      return [];
    }

    const targetStart = timeToMinutes(formData.time);
    const targetDuration = Number(selectedService.duration || 30);
    const openMinutes = timeToMinutes(businessHours?.open_time);
    const closeMinutes = timeToMinutes(businessHours?.close_time);

    if (targetStart === null) return [];

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

  useEffect(() => {
    if (availableStaffList.length !== 1) return;

    const onlyStaff = availableStaffList[0];

    setFormData((prev) => {
      if (String(prev.staff_id) === String(onlyStaff.id)) {
        return prev;
      }

      return {
        ...prev,
        staff_id: String(onlyStaff.id),
      };
    });
  }, [availableStaffList]);

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
        customer_name: formData.customer_name || "Walk-in",
        customer_phone: formData.customer_phone || "",
        service_id: Number(formData.service_id),
        staff_id: Number(formData.staff_id),
        date: formData.date,
        time: formData.time,
        party_size: 1,
        status: "pending",
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
        throw new Error(
          createdBooking?.error || "Failed to create walk-in booking"
        );
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-[2rem] border border-[#E8DED6] bg-[#FFFCFA] shadow-[0_16px_32px_rgba(63,55,51,0.12)]">
        <div className="flex flex-col gap-2 border-b border-[#E8DED6] bg-[#F8F1EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#3F3733]">
              Add walk-in
            </h2>
            <p className="mt-1 text-sm text-[#6F625C]">
              Add one walk-in customer to the schedule.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-semibold text-[#6F625C] transition hover:bg-[#FFF9F6]"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5 overflow-y-auto">
          {formData.date && businessHours?.is_open === false && (
            <div className="rounded-2xl border border-[#F3B2A5] bg-[#FFF1EE] px-4 py-3 text-sm text-[#9F3A2E]">
              <p className="font-semibold">Store is closed on this date.</p>
              <p className="mt-1 text-sm text-[#9F3A2E]">
                {businessHours?.note || "Please choose another date."}
              </p>
            </div>
          )}

          {formData.date && businessHours?.is_open && (
            <div className="rounded-2xl border border-[#D9E9DE] bg-[#EFF8F3] px-4 py-3 text-sm text-[#186C4D]">
              Hours for this date: {safeTimeLabel(businessHours.open_time)} -{" "}
              {safeTimeLabel(businessHours.close_time)}
              {businessHours?.note ? ` · ${businessHours.note}` : ""}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#6F625C]">
                Customer name
              </label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => updateField("customer_name", e.target.value)}
                className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                placeholder="Walk-in customer"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#6F625C]">
                Phone
              </label>
              <input
                type="text"
                value={formData.customer_phone}
                onChange={(e) => updateField("customer_phone", e.target.value)}
                className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#6F625C]">
                Service
              </label>
              <select
                value={formData.service_id}
                onChange={(e) => {
                  updateField("service_id", e.target.value);
                  setFormData((prev) => ({
                    ...prev,
                    staff_id: "",
                  }));
                }}
                className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
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
              <label className="mb-2 block text-sm font-semibold text-[#6F625C]">
                Time
              </label>
              <input
                type="time"
                step="300"
                value={formData.time}
                onChange={(e) => updateField("time", e.target.value)}
                className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                disabled={businessHours?.is_open === false}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-[#6F625C]">
                Staff
              </label>
              <select
                value={formData.staff_id}
                onChange={(e) => updateField("staff_id", e.target.value)}
                className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                disabled={
                  loadingOptions ||
                  businessHours?.is_open === false ||
                  !formData.service_id ||
                  !formData.time
                }
              >
                <option value="">
                  {!formData.service_id
                    ? "Select service first"
                    : !formData.time
                      ? "Select time first"
                      : availableStaffList.length === 0
                        ? "No staff available"
                        : "Select staff"}
                </option>

                {availableStaffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                    {staff.staff_code ? ` (${staff.staff_code})` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[#9A8A84]">
                Staff options are calculated from the selected service and time.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#6F625C]">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateField("date", e.target.value)}
                className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
              />
            </div>

            <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-3 text-sm text-[#6F625C]">
              <p className="font-semibold text-[#3F3733]">One person per walk-in</p>
              <p className="mt-1 text-xs text-[#9A8A84]">
                If two people arrive together, add the second walk-in separately.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#E8DED6] pt-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-[#E8DED6] bg-white px-4 py-2 text-sm font-semibold text-[#6F625C] hover:bg-[#FFF9F6]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || businessHours?.is_open === false}
              className="rounded-2xl bg-[#B86F52] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A86248] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add walk-in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}