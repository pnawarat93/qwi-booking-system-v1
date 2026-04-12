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

function currency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function EndDayReport({
  bookings,
  selectedDate,
  onClose,
  onFinish,
}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!selectedDate) return;

    async function fetchSummary() {
      try {
        setLoading(true);
        setLoadError("");

        const res = await fetch(`/api/end-day-summary?date=${selectedDate}`);
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
  }, [selectedDate]);

  const fallbackStats = useMemo(() => {
    return {
      totalJobs: bookings.length,
      paidJobs: bookings.filter((b) => b.status === "paid").length,
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

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="relative shrink-0 bg-[#4A3A34] p-6 text-white">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 text-white/40 transition hover:text-white"
          >
            <X size={24} />
          </button>

          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C87D87]">
            <Moon size={24} />
          </div>

          <h2 className="text-3xl font-bold">End of Day Report</h2>
          <p className="mt-1 text-white/70">Summary for {selectedDate || "today"}</p>
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-[#F1E4DA] bg-[#FFF9F6] p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                      Paid Jobs
                    </span>
                  </div>
                  <p className="text-3xl font-black text-[#4A3A34]">
                    {stats.paidJobs} / {stats.totalJobs}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#F1E4DA] bg-[#FFF9F6] p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp size={16} className="text-[#C87D87]" />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                      Net Revenue
                    </span>
                  </div>
                  <p className="text-3xl font-black text-[#4A3A34]">
                    {currency(stats.netRevenue)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#F1E4DA] bg-[#FFF9F6] p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Banknote size={16} className="text-blue-600" />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                      Total Staff Payout
                    </span>
                  </div>
                  <p className="text-3xl font-black text-[#4A3A34]">
                    {currency(stats.totalStaffPayout)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#F1E4DA] bg-[#FFF9F6] p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600" />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                      Store Keeps
                    </span>
                  </div>
                  <p className="text-3xl font-black text-[#4A3A34]">
                    {currency(stats.storeKeeps)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div>
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">
                    Payment Breakdown
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700">
                          <Banknote size={16} />
                        </div>
                        <span className="font-bold text-gray-700">Cash</span>
                      </div>
                      <span className="text-lg font-black text-[#4A3A34]">
                        {currency(byMethod.cash)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                          <CreditCard size={16} />
                        </div>
                        <span className="font-bold text-gray-700">Card</span>
                      </div>
                      <span className="text-lg font-black text-[#4A3A34]">
                        {currency(byMethod.card)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                          <Landmark size={16} />
                        </div>
                        <span className="font-bold text-gray-700">Hicaps</span>
                      </div>
                      <span className="text-lg font-black text-[#4A3A34]">
                        {currency(byMethod.hicaps)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                          <AlertCircle size={16} />
                        </div>
                        <span className="font-bold text-gray-700">Other</span>
                      </div>
                      <span className="text-lg font-black text-[#4A3A34]">
                        {currency(byMethod.other)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
                          <AlertCircle size={18} />
                        </div>
                        <span className="font-bold text-amber-700">
                          Outstanding (Unpaid)
                        </span>
                      </div>
                      <span className="text-lg font-black text-amber-900">
                        {currency(stats.outstanding)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">
                    Transaction Summary
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Payments</p>
                      <p className="mt-1 text-lg font-bold text-[#4A3A34]">
                        {currency(transactions.payments.total)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Refunds</p>
                      <p className="mt-1 text-lg font-bold text-[#4A3A34]">
                        {currency(transactions.refunds.total)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Deposits</p>
                      <p className="mt-1 text-lg font-bold text-[#4A3A34]">
                        {currency(transactions.deposits.total)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Voids</p>
                      <p className="mt-1 text-lg font-bold text-[#4A3A34]">
                        {currency(transactions.voids.total)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">
                  Staff Payouts (everyone who worked today)
                </h3>

                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase tracking-widest text-gray-500">
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
                            <td className="px-4 py-6 text-center text-gray-400" colSpan={8}>
                              No staff payout data for this day.
                            </td>
                          </tr>
                        ) : (
                          staffPayouts.map((staff) => (
                            <tr key={staff.staff_id} className="border-t border-gray-100">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {staff.staff_name}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {staff.policy_name || "No policy"}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {staff.paid_jobs_count}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {staff.fully_refunded_jobs_count}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {currency(staff.gross_sales)}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {currency(staff.refunds)}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {currency(staff.effective_sales)}
                              </td>
                              <td className="px-4 py-3 font-semibold text-[#4A3A34]">
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

        <div className="shrink-0 border-t border-gray-100 bg-white p-6">
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 rounded-2xl border border-gray-100 py-4 font-bold text-gray-400 transition hover:bg-gray-50"
            >
              Back to Grid
            </button>
            <button
              onClick={onFinish}
              className="flex-[1.5] rounded-2xl bg-[#C87D87] py-4 font-bold text-white shadow-lg transition hover:bg-[#B8707A]"
            >
              Complete End of Day
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}