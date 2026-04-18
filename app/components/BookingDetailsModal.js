"use client";

import { useEffect, useMemo, useState } from "react";
import { storeApiUrl } from "@/lib/storeApi";

function apiPath(slug, path) {
  return slug ? storeApiUrl(slug, path) : `/api${path}`;
}

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

function totalPaymentAmount(payment) {
  if (!payment) return 0;
  return (
    Number(payment.cash || 0) +
    Number(payment.card || 0) +
    Number(payment.hicaps || 0) +
    Number(payment.transfer || 0) +
    Number(payment.other || 0)
  );
}

export default function BookingDetailsModal({
  booking,
  open,
  onClose,
  onSave,
  onRefresh,
  availableStaffOptions = [],
  allBookings = [],
  storeSlug,
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
    transfer: 0,
    other: 0,
    staff_note: "",
    reference_code: "",
  });

  const [refundInfo, setRefundInfo] = useState({
    cash: 0,
    card: 0,
    hicaps: 0,
    transfer: 0,
    other: 0,
  });

  const [paymentScope, setPaymentScope] = useState("job");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [existingPayment, setExistingPayment] = useState(null);
  const [refundRows, setRefundRows] = useState([]);
  const [refundedTotal, setRefundedTotal] = useState(0);
  const [remainingRefundable, setRemainingRefundable] = useState(0);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [isVoidingPayment, setIsVoidingPayment] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isSavingChanges, setIsSavingChanges] = useState(false);

  const customerBookingNote =
    booking?.customer_note ||
    booking?.booking_note ||
    booking?.notes_customer ||
    booking?.customer_notes ||
    "";

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
      transfer: 0,
      other: 0,
      staff_note: "",
      reference_code: "",
    });

    setRefundInfo({
      cash: 0,
      card: 0,
      hicaps: 0,
      transfer: 0,
      other: 0,
    });

    setShowPaymentForm(false);
    setShowRefundForm(false);
    setPaymentScope("job");
    setExistingPayment(null);
    setRefundRows([]);
    setRefundedTotal(0);
    setRemainingRefundable(0);
    setSaveError("");
    setIsSavingChanges(false);
  }, [booking]);

  useEffect(() => {
    if (!open || !booking) return;

    async function fetchExistingPayment() {
      try {
        setLoadingPayment(true);

        const query = booking.job_group_id
          ? apiPath(storeSlug, `/payments?jobgroup_id=${booking.job_group_id}`)
          : apiPath(storeSlug, `/payments?job_id=${booking.id}`);

        const response = await fetch(query);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || "Failed to load payment");
        }

        setExistingPayment(result.payment || null);
        setRefundRows(Array.isArray(result.refunds) ? result.refunds : []);
        setRefundedTotal(Number(result.refundedTotal || 0));
        setRemainingRefundable(Number(result.remainingRefundable || 0));

        if (result.payment) {
          setPaymentInfo({
            cash: Number(result.payment.cash || 0),
            card: Number(result.payment.card || 0),
            hicaps: Number(result.payment.hicaps || 0),
            transfer: Number(result.payment.transfer || 0),
            other: Number(result.payment.other || 0),
            staff_note: result.payment.staff_note || "",
            reference_code: result.payment.reference_code || "",
          });
        }
      } catch (error) {
        console.error(error);
        setExistingPayment(null);
        setRefundRows([]);
        setRefundedTotal(0);
        setRemainingRefundable(0);
      } finally {
        setLoadingPayment(false);
      }
    }

    fetchExistingPayment();
  }, [open, booking, storeSlug]);

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
  }, [
    availableStaffOptions,
    allBookings,
    booking,
    formData.time,
    formData.duration,
  ]);

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

  const refundDraftTotal = totalPaymentAmount(refundInfo);
  const hasFullyRefunded = remainingRefundable <= 0 && refundedTotal > 0;

  if (!open || !booking) return null;

  function updateField(field, value) {
    setSaveError("");
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function updateRefundField(field, value) {
    setRefundInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleStatusChange(nextStatus) {
    if (!STATUS_OPTIONS.includes(nextStatus)) return;

    setSaveError("");

    setFormData((prev) => ({
      ...prev,
      status: nextStatus,
    }));

    if (nextStatus === "paid") {
      setShowPaymentForm(true);
      setShowRefundForm(false);
    } else {
      setShowPaymentForm(false);
    }
  }

  async function reloadPaymentState() {
    const query = booking.job_group_id
      ? apiPath(storeSlug, `/payments?jobgroup_id=${booking.job_group_id}`)
      : apiPath(storeSlug, `/payments?job_id=${booking.id}`);

    const response = await fetch(query);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || "Failed to reload payment");
    }

    setExistingPayment(result.payment || null);
    setRefundRows(Array.isArray(result.refunds) ? result.refunds : []);
    setRefundedTotal(Number(result.refundedTotal || 0));
    setRemainingRefundable(Number(result.remainingRefundable || 0));
  }

  async function handleRecordPayment() {
    setIsRecordingPayment(true);

    try {
      if (existingPayment?.id) {
        const updateResponse = await fetch(apiPath(storeSlug, "/payments"), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_id: existingPayment.id,
            cash: paymentInfo.cash,
            card: paymentInfo.card,
            hicaps: paymentInfo.hicaps,
            transfer: paymentInfo.transfer,
            other: paymentInfo.other,
            staff_note: paymentInfo.staff_note,
            reference_code: paymentInfo.reference_code,
            notes: "Updated from booking details modal",
          }),
        });

        const updateResult = await updateResponse.json().catch(() => null);

        if (!updateResponse.ok) {
          throw new Error(updateResult?.error || "Failed to update payment");
        }

        setExistingPayment(updateResult?.data || existingPayment);

        await onSave?.({
          ...booking,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          service_name: formData.service_name,
          time: formData.time,
          duration: Number(formData.duration),
          status: "paid",
          notes: formData.notes,
          staff_id: formData.staff_id ? Number(formData.staff_id) : null,
        });

        onRefresh?.();
        onClose?.();
        return;
      }

      const payload =
        paymentScope === "group" && booking.job_group_id
          ? {
            jobgroup_id: booking.job_group_id,
            cash: paymentInfo.cash,
            card: paymentInfo.card,
            hicaps: paymentInfo.hicaps,
            transfer: paymentInfo.transfer,
            other: paymentInfo.other,
            staff_note: paymentInfo.staff_note,
            reference_code: paymentInfo.reference_code,
            notes: "Created from booking details modal",
          }
          : {
            job_id: booking.id,
            cash: paymentInfo.cash,
            card: paymentInfo.card,
            hicaps: paymentInfo.hicaps,
            transfer: paymentInfo.transfer,
            other: paymentInfo.other,
            staff_note: paymentInfo.staff_note,
            reference_code: paymentInfo.reference_code,
            notes: "Created from booking details modal",
          };

      const response = await fetch(apiPath(storeSlug, "/payments"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (response.status === 409 && result?.existingPayment) {
        setExistingPayment(result.existingPayment);
        setPaymentInfo({
          cash: Number(result.existingPayment.cash || 0),
          card: Number(result.existingPayment.card || 0),
          hicaps: Number(result.existingPayment.hicaps || 0),
          transfer: Number(result.existingPayment.transfer || 0),
          other: Number(result.existingPayment.other || 0),
          staff_note: result.existingPayment.staff_note || "",
          reference_code: result.existingPayment.reference_code || "",
        });
        throw new Error(
          "Payment already exists for this booking. Review or update the existing payment instead."
        );
      }

      if (!response.ok) {
        throw new Error(result?.error || "Failed to record payment");
      }

      setExistingPayment(result?.data || null);

      onRefresh?.();
      onClose?.();
    } catch (error) {
      alert(error.message || "Failed to record payment");
    } finally {
      setIsRecordingPayment(false);
    }
  }
  async function handleRefund() {
    if (!existingPayment?.id) {
      alert("No active payment found to refund.");
      return;
    }

    if (refundDraftTotal <= 0) {
      alert("Refund amount must be greater than 0.");
      return;
    }

    if (refundDraftTotal > remainingRefundable) {
      alert(
        `Refund exceeds remaining refundable amount. Remaining: $${remainingRefundable.toFixed(
          2
        )}`
      );
      return;
    }

    const confirmed = window.confirm(
      `Confirm refund of $${refundDraftTotal.toFixed(2)}?`
    );
    if (!confirmed) return;

    setIsRefunding(true);

    try {
      const res = await fetch(apiPath(storeSlug, "/payments"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_type: "refund",
          parent_payment_id: existingPayment.id,
          cash: refundInfo.cash,
          card: refundInfo.card,
          hicaps: refundInfo.hicaps,
          transfer: refundInfo.transfer,
          other: refundInfo.other,
          notes: "Refund from booking details modal",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to record refund");
      }

      await reloadPaymentState();

      setRefundInfo({
        cash: 0,
        card: 0,
        hicaps: 0,
        transfer: 0,
        other: 0,
      });

      setShowRefundForm(false);
      alert("Refund recorded");
      onRefresh?.();
    } catch (err) {
      alert(err.message || "Failed to record refund");
    } finally {
      setIsRefunding(false);
    }
  }

  async function handleBackToPendingWithVoid() {
    if (!existingPayment?.id) {
      setFormData((prev) => ({ ...prev, status: "pending" }));
      return;
    }

    const confirmed = window.confirm(
      "This booking already has a payment. Do you want to void the payment and move the booking back to pending?"
    );

    if (!confirmed) return;

    setIsVoidingPayment(true);

    try {
      const response = await fetch(apiPath(storeSlug, "/payments"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: existingPayment.id }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Failed to void payment");
      }

      setExistingPayment(null);
      setPaymentInfo({
        cash: 0,
        card: 0,
        hicaps: 0,
        transfer: 0,
        other: 0,
        staff_note: "",
        reference_code: "",
      });
      setRefundInfo({
        cash: 0,
        card: 0,
        hicaps: 0,
        transfer: 0,
        other: 0,
      });
      setRefundRows([]);
      setRefundedTotal(0);
      setRemainingRefundable(0);
      setShowPaymentForm(false);
      setShowRefundForm(false);

      onRefresh?.();
      onClose?.();
    } catch (error) {
      alert(error.message || "Failed to void payment");
    } finally {
      setIsVoidingPayment(false);
    }
  }

  async function handleSave() {
    if (!booking) return;

    try {
      setSaveError("");

      if (isRequestedStaffBooking && staffChanged) {
        const confirmed = window.confirm(
          "This customer requested a specific staff member. Are you sure you want to reassign this booking?"
        );

        if (!confirmed) return;
      }

      if (formData.status === "paid" && !existingPayment) {
        setSaveError(
          "You cannot save this booking as paid without recording payment first."
        );
        setShowPaymentForm(true);
        return;
      }

      if (formData.status === "pending" && existingPayment) {
        await handleBackToPendingWithVoid();
        return;
      }

      setIsSavingChanges(true);

      await onSave?.({
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
    } catch (error) {
      console.error(error);
      setSaveError(error.message || "Could not save booking changes.");
    } finally {
      setIsSavingChanges(false);
    }
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

          {saveError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </div>
          )}
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

            {customerBookingNote && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Customer note
                </p>
                <p className="mt-1 text-sm text-amber-900">
                  {customerBookingNote}
                </p>
              </div>
            )}
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
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${formData.status === "pending"
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-700"
                      }`}
                  >
                    Pending
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange("paid")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${formData.status === "paid"
                        ? "border-green-300 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-700"
                      }`}
                  >
                    Paid
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange("cancelled")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${formData.status === "cancelled"
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-700"
                      }`}
                  >
                    Cancelled
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange("no_show")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${formData.status === "no_show"
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
          <section className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Payment information
              </h3>
              {isGroupBooking && (
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                  Group booking
                </span>
              )}
            </div>

            {loadingPayment ? (
              <p className="mt-3 text-sm text-gray-400">Loading payment...</p>
            ) : existingPayment ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800">
                  Active payment recorded. You can review or update it here.
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border bg-gray-50 px-3 py-2">
                    Cash: ${Number(existingPayment.cash || 0).toFixed(2)}
                  </div>
                  <div className="rounded-lg border bg-gray-50 px-3 py-2">
                    Card: ${Number(existingPayment.card || 0).toFixed(2)}
                  </div>
                  <div className="rounded-lg border bg-gray-50 px-3 py-2">
                    Hicaps: ${Number(existingPayment.hicaps || 0).toFixed(2)}
                  </div>
                  <div className="rounded-lg border bg-gray-50 px-3 py-2">
                    Transfer: ${Number(existingPayment.transfer || 0).toFixed(2)}
                  </div>
                  <div className="rounded-lg border bg-gray-50 px-3 py-2">
                    Other: ${Number(existingPayment.other || 0).toFixed(2)}
                  </div>
                  <div className="rounded-lg border bg-gray-50 px-3 py-2">
                    Ref code: {existingPayment.reference_code || "-"}
                  </div>
                </div>

                {existingPayment.staff_note && (
                  <div className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-700">
                    <span className="font-medium text-gray-900">Staff note:</span>{" "}
                    {existingPayment.staff_note}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="rounded-lg border bg-white px-3 py-2 font-medium text-gray-800">
                    Paid total: ${totalPaymentAmount(existingPayment).toFixed(2)}
                  </div>
                  <div className="rounded-lg border bg-blue-50 px-3 py-2 font-medium text-blue-800">
                    Refunded total: ${refundedTotal.toFixed(2)}
                  </div>
                  <div className="rounded-lg border bg-amber-50 px-3 py-2 font-medium text-amber-800">
                    Remaining refundable: ${remainingRefundable.toFixed(2)}
                  </div>
                </div>

                {refundRows.length > 0 && (
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Refund history
                    </p>
                    <div className="space-y-2">
                      {refundRows.map((row) => (
                        <div
                          key={row.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-gray-600">Refunded</span>
                          <span className="font-medium text-gray-900">
                            ${totalPaymentAmount(row).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm((prev) => !prev)}
                    className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {showPaymentForm ? "Hide payment editor" : "Edit payment"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRefundForm((prev) => !prev)}
                    disabled={hasFullyRefunded}
                    className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {hasFullyRefunded
                      ? "Fully refunded"
                      : showRefundForm
                        ? "Cancel refund"
                        : "Refund"}
                  </button>

                  <button
                    type="button"
                    onClick={handleBackToPendingWithVoid}
                    disabled={isVoidingPayment}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {isVoidingPayment
                      ? "Voiding..."
                      : "Void payment & back to pending"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentForm((prev) => !prev);
                    setFormData((prev) => ({ ...prev, status: "paid" }));
                    setSaveError("");
                  }}
                  className="rounded-lg border px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
                >
                  {showPaymentForm ? "Hide payment form" : "Record payment"}
                </button>
              </div>
            )}

            {showPaymentForm && (
              <div className="mt-4 space-y-4 rounded-xl border border-green-100 bg-green-50/30 p-4">
                {booking.job_group_id && (
                  <div className="space-y-3 rounded-lg bg-white/70 p-4">
                    <p className="text-sm font-medium text-gray-800">
                      Choose payment scope
                    </p>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentScope("job")}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium ${paymentScope === "job"
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-700"
                          }`}
                      >
                        Pay this job only
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentScope("group")}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium ${paymentScope === "group"
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
                      Transfer ($)
                    </label>
                    <input
                      type="number"
                      value={paymentInfo.transfer}
                      onChange={(e) =>
                        setPaymentInfo({
                          ...paymentInfo,
                          transfer: e.target.value,
                        })
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

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Reference code
                    </label>
                    <input
                      type="text"
                      value={paymentInfo.reference_code}
                      onChange={(e) =>
                        setPaymentInfo({
                          ...paymentInfo,
                          reference_code: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-400"
                      placeholder="Voucher / bank ref / PayID"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Staff note
                  </label>
                  <textarea
                    rows={2}
                    value={paymentInfo.staff_note}
                    onChange={(e) =>
                      setPaymentInfo({
                        ...paymentInfo,
                        staff_note: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-400"
                    placeholder="Voucher details, transfer time, bank used, split payment note, etc."
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRecordPayment}
                  disabled={isRecordingPayment}
                  className="w-full rounded-lg bg-green-600 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-green-200 transition-all hover:bg-green-700 disabled:opacity-50"
                >
                  {isRecordingPayment
                    ? existingPayment
                      ? "Updating..."
                      : "Recording..."
                    : existingPayment
                      ? "Update payment"
                      : "Finalize & Record Payment"}
                </button>
              </div>
            )}

            {showRefundForm && existingPayment && (
              <div className="mt-4 space-y-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                <p className="text-sm font-semibold text-blue-800">
                  Refund amount
                </p>

                <div className="rounded-lg border bg-white px-3 py-2 text-sm">
                  Remaining refundable: ${remainingRefundable.toFixed(2)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Cash ($)
                    </label>
                    <input
                      type="number"
                      value={refundInfo.cash}
                      onChange={(e) => updateRefundField("cash", e.target.value)}
                      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Card ($)
                    </label>
                    <input
                      type="number"
                      value={refundInfo.card}
                      onChange={(e) => updateRefundField("card", e.target.value)}
                      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Hicaps ($)
                    </label>
                    <input
                      type="number"
                      value={refundInfo.hicaps}
                      onChange={(e) =>
                        updateRefundField("hicaps", e.target.value)
                      }
                      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Transfer ($)
                    </label>
                    <input
                      type="number"
                      value={refundInfo.transfer}
                      onChange={(e) =>
                        updateRefundField("transfer", e.target.value)
                      }
                      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Other ($)
                    </label>
                    <input
                      type="number"
                      value={refundInfo.other}
                      onChange={(e) => updateRefundField("other", e.target.value)}
                      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="rounded-lg border bg-white px-3 py-2 text-sm font-medium">
                  Refund draft total: ${refundDraftTotal.toFixed(2)}
                </div>

                <button
                  type="button"
                  onClick={handleRefund}
                  disabled={
                    isRefunding ||
                    hasFullyRefunded ||
                    refundDraftTotal <= 0 ||
                    refundDraftTotal > remainingRefundable
                  }
                  className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRefunding ? "Processing..." : "Confirm Refund"}
                </button>
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Internal booking note
            </h3>

            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-400"
              placeholder="Internal note for this booking"
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
              disabled={isSavingChanges}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSavingChanges}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
            >
              {isSavingChanges ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 