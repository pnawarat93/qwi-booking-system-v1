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

export default function NewBookingModal({
  open,
  selectedDate,
  onClose,
  onCreated,
  storeSlug,
  copy = {},
}) {
  const labels = {
    title: "New booking",
    subtitle: "Create a phone or future appointment for the schedule.",
    customer: "Customer",
    customerHelper: "Details for the person making the booking.",
    appointment: "Appointment",
    appointmentHelper: "Choose the service, time, and preferred staff.",
    notes: "Notes",
    customerName: "Customer name",
    phone: "Phone",
    service: "Service",
    date: "Date",
    time: "Time",
    staff: "Staff",
    partySize: "Party size",
    selectService: "Select service",
    autoAssign: "Auto assign available staff",
    staffHelper:
      "Keenie will choose available staff based on today's grid order.",
    optionalNote: "Optional request or phone note",
    storeClosed: "Store is closed on this date.",
    chooseAnotherDate: "Please choose another date.",
    hoursForDate: "Hours for this date",
    phoneNumber: "Phone number",
    close: "Close",
    cancel: "Cancel",
    saving: "Saving...",
    submit: "Create booking",
    ...copy,
  };

  const [services, setServices] = useState([]);
  const [effectiveStaff, setEffectiveStaff] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [businessHours, setBusinessHours] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const sydneyToday = getSydneyTodayDate();
  const defaultTime =
    selectedDate === sydneyToday ? getSydneyRoundedNowTime() : "09:00";

  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    service_id: "",
    staff_id: "",
    date: selectedDate,
    time: defaultTime,
    party_size: 1,
    status: "pending",
    is_walk_in: false,
    notes: "",
  });

  useEffect(() => {
    if (!open) return;

    const nextDefaultTime =
      selectedDate === getSydneyTodayDate()
        ? getSydneyRoundedNowTime()
        : "09:00";

    setFormData({
      customer_name: "",
      customer_phone: "",
      service_id: "",
      staff_id: "",
      date: selectedDate,
      time: nextDefaultTime,
      party_size: 1,
      status: "pending",
      is_walk_in: false,
      notes: "",
    });
  }, [open, selectedDate]);

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
              prev.date === sydneyToday
                ? getSydneyRoundedNowTime()
                : "09:00",
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
        console.error("Failed to load new booking options:", error);
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

    if (!selectedService || !formData.time) return effectiveStaff;

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
        if (!["pending", "paid", "completed"].includes(booking.status?.toLowerCase())) {
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
  }, [formData.staff_id, availableStaffList]);

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

    if (!formData.customer_name.trim()) {
      alert("Please enter customer name.");
      return;
    }

    if (!formData.customer_phone.trim()) {
      alert("Please enter customer phone.");
      return;
    }

    if (!formData.service_id) {
      alert("Please select service.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        customer_name: formData.customer_name.trim(),
        customer_phone: formData.customer_phone.trim(),
        service_id: Number(formData.service_id),
        staff_id: formData.staff_id ? Number(formData.staff_id) : null,
        date: formData.date,
        time: formData.time,
        party_size: Number(formData.party_size),
        status: "pending",
        is_walk_in: false,
        notes: formData.notes?.trim() || null,
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
        throw new Error(createdBooking?.error || "Failed to create booking");
      }

      onCreated?.(createdBooking);
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not create booking.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-[#E3D6C8] bg-[#FFFDF9] shadow-[0_18px_48px_rgba(47,41,38,0.18)]">
        <div className="flex flex-col gap-2 border-b border-[#E3D6C8] bg-[#F8F3EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#2F2926]">
              {labels.title}
            </h2>
            <p className="mt-1 text-sm text-[#7A675F]">
              {labels.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#E3D6C8] bg-white px-3 py-2 text-sm font-semibold text-[#7A675F] transition hover:bg-[#FFFDF9]"
          >
            {labels.close}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {formData.date && businessHours?.is_open === false && (
              <div className="rounded-2xl border border-[#D6B894] bg-[#F1E4D5] px-4 py-3 text-sm text-[#6B4F35]">
                <p className="font-semibold">{labels.storeClosed}</p>
                <p className="mt-1">
                  {businessHours?.note || labels.chooseAnotherDate}
                </p>
              </div>
            )}

            {formData.date && businessHours?.is_open && (
              <div className="rounded-2xl border border-[#BFCDBF] bg-[#E8EFE8] px-4 py-3 text-sm text-[#3F5747]">
                {labels.hoursForDate}: {safeTimeLabel(businessHours.open_time)} -{" "}
                {safeTimeLabel(businessHours.close_time)}
                {businessHours?.note ? ` · ${businessHours.note}` : ""}
              </div>
            )}

            <section className="rounded-3xl border border-[#E3D6C8] bg-white px-4 py-4 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4F6A55]">
                  {labels.customer}
                </p>
                <p className="mt-1 text-sm text-[#7A675F]">
                  {labels.customerHelper}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#5F4E47]">
                    {labels.customerName}
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) =>
                      updateField("customer_name", e.target.value)
                    }
                    className="w-full rounded-2xl border border-[#E3D6C8] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2F2926] outline-none transition focus:border-[#4F6A55] focus:ring-2 focus:ring-[#E8EFE8]"
                    placeholder={labels.customerName}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#5F4E47]">
                    {labels.phone}
                  </label>
                  <input
                    type="text"
                    value={formData.customer_phone}
                    onChange={(e) =>
                      updateField("customer_phone", e.target.value)
                    }
                    className="w-full rounded-2xl border border-[#E3D6C8] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2F2926] outline-none transition focus:border-[#4F6A55] focus:ring-2 focus:ring-[#E8EFE8]"
                    placeholder={labels.phoneNumber}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[#E3D6C8] bg-white px-4 py-4 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4F6A55]">
                  {labels.appointment}
                </p>
                <p className="mt-1 text-sm text-[#7A675F]">
                  {labels.appointmentHelper}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#5F4E47]">
                    {labels.service}
                  </label>
                  <select
                    value={formData.service_id}
                    onChange={(e) => updateField("service_id", e.target.value)}
                    className="w-full rounded-2xl border border-[#E3D6C8] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2F2926] outline-none transition focus:border-[#4F6A55] focus:ring-2 focus:ring-[#E8EFE8]"
                    disabled={
                      loadingOptions || businessHours?.is_open === false
                    }
                  >
                    <option value="">{labels.selectService}</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} ({service.duration} mins)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#5F4E47]">
                    {labels.date}
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    min={getSydneyTodayDate()}
                    onChange={(e) => updateField("date", e.target.value)}
                    className="w-full rounded-2xl border border-[#E3D6C8] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2F2926] outline-none transition focus:border-[#4F6A55] focus:ring-2 focus:ring-[#E8EFE8]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#5F4E47]">
                    {labels.time}
                  </label>
                  <input
                    type="time"
                    step="300"
                    value={formData.time}
                    onChange={(e) => updateField("time", e.target.value)}
                    className="w-full rounded-2xl border border-[#E3D6C8] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2F2926] outline-none transition focus:border-[#4F6A55] focus:ring-2 focus:ring-[#E8EFE8]"
                    disabled={businessHours?.is_open === false}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#5F4E47]">
                    {labels.staff}
                  </label>
                  <select
                    value={formData.staff_id}
                    onChange={(e) => updateField("staff_id", e.target.value)}
                    className="w-full rounded-2xl border border-[#E3D6C8] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2F2926] outline-none transition focus:border-[#4F6A55] focus:ring-2 focus:ring-[#E8EFE8]"
                    disabled={
                      loadingOptions || businessHours?.is_open === false
                    }
                  >
                    <option value="">{labels.autoAssign}</option>
                    {availableStaffList.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                        {staff.staff_code ? ` (${staff.staff_code})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[#8A7A72]">
                    {labels.staffHelper}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#5F4E47]">
                    {labels.partySize}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.party_size}
                    onChange={(e) => updateField("party_size", e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full rounded-2xl border border-[#E3D6C8] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2F2926] outline-none transition focus:border-[#4F6A55] focus:ring-2 focus:ring-[#E8EFE8]"
                  />
                </div>

              </div>
            </section>

            <section className="rounded-3xl border border-[#E3D6C8] bg-white px-4 py-4 shadow-sm">
              <label className="mb-2 block text-sm font-semibold text-[#5F4E47]">
                {labels.notes}
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="w-full rounded-2xl border border-[#E3D6C8] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2F2926] outline-none transition focus:border-[#4F6A55] focus:ring-2 focus:ring-[#E8EFE8]"
                placeholder={labels.optionalNote}
              />
            </section>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-[#E3D6C8] bg-[#FFFDF9] px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-[#E3D6C8] bg-white px-4 py-2 text-sm font-semibold text-[#7A675F] hover:bg-[#FFFDF9]"
            >
              {labels.cancel}
            </button>

            <button
              type="submit"
              disabled={saving || businessHours?.is_open === false}
              className="rounded-2xl bg-[#4A3A34] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3A2D28] disabled:opacity-50"
            >
              {saving ? labels.saving : labels.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
