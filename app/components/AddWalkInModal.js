"use client";

import { useEffect, useMemo, useState } from "react";

function roundToNextFiveMinutes(date = new Date()) {
  const d = new Date(date);
  d.setSeconds(0);
  d.setMilliseconds(0);

  const minutes = d.getMinutes();
  const rounded = Math.ceil(minutes / 5) * 5;

  if (rounded === 60) {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
  } else {
    d.setMinutes(rounded);
  }

  return d.toTimeString().slice(0, 5);
}

export default function AddWalkInModal({
  open,
  selectedDate,
  onClose,
  onCreated,
}) {
  const [services, setServices] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const defaultTime = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return selectedDate === today ? roundToNextFiveMinutes() : "09:00";
  }, [selectedDate]);

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

    setFormData({
      customer_name: "Walk-in",
      customer_phone: "",
      service_id: "",
      staff_id: "",
      date: selectedDate,
      time: selectedDate === new Date().toISOString().split("T")[0]
        ? roundToNextFiveMinutes()
        : "09:00",
      party_size: 1,
      status: "pending",
      is_walk_in: true,
    });
  }, [open, selectedDate]);

  useEffect(() => {
    if (!open) return;

    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [servicesRes, staffRes] = await Promise.all([
          fetch("/api/services"),
          fetch("/api/staffs"),
        ]);

        const servicesData = await servicesRes.json();
        const staffData = await staffRes.json();

        setServices(Array.isArray(servicesData) ? servicesData : []);
        setStaffList(Array.isArray(staffData) ? staffData : []);
      } catch (error) {
        console.error("Failed to load walk-in options:", error);
        setServices([]);
        setStaffList([]);
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, [open]);

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
      alert("Please select service, and staff.");
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

      const res = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to create walk-in booking");
      }

      const createdBooking = await res.json().catch(() => null);

      onCreated?.(createdBooking);
      onClose?.();
    } catch (error) {
      console.error(error);
      alert("Could not create walk-in. Check your API route.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/40 p-4">
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
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
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