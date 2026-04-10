"use client";

import { useEffect, useMemo, useState } from "react";

const STATUS_OPTIONS = ["pending", "paid", "cancelled", "no_show"];
const ACTIVE_BOOKING_STATUSES = ["pending", "paid"];

function timeToMinutes(timeString) {
  if (!timeString) return null;

  const safeTime = String(timeString).substring(0, 5);
  const [hours, minutes] = safeTime.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function bookingDuration(booking) {
  return Number(booking?.duration ?? booking?.services?.duration ?? 30);
}

function bookingsOverlap(aStart, aDuration, bStart, bDuration) {
  const aEnd = aStart + aDuration;
  const bEnd = bStart + bDuration;
  return aStart < bEnd && aEnd > bStart;
}

function formatTimeRange(startTime, duration) {
  if (!startTime) return "--:-- - --:--";

  const safeTime = String(startTime).substring(0, 5);
  const [hours, minutes] = safeTime.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return `${safeTime} - --:--`;
  }

  const startTotal = hours * 60 + minutes;
  const endTotal = startTotal + (Number(duration) || 30);

  const endHours = Math.floor(endTotal / 60);
  const endMinutes = endTotal % 60;

  return `${safeTime} - ${String(endHours).padStart(2, "0")}:${String(
    endMinutes
  ).padStart(2, "0")}`;
}

export default function BookingDetailsModal({
  booking,
  open,
  onClose,
  onSave,
  onRefresh,
  availableStaffOptions = [],
  allBookings = [],
}) {
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
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

  useEffect(() => {
    if (!booking) return;

    setFormData({
      customer_name: booking.customer_name || "",
      customer_phone: booking.customer_phone || "",
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

  const assignableStaff = useMemo(() => {
    if (!booking) return [];

    const targetStart = timeToMinutes(formData.time || booking.time);
    const targetDuration = Number(formData.duration) || bookingDuration(booking);

    if (targetStart === null) return [];

    return availableStaffOptions.filter((staff) => {
      const hasConflict = allBookings.some((otherBooking) => {
        if (!otherBooking) return false;
        if (String(otherBooking.id) === String(booking.id)) return false;
        if (String(otherBooking.staff_id) !== String(staff.id)) return false;
        if (otherBooking.date !== booking.date) return false;

        const otherStatus = otherBooking.status?.toLowerCase();
        if (!ACTIVE_BOOKING_STATUSES.includes(otherStatus)) return false;

        const otherStart = timeToMinutes(otherBooking.time);
        const otherDuration = bookingDuration(otherBooking);
        if (otherStart === null) return false;

        return bookingsOverlap(
          targetStart,
          targetDuration,
          otherStart,
          otherDuration
        );
      });

      return !hasConflict;
    });
  }, [availableStaffOptions, allBookings, booking, formData.time, formData.duration]);

  const currentStaffMissing = useMemo(() => {
    if (!booking?.staff_id) return false;

    return !availableStaffOptions.some(
      (staff) => String(staff.id) === String(booking.staff_id)
    );
  }, [availableStaffOptions, booking]);

  const isGroupBooking = Boolean(booking?.job_group_id);
  const isRequestedStaffBooking = Boolean(
    booking?.requested_staff_id || booking?.is_staff_requested
  );

  const originalStaffId = booking?.staff_id ? String(booking.staff_id) : "";
  const staffChanged = String(formData.staff_id || "") !== originalStaffId;

  const isDirty = useMemo(() => {
    if (!booking) return false;

    return (
      formData.customer_name !== (booking.customer_name || "") ||
      formData.customer_phone !== (booking.customer_phone || "") ||
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

    if (isRequestedStaffBooking && staffChanged) {
      const confirmed = window.confirm(
        "This customer requested a specific staff member. Are you sure you want to reassign this booking?"
      );

      if (!confirmed) return;
    }

    onSave?.({
      ...booking,
      customer_name: formData.customer_name,
      customer_phone: formData.customer_phone,
      service_name: formData.service_name,
      time: formData.time,
      duration: Number(formData.duration),
      status: formData.status,
      notes: formData.notes,
      staff_id: formData.staff_id ? Number(formData.staff_id) : null,
    });
  }

  const timeRange = formatTimeRange(formData.time, formData.duration);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="shrink-0 border-b px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">
                Booking details
              </h2>
              <p className="mt-1 text-sm text-gray-500">{timeRange}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {isGroupBooking && (
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                Group booking
              </span>
            )}

            {isRequestedStaffBooking && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                Requested staff booking
              </span>
            )}

            {currentStaffMissing && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                Needs reassignment
              </span>
            )}
          </div>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-6">
          <section className="rounded-xl border bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Customer
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Customer name
                </label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => updateField("customer_name", e.target.value)}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Phone number
                </label>
                <input
                  type="text"
                  value={formData.customer_phone}
                  onChange={(e) => updateField("customer_phone", e.target.value)}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Booking
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
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
                  Status
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatusChange("pending")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      formData.status === "pending"
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-700"
                    }`}
                  >
                    Pending
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange("paid")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                      formData.status === "paid"
                        ? "border-green-300 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-700"
                    }`}
                  >
                    Paid
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
                    Cancelled
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
                    No-show
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Assigned staff
            </h3>

            {(isRequestedStaffBooking || isGroupBooking) && (
              <div className="mb-3 space-y-2">
                {isRequestedStaffBooking && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Customer requested this staff. Reassign only if necessary.
                  </div>
                )}

                {isGroupBooking && (
                  <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-700">
                    This booking is part of a group booking. Check linked jobs
                    before changing staff.
                  </div>
                )}
              </div>
            )}

            <select
              value={formData.staff_id}
              onChange={(e) => updateField("staff_id", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-400"
            >
              <option value="">Unassigned</option>
              {assignableStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                  {staff.staff_code ? ` (${staff.staff_code})` : ""}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-gray-500">
              Only staff on the selected date’s shift and free at this time are
              shown here.
            </p>
          </section>

          {showPaymentForm && (
            <section className="space-y-4 rounded-xl border border-green-100 bg-green-50/30 p-4">
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
            </section>
          )}

          <section className="rounded-xl border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Notes</h3>

            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-400"
              placeholder="Internal notes"
            />
          </section>
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