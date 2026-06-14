"use client";

import { use, useEffect, useMemo, useState } from "react";
import { getStoreFeatures } from "@/lib/config/features";
import { storeApiUrl } from "@/lib/storeApi";
import { useStore } from "../../StoreContext";

function apiPath(slug, path) {
  return slug ? storeApiUrl(slug, path) : `/api${path}`;
}

function currency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatTime(value) {
  if (!value) return "-";
  return String(value).slice(0, 5);
}

function formatDuration(minutes, emptyLabel = "-") {
  const totalMinutes = Number(minutes || 0);
  if (!totalMinutes) return emptyLabel;

  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;

  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

function summaryCard(title, value, subtitle = "") {
  return { title, value, subtitle };
}

export default function OwnerReportsPage({ params }) {
  const { slug } = use(params);
  const store = useStore();
  const storeFeatures = getStoreFeatures(store);
  const payoutsEnabled = storeFeatures.PAYOUTS;
  const financialControlsEnabled = storeFeatures.FINANCIAL_CONTROLS;
  const bookingLogColumnCount = payoutsEnabled ? 18 : 17;
  const staffActivityColumnCount = payoutsEnabled ? 12 : 5;

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [rows, setRows] = useState([]);
  const [workingStaff, setWorkingStaff] = useState([]);

  useEffect(() => {
    if (!slug || !selectedDate) return;

    async function fetchReport() {
      try {
        setLoading(true);
        setError("");

        const [reportResult, staffResult] = await Promise.all([
          fetch(apiPath(slug, `/reports?date=${selectedDate}`)).then(async (res) => ({
            res,
            data: await res.json().catch(() => null),
          })),
          fetch(apiPath(slug, `/effective-staff?date=${selectedDate}`)).then(
            async (res) => ({
              res,
              data: await res.json().catch(() => null),
            })
          ),
        ]);

        if (!reportResult.res.ok) {
          throw new Error(reportResult.data?.error || "Failed to load report");
        }

        if (!staffResult.res.ok) {
          console.error(
            staffResult.data?.error || "Failed to load effective staff"
          );
        }

        setReport(reportResult.data?.report || null);
        setRows(Array.isArray(reportResult.data?.rows) ? reportResult.data.rows : []);
        setWorkingStaff(
          staffResult.res.ok && Array.isArray(staffResult.data?.items)
            ? staffResult.data.items
            : []
        );
      } catch (err) {
        console.error(err);
        setError(err.message || "Could not load report.");
        setReport(null);
        setRows([]);
        setWorkingStaff([]);
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [slug, selectedDate]);

  const summaryCards = useMemo(() => {
    if (!report) return [];

    const cards = [
      summaryCard("Total Jobs", report.total_jobs ?? 0, `${report.paid_jobs ?? 0} paid`),
      summaryCard(
        "Payments",
        currency(report.payments_total || 0),
        `Refunds ${currency(report.refunds_total || 0)}`
      ),
      summaryCard(
        "Net Revenue",
        currency(report.net_revenue || 0),
        `Outstanding ${currency(report.outstanding || 0)}`
      ),
    ];

    if (payoutsEnabled) {
      cards.push(
        summaryCard(
          "Staff Payout",
          currency(report.total_staff_payout || 0),
          `Store Keeps ${currency(report.store_keeps || 0)}`
        )
      );
    }

    return cards;
  }, [report, payoutsEnabled]);

  const liteStoreSummary = useMemo(() => {
    return rows.reduce(
      (summary, row) => {
        const status = String(row.status || "").trim().toLowerCase();

        summary.totalJobs += 1;
        summary.estimatedRevenue += Number(row.service_price || 0);
        summary.totalWorkingMinutes += Number(row.duration || 0);

        if (status === "paid" || status === "completed") {
          summary.completedJobs += 1;
        }

        if (status === "pending") {
          summary.pendingJobs += 1;
        }

        if (status === "cancelled" || status === "canceled") {
          summary.cancelledJobs += 1;
        }

        if (
          status === "no-show" ||
          status === "no show" ||
          status === "noshow" ||
          status === "no_show"
        ) {
          summary.noShowJobs += 1;
        }

        return summary;
      },
      {
        totalJobs: 0,
        completedJobs: 0,
        pendingJobs: 0,
        cancelledJobs: 0,
        noShowJobs: 0,
        estimatedRevenue: 0,
        totalWorkingMinutes: 0,
      }
    );
  }, [rows]);

  const groupedStaffActivity = useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const staffId = row.staff_id || "unassigned";
      const name = row.staff_name || "Unassigned";
      const key = `${staffId}:${name}`;
      const status = String(row.status || "").toLowerCase();

      const current = map.get(key) || {
        staff_id: staffId,
        staff_name: name,
        jobs: 0,
        service_value: 0,
        paid_total: 0,
        working_minutes: 0,
        cancelled_count: 0,
        no_show_count: 0,
        cash_total: 0,
        card_total: 0,
        hicaps_total: 0,
        transfer_total: 0,
        other_total: 0,
        base_payout: 0,
        rows: [],
      };

      current.jobs += 1;
      current.service_value += Number(row.service_price || 0);
      current.paid_total += Number(row.payment_total || 0);
      current.working_minutes += Number(row.duration || 0);
      current.cash_total += Number(row.cash || 0);
      current.card_total += Number(row.card || 0);
      current.hicaps_total += Number(row.hicaps || 0);
      current.transfer_total += Number(row.transfer || 0);
      current.other_total += Number(row.other || 0);
      current.base_payout += Number(row.staff_payout || 0);

      if (status === "cancelled" || status === "canceled") {
        current.cancelled_count += 1;
      }

      if (status === "no-show" || status === "no show" || status === "noshow") {
        current.no_show_count += 1;
      }

      current.rows.push(row);

      map.set(key, current);
    });

    return Array.from(map.values())
      .sort((a, b) => a.staff_name.localeCompare(b.staff_name));
  }, [rows]);

  const staffActivityGroups = useMemo(() => {
    if (workingStaff.length === 0) {
      return groupedStaffActivity;
    }

    const groupedByStaffId = new Map();
    const merged = [];
    const matchedStaffIds = new Set();
    const seenWorkingStaffIds = new Set();

    groupedStaffActivity.forEach((group) => {
      const key = group.staff_id ? String(group.staff_id) : "";

      if (!key || key === "unassigned") {
        return;
      }

      const existing = groupedByStaffId.get(key) || [];
      existing.push(group);
      groupedByStaffId.set(key, existing);
    });

    workingStaff.forEach((staff) => {
      const key = staff?.staff_id ? String(staff.staff_id) : "";

      if (!key || seenWorkingStaffIds.has(key)) {
        return;
      }

      seenWorkingStaffIds.add(key);

      const matchingGroups = groupedByStaffId.get(key);

      if (matchingGroups?.length) {
        merged.push(...matchingGroups);
        matchedStaffIds.add(key);
        return;
      }

      merged.push({
        staff_id: staff.staff_id,
        staff_name: staff.name_display || staff.name || "Unknown Staff",
        jobs: 0,
        service_value: 0,
        paid_total: 0,
        working_minutes: 0,
        cancelled_count: 0,
        no_show_count: 0,
        cash_total: 0,
        card_total: 0,
        hicaps_total: 0,
        transfer_total: 0,
        other_total: 0,
        base_payout: 0,
        rows: [],
        is_zero_state: true,
      });
    });

    groupedStaffActivity.forEach((group) => {
      const key = group.staff_id ? String(group.staff_id) : "";

      if (!key || key === "unassigned" || !matchedStaffIds.has(key)) {
        merged.push(group);
      }
    });

    return merged;
  }, [groupedStaffActivity, workingStaff]);

  const hasReport = Boolean(report);

  return (
    <div className="min-h-screen bg-[#FAF7F4] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-4xl border border-[#EADFD8] bg-white shadow-sm">
          <div className="border-b border-[#F1E7E2] bg-[#4A3A34] px-6 py-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
              Owner Reports
            </p>
            <h1 className="mt-2 text-3xl font-bold">Daily Report</h1>
            <p className="mt-2 text-sm text-white/70">
              Daily Summary + Daily Booking Log
            </p>
          </div>

          <div className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Select date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gray-400"
              />
            </div>

            {report && (
              <div className="grid gap-3 text-sm text-gray-600 md:grid-flow-col">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2">
                  Start till:{" "}
                  <span className="font-semibold">
                    {currency(report.start_till || 0)}
                  </span>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2">
                  End till:{" "}
                  <span className="font-semibold">
                    {currency(report.end_till || 0)}
                  </span>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2">
                  Closed:{" "}
                  <span className="font-semibold">
                    {report.closed_at ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-gray-200 bg-white px-6 py-10 text-sm text-gray-500 shadow-sm">
            Loading report...
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-red-200 bg-red-50 px-6 py-10 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : !hasReport ? (
          <div className="rounded-[2rem] border border-amber-200 bg-amber-50 px-6 py-10 text-sm text-amber-800 shadow-sm">
            No end-of-day report found for this date yet.
          </div>
        ) : (
          <>
            {financialControlsEnabled ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                      Daily Summary
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-[#4A3A34]">
                      Summary for {selectedDate}
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {summaryCards.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-[1.5rem] border border-[#F1E4DA] bg-white p-5 shadow-sm"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                        {card.title}
                      </p>
                      <p className="mt-2 text-3xl font-black text-[#4A3A34]">
                        {card.value}
                      </p>
                      {card.subtitle ? (
                        <p className="mt-2 text-sm text-gray-500">{card.subtitle}</p>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                      Payment Breakdown
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        ["Cash", report.cash_total],
                        ["Card", report.card_total],
                        ["Hicaps", report.hicaps_total],
                        ["Transfer", report.transfer_total],
                        ["Other", report.other_total],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border bg-gray-50 px-4 py-3">
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className="mt-1 text-lg font-bold text-[#4A3A34]">
                            {currency(value || 0)}
                          </p>
                        </div>
                      ))}

                      <div className="rounded-xl border bg-amber-50 px-4 py-3">
                        <p className="text-xs text-amber-700">Outstanding</p>
                        <p className="mt-1 text-lg font-bold text-amber-900">
                          {currency(report.outstanding || 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                      Day Status
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[
                        ["Paid", report.paid_jobs || 0],
                        ["Pending", report.pending_jobs || 0],
                        ["Cancelled", report.cancelled_jobs || 0],
                        ["No-show", report.no_show_jobs || 0],
                        ["Deposits", currency(report.deposits_total || 0)],
                        ["Voids", currency(report.voids_total || 0)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border bg-gray-50 px-4 py-3">
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className="mt-1 text-lg font-bold text-[#4A3A34]">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {report.notes ? (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-[#FAF7F4] px-4 py-3 text-sm text-gray-700">
                        <span className="font-semibold text-[#4A3A34]">
                          Closing note:
                        </span>{" "}
                        {report.notes}
                      </div>
                    ) : null}
                  </div>

                </div>
              </section>
            ) : (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                      Store Activity Summary
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-[#4A3A34]">
                      Activity for {selectedDate}
                    </h2>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-[#F1E4DA] bg-white p-4 shadow-sm">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-xl border border-[#F3E7DD] bg-[#FAF7F4] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                        Estimated Revenue
                      </p>
                      <p className="mt-1 text-2xl font-bold text-[#4A3A34]">
                        {currency(liteStoreSummary.estimatedRevenue)}
                      </p>
                    </div>

                    {[
                      ["Completed Jobs", liteStoreSummary.completedJobs],
                      ["Cancelled", liteStoreSummary.cancelledJobs],
                      ["No Show", liteStoreSummary.noShowJobs],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-[#F3E7DD] bg-white px-4 py-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                          {label}
                        </p>
                        <p className="mt-1 text-2xl font-bold text-[#4A3A34]">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-[2rem] border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Staff Activity Summary
                </p>
                <h2 className="mt-1 text-2xl font-bold text-[#4A3A34]">
                  Staff activity for {selectedDate}
                </h2>
              </div>

              <div className="space-y-5 p-5">
                {staffActivityGroups.length === 0 ? (
                  <div className="rounded-xl border bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
                    No staff activity rows found for this day.
                  </div>
                ) : (
                  staffActivityGroups.map((staff) => (
                    <div
                      key={`${staff.staff_id}:${staff.staff_name}`}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                    >
                      <div className="border-b border-gray-100 bg-[#FAF7F4] px-5 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-[#4A3A34]">
                              {staff.staff_name}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              {staff.jobs} job{staff.jobs === 1 ? "" : "s"}
                              {staff.cancelled_count || staff.no_show_count
                                ? ` · ${staff.cancelled_count} cancelled · ${staff.no_show_count} no-show`
                                : ""}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                            <div>
                              <p className="text-xs text-gray-500">
                                {payoutsEnabled ? "Service Value" : "Estimated Revenue"}
                              </p>
                              <p className="font-bold text-[#4A3A34]">
                                {currency(staff.service_value || 0)}
                              </p>
                            </div>
                            {payoutsEnabled ? (
                              <div>
                                <p className="text-xs text-gray-500">Paid Total</p>
                                <p className="font-bold text-[#4A3A34]">
                                  {currency(staff.paid_total || 0)}
                                </p>
                              </div>
                            ) : null}
                            <div>
                              <p className="text-xs text-gray-500">Working Time</p>
                              <p className="font-bold text-[#4A3A34]">
                                {formatDuration(
                                  staff.working_minutes,
                                  staff.jobs === 0 ? "0 hr" : "-"
                                )}
                              </p>
                            </div>
                            {payoutsEnabled ? (
                              <div>
                                <p className="text-xs text-gray-500">Base Payout</p>
                                <p className="font-bold text-[#4A3A34]">
                                  {currency(staff.base_payout || 0)}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table
                          className={`w-full text-sm ${
                            payoutsEnabled ? "min-w-[1100px]" : "min-w-[620px]"
                          }`}
                        >
                          <thead className="bg-white text-left text-xs uppercase tracking-[0.18em] text-gray-500">
                            <tr>
                              <th className="px-4 py-3">Time</th>
                              <th className="px-4 py-3">Service</th>
                              <th className="px-4 py-3">Duration</th>
                              <th className="px-4 py-3">Value</th>
                              <th className="px-4 py-3">Status</th>
                              {payoutsEnabled ? (
                                <>
                                  <th className="px-4 py-3">Cash</th>
                                  <th className="px-4 py-3">Card</th>
                                  <th className="px-4 py-3">HICAPS</th>
                                  <th className="px-4 py-3">Transfer</th>
                                  <th className="px-4 py-3">Other</th>
                                  <th className="px-4 py-3">Paid Total</th>
                                  <th className="px-4 py-3">Payout</th>
                                </>
                              ) : null}
                            </tr>
                          </thead>

                          <tbody>
                            {staff.rows.length === 0 ? (
                              <tr className="border-t border-gray-100">
                                <td
                                  colSpan={staffActivityColumnCount}
                                  className="px-4 py-6 text-center text-sm text-gray-400"
                                >
                                  No jobs recorded for this staff on this day.
                                </td>
                              </tr>
                            ) : (
                              staff.rows.map((row, index) => (
                                <tr
                                  key={row.id || `${staff.staff_id}-${index}`}
                                  className="border-t border-gray-100"
                                >
                                  <td className="px-4 py-3 text-gray-700">
                                    {formatTime(row.start_time)}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    {row.service_name || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    {formatDuration(row.duration)}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    {currency(row.service_price || 0)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                                      {row.status || "-"}
                                    </span>
                                  </td>
                                  {payoutsEnabled ? (
                                    <>
                                      <td className="px-4 py-3 text-gray-700">
                                        {currency(row.cash || 0)}
                                      </td>
                                      <td className="px-4 py-3 text-gray-700">
                                        {currency(row.card || 0)}
                                      </td>
                                      <td className="px-4 py-3 text-gray-700">
                                        {currency(row.hicaps || 0)}
                                      </td>
                                      <td className="px-4 py-3 text-gray-700">
                                        {currency(row.transfer || 0)}
                                      </td>
                                      <td className="px-4 py-3 text-gray-700">
                                        {currency(row.other || 0)}
                                      </td>
                                      <td className="px-4 py-3 font-medium text-[#4A3A34]">
                                        {currency(row.payment_total || 0)}
                                      </td>
                                      <td className="px-4 py-3 font-semibold text-[#4A3A34]">
                                        {currency(row.staff_payout || 0)}
                                      </td>
                                    </>
                                  ) : null}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {financialControlsEnabled ? (
              <section className="rounded-[2rem] border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Daily Booking Log
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-[#4A3A34]">
                    Booking log for {selectedDate}
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[1500px] w-full text-sm">
                    <thead className="bg-[#FAF7F4] text-left text-xs uppercase tracking-[0.18em] text-gray-500">
                      <tr>
                        <th className="px-4 py-3">No.</th>
                        <th className="px-4 py-3">Start</th>
                        <th className="px-4 py-3">End</th>
                        <th className="px-4 py-3">Service</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Staff</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Cash</th>
                        <th className="px-4 py-3">Card</th>
                        <th className="px-4 py-3">Hicaps</th>
                        <th className="px-4 py-3">Transfer</th>
                        <th className="px-4 py-3">Other</th>
                        <th className="px-4 py-3">Paid Total</th>
                        <th className="px-4 py-3">Refund</th>
                        {payoutsEnabled ? (
                          <th className="px-4 py-3">Payout</th>
                        ) : null}
                        <th className="px-4 py-3">Ref Code</th>
                        <th className="px-4 py-3">Staff Note</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={bookingLogColumnCount}
                            className="px-4 py-10 text-center text-gray-400"
                          >
                            No booking rows found for this date.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, index) => (
                          <tr key={row.id} className="border-t border-gray-100">
                            <td className="px-4 py-3 text-gray-600">
                              {row.row_order || index + 1}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {formatTime(row.start_time)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {formatTime(row.end_time)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {row.service_name || "-"}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {row.duration ? `${row.duration} min` : "-"}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {row.staff_name || "-"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                                {row.status || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {currency(row.service_price || 0)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {currency(row.cash || 0)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {currency(row.card || 0)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {currency(row.hicaps || 0)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {currency(row.transfer || 0)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {currency(row.other || 0)}
                            </td>
                            <td className="px-4 py-3 font-medium text-[#4A3A34]">
                              {currency(row.payment_total || 0)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {currency(row.refund_total || 0)}
                            </td>
                            {payoutsEnabled ? (
                              <td className="px-4 py-3 font-semibold text-[#4A3A34]">
                                {currency(row.staff_payout || 0)}
                              </td>
                            ) : null}
                            <td className="px-4 py-3 text-gray-700">
                              {row.payment_reference_code || "-"}
                            </td>
                            <td className="max-w-[240px] px-4 py-3 text-gray-700">
                              <div className="whitespace-pre-wrap break-words">
                                {row.payment_staff_note || "-"}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>

                    {rows.length > 0 && (
                      <tfoot className="border-t-2 border-gray-200 bg-[#FAF7F4] text-sm font-semibold text-[#4A3A34]">
                        <tr>
                          <td colSpan={8} className="px-4 py-3 text-right">
                            Totals
                          </td>
                          <td className="px-4 py-3">
                            {currency(rows.reduce((sum, r) => sum + Number(r.cash || 0), 0))}
                          </td>
                          <td className="px-4 py-3">
                            {currency(rows.reduce((sum, r) => sum + Number(r.card || 0), 0))}
                          </td>
                          <td className="px-4 py-3">
                            {currency(rows.reduce((sum, r) => sum + Number(r.hicaps || 0), 0))}
                          </td>
                          <td className="px-4 py-3">
                            {currency(rows.reduce((sum, r) => sum + Number(r.transfer || 0), 0))}
                          </td>
                          <td className="px-4 py-3">
                            {currency(rows.reduce((sum, r) => sum + Number(r.other || 0), 0))}
                          </td>
                          <td className="px-4 py-3">
                            {currency(rows.reduce((sum, r) => sum + Number(r.payment_total || 0), 0))}
                          </td>
                          <td className="px-4 py-3">
                            {currency(rows.reduce((sum, r) => sum + Number(r.refund_total || 0), 0))}
                          </td>
                          {payoutsEnabled ? (
                            <td className="px-4 py-3">
                              {currency(rows.reduce((sum, r) => sum + Number(r.staff_payout || 0), 0))}
                            </td>
                          ) : null}
                          <td colSpan={2} className="px-4 py-3" />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
