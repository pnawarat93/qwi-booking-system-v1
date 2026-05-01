"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Save,
  Store,
  Phone,
  MapPin,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "../../StoreContext";

function apiPath(slug, path) {
  return `/api/s/${slug}${path}`;
}

const DEFAULT_DAILY_GUARANTEE_CONFIG = {
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0,
};

const GUARANTEE_DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

function normalizeDailyGuaranteeConfig(value) {
  return {
    ...DEFAULT_DAILY_GUARANTEE_CONFIG,
    ...(value || {}),
  };
}

export default function OwnerSettingsPage() {
  const store = useStore();

  const [storeInfo, setStoreInfo] = useState({
    name: "",
    phone: "",
    address: "",
    slug: "",
    enable_daily_guarantee: false,
    daily_guarantee_config: DEFAULT_DAILY_GUARANTEE_CONFIG,
  });

  const [payoutPolicies, setPayoutPolicies] = useState([]);
  const [loadingPayoutPolicies, setLoadingPayoutPolicies] = useState(false);
  const [savingPayoutPolicy, setSavingPayoutPolicy] = useState(false);
  const [payoutPolicyForm, setPayoutPolicyForm] = useState({
    name: "",
    payout_type: "fixed_per_job",
    fixed_amount: "",
    percent: "",
    hourly_rate: "",
    refund_behavior: "exclude_full",
  });

  const [loading, setLoading] = useState(true);
  const [savingStore, setSavingStore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [copied, setCopied] = useState(false);

  async function loadStoreInfo() {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const res = await fetch(apiPath(store.slug, "/store"));
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load store info");
      }

      setStoreInfo({
        name: data?.name || "",
        phone: data?.phone || "",
        address: data?.address || "",
        slug: data?.slug || "",
        enable_daily_guarantee: data?.enable_daily_guarantee ?? false,
        daily_guarantee_config: normalizeDailyGuaranteeConfig(
          data?.daily_guarantee_config
        ),
      });
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Failed to load store info");
    } finally {
      setLoading(false);
    }
  }

  async function loadPayoutPolicies() {
    try {
      setLoadingPayoutPolicies(true);

      const res = await fetch(apiPath(store.slug, "/payout-policies"));
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load payout policies");
      }

      setPayoutPolicies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Failed to load payout policies");
    } finally {
      setLoadingPayoutPolicies(false);
    }
  }

  useEffect(() => {
    if (!store.slug) return;
    loadStoreInfo();
    loadPayoutPolicies();
  }, [store.slug]);

  const bookingLink = useMemo(() => {
    if (!storeInfo.slug) return "";
    if (typeof window === "undefined") return `/s/${storeInfo.slug}`;
    return `${window.location.origin}/s/${storeInfo.slug}`;
  }, [storeInfo.slug]);

  async function handleSaveStoreInfo() {
    try {
      setSavingStore(true);
      setErrorMessage("");
      setSuccessMessage("");

      const res = await fetch(apiPath(store.slug, "/store"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: storeInfo.name,
          phone: storeInfo.phone,
          address: storeInfo.address,
          enable_daily_guarantee: storeInfo.enable_daily_guarantee,
          daily_guarantee_config: normalizeDailyGuaranteeConfig(
            storeInfo.daily_guarantee_config
          ),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save store info");
      }

      setStoreInfo({
        name: data?.name || "",
        phone: data?.phone || "",
        address: data?.address || "",
        slug: data?.slug || "",
        enable_daily_guarantee: data?.enable_daily_guarantee ?? false,
        daily_guarantee_config: normalizeDailyGuaranteeConfig(
          data?.daily_guarantee_config
        ),
      });

      setSuccessMessage("Store settings saved");
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Could not save store settings");
    } finally {
      setSavingStore(false);
    }
  }

  async function handleCreatePayoutPolicy() {
    try {
      setSavingPayoutPolicy(true);
      setErrorMessage("");
      setSuccessMessage("");

      const res = await fetch(apiPath(store.slug, "/payout-policies"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: payoutPolicyForm.name.trim(),
          payout_type: payoutPolicyForm.payout_type,
          fixed_amount: Number(payoutPolicyForm.fixed_amount || 0),
          percent: Number(payoutPolicyForm.percent || 0),
          hourly_rate: Number(payoutPolicyForm.hourly_rate || 0),
          refund_behavior: payoutPolicyForm.refund_behavior,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create payout policy");
      }

      setPayoutPolicyForm({
        name: "",
        payout_type: "fixed_per_job",
        fixed_amount: "",
        percent: "",
        hourly_rate: "",
        refund_behavior: "exclude_full",
      });

      await loadPayoutPolicies();
      setSuccessMessage("Payout policy created");
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Could not create payout policy");
    } finally {
      setSavingPayoutPolicy(false);
    }
  }

  async function handleCopyLink() {
    try {
      if (!bookingLink) return;
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("Copy failed:", error);
      setErrorMessage("Could not copy booking link");
    }
  }

  function updateDailyGuaranteeDay(dayKey, value) {
    setStoreInfo((prev) => ({
      ...prev,
      daily_guarantee_config: {
        ...normalizeDailyGuaranteeConfig(prev.daily_guarantee_config),
        [dayKey]: Number(value) || 0,
      },
    }));
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-emerald-600">
          Owner Dashboard
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          Store Settings
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Update your store details and access your customer booking link.
        </p>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
            <Store className="h-5 w-5 text-gray-700" />
          </div>

          <div className="w-full">
            <h2 className="text-lg font-semibold text-gray-900">
              Store information
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              These details are shown for your store setup. Booking link is fixed
              from onboarding.
            </p>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500">
                Loading store info...
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Store name
                    </label>
                    <input
                      value={storeInfo.name}
                      onChange={(e) =>
                        setStoreInfo((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
                      placeholder="Store name"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Phone
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={storeInfo.phone}
                        onChange={(e) =>
                          setStoreInfo((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm"
                        placeholder="Phone number"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Address
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                      <textarea
                        rows={3}
                        value={storeInfo.address}
                        onChange={(e) =>
                          setStoreInfo((prev) => ({
                            ...prev,
                            address: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm"
                        placeholder="Store address"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveStoreInfo}
                  disabled={savingStore}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingStore ? "Saving..." : "Save store settings"}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
            <ShieldCheck className="h-5 w-5 text-gray-700" />
          </div>

          <div className="w-full">
            <h2 className="text-lg font-semibold text-gray-900">
              Daily Guarantee / ประกันมือ
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Optional minimum daily payout for staff. If a staff member earns
              less than the daily guarantee, payout reports can use the guarantee
              amount later.
            </p>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500">
                Loading daily guarantee...
              </div>
            ) : (
              <>
                <label className="mt-5 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={storeInfo.enable_daily_guarantee}
                    onChange={(e) =>
                      setStoreInfo((prev) => ({
                        ...prev,
                        enable_daily_guarantee: e.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable daily guarantee
                  </span>
                </label>

                <div
                  className={`mt-5 grid gap-4 md:grid-cols-2 ${
                    storeInfo.enable_daily_guarantee ? "" : "opacity-50"
                  }`}
                >
                  {GUARANTEE_DAYS.map((day) => (
                    <div key={day.key}>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        {day.label}
                      </label>

                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={!storeInfo.enable_daily_guarantee}
                          value={
                            normalizeDailyGuaranteeConfig(
                              storeInfo.daily_guarantee_config
                            )[day.key]
                          }
                          onChange={(e) =>
                            updateDailyGuaranteeDay(day.key, e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-200 py-2.5 pl-8 pr-4 text-sm disabled:bg-gray-50"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  Example: Mon–Thu 150, Fri 180, Sat–Sun 200. This setting is
                  saved now; payout calculation will be connected in the next
                  step.
                </p>

                <button
                  type="button"
                  onClick={handleSaveStoreInfo}
                  disabled={savingStore}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingStore ? "Saving..." : "Save guarantee settings"}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
            <LinkIcon className="h-5 w-5 text-gray-700" />
          </div>

          <div className="w-full">
            <h2 className="text-lg font-semibold text-gray-900">
              Booking link
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Share this link with customers so they can book online.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={bookingLink}
                readOnly
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600"
              />

              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!bookingLink}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Copy"}
              </button>

              <a
                href={bookingLink || "#"}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                  bookingLink
                    ? "border-gray-200 text-gray-700 hover:bg-gray-50"
                    : "pointer-events-none border-gray-200 text-gray-400"
                }`}
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              This link is created from your onboarding setup and cannot be
              changed here.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
            <ShieldCheck className="h-5 w-5 text-gray-700" />
          </div>

          <div className="w-full">
            <h2 className="text-lg font-semibold text-gray-900">
              Payout Policies
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Create payout rules for staff. After creating a policy, assign it
              to each staff member on the Staff page.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Policy name
                </label>
                <input
                  value={payoutPolicyForm.name}
                  onChange={(e) =>
                    setPayoutPolicyForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
                  placeholder="Standard therapist rate"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Payout type
                </label>
                <select
                  value={payoutPolicyForm.payout_type}
                  onChange={(e) =>
                    setPayoutPolicyForm((prev) => ({
                      ...prev,
                      payout_type: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
                >
                  <option value="fixed_per_job">Fixed per job</option>
                  <option value="percent">Percent of payment</option>
                  <option value="per_hour">Per hour</option>
                </select>
              </div>

              {payoutPolicyForm.payout_type === "fixed_per_job" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Fixed amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={payoutPolicyForm.fixed_amount}
                    onChange={(e) =>
                      setPayoutPolicyForm((prev) => ({
                        ...prev,
                        fixed_amount: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
                    placeholder="50"
                  />
                </div>
              ) : null}

              {payoutPolicyForm.payout_type === "percent" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Percent
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={payoutPolicyForm.percent}
                    onChange={(e) =>
                      setPayoutPolicyForm((prev) => ({
                        ...prev,
                        percent: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
                    placeholder="40"
                  />
                </div>
              ) : null}

              {payoutPolicyForm.payout_type === "per_hour" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Hourly rate
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={payoutPolicyForm.hourly_rate}
                    onChange={(e) =>
                      setPayoutPolicyForm((prev) => ({
                        ...prev,
                        hourly_rate: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
                    placeholder="50"
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Refund behavior
                </label>
                <select
                  value={payoutPolicyForm.refund_behavior}
                  onChange={(e) =>
                    setPayoutPolicyForm((prev) => ({
                      ...prev,
                      refund_behavior: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
                >
                  <option value="exclude_full">Use net amount after refund</option>
                  <option value="full_pay">Pay based on original payment</option>
                  <option value="prorate">Prorate by remaining payment</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreatePayoutPolicy}
              disabled={savingPayoutPolicy || !payoutPolicyForm.name.trim()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingPayoutPolicy ? "Creating..." : "Create payout policy"}
            </button>

            <div className="mt-6 space-y-3">
              {loadingPayoutPolicies ? (
                <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500">
                  Loading payout policies...
                </div>
              ) : payoutPolicies.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500">
                  No payout policies yet.
                </div>
              ) : (
                payoutPolicies.map((policy) => (
                  <div
                    key={policy.id}
                    className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {policy.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {policy.payout_type}
                          {policy.payout_type === "fixed_per_job"
                            ? ` · $${Number(policy.fixed_amount || 0).toFixed(
                                2
                              )} per job`
                            : ""}
                          {policy.payout_type === "percent"
                            ? ` · ${Number(policy.percent || 0)}%`
                            : ""}
                          {policy.payout_type === "per_hour"
                            ? ` · $${Number(policy.hourly_rate || 0).toFixed(
                                2
                              )} per hour`
                            : ""}
                        </p>
                      </div>

                      <span
                        className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
                          policy.is_active
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                            : "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200"
                        }`}
                      >
                        {policy.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}