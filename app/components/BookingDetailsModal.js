"use client";

import { useEffect, useMemo, useState } from "react";

const STATUS_OPTIONS = ["pending", "paid", "cancelled", "no_show"];

export default function BookingDetailsModal({
  booking,
  open,
  onClose,
  onSave,
  onRefresh,
}) {
  const [formData, setFormData] = useState({
    customer_name: "",
    service_name: "",
    time: "",
    duration: 30,
    status: "pending",
    notes: "",
    staff_id: "",
  });

  const [paymentInfo, setPaymentInfo] = useState({
    cash: 0,
    card: 0,
    hicaps: 0,
    other: 0,
  });

  const [paymentScope, setPaymentScope] = useState("job");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  const [availableStaff, setAvailableStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  useEffect(() => {
    if (!booking) return;

    setFormData({
      customer_name: booking.customer_name || "",
      service_name: booking.services?.name || booking.service_name || "",
      time: booking.time?.substring(0, 5) || "",
      duration: booking.duration ?? booking.services?.duration ?? 30,
      status: booking.status?.toLowerCase() || "pending",
      notes: booking.notes || "",
      staff_id: booking.staff_id ? String(booking.staff_id) : "",
    });

    setPaymentInfo({
      cash: 0,
      card: 0,
      hicaps: 0,
      other: 0,
    });

    setShowPaymentForm(false);
    setPaymentScope("job");
  }, [booking]);

  useEffect(() => {
    if (!open || !booking?.date) return;

    async function fetchAvailableStaff() {
      setLoadingStaff(true);

      try {
        const res = await fetch(`/api/staff-shifts?date=${booking.date}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load available staff");
        }

        const normalized = Array.isArray(data)
          ? data
              .filter((shift) => shift.users)
              .map((shift) => ({
                id: shift.users.id,
                name: shift.users.name_display || shift.users.name,
                staff_code: shift.users.staff_code || "",
              }))
          : [];

        setAvailableStaff(normalized);
      } catch (error) {
        console.error(error);
        setAvailableStaff([]);
      } finally {
        setLoadingStaff(false);
      }
    }

    fetchAvailableStaff();
  }, [open, booking?.date]);

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
      formData.notes !== (booking.notes || "") ||
      String(formData.staff_id || "") !== String(booking.staff_id || "")
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

    if (nextStatus === "paid") {
      setShowPaymentForm(true);
    } else {
      setShowPaymentForm(false);
    }
  }

  async function handleRecordPayment() {
    setIsRecordingPayment(true);

    try {
      const payload =
        paymentScope === "group" && booking.job_group_id
          ? {
              jobgroup_id: booking.job_group_id,
              cash: paymentInfo.cash,
              card: paymentInfo.card,
              hicaps: paymentInfo.hicaps,
              other: paymentInfo.other,
            }
          : {
              job_id: booking.id,
              cash: paymentInfo.cash,
              card: paymentInfo.card,
              hicaps: paymentInfo.hicaps,
              other: paymentInfo.other,
            };

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Failed to record payment");
      }

      onRefresh?.();
      onClose?.();
    } catch (error) {
      alert(error.message || "Failed to record payment");
    } finally {
      setIsRecordingPayment(false);
    }
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
      staff_id: formData.staff_id ? Number(formData.staff_id) : null,
    });
  }

  const currentStaffMissing =
    booking.staff_id &&
    !availableStaff.some(
      (staff) => String(staff.id) === String(booking.staff_id)
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="shrink-0 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Booking details
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Review booking info and reassign staff if needed.
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
        </div>

        <div className="space-y-6 overflow-y-auto px-6 py-6">
          {currentStaffMissing && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">Needs reassignment.</span>
              <span className="ml-2">
                The originally assigned staff member is not on today’s shift.
              </span>
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
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Assigned staff
            </label>

            <select
              value={formData.staff_id}
              onChange={(e) => updateField("staff_id", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-400"
              disabled={loadingStaff}
            >
              <option value="">Unassigned</option>
              {availableStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                  {staff.staff_code ? ` (${staff.staff_code})` : ""}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-gray-500">
              Only staff on the selected date’s shift are shown here.
            </p>
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

          {showPaymentForm && (
            <div className="space-y-4 rounded-xl border border-green-100 bg-green-50/30 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-green-800">
                  Payment information
                </h3>
                {booking.job_group_id && (
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                    Group booking
                  </span>
                )}
              </div>

              {booking.job_group_id && (
                <div className="space-y-3 rounded-lg bg-white/70 p-4">
                  <p className="text-sm font-medium text-gray-800">
                    Choose payment scope
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentScope("job")}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                        paymentScope === "job"
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-700"
                      }`}
                    >
                      Pay this job only
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentScope("group")}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                        paymentScope === "group"
                          ? "border-green-300 bg-green-50 text-green-700"
                          : "border-gray-200 text-gray-700"
                      }`}
                    >
                      Pay whole group
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Cash ($)
                  </label>
                  <input
                    type="number"
                    value={paymentInfo.cash}
                    onChange={(e) =>
                      setPaymentInfo({ ...paymentInfo, cash: e.target.value })
                    }
                    className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-400"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Card ($)
                  </label>
                  <input
                    type="number"
                    value={paymentInfo.card}
                    onChange={(e) =>
                      setPaymentInfo({ ...paymentInfo, card: e.target.value })
                    }
                    className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-400"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Hicaps ($)
                  </label>
                  <input
                    type="number"
                    value={paymentInfo.hicaps}
                    onChange={(e) =>
                      setPaymentInfo({ ...paymentInfo, hicaps: e.target.value })
                    }
                    className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-400"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Other ($)
                  </label>
                  <input
                    type="number"
                    value={paymentInfo.other}
                    onChange={(e) =>
                      setPaymentInfo({ ...paymentInfo, other: e.target.value })
                    }
                    className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-400"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {(!booking.payments || booking.payments.length === 0) && (
                <button
                  type="button"
                  onClick={handleRecordPayment}
                  disabled={isRecordingPayment}
                  className="w-full rounded-lg bg-green-600 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-green-200 transition-all hover:bg-green-700 disabled:opacity-50"
                >
                  {isRecordingPayment ? "Recording..." : "Finalize & Record Payment"}
                </button>
              )}
            </div>
          )}

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