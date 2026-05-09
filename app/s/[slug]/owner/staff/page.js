"use client";

import { use, useEffect, useMemo, useState } from "react";
import { storeApiUrl } from "@/lib/storeApi";

function apiPath(slug, path) {
  return slug ? storeApiUrl(slug, path) : `/api${path}`;
}

function currency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function safeDateInputValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatEmploymentType(value) {
  if (!value) return "-";
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRoleLabel(policy) {
  if (!policy) return "";
  return policy.role_name || policy.name || "Role";
}

function formatMinutes(totalMinutes) {
  const mins = Number(totalMinutes || 0);
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;

  if (!hours) return `${remainder}m`;
  if (!remainder) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function summaryCard(title, value, subtitle = "") {
  return { title, value, subtitle };
}

function FieldLabel({ children, optional = false }) {
  return (
    <label className="mb-2 block text-sm font-medium text-gray-700">
      <span>{children}</span>
      {optional ? (
        <span className="ml-2 text-xs font-normal italic text-gray-400">
          optional
        </span>
      ) : null}
    </label>
  );
}

const EMPTY_FORM = {
  name_display: "",
  name_legal: "",
  staff_code: "",
  employment_type: "temporary",
  payout_policy_id: "",
  start_date: "",
  end_date: "",
  abn: "",
  tfn: "",
  is_active: true,
};

export default function OwnerStaffPage({ params }) {
  const { slug } = use(params);

  const [staffStatusFilter, setStaffStatusFilter] = useState("all");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [staffRows, setStaffRows] = useState([]);

  const [policies, setPolicies] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesError, setPoliciesError] = useState("");

  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formMode, setFormMode] = useState("create");
  const [form, setForm] = useState(EMPTY_FORM);

  const [range, setRange] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const firstDay = `${year}-${month}-01`;
    const today = `${year}-${month}-${String(now.getDate()).padStart(2, "0")}`;

    return {
      from: firstDay,
      to: today,
      activeOnly: false,
      abnOnly: false,
    };
  });

  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  const [payoutSummary, setPayoutSummary] = useState(null);
  const [payoutRows, setPayoutRows] = useState([]);

  async function fetchPolicies() {
    try {
      setPoliciesLoading(true);
      setPoliciesError("");

      const res = await fetch(apiPath(slug, "/payout-policies"), {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load employment roles");
      }

      setPolicies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setPoliciesError(err.message || "Could not load employment roles.");
      setPolicies([]);
    } finally {
      setPoliciesLoading(false);
    }
  }

  async function fetchStaff(status = staffStatusFilter) {
    try {
      setStaffLoading(true);
      setStaffError("");

      const res = await fetch(apiPath(slug, `/staff?status=${status}`), {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load staff");
      }

      setStaffRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setStaffError(err.message || "Could not load staff.");
      setStaffRows([]);
    } finally {
      setStaffLoading(false);
    }
  }

  async function fetchPayoutSummary(currentRange = range) {
    try {
      if (!currentRange.from || !currentRange.to) return;

      setPayoutLoading(true);
      setPayoutError("");

      const params = new URLSearchParams({
        from: currentRange.from,
        to: currentRange.to,
        activeOnly: String(currentRange.activeOnly),
        abnOnly: String(currentRange.abnOnly),
      });

      const res = await fetch(
        apiPath(slug, `/staff/payout-summary?${params.toString()}`),
        { cache: "no-store" }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load payout summary");
      }

      setPayoutSummary(data.summary || null);
      setPayoutRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      console.error(err);
      setPayoutError(err.message || "Could not load payout summary.");
      setPayoutSummary(null);
      setPayoutRows([]);
    } finally {
      setPayoutLoading(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    fetchStaff(staffStatusFilter);
  }, [slug, staffStatusFilter]);

  useEffect(() => {
    if (!slug) return;
    fetchPolicies();
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    fetchPayoutSummary(range);
  }, [slug, range.from, range.to, range.activeOnly, range.abnOnly]);

  const policiesById = useMemo(() => {
    const map = new Map();
    policies.forEach((policy) => {
      map.set(String(policy.id), policy);
    });
    return map;
  }, [policies]);

  const staffSummaryCards = useMemo(() => {
    const total = staffRows.length;
    const active = staffRows.filter((row) => row.is_active).length;
    const abnCount = staffRows.filter((row) => row.abn).length;
    const noCode = staffRows.filter((row) => !row.staff_code).length;
    const noRole = staffRows.filter((row) => !row.payout_policy_id).length;

    return [
      summaryCard("Staff in view", total),
      summaryCard("Active", active),
      summaryCard("With ABN", abnCount),
      summaryCard("No role", noRole),
      summaryCard("No code yet", noCode),
    ];
  }, [staffRows]);

  const payoutSummaryCards = useMemo(() => {
    if (!payoutSummary) return [];

    return [
      summaryCard("Total Staff", payoutSummary.total_staff ?? 0),
      summaryCard("Total Jobs", payoutSummary.total_jobs ?? 0),
      summaryCard(
        "Total Hours",
        formatMinutes(payoutSummary.total_minutes || 0)
      ),
      summaryCard("Total Payout", currency(payoutSummary.total_payout || 0)),
    ];
  }, [payoutSummary]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormMode("create");
  }

  function startEditStaff(row) {
    setFormMode("edit");
    setEditingId(row.id);
    setForm({
      name_display: row.name_display || "",
      name_legal: row.name_legal || "",
      staff_code: row.staff_code || "",
      employment_type: row.employment_type || "temporary",
      payout_policy_id: row.payout_policy_id ? String(row.payout_policy_id) : "",
      start_date: safeDateInputValue(row.start_date),
      end_date: safeDateInputValue(row.end_date),
      abn: row.abn || "",
      tfn: row.tfn || "",
      is_active: Boolean(row.is_active),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setStaffError("");

      if (!form.payout_policy_id) {
        throw new Error("Please select an employment role for this staff member.");
      }

      const isEdit = formMode === "edit" && editingId;
      const url = isEdit
        ? apiPath(slug, `/staff/${editingId}`)
        : apiPath(slug, "/staff");

      const method = isEdit ? "PATCH" : "POST";

      const payload = {
        ...form,
        payout_policy_id: form.payout_policy_id || null,
      };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save staff");
      }

      resetForm();
      await fetchStaff(staffStatusFilter);
      await fetchPayoutSummary(range);
    } catch (err) {
      console.error(err);
      setStaffError(err.message || "Could not save staff.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-emerald-600">
          Owner Dashboard
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Staff</h1>
        <p className="mt-2 text-sm text-gray-500">
          Manage staff records, assign employment roles, and review payout totals
          by date range.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Section 1
          </p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">
            Staff Directory
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Add staff, update details later, assign their employment role, and
            mark people inactive when they leave.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          {staffSummaryCards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <p className="text-sm text-gray-500">{card.title}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {card.value}
              </p>
              {card.subtitle ? (
                <p className="mt-1 text-xs text-gray-500">{card.subtitle}</p>
              ) : null}
            </div>
          ))}
        </div>

        {policiesError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {policiesError}
          </div>
        ) : null}

        {policies.length === 0 && !policiesLoading ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No employment roles found yet. Create at least one role in
            Employment Roles & Payout before adding staff.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {formMode === "edit" ? "Edit Staff" : "Add Staff"}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Basic staff profile for owner use, payroll notes, tax
                  reference, and employment role.
                </p>
              </div>

              {formMode === "edit" ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <FieldLabel>Display name *</FieldLabel>
                <input
                  value={form.name_display}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      name_display: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
                  placeholder="Nancy"
                  required
                />
              </div>

              <div>
                <FieldLabel optional>Legal name</FieldLabel>
                <input
                  value={form.name_legal}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      name_legal: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
                  placeholder="Full legal name"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel optional>Staff code</FieldLabel>
                  <input
                    value={form.staff_code}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        staff_code: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
                    placeholder="NAN01"
                  />
                </div>

                <div>
                  <FieldLabel>Employment Role *</FieldLabel>
                  <select
                    value={form.payout_policy_id || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        payout_policy_id: e.target.value || "",
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
                    disabled={policiesLoading}
                    required
                  >
                    <option value="">
                      {policiesLoading ? "Loading roles..." : "Select role"}
                    </option>
                    {policies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {getRoleLabel(policy)}
                        {policy.is_active === false ? " (inactive)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                Role controls how payout is calculated. Create or edit roles in
                Employment Roles & Payout.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel optional>Start date</FieldLabel>
                  <input
                    type="date"
                    value={safeDateInputValue(form.start_date)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        start_date: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
                  />
                </div>

                <div>
                  <FieldLabel optional>End date</FieldLabel>
                  <input
                    type="date"
                    value={safeDateInputValue(form.end_date)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        end_date: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
                  />
                </div>
              </div>

              <div>
                <FieldLabel optional>ABN</FieldLabel>
                <input
                  value={form.abn}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      abn: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
                  placeholder="ABN"
                />
              </div>

              <div>
                <FieldLabel optional>TFN</FieldLabel>
                <input
                  value={form.tfn}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      tfn: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
                  placeholder="TFN"
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                />
                Active now
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? formMode === "edit"
                    ? "Saving changes..."
                    : "Saving..."
                  : formMode === "edit"
                    ? "Save changes"
                    : "Save new staff"}
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Staff List
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Store records for this team.
                </p>
              </div>

              <div className="inline-flex rounded-xl bg-gray-100 p-1">
                {["all", "active", "inactive"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStaffStatusFilter(option)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                      staffStatusFilter === option
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {staffError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {staffError}
              </div>
            ) : null}

            {staffLoading ? (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                Loading staff...
              </div>
            ) : staffRows.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                No staff found in this filter.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 text-left text-sm text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Staff</th>
                        <th className="px-4 py-3 font-medium">Code</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">ABN</th>
                        <th className="px-4 py-3 font-medium">Start</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200 bg-white">
                      {staffRows.map((row) => {
                        const policy = row.payout_policy_id
                          ? policiesById.get(String(row.payout_policy_id))
                          : null;

                        return (
                          <tr key={row.id} className="text-sm text-gray-700">
                            <td className="px-4 py-4">
                              <div className="font-medium text-gray-900">
                                {row.name_display || row.name || "-"}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                Legal: {row.name_legal || "-"}
                              </div>
                            </td>
                            <td className="px-4 py-4">{row.staff_code || "-"}</td>
                            <td className="px-4 py-4">
                              {policy ? (
                                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                  {getRoleLabel(policy)}
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                                  No role
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">{row.abn || "-"}</td>
                            <td className="px-4 py-4">
                              {safeDateInputValue(row.start_date) || "-"}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                  row.is_active
                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                                    : "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200"
                                }`}
                              >
                                {row.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => startEditStaff(row)}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Section 2
          </p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">
            Staff Payout Summary
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Select a date range to see how much each staff member earned.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr,1fr,auto,auto]">
            <div>
              <FieldLabel>From</FieldLabel>
              <input
                type="date"
                value={safeDateInputValue(range.from)}
                onChange={(e) =>
                  setRange((prev) => ({
                    ...prev,
                    from: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
              />
            </div>

            <div>
              <FieldLabel>To</FieldLabel>
              <input
                type="date"
                value={safeDateInputValue(range.to)}
                onChange={(e) =>
                  setRange((prev) => ({
                    ...prev,
                    to: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
              />
            </div>

            <label className="flex items-end gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={range.activeOnly}
                onChange={(e) =>
                  setRange((prev) => ({
                    ...prev,
                    activeOnly: e.target.checked,
                  }))
                }
              />
              Active only
            </label>

            <label className="flex items-end gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={range.abnOnly}
                onChange={(e) =>
                  setRange((prev) => ({
                    ...prev,
                    abnOnly: e.target.checked,
                  }))
                }
              />
              ABN only
            </label>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {payoutSummaryCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-gray-200 bg-white p-4"
              >
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {card.value}
                </p>
                {card.subtitle ? (
                  <p className="mt-1 text-xs text-gray-500">{card.subtitle}</p>
                ) : null}
              </div>
            ))}
          </div>

          {payoutError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {payoutError}
            </div>
          ) : null}

          {payoutLoading ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
              Loading payout summary...
            </div>
          ) : payoutRows.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
              No payout rows found for this date range.
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-left text-sm text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Staff</th>
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">ABN</th>
                      <th className="px-4 py-3 font-medium">Jobs</th>
                      <th className="px-4 py-3 font-medium">Hours</th>
                      <th className="px-4 py-3 font-medium">Payout</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 bg-white">
                    {payoutRows.map((row) => (
                      <tr key={row.staff_id} className="text-sm text-gray-700">
                        <td className="px-4 py-4 font-medium text-gray-900">
                          {row.staff_name || "-"}
                        </td>
                        <td className="px-4 py-4">{row.staff_code || "-"}</td>
                        <td className="px-4 py-4">
                          {row.role_name ||
                            row.payout_role_name ||
                            row.payout_policy_name ||
                            formatEmploymentType(row.employment_type)}
                        </td>
                        <td className="px-4 py-4">{row.abn || "-"}</td>
                        <td className="px-4 py-4">{row.jobs_count || 0}</td>
                        <td className="px-4 py-4">
                          {formatMinutes(row.total_minutes || 0)}
                        </td>
                        <td className="px-4 py-4 font-semibold text-gray-900">
                          {currency(row.payout_total || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}