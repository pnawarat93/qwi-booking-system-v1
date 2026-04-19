"use client";

import { use, useEffect, useMemo, useState } from "react";
import { storeApiUrl } from "@/lib/storeApi";

function apiPath(slug, path) {
  return slug ? storeApiUrl(slug, path) : `/api${path}`;
}

function currency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
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
  name: "",
  duration: 60,
  price: "",
  staff_payout_fixed: "",
  is_active: true,
};

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

export default function OwnerServicesPage({ params }) {
  const { slug } = use(params);

  const [serviceStatusFilter, setServiceStatusFilter] = useState("all");
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceError, setServiceError] = useState("");
  const [serviceRows, setServiceRows] = useState([]);

  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formMode, setFormMode] = useState("create");
  const [form, setForm] = useState(EMPTY_FORM);

  async function fetchServices(status = serviceStatusFilter) {
    try {
      setServiceLoading(true);
      setServiceError("");

      const res = await fetch(apiPath(slug, `/services?status=${status}`), {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load services");
      }

      setServiceRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setServiceError(err.message || "Could not load services.");
      setServiceRows([]);
    } finally {
      setServiceLoading(false);
    }
  }

  useEffect(() => {
    if (!slug) return;
    fetchServices(serviceStatusFilter);
  }, [slug, serviceStatusFilter]);

  const serviceSummaryCards = useMemo(() => {
    const total = serviceRows.length;
    const active = serviceRows.filter((row) => row.is_active).length;
    const withPayout = serviceRows.filter(
      (row) => row.staff_payout_fixed !== null && row.staff_payout_fixed !== undefined
    ).length;

    const averagePrice =
      total > 0
        ? currency(
            serviceRows.reduce((sum, row) => sum + Number(row.price || 0), 0) / total
          )
        : "$0.00";

    return [
      summaryCard("Services in view", total),
      summaryCard("Active", active),
      summaryCard("With fixed payout", withPayout),
      summaryCard("Average price", averagePrice),
    ];
  }, [serviceRows]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormMode("create");
  }

  function startEditService(row) {
    setFormMode("edit");
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      duration: Number(row.duration || 60),
      price: row.price ?? "",
      staff_payout_fixed: row.staff_payout_fixed ?? "",
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
      setServiceError("");

      const isEdit = formMode === "edit" && editingId;
      const url = isEdit
        ? apiPath(slug, `/services/${editingId}`)
        : apiPath(slug, "/services");
      const method = isEdit ? "PATCH" : "POST";

      const payload = {
        ...form,
        duration: Number(form.duration),
        price: form.price === "" ? "" : Number(form.price),
        staff_payout_fixed:
          form.staff_payout_fixed === "" ? "" : Number(form.staff_payout_fixed),
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
        throw new Error(data?.error || "Failed to save service");
      }

      resetForm();
      await fetchServices(serviceStatusFilter);
    } catch (err) {
      console.error(err);
      setServiceError(err.message || "Could not save service.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-emerald-600">Owner Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Services</h1>
        <p className="mt-2 text-sm text-gray-500">
          Manage service list, pricing, duration, and fixed staff payout.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Section 1
          </p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">
            Service Directory
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Create services, update pricing, and keep inactive items out of the
            booking flow when needed.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {serviceSummaryCards.map((card) => (
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

        <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {formMode === "edit" ? "Edit Service" : "Add Service"}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Set the core service details used in booking and reporting.
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
                <FieldLabel>Service name *</FieldLabel>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
                  placeholder="Thai Massage"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Duration *</FieldLabel>
                  <select
                    value={form.duration}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        duration: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
                  >
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} min
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel>Price *</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        price: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
                    placeholder="95"
                    required
                  />
                </div>
              </div>

              <div>
                <FieldLabel optional>Fixed staff payout</FieldLabel>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.staff_payout_fixed}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      staff_payout_fixed: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-gray-400"
                  placeholder="Optional fixed payout per service"
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
                  : "Save service"}
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Service List
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Services available for this store.
                </p>
              </div>

              <div className="inline-flex rounded-xl bg-gray-100 p-1">
                {["all", "active", "inactive"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setServiceStatusFilter(option)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                      serviceStatusFilter === option
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {serviceError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {serviceError}
              </div>
            ) : null}

            {serviceLoading ? (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                Loading services...
              </div>
            ) : serviceRows.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                No services found in this filter.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 text-left text-sm text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Service</th>
                        <th className="px-4 py-3 font-medium">Duration</th>
                        <th className="px-4 py-3 font-medium">Price</th>
                        <th className="px-4 py-3 font-medium">Staff payout</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200 bg-white">
                      {serviceRows.map((row) => (
                        <tr key={row.id} className="text-sm text-gray-700">
                          <td className="px-4 py-4 font-medium text-gray-900">
                            {row.name || "-"}
                          </td>
                          <td className="px-4 py-4">
                            {row.duration ? `${row.duration} min` : "-"}
                          </td>
                          <td className="px-4 py-4">{currency(row.price)}</td>
                          <td className="px-4 py-4">
                            {row.staff_payout_fixed === null ||
                            row.staff_payout_fixed === undefined
                              ? "-"
                              : currency(row.staff_payout_fixed)}
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
                              onClick={() => startEditService(row)}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}