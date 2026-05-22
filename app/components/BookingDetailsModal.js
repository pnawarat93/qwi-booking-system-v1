"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
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

function getServicePrice(booking) {
  return Number(
    booking?.service_price_snapshot ??
    booking?.services?.price ??
    booking?.price ??
    0
  );
}

function handleNumberWheel(event) {
  event.currentTarget.blur();
}

function setFullPaymentToMethod(method, amount, setPaymentInfo) {
  const safeAmount = Number(amount || 0);

  setPaymentInfo((prev) => ({
    ...prev,
    cash: method === "cash" ? safeAmount : 0,
    card: method === "card" ? safeAmount : 0,
    hicaps: method === "hicaps" ? safeAmount : 0,
    transfer: method === "transfer" ? safeAmount : 0,
    other: method === "other" ? safeAmount : 0,
  }));
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
  const [paymentScope, setPaymentScope] = useState("single");
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const paymentSectionRef = useRef(null);

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
      service_name:
        booking.service_name_snapshot ||
        booking.services?.name ||
        booking.service_name ||
        "",
      time: booking.time?.substring(0, 5) || "",
      duration:
        booking.service_duration_snapshot ??
        booking.duration ??
        booking.services?.duration ??
        30,
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
    setExistingPayment(null);
    setRefundRows([]);
    setRefundedTotal(0);
    setRemainingRefundable(0);
    setPaymentScope("single");
    setIsEditingDetails(false);
    setSaveError("");
    setIsSavingChanges(false);
  }, [booking]);

  useEffect(() => {
    if (!open || !booking) return;

    async function fetchExistingPayment() {
      try {
        setLoadingPayment(true);

        const query = booking.job_group_id && paymentScope === "group"
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
        else {
          setPaymentInfo({
            cash: 0,
            card: 0,
            hicaps: 0,
            transfer: 0,
            other: 0,
            staff_note: "",
            reference_code: "",
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
  }, [open, booking, storeSlug, paymentScope]);

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

  const groupBookings = useMemo(() => {
    if (!booking?.job_group_id) return [];
    return allBookings.filter(
      (item) => String(item.job_group_id) === String(booking.job_group_id)
    );
  }, [allBookings, booking?.job_group_id]);

  const groupTotalPrice = useMemo(
    () => groupBookings.reduce((sum, item) => sum + getServicePrice(item), 0),
    [groupBookings]
  );

  const isGroupBooking = Boolean(booking?.job_group_id);
  const isWalkInBooking = Boolean(booking?.is_walk_in);
  const isRequestedStaffBooking = Boolean(
    !isWalkInBooking &&
    (booking?.requested_staff_id || booking?.is_staff_requested)
  );

  const originalStaffId = booking?.staff_id ? String(booking.staff_id) : "";
  const staffChanged = String(formData.staff_id || "") !== originalStaffId;

  const servicePrice = getServicePrice(booking);
  const selectedPaymentPrice = isGroupBooking && paymentScope === "group"
    ? groupTotalPrice
    : servicePrice;
  const refundDraftTotal = totalPaymentAmount(refundInfo);
  const paidTotal = totalPaymentAmount(existingPayment);
  const remainingAmount = Math.max(selectedPaymentPrice - paidTotal, 0);
  const paymentDraftTotal = totalPaymentAmount(paymentInfo);
  const paymentTargetAmount = existingPayment ? remainingAmount : selectedPaymentPrice;
  const remainingAfterDraft = Math.max(selectedPaymentPrice - paymentDraftTotal, 0);
  const overpaymentAmount = Math.max(paymentDraftTotal - selectedPaymentPrice, 0);
  const hasFullyRefunded = remainingRefundable <= 0 && refundedTotal > 0;

  const isDirty = useMemo(() => {
    if (!booking) return false;

    return (
      formData.customer_name !== (booking.customer_name || "") ||
      formData.customer_phone !== (booking.customer_phone || "") ||
      formData.service_name !==
      (booking.service_name_snapshot ||
        booking.services?.name ||
        booking.service_name ||
        "") ||
      formData.time !== (booking.time?.substring(0, 5) || "") ||
      Number(formData.duration) !==
      Number(
        booking.service_duration_snapshot ??
        booking.duration ??
        booking.services?.duration ??
        30
      ) ||
      formData.status !== (booking.status?.toLowerCase() || "pending") ||
      formData.notes !== (booking.notes || "") ||
      String(formData.staff_id || "") !== String(booking.staff_id || "")
    );
  }, [booking, formData]);

  if (!open || !booking) return null;

  function updateField(field, value) {
    setSaveError("");
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function updatePaymentField(field, value) {
    setPaymentInfo((prev) => ({
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

  function clearPaymentAmounts() {
    setPaymentInfo((prev) => ({
      ...prev,
      cash: 0,
      card: 0,
      hicaps: 0,
      transfer: 0,
      other: 0,
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
      setTimeout(() => {
        paymentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
      return;
    }

    if (nextStatus === "cancelled" && existingPayment && !hasFullyRefunded) {
      setShowRefundForm(true);
      setShowPaymentForm(false);
      setSaveError(
        "This booking has an active payment. Please refund or void payment before cancelling."
      );
      return;
    }

    setShowPaymentForm(false);
  }

  async function reloadPaymentState() {
    const query = booking.job_group_id && paymentScope === "group"
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

        toast.success(
          existingPayment
            ? "Payment updated successfully"
            : "Payment recorded successfully"
        );
        onClose?.();
        return;
      }

      const payload = paymentScope === "group"
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
      toast.success("Payment recorded successfully");
      onClose?.();
    } catch (error) {
      toast.error(error.message || "Failed to record payment");
    } finally {
      setIsRecordingPayment(false);
    }
  }

  async function handleRefund() {
    if (!existingPayment?.id) {
      toast.error("No active payment found to refund.");
      return;
    }

    if (refundDraftTotal <= 0) {
      toast.error("Refund amount must be greater than 0.");
      return;
    }

    if (refundDraftTotal > remainingRefundable) {
      toast.error(
        `Refund exceeds remaining refundable amount. Remaining: $${remainingRefundable.toFixed(
          2
        )}`
      );
      return;
    }

    const willFullyRefund =
      refundDraftTotal >= remainingRefundable && remainingRefundable > 0;

    const confirmed = window.confirm(
      willFullyRefund
        ? `Confirm full refund of $${refundDraftTotal.toFixed(
          2
        )}? This booking will be marked as cancelled.`
        : `Confirm refund of $${refundDraftTotal.toFixed(2)}?`
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

      if (data?.refundSummary?.fullyRefunded) {
        setFormData((prev) => ({
          ...prev,
          status: "cancelled",
        }));
        toast.success("Full refund recorded. Booking has been cancelled.");
      } else {
        toast.success("Refund recorded");
      }

      onRefresh?.();
    } catch (err) {
      toast.error(err.message || "Failed to record refund");
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
      toast.success("Payment voided");

      onClose?.();
    } catch (error) {
      toast.error(error.message || "Failed to void payment");
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

      if (
        formData.status === "cancelled" &&
        existingPayment &&
        remainingRefundable > 0
      ) {
        setSaveError(
          "This booking still has refundable payment. Please refund or void payment before cancelling."
        );
        setShowRefundForm(true);
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
      toast.success("Booking changes saved successfully.");
      onRefresh?.();
      onClose?.();

    } catch (error) {
      console.error(error);
      setSaveError(error.message || "Could not save booking changes.");
      toast.error("Could not save booking changes.");
    } finally {
      setIsSavingChanges(false);
    }
  }

  const timeRange = formatTimeRange(formData.time, formData.duration);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-[#E8DED6] bg-[#FFFCFA] shadow-[0_20px_60px_rgba(63,55,51,0.08)]">
        <div className="shrink-0 border-b border-[#E8DED6] bg-[#F8F1EC] px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-[#3F3733]">
                Booking details
              </h2>
              <p className="mt-1 text-sm text-[#6F625C]">{timeRange}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-semibold text-[#6F625C] transition hover:bg-[#FFF9F6]"
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

            {isWalkInBooking && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                Walk-in
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

            {hasFullyRefunded && (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
                Fully refunded
              </span>
            )}
          </div>

          {saveError && (
            <div className="mt-3 rounded-2xl border border-[#F3B2A5] bg-[#FFF1EE] px-4 py-3 text-sm text-[#9F3A2E]">
              {saveError}
            </div>
          )}
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-5">
          <section className="rounded-2xl border border-[#E8DED6] bg-white p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A8A84]">
                  Booking information
                </h3>
                <p className="mt-1 text-xs text-[#6F625C]">
                  Customer, service, and time details
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingDetails((prev) => !prev)}
                className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${isEditingDetails
                  ? "border-[#B86F52] bg-[#FFEFE9] text-[#B86F52]"
                  : "border-[#E8DED6] bg-[#FFF9F6] text-[#5B4B45] hover:bg-[#FFF5F1]"
                  }`}
              >
                {isEditingDetails ? "Done editing" : "Edit details"}
              </button>
            </div>

            {isEditingDetails ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#6F625C]">
                    Customer name
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => updateField("customer_name", e.target.value)}
                    className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#6F625C]">
                    Phone number
                  </label>
                  <input
                    type="text"
                    value={formData.customer_phone}
                    onChange={(e) => updateField("customer_phone", e.target.value)}
                    className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#6F625C]">
                    Service name
                  </label>
                  <input
                    type="text"
                    value={formData.service_name}
                    onChange={(e) => updateField("service_name", e.target.value)}
                    className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#6F625C]">
                    Duration (mins)
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={formData.duration}
                    onWheel={handleNumberWheel}
                    onChange={(e) => updateField("duration", e.target.value)}
                    className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-[#6F625C]">
                    Time
                  </label>
                  <input
                    type="time"
                    step="300"
                    value={formData.time}
                    onChange={(e) => updateField("time", e.target.value)}
                    className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#FFFCFA] px-4 py-3">
                <div className="grid gap-y-2 text-sm md:grid-cols-2 md:gap-x-6">
                  <div className="flex items-center justify-between gap-3 border-b border-[#F1E7E2] py-2 md:border-b-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9A8A84]">
                      Customer
                    </span>

                    <span className="text-right font-semibold text-[#3F3733]">
                      {formData.customer_name || "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-b border-[#F1E7E2] py-2 md:border-b-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9A8A84]">
                      Phone
                    </span>

                    <span className="text-right font-semibold text-[#3F3733]">
                      {formData.customer_phone || "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-b border-[#F1E7E2] py-2 md:border-b-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9A8A84]">
                      Service
                    </span>

                    <span className="text-right font-semibold text-[#3F3733]">
                      {formData.service_name || "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-b border-[#F1E7E2] py-2 md:border-b-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9A8A84]">
                      Duration
                    </span>

                    <span className="text-right font-semibold text-[#3F3733]">
                      {formData.duration} mins
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9A8A84]">
                      Time
                    </span>

                    <span className="text-right font-semibold text-[#3F3733]">
                      {formData.time || "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}


            {customerBookingNote && (
              <div className="mt-3 rounded-2xl border border-[#F3B2A5] bg-[#FFF1EE] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9F3A2E]">
                  Customer note
                </p>
                <p className="mt-2 text-sm text-[#9F3A2E]">{customerBookingNote}</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#E8DED6] bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-[#3F3733]">
              Assigned staff
            </h3>

            {(isRequestedStaffBooking || isGroupBooking) && (
              <div className="mb-3 space-y-2">
                {isRequestedStaffBooking && (
                  <div className="rounded-2xl border border-[#F3B2A5] bg-[#FFF1EE] px-3 py-2 text-sm text-[#9F3A2E]">
                    Customer requested this staff. Reassign only if necessary.
                  </div>
                )}

                {isGroupBooking && (
                  <div className="rounded-2xl border border-[#D1D0EA] bg-[#F9F6FE] px-3 py-2 text-sm text-[#5B4B45]">
                    This booking is part of a group booking. Payments and refunds
                    are handled at group level.
                  </div>
                )}
              </div>
            )}

            <select
              value={formData.staff_id}
              onChange={(e) => updateField("staff_id", e.target.value)}
              className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
            >
              <option value="">Unassigned</option>
              {assignableStaff.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                  {staff.staff_code ? ` (${staff.staff_code})` : ""}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-[#6F625C]">
              Only staff on the selected date’s shift and free at this time are shown here.
            </p>
          </section>

          <section className="rounded-2xl border border-[#E8DED6] bg-white p-4">
            <div className="mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A8A84]">
                Status
              </h3>

              <p className="mt-1 text-xs text-[#6F625C]">
                Update booking progress and payment flow
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => {
                const active = formData.status === status;

                const labelMap = {
                  pending: "Pending",
                  paid: "Paid",
                  cancelled: "Cancelled",
                  no_show: "No-show",
                };

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusChange(status)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${active
                        ? "border-[#B86F52] bg-[#FFEFE9] text-[#B86F52]"
                        : "border-[#E8DED6] bg-[#FFFCFA] text-[#5B4B45] hover:bg-[#FFF5F1]"
                      }`}
                  >
                    {labelMap[status]}
                  </button>
                );
              })}
            </div>

            {formData.status === "paid" ? (
              <div className="mt-3 rounded-2xl border border-[#D9E9DE] bg-[#EFF8F3] px-3 py-2.5">
                <p className="text-sm font-semibold text-[#186C4D]">
                  Payment section is ready below
                </p>
              </div>
            ) : null}
          </section>

          <section ref={paymentSectionRef} className="rounded-2xl border border-[#E8DED6] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-[#3F3733]">
                Payment information
              </h3>
              {isGroupBooking && (
                <span className="rounded-full bg-[#EFF8F3] px-3 py-1 text-xs font-semibold text-[#186C4D]">
                  Group payment
                </span>
              )}
            </div>

            {isGroupBooking && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-[#6F625C]">Scope:</span>
                <button
                  type="button"
                  onClick={() => setPaymentScope("single")}
                  className={`rounded-2xl border px-3 py-2 text-sm font-medium ${paymentScope === "single"
                    ? "border-[#B86F52] bg-[#FFEFE9] text-[#B86F52]"
                    : "border-[#E8DED6] bg-[#FFFCFA] text-[#5B4B45]"
                    }`}
                >
                  This booking only
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentScope("group")}
                  className={`rounded-2xl border px-3 py-2 text-sm font-medium ${paymentScope === "group"
                    ? "border-[#B86F52] bg-[#FFEFE9] text-[#B86F52]"
                    : "border-[#E8DED6] bg-[#FFFCFA] text-[#5B4B45]"
                    }`}
                >
                  Whole group
                </button>
              </div>
            )}

            <div className="mt-3 rounded-2xl border border-[#F3B2A5] bg-[#FFF1EE] px-3 py-3 text-sm text-[#9F3A2E]">
              <div className="flex items-center justify-between">
                <span>Selected amount</span>
                <span className="font-semibold text-[#3F3733]">
                  ${selectedPaymentPrice.toFixed(2)}
                </span>
              </div>

              {existingPayment && (
                <>
                  <div className="mt-3 flex items-center justify-between text-sm text-[#5B4B45]">
                    <span>Paid so far</span>
                    <span className="font-semibold text-[#186C4D]">
                      ${paidTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm text-[#5B4B45]">
                    <span>Remaining</span>
                    <span className="font-semibold text-[#B86F52]">
                      ${remainingAmount.toFixed(2)}
                    </span>
                  </div>
                </>
              )}

              {isGroupBooking && (
                <p className="border-t border-amber-200 pt-2 text-xs text-amber-700">
                  Group payment will cover linked bookings.
                </p>
              )}
            </div>

            {loadingPayment ? (
              <p className="mt-3 text-sm text-[#6F625C]">Loading payment...</p>
            ) : existingPayment ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl border border-[#D9E9DE] bg-[#EFF8F3] px-3 py-3 text-sm text-[#186C4D]">
                  Active payment recorded. You can review or update it here.
                </div>

                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2">
                    Cash: ${Number(existingPayment.cash || 0).toFixed(2)}
                  </div>
                  <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2">
                    Card: ${Number(existingPayment.card || 0).toFixed(2)}
                  </div>
                  <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2">
                    Hicaps: ${Number(existingPayment.hicaps || 0).toFixed(2)}
                  </div>
                  <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2">
                    Transfer: ${Number(existingPayment.transfer || 0).toFixed(2)}
                  </div>
                  <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2">
                    Other: ${Number(existingPayment.other || 0).toFixed(2)}
                  </div>
                  <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2">
                    Ref code: {existingPayment.reference_code || "-"}
                  </div>
                </div>

                {existingPayment.staff_note && (
                  <div className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733]">
                    <span className="font-semibold text-[#3F3733]">Staff note:</span>{" "}
                    {existingPayment.staff_note}
                  </div>
                )}

                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 font-semibold text-[#3F3733]">
                    Paid total: ${paidTotal.toFixed(2)}
                  </div>
                  <div className="rounded-2xl border border-[#E8DED6] bg-[#EFF8FF] px-3 py-2 font-semibold text-[#1B4E82]">
                    Refunded total: ${refundedTotal.toFixed(2)}
                  </div>
                  <div className="rounded-2xl border border-[#E8DED6] bg-[#FFF7ED] px-3 py-2 font-semibold text-[#B86F52]">
                    Remaining refundable: ${remainingRefundable.toFixed(2)}
                  </div>
                </div>

                {refundRows.length > 0 && (
                  <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#9A8A84]">
                      Refund history
                    </p>
                    <div className="space-y-2">
                      {refundRows.map((row) => (
                        <div
                          key={row.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-[#6F625C]">Refunded</span>
                          <span className="font-semibold text-[#3F3733]">
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
                    className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-semibold text-[#5B4B45] hover:bg-[#FFF9F6]"
                  >
                    {showPaymentForm ? "Hide payment editor" : "Edit payment"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRefundForm((prev) => !prev)}
                    disabled={hasFullyRefunded}
                    className="rounded-2xl border border-[#D1E4FF] bg-white px-3 py-2 text-sm font-semibold text-[#1B4E82] hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="rounded-2xl border border-[#F3B2A5] bg-white px-3 py-2 text-sm font-semibold text-[#9F3A2E] hover:bg-[#FFF1EE] disabled:opacity-50"
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
                  className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-semibold text-[#5B4B45] hover:bg-[#FFF9F6]"
                >
                  {showPaymentForm ? "Hide payment form" : "Record payment"}
                </button>
              </div>
            )}

            {showPaymentForm && (
              <div className="mt-4 space-y-4 rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-4">
                {isGroupBooking && (
                  <div className="rounded-2xl border border-[#D9D0EA] bg-white px-3 py-2 text-sm text-[#5B4B45]">
                    This is a group booking. Payment will be recorded against the whole group to prevent duplicate payment records.
                  </div>
                )}

                <div className="rounded-2xl border border-[#D9E9DE] bg-white px-3 py-3 text-sm text-[#3F3733]">
                  <div className="flex items-center justify-between">
                    <span>Suggested amount</span>
                    <span className="font-semibold text-[#3F3733]">
                      ${paymentTargetAmount.toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs text-[#6F625C]">
                    <span>
                      {existingPayment
                        ? "Remaining after current payment"
                        : "Service price"}
                    </span>
                    <span className="font-semibold text-[#3F3733]">${paymentTargetAmount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFullPaymentToMethod(
                        "cash",
                        paymentTargetAmount,
                        setPaymentInfo
                      )
                    }
                    className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-semibold text-[#5B4B45] hover:bg-[#FFF9F6]"
                  >
                    {existingPayment ? "Remaining cash" : "Full cash"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFullPaymentToMethod(
                        "card",
                        paymentTargetAmount,
                        setPaymentInfo
                      )
                    }
                    className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-semibold text-[#5B4B45] hover:bg-[#FFF9F6]"
                  >
                    {existingPayment ? "Remaining card" : "Full card"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFullPaymentToMethod(
                        "transfer",
                        paymentTargetAmount,
                        setPaymentInfo
                      )
                    }
                    className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-semibold text-[#5B4B45] hover:bg-[#FFF9F6]"
                  >
                    Transfer
                  </button>

                  <button
                    type="button"
                    onClick={clearPaymentAmounts}
                    className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-semibold text-[#5B4B45] hover:bg-[#FFF9F6]"
                  >
                    Clear
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6F625C]">
                      Cash ($)
                    </label>
                    <input
                      type="number"
                      value={paymentInfo.cash}
                      onWheel={handleNumberWheel}
                      onChange={(e) =>
                        updatePaymentField("cash", e.target.value)
                      }
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6F625C]">
                      Card ($)
                    </label>
                    <input
                      type="number"
                      value={paymentInfo.card}
                      onWheel={handleNumberWheel}
                      onChange={(e) =>
                        updatePaymentField("card", e.target.value)
                      }
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6F625C]">
                      Hicaps ($)
                    </label>
                    <input
                      type="number"
                      value={paymentInfo.hicaps}
                      onWheel={handleNumberWheel}
                      onChange={(e) =>
                        updatePaymentField("hicaps", e.target.value)
                      }
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6F625C]">
                      Transfer ($)
                    </label>
                    <input
                      type="number"
                      value={paymentInfo.transfer}
                      onWheel={handleNumberWheel}
                      onChange={(e) =>
                        updatePaymentField("transfer", e.target.value)
                      }
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6F625C]">
                      Other ($)
                    </label>
                    <input
                      type="number"
                      value={paymentInfo.other}
                      onWheel={handleNumberWheel}
                      onChange={(e) =>
                        updatePaymentField("other", e.target.value)
                      }
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6F625C]">
                      Reference code
                    </label>
                    <input
                      type="text"
                      value={paymentInfo.reference_code}
                      onChange={(e) =>
                        updatePaymentField("reference_code", e.target.value)
                      }
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                      placeholder="Voucher / bank ref / PayID"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#6F625C]">Entered total</span>
                    <span className="font-semibold text-[#3F3733]">
                      ${paymentDraftTotal.toFixed(2)}
                    </span>
                  </div>

                  {overpaymentAmount > 0 ? (
                    <div className="mt-1 flex items-center justify-between text-red-700">
                      <span>Overpayment</span>
                      <span className="font-semibold">
                        ${overpaymentAmount.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center justify-between text-amber-700">
                      <span>Remaining after this payment</span>
                      <span className="font-semibold">
                        ${remainingAfterDraft.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6F625C]">
                      Staff note
                    </label>
                    <textarea
                      rows={2}
                      value={paymentInfo.staff_note}
                      onChange={(e) =>
                        updatePaymentField("staff_note", e.target.value)
                      }
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRecordPayment}
                  disabled={isRecordingPayment || paymentDraftTotal <= 0}
                  className="w-full rounded-2xl bg-[#B86F52] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#A86248] disabled:opacity-50"
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
              <div className="mt-4 space-y-4 rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-4">
                <p className="text-sm font-semibold text-[#3F3733]">
                  Refund amount
                </p>

                <div className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733]">
                  Remaining refundable: ${remainingRefundable.toFixed(2)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6F625C]">
                      Cash ($)
                    </label>
                    <input
                      type="number"
                      value={refundInfo.cash}
                      onWheel={handleNumberWheel}
                      onChange={(e) => updateRefundField("cash", e.target.value)}
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6F625C]">
                      Card ($)
                    </label>
                    <input
                      type="number"
                      value={refundInfo.card}
                      onWheel={handleNumberWheel}
                      onChange={(e) => updateRefundField("card", e.target.value)}
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6F625C]">
                      Hicaps ($)
                    </label>
                    <input
                      type="number"
                      value={refundInfo.hicaps}
                      onWheel={handleNumberWheel}
                      onChange={(e) =>
                        updateRefundField("hicaps", e.target.value)
                      }
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6F625C]">
                      Transfer ($)
                    </label>
                    <input
                      type="number"
                      value={refundInfo.transfer}
                      onWheel={handleNumberWheel}
                      onChange={(e) =>
                        updateRefundField("transfer", e.target.value)
                      }
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6F625C]">
                      Other ($)
                    </label>
                    <input
                      type="number"
                      value={refundInfo.other}
                      onWheel={handleNumberWheel}
                      onChange={(e) => updateRefundField("other", e.target.value)}
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-semibold text-[#3F3733]">
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
                  className="w-full rounded-2xl bg-[#B86F52] py-3 text-sm font-semibold text-white transition hover:bg-[#A86248] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRefunding ? "Processing..." : "Confirm refund"}
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#E8DED6] bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-[#3F3733]">
              Internal booking note
            </h3>

            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
              placeholder="Internal note for this booking"
            />
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#E8DED6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#6F625C]">
            {isDirty ? "Unsaved changes" : "No changes yet"}
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSavingChanges}
              className="rounded-2xl border border-[#E8DED6] bg-white px-4 py-2 text-sm font-semibold text-[#6F625C] hover:bg-[#FFF9F6] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSavingChanges}
              className="rounded-2xl bg-[#B86F52] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A86248] disabled:opacity-50"
            >
              {isSavingChanges ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}