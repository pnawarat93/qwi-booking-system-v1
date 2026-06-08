"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Moon,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  X,
  Banknote,
  CreditCard,
  Landmark,
} from "lucide-react";
import { storeApiUrl } from "@/lib/storeApi";

function apiPath(slug, path) {
  return slug ? storeApiUrl(slug, path) : `/api${path}`;
}

function currency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

const FINALIZED_JOB_STATUSES = ["paid", "completed"];

export default function EndDayReport({
  bookings = [],
  selectedDate,
  onClose,
  onFinish,
  storeSlug,
}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  useEffect(() => {
    if (!selectedDate) return;

    async function fetchSummary() {
      try {
        setLoading(true);
        setLoadError("");
        setCompleteError("");

        const res = await fetch(
          apiPath(storeSlug, `/end-day-summary?date=${selectedDate}`)
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load end day summary");
        }

        setSummary(data);
      } catch (error) {
        console.error(error);
        setLoadError(error.message || "Failed to load end day summary");
        setSummary(null);
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, [selectedDate, storeSlug]);

  const fallbackStats = useMemo(() => {
    return {
      totalJobs: bookings.length,
      paidJobs: bookings.filter((b) =>
        FINALIZED_JOB_STATUSES.includes(b.status)
      ).length,
      pendingJobs: bookings.filter((b) => b.status === "pending").length,
      cancelledJobs: bookings.filter((b) => b.status === "cancelled").length,
      noShowJobs: bookings.filter((b) => b.status === "no_show").length,
      outstanding: bookings
        .filter((b) => b.status === "pending")
        .reduce((sum, b) => sum + Number(b.services?.price || 0), 0),
      netRevenue: 0,
      totalStaffPayout: 0,
      storeKeeps: 0,
    };
  }, [bookings]);

  const stats = summary?.stats || fallbackStats;

  const byMethod = summary?.byMethod || {
    cash: 0,
    card: 0,
    hicaps: 0,
    transfer: 0,
    other: 0,
  };

  const transactions = summary?.transactions || {
    payments: { total: 0 },
    refunds: { total: 0 },
    deposits: { total: 0 },
    cancellationFees: { total: 0 },
    voids: { total: 0 },
  };

  const staffPayouts = summary?.staffPayouts || [];

  const startTill =
    summary?.startTill ??
    summary?.stats?.startTill ??
    0;

  const cashOnTill =
    summary?.cashOnTill ??
    summary?.stats?.cashOnTill ??
    startTill;

  const pendingBookings = useMemo(() => {
    return bookings.filter((booking) => booking.status === "pending");
  }, [bookings]);

  const hasPendingBookings = pendingBookings.length > 0;

  async function handleCompleteEndDay() {
    if (hasPendingBookings) {
      setCompleteError(
        "Cannot finalize day while pending bookings still exist. Please finalize all pending bookings first."
      );
      return;
    }

    try {
      setIsCompleting(true);
      setCompleteError("");

      const res = await fetch(apiPath(storeSlug, "/complete-end-day"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: selectedDate,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to complete end of day");
      }

      onFinish?.(data);
    } catch (error) {
      console.error(error);
      setCompleteError(error.message || "Could not finalize day.");
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="relative shrink-0 border-b border-[#E8DED6] bg-[#F8F1EC] p-5 text-[#3F3733] sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isCompleting}
            className="absolute right-5 top-5 rounded-full p-2 text-[#8B7A72] transition hover:bg-white hover:text-[#3F3733] disabled:opacity-40 sm:right-6 sm:top-6"
          >
            <X size={24} />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E1D3CA] bg-white text-[#7A6458] shadow-sm">
              <Moon size={22} />
            </div>

            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              End of Day Report
            </h2>
          </div>

          <p className="mt-1 max-w-2xl text-sm text-[#7B6B64]">
            Review today&apos;s records before closing store operations.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-sm text-gray-500">
              Loading end of day summary...
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
              {loadError}
            </div>
          ) : (
            <div className="space-y-6">
              {completeError && (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                  {completeError}
                </div>
              )}

              {hasPendingBookings && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
                      <AlertCircle size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold text-amber-900">
                        Pending bookings still exist
                      </h3>

                      <p className="mt-1 text-sm text-amber-800">
                        All active bookings must be finalized before the store
                        can be closed. Please finish or close each pending
                        booking first.
                      </p>

                      <div className="mt-4 overflow-hidden rounded-2xl border border-amber-200 bg-white">
                        <div className="divide-y divide-amber-100">
                          {pendingBookings.map((booking) => (
                            <div
                              key={booking.id}
                              className="flex items-center justify-between gap-4 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-gray-900">
                                  {booking.customer_name || "Walk-in"}
                                </p>

                                <p className="mt-1 text-xs font-medium text-[#9A8A84]">
                                  {String(booking.time || "").substring(0, 5)} •{" "}
                                  {booking.services?.name ||
                                    booking.service_name_snapshot ||
                                    booking.service_name ||
                                    "Service"}
                                </p>
                              </div>

                              <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
                                Pending
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-amber-700">
                        Finalize these bookings first to continue.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-[#E8DED6] bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-500" />

                    <span className="text-xs font-bold uppercase tracking-widest text-[#9A8A84]">
                      Paid Jobs
                    </span>
                  </div>

                  <p className="text-2xl font-semibold tracking-tight sm:text-3xl text-[#4A3A34]">
                    {stats.paidJobs} / {stats.totalJobs}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E8DED6] bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp size={16} className="text-[#C87D87]" />

                    <span className="text-xs font-bold uppercase tracking-widest text-[#9A8A84]">
                      Net Revenue
                    </span>
                  </div>

                  <p className="text-2xl font-semibold tracking-tight sm:text-3xl text-[#4A3A34]">
                    {currency(stats.netRevenue)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E8DED6] bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Banknote size={16} className="text-blue-600" />

                    <span className="text-xs font-bold uppercase tracking-widest text-[#9A8A84]">
                      Total Staff Payout
                    </span>
                  </div>

                  <p className="text-2xl font-semibold tracking-tight sm:text-3xl text-[#4A3A34]">
                    {currency(stats.totalStaffPayout)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E8DED6] bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600" />

                    <span className="text-xs font-bold uppercase tracking-widest text-[#9A8A84]">
                      Store Keeps
                    </span>
                  </div>

                  <p className="text-2xl font-semibold tracking-tight sm:text-3xl text-[#4A3A34]">
                    {currency(stats.storeKeeps)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E8DED6] bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Banknote size={16} className="text-[#8B5E3C]" />

                    <span className="text-xs font-bold uppercase tracking-widest text-[#9A8A84]">
                      Start Till
                    </span>
                  </div>

                  <p className="text-2xl font-semibold tracking-tight sm:text-3xl text-[#4A3A34]">
                    {currency(startTill)}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Banknote size={16} className="text-emerald-600" />

                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                      Expected Cash in Till
                    </span>
                  </div>

                  <p className="text-2xl font-semibold tracking-tight sm:text-3xl text-emerald-900">
                    {currency(cashOnTill)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div>
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#9A8A84]">
                    Payment Breakdown
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700">
                          <Banknote size={16} />
                        </div>

                        <span className="font-semibold text-[#5B4B45]">Cash</span>
                      </div>

                      <span className="text-lg font-semibold text-[#3F3733]">
                        {currency(byMethod.cash)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                          <CreditCard size={16} />
                        </div>

                        <span className="font-semibold text-[#5B4B45]">Card</span>
                      </div>

                      <span className="text-lg font-semibold text-[#3F3733]">
                        {currency(byMethod.card)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                          <Landmark size={16} />
                        </div>

                        <span className="font-semibold text-[#5B4B45]">Hicaps</span>
                      </div>

                      <span className="text-lg font-semibold text-[#3F3733]">
                        {currency(byMethod.hicaps)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                          <Landmark size={16} />
                        </div>

                        <span className="font-semibold text-[#5B4B45]">Transfer</span>
                      </div>

                      <span className="text-lg font-semibold text-[#3F3733]">
                        {currency(byMethod.transfer)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                          <AlertCircle size={16} />
                        </div>

                        <span className="font-semibold text-[#5B4B45]">Other</span>
                      </div>

                      <span className="text-lg font-semibold text-[#3F3733]">
                        {currency(byMethod.other)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
                          <AlertCircle size={18} />
                        </div>

                        <span className="font-semibold text-amber-700">
                          Outstanding (Unpaid)
                        </span>
                      </div>

                      <span className="text-lg font-semibold text-amber-900">
                        {currency(stats.outstanding)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#9A8A84]">
                    Transaction Summary
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-4 shadow-sm">
                      <p className="text-xs font-medium text-[#9A8A84]">Payments</p>
                      <p className="mt-1 text-lg font-semibold text-[#3F3733]">
                        {currency(transactions.payments.total)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-4 shadow-sm">
                      <p className="text-xs font-medium text-[#9A8A84]">Refunds</p>
                      <p className="mt-1 text-lg font-semibold text-[#3F3733]">
                        {currency(transactions.refunds.total)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-4 shadow-sm">
                      <p className="text-xs font-medium text-[#9A8A84]">Deposits</p>
                      <p className="mt-1 text-lg font-semibold text-[#3F3733]">
                        {currency(transactions.deposits.total)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-4 shadow-sm">
                      <p className="text-xs font-medium text-[#9A8A84]">Voids</p>
                      <p className="mt-1 text-lg font-semibold text-[#3F3733]">
                        {currency(transactions.voids.total)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#9A8A84]">
                  Staff Payouts
                </h3>

                <div className="overflow-hidden rounded-3xl border border-[#E8DED6] bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#FAF5F1] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9A8A84]">
                        <tr>
                          <th className="px-4 py-3">Staff</th>
                          <th className="px-4 py-3">Policy</th>
                          <th className="px-4 py-3">Paid Jobs</th>
                          <th className="px-4 py-3">Full Refunds</th>
                          <th className="px-4 py-3">Gross</th>
                          <th className="px-4 py-3">Refunds</th>
                          <th className="px-4 py-3">Effective</th>
                          <th className="px-4 py-3">Payout</th>
                        </tr>
                      </thead>

                      <tbody>
                        {staffPayouts.length === 0 ? (
                          <tr>
                            <td
                              className="px-4 py-6 text-center text-[#9A8A84]"
                              colSpan={8}
                            >
                              No staff payout data for this day.
                            </td>
                          </tr>
                        ) : (
                          staffPayouts.map((staff) => (
                            <tr
                              key={staff.staff_id}
                              className="border-t border-[#F3EAE4]"
                            >
                              <td className="px-4 py-3 font-semibold text-[#3F3733]">
                                {staff.staff_name}
                              </td>

                              <td className="px-4 py-3 text-[#6F625C]">
                                {staff.policy_name || "No policy"}
                              </td>

                              <td className="px-4 py-3 text-[#6F625C]">
                                {staff.paid_jobs_count}
                              </td>

                              <td className="px-4 py-3 text-[#6F625C]">
                                {staff.fully_refunded_jobs_count}
                              </td>

                              <td className="px-4 py-3 text-[#6F625C]">
                                {currency(staff.gross_sales)}
                              </td>

                              <td className="px-4 py-3 text-[#6F625C]">
                                {currency(staff.refunds)}
                              </td>

                              <td className="px-4 py-3 text-[#6F625C]">
                                {currency(staff.effective_sales)}
                              </td>

                              <td className="px-4 py-3 font-bold text-[#3F3733]">
                                {currency(staff.payout_total)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#E8DED6] bg-[#FFFCFA] p-5 sm:p-6">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isCompleting}
              className="flex-1 rounded-2xl border border-[#E2D7CF] bg-white py-3.5 font-semibold text-[#6F625C] transition hover:bg-[#FAF5F1] disabled:opacity-50"
            >
              Back to Grid
            </button>

            <button
              type="button"
              onClick={() => {
                if (hasPendingBookings) return;
                setCompleteError("");
                setShowFinalizeConfirm(true);
              }}
              disabled={loading || isCompleting || !!loadError || hasPendingBookings}
              className="flex-[1.5] rounded-2xl bg-[#B86F52] py-3.5 font-semibold text-white shadow-sm transition hover:bg-[#A86248] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCompleting
                ? "Finalizing..."
                : hasPendingBookings
                  ? "Pending Bookings Exist"
                  : "Finalize Day"}
            </button>
          </div>
        </div>
      </div>

      {showFinalizeConfirm && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[2rem] border border-[#E8DED6] bg-[#FFFCFA] p-6 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#E8DED6] bg-white text-[#7A6458]">
              <AlertCircle size={22} />
            </div>

            <h3 className="mt-4 text-center text-xl font-semibold tracking-tight text-[#3F3733]">
              Finalize and lock this day?
            </h3>

            <p className="mt-2 text-center text-sm leading-6 text-[#7B6B64]">
              After this day is finalized, front desk can no longer edit
              bookings, payments, refunds, staff assignment, or notes for this
              date.
            </p>

            <div className="mt-5 rounded-2xl border border-[#F3B2A5] bg-[#FFF1EE] px-4 py-3 text-sm font-semibold text-[#9F3A2E]">
              This action cannot be changed from the front desk.
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowFinalizeConfirm(false)}
                disabled={isCompleting}
                className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Go back
              </button>

              <button
                type="button"
                onClick={async () => {
                  setShowFinalizeConfirm(false);
                  await handleCompleteEndDay();
                }}
                disabled={isCompleting}
                className="flex-[1.4] rounded-2xl bg-[#B86F52] px-4 py-3 text-sm font-semibold text-white hover:bg-[#A86248] disabled:opacity-50"
              >
                Yes, finalize day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
