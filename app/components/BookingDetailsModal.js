"use client";

import { useEffect, useMemo, useState } from "react";

const STATUS_OPTIONS = ["pending", "paid", "cancelled", "no_show"];

export default function BookingDetailsModal({
  booking,
  open,
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState({
    customer_name: "",
    service_name: "",
    time: "",
    duration: 30,
    status: "pending",
    notes: "",
  });

  useEffect(() => {
    if (!booking) return;

    setFormData({
      customer_name: booking.customer_name || "",
      service_name: booking.services?.name || booking.service_name || "",
      time: booking.time?.substring(0, 5) || "",
      duration: booking.duration ?? booking.services?.duration ?? 30,
      status: booking.status?.toLowerCase() || "pending",
      notes: booking.notes || "",
    });
  }, [booking]);

  const isDirty = useMemo(() => {
    if (!booking) return false;

    return (
      formData.customer_name !== (booking.customer_name || "") ||
      formData.service_name !==
        (booking.services?.name || booking.service_name || "") ||
      formData.time !== (booking.time?.substring(0, 5) || "") ||
      Number(formData.duration) !==
        Number(booking.duration ?? booking.services?.duration ?? 30) ||
      formData.status !== (booking.status?.toLowerCase() || "pending") ||
      formData.notes !== (booking.notes || "")
    );
  }, [booking, formData]);

  if (!open || !booking) return null;

  function updateField(field, value) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleStatusChange(nextStatus) {
    if (!STATUS_OPTIONS.includes(nextStatus)) return;

    setFormData((prev) => ({
      ...prev,
      status: nextStatus,
    }));
  }

  function handleSave() {
    if (!booking) return;

    onSave?.({
      ...booking,
      customer_name: formData.customer_name,
      service_name: formData.service_name,
      time: formData.time,
      duration: Number(formData.duration),
      status: formData.status,
      notes: formData.notes,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Booking details
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Structure first — editing can expand later.
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

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Customer name
              </label>
              <input
                type="text"
                value={formData.customer_name}
                onChange={(e) => updateField("customer_name", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Service name
              </label>
              <input
                type="text"
                value={formData.service_name}
                onChange={(e) => updateField("service_name", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-400"
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
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Duration (mins)
              </label>
              <input
                type="number"
                min="5"
                step="5"
                value={formData.duration}
                onChange={(e) => updateField("duration", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Status</p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange("paid")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  formData.status === "paid"
                    ? "border-green-300 bg-green-50 text-green-700"
                    : "border-gray-200 text-gray-700"
                }`}
              >
                Mark as paid
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange("cancelled")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  formData.status === "cancelled"
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-gray-200 text-gray-700"
                }`}
              >
                Mark as cancelled
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange("no_show")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  formData.status === "no_show"
                    ? "border-gray-400 bg-gray-100 text-gray-700"
                    : "border-gray-200 text-gray-700"
                }`}
              >
                Mark as no_show
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange("pending")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  formData.status === "pending"
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-700"
                }`}
              >
                Back to pending
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-400"
              placeholder="Keep for later extensibility"
            />
          </div>

          <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
            <p>
              <span className="font-medium text-gray-800">Booking ID:</span>{" "}
              {booking.id}
            </p>
            <p className="mt-1">
              <span className="font-medium text-gray-800">Current grid rule:</span>{" "}
              only <span className="font-medium">pending</span> and{" "}
              <span className="font-medium">paid</span> stay on the schedule.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4">
          <p className="text-sm text-gray-500">
            {isDirty ? "Unsaved changes" : "No changes yet"}
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}