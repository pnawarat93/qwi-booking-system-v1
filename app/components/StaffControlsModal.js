"use client";

import { useEffect, useMemo, useState } from "react";
import { storeApiUrl } from "@/lib/storeApi";

function apiPath(slug, path) {
  return slug ? storeApiUrl(slug, path) : `/api${path}`;
}

function normalizeTime(value, fallback = "09:00") {
  if (!value) return fallback;
  return String(value).substring(0, 5);
}

function getDefaultGuaranteeForDate(storeConfig, selectedDate) {
  if (!storeConfig?.enable_daily_guarantee) return 0;

  const config = storeConfig.daily_guarantee_config || {};

  const weekdayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  const date = new Date(`${selectedDate}T00:00:00`);
  const weekdayKey = weekdayMap[date.getDay()];

  return Number(config?.[weekdayKey] || 0);
}

export default function StaffControlsModal({
  open,
  onClose,
  selectedDate,
  storeSlug,
  onUpdated,
}) {
  const [allStaff, setAllStaff] = useState([]);
  const [effectiveStaff, setEffectiveStaff] = useState([]);
  const [businessHours, setBusinessHours] = useState(null);
  const [storeInfo, setStoreInfo] = useState(null);

  const [loading, setLoading] = useState(false);
  const [savingIds, setSavingIds] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState("");

  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCode, setNewStaffCode] = useState("");
  const [newEmploymentType, setNewEmploymentType] = useState("temporary");
  const [newGuaranteeOverride, setNewGuaranteeOverride] = useState("");
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [staffRes, effectiveRes, hoursRes, storeRes] =
        await Promise.all([
          fetch(apiPath(storeSlug, "/staff")),

          fetch(
            apiPath(
              storeSlug,
              `/effective-staff?date=${selectedDate}&include_all=true`
            )
          ),

          fetch(
            apiPath(
              storeSlug,
              `/business-hours?date=${selectedDate}`
            )
          ),

          fetch(apiPath(storeSlug, "/store")),
        ]);

      const staffData = await staffRes.json();
      const effectiveData = await effectiveRes.json();
      const hoursData = await hoursRes.json();
      const storeData = await storeRes.json();

      if (!staffRes.ok) {
        throw new Error(staffData?.error || "Failed to load staff");
      }

      if (!effectiveRes.ok) {
        throw new Error(
          effectiveData?.error || "Failed to load effective staff"
        );
      }

      if (!hoursRes.ok) {
        throw new Error(
          hoursData?.error || "Failed to load business hours"
        );
      }

      if (!storeRes.ok) {
        throw new Error(storeData?.error || "Failed to load store");
      }

      setAllStaff(Array.isArray(staffData) ? staffData : []);
      setEffectiveStaff(
        Array.isArray(effectiveData?.items)
          ? effectiveData.items
          : []
      );

      setBusinessHours(hoursData || null);
      setStoreInfo(storeData || null);
    } catch (err) {
      console.error("Failed to load staff controls:", err);

      setAllStaff([]);
      setEffectiveStaff([]);
      setBusinessHours(null);
      setStoreInfo(null);

      setErrorMessage(
        err.message || "Failed to load staff controls"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open, selectedDate, storeSlug]);

  const enableDailyGuarantee =
    Boolean(storeInfo?.enable_daily_guarantee);

  const defaultGuarantee = getDefaultGuaranteeForDate(
    storeInfo,
    selectedDate
  );

  const todaysStaff = useMemo(() => {
    return (effectiveStaff || [])
      .map((s, index) => ({
        staff_id: s.staff_id,

        name: s.name_display || s.name || "Staff",

        staff_code: s.staff_code || "",

        start_time: normalizeTime(
          s.start_time,
          normalizeTime(
            businessHours?.open_time,
            "09:00"
          )
        ),

        end_time: normalizeTime(
          s.end_time,
          normalizeTime(
            businessHours?.close_time,
            "18:00"
          )
        ),

        display_order:
          s.display_order !== undefined &&
          s.display_order !== null
            ? s.display_order
            : index + 1,

        source: s.source || "override",

        is_working: s.is_working === true,

        daily_guarantee_override:
          s.daily_guarantee_override !== null &&
          s.daily_guarantee_override !== undefined
            ? Number(s.daily_guarantee_override)
            : null,
      }))
      .sort((a, b) => {
        if (a.is_working !== b.is_working) {
          return a.is_working ? -1 : 1;
        }

        const aOrder = a.display_order ?? 0;
        const bOrder = b.display_order ?? 0;

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        return (a.name || "").localeCompare(b.name || "");
      });
  }, [effectiveStaff, businessHours]);

  const availableToAdd = useMemo(() => {
    const existingIds = new Set(
      todaysStaff.map((staff) =>
        String(staff.staff_id)
      )
    );

    return allStaff
      .filter(
        (staff) =>
          !existingIds.has(String(staff.id))
      )
      .sort((a, b) => {
        const aName =
          a.name_display || a.name || "";

        const bName =
          b.name_display || b.name || "";

        return aName.localeCompare(bName);
      });
  }, [allStaff, todaysStaff]);

  const defaultStartTime = normalizeTime(
    businessHours?.open_time,
    "09:00"
  );

  const defaultEndTime = normalizeTime(
    businessHours?.close_time,
    "18:00"
  );

  function setSaving(staffId, isSaving) {
    setSavingIds((prev) => {
      const next = new Set(prev);

      if (isSaving) next.add(staffId);
      else next.delete(staffId);

      return next;
    });
  }

  async function createOrUpdateOverride(payload) {
    const res = await fetch(
      apiPath(storeSlug, "/staff-overrides"),
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(
        data?.error ||
          "Failed to update staff override"
      );
    }

    return data;
  }

  async function syncWholeWorkingOrder(nextList) {
    const payloads = nextList.map(
      (staff, index) => ({
        staff_id: staff.staff_id,

        override_date: selectedDate,

        is_working: staff.is_working,

        start_time: staff.is_working
          ? `${normalizeTime(
              staff.start_time,
              defaultStartTime
            )}:00`
          : null,

        end_time: staff.is_working
          ? `${normalizeTime(
              staff.end_time,
              defaultEndTime
            )}:00`
          : null,

        display_order: index + 1,

        daily_guarantee_override:
          enableDailyGuarantee
            ? staff.daily_guarantee_override !==
                null &&
              staff.daily_guarantee_override !==
                undefined &&
              staff.daily_guarantee_override !==
                ""
              ? Number(
                  staff.daily_guarantee_override
                )
              : null
            : null,
      })
    );

    await Promise.all(
      payloads.map((payload) =>
        createOrUpdateOverride(payload)
      )
    );
  }

  function normalizeWorkingOrder(list) {
    return list.map((row, index) => ({
      ...row,
      display_order: index + 1,
    }));
  }

  async function moveStaff(staffId, direction) {
    try {
      setSaving(staffId, true);
      setErrorMessage("");

      const next = [...todaysStaff];

      const index = next.findIndex(
        (row) =>
          String(row.staff_id) ===
          String(staffId)
      );

      if (index === -1) return;

      const targetIndex =
        direction === "left"
          ? index - 1
          : index + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= next.length
      )
        return;

      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;

      const normalized =
        normalizeWorkingOrder(next);

      await syncWholeWorkingOrder(
        normalized
      );

      await loadData();

      onUpdated?.();
    } catch (err) {
      console.error(
        "Move staff failed:",
        err
      );

      setErrorMessage(
        err.message ||
          "Could not update staff order."
      );
    } finally {
      setSaving(staffId, false);
    }
  }

  async function toggleOff(staff) {
    try {
      setSaving(staff.staff_id, true);

      setErrorMessage("");

      const next = todaysStaff.map((row) => {
        if (
          String(row.staff_id) !==
          String(staff.staff_id)
        ) {
          return row;
        }

        return {
          ...row,
          is_working: !row.is_working,
        };
      });

      const active = next.filter(
        (s) => s.is_working
      );

      const inactive = next.filter(
        (s) => !s.is_working
      );

      const normalized =
        normalizeWorkingOrder([
          ...active,
          ...inactive,
        ]);

      await syncWholeWorkingOrder(
        normalized
      );

      await loadData();

      onUpdated?.();
    } catch (err) {
      console.error(
        "Toggle off failed:",
        err
      );

      setErrorMessage(
        err.message ||
          "Could not update staff."
      );
    } finally {
      setSaving(staff.staff_id, false);
    }
  }

  async function updateGuarantee(
    staffId,
    value
  ) {
    try {
      setSaving(staffId, true);

      const target = todaysStaff.find(
        (s) =>
          String(s.staff_id) ===
          String(staffId)
      );

      if (!target) return;

      await createOrUpdateOverride({
        staff_id: target.staff_id,

        override_date: selectedDate,

        is_working: target.is_working,

        start_time: target.is_working
          ? `${normalizeTime(
              target.start_time,
              defaultStartTime
            )}:00`
          : null,

        end_time: target.is_working
          ? `${normalizeTime(
              target.end_time,
              defaultEndTime
            )}:00`
          : null,

        display_order:
          target.display_order,

        daily_guarantee_override:
          value === ""
            ? null
            : Number(value),
      });

      await loadData();

      onUpdated?.();
    } catch (err) {
      console.error(
        "Update guarantee failed:",
        err
      );

      setErrorMessage(
        err.message ||
          "Could not update guarantee."
      );
    } finally {
      setSaving(staffId, false);
    }
  }

  async function addExistingStaff(staff) {
    try {
      setSaving(staff.id, true);

      setErrorMessage("");

      const next =
        normalizeWorkingOrder([
          ...todaysStaff,

          {
            staff_id: staff.id,

            name:
              staff.name_display ||
              staff.name ||
              "Staff",

            staff_code:
              staff.staff_code || "",

            start_time:
              defaultStartTime,

            end_time:
              defaultEndTime,

            display_order:
              todaysStaff.length + 1,

            source: "override",

            is_working: true,

            daily_guarantee_override:
              enableDailyGuarantee
                ? defaultGuarantee
                : null,
          },
        ]);

      await syncWholeWorkingOrder(
        next
      );

      await loadData();

      onUpdated?.();

      setShowAddExisting(false);
    } catch (err) {
      console.error(
        "Add existing staff failed:",
        err
      );

      setErrorMessage(
        err.message ||
          "Could not add staff."
      );
    } finally {
      setSaving(staff.id, false);
    }
  }

  async function createTemporaryStaff() {
    try {
      if (!newStaffName.trim()) {
        setErrorMessage(
          "Please enter a display name."
        );

        return;
      }

      setIsCreatingStaff(true);

      setErrorMessage("");

      const createRes = await fetch(
        apiPath(storeSlug, "/staff"),
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            name_display:
              newStaffName.trim(),

            staff_code:
              newStaffCode.trim() ||
              null,

            employment_type:
              newEmploymentType,
          }),
        }
      );

      const createdStaff =
        await createRes
          .json()
          .catch(() => null);

      if (!createRes.ok) {
        throw new Error(
          createdStaff?.error ||
            "Failed to create staff"
        );
      }

      const next =
        normalizeWorkingOrder([
          ...todaysStaff,

          {
            staff_id: createdStaff.id,

            name:
              createdStaff.name_display ||
              createdStaff.name ||
              newStaffName.trim(),

            staff_code:
              createdStaff.staff_code ||
              "",

            start_time:
              defaultStartTime,

            end_time:
              defaultEndTime,

            display_order:
              todaysStaff.length + 1,

            source: "override",

            is_working: true,

            daily_guarantee_override:
              enableDailyGuarantee
                ? newGuaranteeOverride !==
                    ""
                  ? Number(
                      newGuaranteeOverride
                    )
                  : defaultGuarantee
                : null,
          },
        ]);

      await syncWholeWorkingOrder(
        next
      );

      await loadData();

      onUpdated?.();

      setNewStaffName("");
      setNewStaffCode("");
      setNewEmploymentType(
        "temporary"
      );

      setNewGuaranteeOverride("");

      setShowQuickAdd(false);
    } catch (err) {
      console.error(
        "Create temporary staff failed:",
        err
      );

      setErrorMessage(
        err.message ||
          "Could not create and add staff."
      );
    } finally {
      setIsCreatingStaff(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Staff controls
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Manage who is working on{" "}
              {selectedDate}.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[1.5fr_1fr]">
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Today’s staff
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Staff marked off stay
                  visible for payout and
                  guarantee adjustments.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddExisting(
                      (prev) => !prev
                    );

                    setShowQuickAdd(
                      false
                    );
                  }}
                  className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {showAddExisting
                    ? "Hide add staff"
                    : "Add staff"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAdd(
                      (prev) => !prev
                    );

                    setShowAddExisting(
                      false
                    );
                  }}
                  className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
                >
                  {showQuickAdd
                    ? "Hide quick add"
                    : "Add temporary / casual"}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {loading ? (
              <p className="text-sm text-gray-400">
                Loading...
              </p>
            ) : todaysStaff.length ===
              0 ? (
              <div className="rounded-xl border bg-gray-50 px-4 py-6 text-sm text-gray-500">
                No staff on this date
                yet.
              </div>
            ) : (
              <div className="space-y-3">
                {todaysStaff.map(
                  (staff, index) => {
                    const saving =
                      savingIds.has(
                        staff.staff_id
                      );

                    const effectiveGuarantee =
                      staff.daily_guarantee_override !==
                        null &&
                      staff.daily_guarantee_override !==
                        undefined
                        ? Number(
                            staff.daily_guarantee_override
                          )
                        : defaultGuarantee;

                    return (
                      <div
                        key={
                          staff.staff_id
                        }
                        className={`rounded-xl border px-4 py-4 transition-all ${
                          staff.is_working
                            ? "bg-white"
                            : "bg-gray-100 opacity-70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {index + 1}.{" "}
                                {staff.name}
                              </p>

                              {!staff.is_working && (
                                <span className="rounded-full bg-gray-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                                  Off
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span>
                                {staff.staff_code ||
                                  "No staff code"}
                              </span>

                              <span>
                                •
                              </span>

                              <span>
                                {normalizeTime(
                                  staff.start_time,
                                  defaultStartTime
                                )}{" "}
                                -{" "}
                                {normalizeTime(
                                  staff.end_time,
                                  defaultEndTime
                                )}
                              </span>

                              <span>
                                •
                              </span>

                              <span className="capitalize">
                                {
                                  staff.source
                                }
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {enableDailyGuarantee && (
                              <div className="w-[120px]">
                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                  Guarantee
                                </label>

                                <input
                                  type="number"
                                  value={
                                    staff.daily_guarantee_override ??
                                    ""
                                  }
                                  placeholder={String(
                                    defaultGuarantee
                                  )}
                                  onWheel={(
                                    e
                                  ) =>
                                    e.currentTarget.blur()
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateGuarantee(
                                      staff.staff_id,
                                      e.target
                                        .value
                                    )
                                  }
                                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                                />

                                <p className="mt-1 text-[10px] text-gray-400">
                                  Effective: $
                                  {Number(
                                    effectiveGuarantee
                                  ).toFixed(
                                    0
                                  )}
                                </p>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={
                                saving ||
                                index === 0
                              }
                              onClick={() =>
                                moveStaff(
                                  staff.staff_id,
                                  "left"
                                )
                              }
                              className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                            >
                              ←
                            </button>

                            <button
                              type="button"
                              disabled={
                                saving ||
                                index ===
                                  todaysStaff.length -
                                    1
                              }
                              onClick={() =>
                                moveStaff(
                                  staff.staff_id,
                                  "right"
                                )
                              }
                              className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                            >
                              →
                            </button>

                            <button
                              type="button"
                              disabled={
                                saving
                              }
                              onClick={() =>
                                toggleOff(
                                  staff
                                )
                              }
                              className={`rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                                staff.is_working
                                  ? "border-red-200 text-red-700 hover:bg-red-50"
                                  : "border-green-200 text-green-700 hover:bg-green-50"
                              }`}
                            >
                              {saving
                                ? "Saving..."
                                : staff.is_working
                                ? "Set off"
                                : "Set working"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>

          <section className="space-y-4">
            {showAddExisting && (
              <div className="rounded-xl border bg-gray-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Add existing staff
                </h3>

                {loading ? (
                  <p className="text-sm text-gray-400">
                    Loading...
                  </p>
                ) : availableToAdd.length ===
                  0 ? (
                  <p className="text-sm text-gray-400">
                    No more staff
                    available to add.
                  </p>
                ) : (
                  <div className="max-h-[320px] space-y-3 overflow-auto">
                    {availableToAdd.map(
                      (staff) => {
                        const displayName =
                          staff.name_display ||
                          staff.name ||
                          "Staff";

                        const saving =
                          savingIds.has(
                            staff.id
                          );

                        return (
                          <div
                            key={
                              staff.id
                            }
                            className="flex items-center justify-between rounded-xl border bg-white px-4 py-4"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {
                                  displayName
                                }
                              </p>

                              <p className="mt-1 text-xs text-gray-500">
                                {staff.staff_code ||
                                  "No staff code"}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={
                                saving
                              }
                              onClick={() =>
                                addExistingStaff(
                                  staff
                                )
                              }
                              className="rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                            >
                              {saving
                                ? "Adding..."
                                : "Add"}
                            </button>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            )}

            {showQuickAdd && (
              <div className="rounded-xl border bg-gray-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Quick add temporary /
                  casual staff
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Display name
                    </label>

                    <input
                      type="text"
                      value={
                        newStaffName
                      }
                      onChange={(e) =>
                        setNewStaffName(
                          e.target
                            .value
                        )
                      }
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                      placeholder="e.g. Nancy"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Staff code
                      (optional)
                    </label>

                    <input
                      type="text"
                      value={
                        newStaffCode
                      }
                      onChange={(e) =>
                        setNewStaffCode(
                          e.target
                            .value
                        )
                      }
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                      placeholder="e.g. NANCY-07"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Employment type
                    </label>

                    <select
                      value={
                        newEmploymentType
                      }
                      onChange={(e) =>
                        setNewEmploymentType(
                          e.target
                            .value
                        )
                      }
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                    >
                      <option value="temporary">
                        temporary
                      </option>

                      <option value="casual">
                        casual
                      </option>

                      <option value="permanent">
                        permanent
                      </option>
                    </select>
                  </div>

                  {enableDailyGuarantee && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Guarantee today
                        (optional)
                      </label>

                      <input
                        type="number"
                        value={
                          newGuaranteeOverride
                        }
                        onWheel={(e) =>
                          e.currentTarget.blur()
                        }
                        onChange={(e) =>
                          setNewGuaranteeOverride(
                            e.target
                              .value
                          )
                        }
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                        placeholder={String(
                          defaultGuarantee
                        )}
                      />

                      <p className="mt-1 text-xs text-gray-400">
                        Leave empty
                        to use default
                        guarantee.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={
                      isCreatingStaff
                    }
                    onClick={
                      createTemporaryStaff
                    }
                    className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                  >
                    {isCreatingStaff
                      ? "Creating..."
                      : "Create and add"}
                  </button>
                </div>
              </div>
            )}

            {!showAddExisting &&
              !showQuickAdd && (
                <div className="rounded-xl border bg-gray-50 px-4 py-6 text-sm text-gray-500">
                  Use{" "}
                  <span className="font-medium text-gray-700">
                    Add staff
                  </span>{" "}
                  for existing
                  staff, or{" "}
                  <span className="font-medium text-gray-700">
                    Add temporary /
                    casual
                  </span>{" "}
                  for last-minute
                  coverage.
                </div>
              )}
          </section>
        </div>
      </div>
    </div>
  );
}