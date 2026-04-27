"use client";

import { use, useEffect, useMemo, useState } from "react";
import { storeApiUrl } from "@/lib/storeApi";

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

function summaryCard(title, value, subtitle = "") {
  return { title, value, subtitle };
}

export default function OwnerReportsPage({ params }) {
  const { slug } = use(params);

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

  useEffect(() => {
    if (!slug || !selectedDate) return;

    async function fetchReport() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(apiPath(slug, `/reports?date=${selectedDate}`));
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load report");
        }

        setReport(data.report || null);
        setRows(Array.isArray(data.rows) ? data.rows : []);
      } catch (err) {
        console.error(err);
        setError(err.message || "Could not load report.");
        setReport(null);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [slug, selectedDate]);

  const summaryCards = useMemo(() => {
    if (!report) return [];

    return [
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
      summaryCard(
        "Staff Payout",
        currency(report.total_staff_payout || 0),
        `Store Keeps ${currency(report.store_keeps || 0)}`
      ),
    ];
  }, [report]);

  const staffPayoutRows = useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const name = row.staff_name || "Unassigned";

      const current = map.get(name) || {
        staff_name: name,
        jobs: 0,
        calculated_payout_total: 0,
      };

      current.jobs += 1;
      current.calculated_payout_total += Number(row.staff_payout || 0);

      map.set(name, current);
    });

    const guaranteeEnabled = Boolean(report?.enable_daily_guarantee);
    const dailyGuarantee = Number(report?.daily_guarantee || report?.dailyGuarantee || 0);

    return Array.from(map.values())
      .map((staff) => {
        const calculated = Number(staff.calculated_payout_total || 0);

        let finalPayout = calculated;
        let topUp = 0;

        if (guaranteeEnabled) {
          finalPayout = Math.max(calculated, dailyGuarantee);
          topUp = Math.max(finalPayout - calculated, 0);
        }

        return {
          ...staff,
          calculated_payout_total: calculated,
          daily_guarantee: guaranteeEnabled ? dailyGuarantee : 0,
          guarantee_top_up: topUp,
          payout_total: finalPayout,
        };
      })
      .sort((a, b) => a.staff_name.localeCompare(b.staff_name));
  }, [rows, report]);

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

                <div className="rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Staff Payout Summary
                  </p>

                  {report?.enable_daily_guarantee ? (
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                      Daily guarantee is enabled for this report.
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {staffPayoutRows.length === 0 ? (
                      <div className="rounded-xl border bg-gray-50 px-4 py-4 text-sm text-gray-400">
                        No staff payout rows for this day.
                      </div>
                    ) : (
                      staffPayoutRows.map((staff) => (
                        <div
                          key={staff.staff_name}
                          className="rounded-xl border bg-gray-50 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold text-[#4A3A34]">
                                {staff.staff_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {staff.jobs} job{staff.jobs === 1 ? "" : "s"}
                              </p>
                            </div>

                            <div className="text-right">
                              {report?.enable_daily_guarantee ? (
                                <div className="mb-2 space-y-1">
                                  <p className="text-xs text-gray-500">
                                    Calculated:{" "}
                                    {currency(staff.calculated_payout_total || 0)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Guarantee: {currency(staff.daily_guarantee || 0)}
                                  </p>
                                  {staff.guarantee_top_up > 0 ? (
                                    <p className="text-xs font-semibold text-emerald-700">
                                      Top-up: +{currency(staff.guarantee_top_up)}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}

                              <p className="text-xs text-gray-500">Final Payout</p>
                              <p className="text-lg font-bold text-[#4A3A34]">
                                {currency(staff.payout_total || 0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

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
                      <th className="px-4 py-3">Payout</th>
                      <th className="px-4 py-3">Ref Code</th>
                      <th className="px-4 py-3">Staff Note</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={18} className="px-4 py-10 text-center text-gray-400">
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
                          <td className="px-4 py-3 font-semibold text-[#4A3A34]">
                            {currency(row.staff_payout || 0)}
                          </td>
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
                        <td className="px-4 py-3">
                          {currency(rows.reduce((sum, r) => sum + Number(r.staff_payout || 0), 0))}
                        </td>
                        <td colSpan={2} className="px-4 py-3" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}