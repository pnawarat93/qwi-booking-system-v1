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

function handleNumberWheel(event) {
  event.currentTarget.blur();
}

function getDefaultGuaranteeForDate(storeConfig, selectedDate) {
  if (!storeConfig?.enable_daily_guarantee) return 0;

  const config = storeConfig.daily_guarantee_config || {};

  const weekdayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  const date = new Date(`${selectedDate}T00:00:00`);
  const weekdayKey = weekdayMap[date.getDay()];

  return Number(config?.[weekdayKey] || 0);
}

function isVisibleOnGrid(staff) {
  if (staff?.is_working === true) return true;

  return staff?.source === "override" && Boolean(staff?.override_id);
}

export default function StaffControlsModal({
  open,
  onClose,
  selectedDate,
  storeSlug,
  storeFeatures,
  onUpdated,
  copy = {},
}) {
  const [allStaff, setAllStaff] = useState([]);
  const [effectiveStaff, setEffectiveStaff] = useState([]);
  const [businessHours, setBusinessHours] = useState(null);
  const [storeInfo, setStoreInfo] = useState(null);
  const [payoutRoles, setPayoutRoles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [savingIds, setSavingIds] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState("");

  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCode, setNewStaffCode] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [newGuaranteeOverride, setNewGuaranteeOverride] = useState("");
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const labels = {
    title: "Staff controls",
    manageWorkingOn: "Manage who is working on",
    dateSuffix: ".",
    close: "Close",
    todaysStaff: "Today's staff",
    staffMarkedOffHelper:
      "Staff marked off remain visible for payout and guarantee adjustments.",
    liteStaffHelper: "Staff can be switched on or off for today's grid.",
    addStaff: "Add staff",
    addTemporaryCasual: "Add temporary / casual",
    addTemporaryStaff: "Add temporary staff",
    hideAddStaff: "Hide add staff",
    hideQuickAdd: "Hide quick add",
    loading: "Loading...",
    noStaffOnDate: "No staff on this date yet.",
    off: "Off",
    noStaffCode: "No staff code",
    guarantee: "Guarantee",
    effective: "Effective",
    saving: "Saving...",
    setOff: "Set off",
    setWorking: "Set working",
    addExistingStaff: "Add existing staff",
    noMoreStaffAvailable: "No more staff available to add.",
    adding: "Adding...",
    add: "Add",
    quickAddTemporary: "Quick add temporary / casual staff",
    displayName: "Display name",
    staffCodeOptional: "Staff code (optional)",
    staffRole: "Staff role",
    noRoleSelected: "No role selected",
    optionalRoleHelper: "Optional. Staff payout will use this role.",
    guaranteeToday: "Guarantee today (optional)",
    defaultGuaranteeHelper: "Leave empty to use default guarantee.",
    createAndAdd: "Create and add",
    creating: "Creating...",
    emptyActionHelperBefore: "Use",
    emptyActionHelperMiddle: "for existing staff, or",
    emptyActionHelperAfter: "for last-minute coverage.",
    displayNameRequired: "Please enter a display name.",
    ...copy,
  };
  const financialControlsEnabled =
    storeFeatures?.FINANCIAL_CONTROLS === true;
  const isLiteStore =
    storeFeatures?.LITE_MODE === true || !financialControlsEnabled;

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    try {
      let staffRes;
      let effectiveRes;
      let hoursRes;
      let storeRes = null;
      let payoutRolesRes = null;

      if (isLiteStore) {
        [staffRes, effectiveRes, hoursRes] = await Promise.all([
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
        ]);
      } else {
        [
          staffRes,
          effectiveRes,
          hoursRes,
          storeRes,
          payoutRolesRes,
        ] = await Promise.all([
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

          fetch(apiPath(storeSlug, "/payout-policies")),
        ]);
      }

      const staffData = await staffRes.json();
      const effectiveData = await effectiveRes.json();
      const hoursData = await hoursRes.json();
      let storeData = null;
      let payoutRolesData = [];

      if (!isLiteStore) {
        storeData = await storeRes.json();
        payoutRolesData = await payoutRolesRes.json();
      }

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

      if (!isLiteStore && !storeRes.ok) {
        throw new Error(storeData?.error || "Failed to load store");
      }

      if (!isLiteStore && !payoutRolesRes.ok) {
        throw new Error(
          payoutRolesData?.error ||
          "Failed to load payout roles"
        );
      }

      setAllStaff(Array.isArray(staffData) ? staffData : []);

      setEffectiveStaff(
        Array.isArray(effectiveData?.items)
          ? effectiveData.items
          : []
      );

      setBusinessHours(hoursData || null);

      setStoreInfo(isLiteStore ? null : storeData || null);

      setPayoutRoles(
        !isLiteStore && Array.isArray(payoutRolesData)
          ? payoutRolesData.filter(
            (role) => role.is_active !== false
          )
          : []
      );
    } catch (err) {
      console.error("Failed to load staff controls:", err);

      setAllStaff([]);
      setEffectiveStaff([]);
      setBusinessHours(null);
      setStoreInfo(null);
      setPayoutRoles([]);

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
  }, [open, selectedDate, storeSlug, isLiteStore]);

  const enableDailyGuarantee =
    !isLiteStore && Boolean(storeInfo?.enable_daily_guarantee);

  const defaultGuarantee = getDefaultGuaranteeForDate(
    storeInfo,
    selectedDate
  );

  const visibleTodayStaff = useMemo(() => {
    return (effectiveStaff || []).filter(isVisibleOnGrid);
  }, [effectiveStaff]);

  const todaysStaff = useMemo(() => {
    return (visibleTodayStaff || [])
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
  }, [visibleTodayStaff, businessHours]);

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

  function updateGuaranteeDraft(staffId, value) {
    setEffectiveStaff((prev) =>
      prev.map((staff) => {
        const currentStaffId = staff.staff_id ?? staff.id;

        if (String(currentStaffId) !== String(staffId)) {
          return staff;
        }

        return {
          ...staff,
          daily_guarantee_override:
            value === "" ? null : value,
        };
      })
    );
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
          labels.displayNameRequired
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

            ...(!isLiteStore
              ? {
                payout_policy_id:
                  newRoleId
                    ? Number(newRoleId)
                    : null,
              }
              : {}),
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
      setNewRoleId("");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-4xl border border-[#E8DED6] bg-[#FFFCFA]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8DED6] bg-[#F8F1EC] px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-[#3F3733]">
              {labels.title}
            </h2>

            <p className="mt-1 text-sm leading-5 text-[#6F625C]">
              {labels.manageWorkingOn} {selectedDate}{labels.dateSuffix}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#E8DED6] bg-white px-3.5 py-2 text-sm font-semibold text-[#3F3733] transition hover:bg-[#FFF8F4]"
          >
            {labels.close}
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-auto px-6 py-5 lg:grid-cols-[1.55fr_0.95fr]">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight text-[#3F3733]">
                  {labels.todaysStaff}
                </h3>

                <p className="mt-1 text-sm leading-5 text-[#6F625C]">
                  {isLiteStore
                    ? labels.liteStaffHelper
                    : labels.staffMarkedOffHelper}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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
                  className="rounded-2xl border border-[#E8DED6] bg-white px-3.5 py-2 text-sm font-semibold text-[#3F3733] transition hover:bg-[#FFF8F4]"
                >
                  {showAddExisting
                    ? labels.hideAddStaff
                    : labels.addStaff}
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
                  className="rounded-2xl bg-[#B86F52] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#A86248]"
                >
                  {showQuickAdd
                    ? labels.hideQuickAdd
                    : isLiteStore
                      ? labels.addTemporaryStaff
                      : labels.addTemporaryCasual}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-3xl border border-[#F3B2A5] bg-[#FFF1EE] px-4 py-3 text-sm text-[#9F3A2E]">
                {errorMessage}
              </div>
            )}

            {loading ? (
              <div className="rounded-3xl border border-[#E8DED6] bg-[#FFFCFA] px-4 py-4 text-sm text-[#6F625C]">
                {labels.loading}
              </div>
            ) : todaysStaff.length === 0 ? (
              <div className="rounded-3xl border border-[#E8DED6] bg-[#FFFCFA] px-4 py-4 text-sm text-[#6F625C]">
                {labels.noStaffOnDate}
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
                        className={`rounded-3xl border px-4 py-4 transition ${staff.is_working
                            ? "bg-white"
                            : "bg-[#FFF7F2] opacity-95"
                          }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-[#3F3733]">
                                {index + 1}. {staff.name}
                              </p>

                              {!staff.is_working && (
                                <span className="rounded-full bg-[#FFF1EE] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#9F3A2E]">
                                  {labels.off}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6F625C]">
                              <span>{staff.staff_code || labels.noStaffCode}</span>
                              <span>•</span>
                              <span>
                                {normalizeTime(
                                  staff.start_time,
                                  defaultStartTime
                                )} - {normalizeTime(
                                  staff.end_time,
                                  defaultEndTime
                                )}
                              </span>
                              <span>•</span>
                              <span className="capitalize">{staff.source}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {enableDailyGuarantee && (
                              <div className="w-30 min-w-30">
                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9A8A84]">
                                  {labels.guarantee}
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
                                  onWheel={handleNumberWheel}
                                  onChange={(e) =>
                                    updateGuaranteeDraft(
                                      staff.staff_id,
                                      e.target.value
                                    )
                                  }
                                  onBlur={() =>
                                    updateGuarantee(
                                      staff.staff_id,
                                      staff.daily_guarantee_override ?? ""
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52]"
                                />

                                <p className="mt-1 text-[10px] text-[#9A8A84]">
                                  {labels.effective}: ${Number(
                                    effectiveGuarantee
                                  ).toFixed(0)}
                                </p>
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={
                                saving || index === 0
                              }
                              onClick={() =>
                                moveStaff(
                                  staff.staff_id,
                                  "left"
                                )
                              }
                              className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-semibold text-[#3F3733] transition hover:bg-[#FFF8F4] disabled:opacity-40"
                            >
                              ←
                            </button>

                            <button
                              type="button"
                              disabled={
                                saving ||
                                index === todaysStaff.length - 1
                              }
                              onClick={() =>
                                moveStaff(
                                  staff.staff_id,
                                  "right"
                                )
                              }
                              className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-semibold text-[#3F3733] transition hover:bg-[#FFF8F4] disabled:opacity-40"
                            >
                              →
                            </button>

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                toggleOff(staff)
                              }
                              className={`rounded-2xl border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${staff.is_working
                                  ? "border-[#F3B2A5] bg-[#FFF1EE] text-[#9F3A2E] hover:bg-[#FFE8DE]"
                                  : "border-[#D8E9DE] bg-[#F4FBF6] text-[#166B3A] hover:bg-[#E6F8E8]"
                                }`}
                            >
                              {saving
                                ? labels.saving
                                : staff.is_working
                                  ? labels.setOff
                                  : labels.setWorking}
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
              <div className="rounded-3xl border border-[#E8DED6] bg-white p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold tracking-tight text-[#3F3733]">
                    {labels.addExistingStaff}
                  </h3>
                </div>

                {loading ? (
                  <div className="rounded-3xl border border-[#E8DED6] bg-[#FFFCFA] px-4 py-4 text-sm text-[#6F625C]">
                    {labels.loading}
                  </div>
                ) : availableToAdd.length === 0 ? (
                  <div className="rounded-3xl border border-[#E8DED6] bg-[#FFFCFA] px-4 py-4 text-sm text-[#6F625C]">
                    {labels.noMoreStaffAvailable}
                  </div>
                ) : (
                  <div className="max-h-80 space-y-3 overflow-auto pr-1">
                    {availableToAdd.map((staff) => {
                      const displayName =
                        staff.name_display ||
                        staff.name ||
                        "Staff";

                      const saving = savingIds.has(staff.id);

                      return (
                        <div
                          key={staff.id}
                          className="flex items-center justify-between gap-3 rounded-3xl border border-[#E8DED6] bg-[#FFFCFA] px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#3F3733]">
                              {displayName}
                            </p>

                            <p className="mt-1 text-xs text-[#6F625C]">
                              {staff.staff_code || labels.noStaffCode}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => addExistingStaff(staff)}
                            className="rounded-2xl border border-[#D7E8DF] bg-[#F7FCF8] px-3 py-2 text-sm font-semibold text-[#166B3A] transition hover:bg-[#E6F8E8] disabled:opacity-50"
                          >
                            {saving ? labels.adding : labels.add}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {showQuickAdd && (
              <div className="rounded-3xl border border-[#E8DED6] bg-white p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold tracking-tight text-[#3F3733]">
                    {isLiteStore
                      ? labels.addTemporaryStaff
                      : labels.quickAddTemporary}
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9A8A84]">
                      {labels.displayName}
                    </label>

                    <input
                      type="text"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      className="w-full rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52]"
                      placeholder="e.g. Nancy"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9A8A84]">
                      {labels.staffCodeOptional}
                    </label>

                    <input
                      type="text"
                      value={newStaffCode}
                      onChange={(e) => setNewStaffCode(e.target.value)}
                      className="w-full rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52]"
                      placeholder="e.g. NANCY-07"
                    />
                  </div>

                  {!isLiteStore ? (
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9A8A84]">
                        {labels.staffRole}
                      </label>

                      <select
                        value={newRoleId}
                        onChange={(e) => setNewRoleId(e.target.value)}
                        className="w-full rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52]"
                      >
                        <option value="">{labels.noRoleSelected}</option>
                        {payoutRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.role_name || role.name}
                          </option>
                        ))}
                      </select>

                      <p className="mt-1 text-xs text-[#9A8A84]">
                        {labels.optionalRoleHelper}
                      </p>
                    </div>
                  ) : null}

                  {enableDailyGuarantee && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9A8A84]">
                        {labels.guaranteeToday}
                      </label>

                      <input
                        type="number"
                        value={newGuaranteeOverride}
                        onWheel={handleNumberWheel}
                        onChange={(e) => setNewGuaranteeOverride(e.target.value)}
                        className="w-full rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52]"
                        placeholder={String(defaultGuarantee)}
                      />

                      <p className="mt-1 text-xs text-[#9A8A84]">
                        {labels.defaultGuaranteeHelper}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isCreatingStaff}
                    onClick={createTemporaryStaff}
                    className="w-full rounded-2xl bg-[#B86F52] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#A86248] disabled:opacity-50"
                  >
                    {isCreatingStaff ? labels.creating : labels.createAndAdd}
                  </button>
                </div>
              </div>
            )}

            {!showAddExisting && !showQuickAdd && (
              <div className="rounded-3xl border border-[#E8DED6] bg-[#FFFCFA] px-4 py-4 text-sm leading-6 text-[#6F625C]">
                {labels.emptyActionHelperBefore}{" "}
                <span className="font-semibold text-[#3F3733]">
                  {labels.addStaff}
                </span>{" "}
                {labels.emptyActionHelperMiddle}{" "}
                <span className="font-semibold text-[#3F3733]">
                  {isLiteStore
                    ? labels.addTemporaryStaff
                    : labels.addTemporaryCasual}
                </span>{" "}
                {labels.emptyActionHelperAfter}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
