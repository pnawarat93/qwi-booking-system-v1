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

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [
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

      const staffData = await staffRes.json();
      const effectiveData = await effectiveRes.json();
      const hoursData = await hoursRes.json();
      const storeData = await storeRes.json();
      const payoutRolesData =
        await payoutRolesRes.json();

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

      if (!payoutRolesRes.ok) {
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

      setStoreInfo(storeData || null);

      setPayoutRoles(
        Array.isArray(payoutRolesData)
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

            payout_policy_id:
              newRoleId
                ? Number(newRoleId)
                : null,
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
              Staff controls
            </h2>

            <p className="mt-1 text-sm leading-5 text-[#6F625C]">
              Manage who is working on {selectedDate}.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#E8DED6] bg-white px-3.5 py-2 text-sm font-semibold text-[#3F3733] transition hover:bg-[#FFF8F4]"
          >
            Close
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-hidden px-6 py-5 lg:grid-cols-[1.55fr_0.95fr]">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight text-[#3F3733]">
                  Today’s staff
                </h3>

                <p className="mt-1 text-sm leading-5 text-[#6F625C]">
                  Staff marked off remain visible for payout and guarantee adjustments.
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
                  className="rounded-2xl bg-[#B86F52] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#A86248]"
                >
                  {showQuickAdd
                    ? "Hide quick add"
                    : "Add temporary / casual"}
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
                Loading...
              </div>
            ) : todaysStaff.length === 0 ? (
              <div className="rounded-3xl border border-[#E8DED6] bg-[#FFFCFA] px-4 py-4 text-sm text-[#6F625C]">
                No staff on this date yet.
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
                                  Off
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6F625C]">
                              <span>{staff.staff_code || "No staff code"}</span>
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
                                  Effective: ${Number(
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
              <div className="rounded-3xl border border-[#E8DED6] bg-white p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold tracking-tight text-[#3F3733]">
                    Add existing staff
                  </h3>
                </div>

                {loading ? (
                  <div className="rounded-3xl border border-[#E8DED6] bg-[#FFFCFA] px-4 py-4 text-sm text-[#6F625C]">
                    Loading...
                  </div>
                ) : availableToAdd.length === 0 ? (
                  <div className="rounded-3xl border border-[#E8DED6] bg-[#FFFCFA] px-4 py-4 text-sm text-[#6F625C]">
                    No more staff available to add.
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
                              {staff.staff_code || "No staff code"}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => addExistingStaff(staff)}
                            className="rounded-2xl border border-[#D7E8DF] bg-[#F7FCF8] px-3 py-2 text-sm font-semibold text-[#166B3A] transition hover:bg-[#E6F8E8] disabled:opacity-50"
                          >
                            {saving ? "Adding..." : "Add"}
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
                    Quick add temporary / casual staff
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9A8A84]">
                      Display name
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
                      Staff code (optional)
                    </label>

                    <input
                      type="text"
                      value={newStaffCode}
                      onChange={(e) => setNewStaffCode(e.target.value)}
                      className="w-full rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52]"
                      placeholder="e.g. NANCY-07"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9A8A84]">
                      Staff role
                    </label>

                    <select
                      value={newRoleId}
                      onChange={(e) => setNewRoleId(e.target.value)}
                      className="w-full rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52]"
                    >
                      <option value="">No role selected</option>
                      {payoutRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.role_name || role.name}
                        </option>
                      ))}
                    </select>

                    <p className="mt-1 text-xs text-[#9A8A84]">
                      Optional. Staff payout will use this role.
                    </p>
                  </div>

                  {enableDailyGuarantee && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9A8A84]">
                        Guarantee today (optional)
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
                        Leave empty to use default guarantee.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isCreatingStaff}
                    onClick={createTemporaryStaff}
                    className="w-full rounded-2xl bg-[#B86F52] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#A86248] disabled:opacity-50"
                  >
                    {isCreatingStaff ? "Creating..." : "Create and add"}
                  </button>
                </div>
              </div>
            )}

            {!showAddExisting && !showQuickAdd && (
              <div className="rounded-3xl border border-[#E8DED6] bg-[#FFFCFA] px-4 py-4 text-sm leading-6 text-[#6F625C]">
                Use <span className="font-semibold text-[#3F3733]">Add staff</span> for existing staff, or <span className="font-semibold text-[#3F3733]">Add temporary / casual</span> for last-minute coverage.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}