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

function handleNumberWheel(event) {
  event.currentTarget.blur();
}

export default function StartDayModal({
  open,
  selectedDate,
  storeSlug,
  storeName,
  existingStoreDay,
  onStarted,
}) {
  const [startTill, setStartTill] = useState("0");
  const [openingNote, setOpeningNote] = useState("");
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [businessHours, setBusinessHours] = useState(null);
  const [storeInfo, setStoreInfo] = useState(null);
  const [allStaff, setAllStaff] = useState([]);
  const [payoutRoles, setPayoutRoles] = useState([]);
  const [workingToday, setWorkingToday] = useState([]);
  const [removedStaffIds, setRemovedStaffIds] = useState([]);

  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCode, setNewStaffCode] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [newGuaranteeOverride, setNewGuaranteeOverride] = useState("");
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  useEffect(() => {
    if (!open) return;

    setStartTill(
      existingStoreDay?.start_till !== undefined &&
        existingStoreDay?.start_till !== null
        ? String(existingStoreDay.start_till)
        : "0"
    );

    setOpeningNote(existingStoreDay?.opening_note || "");
    setErrorMessage("");
  }, [open, existingStoreDay]);

  useEffect(() => {
    if (!open) return;

    async function loadSetupData() {
      setLoadingSetup(true);
      setErrorMessage("");

      try {
        const [hoursRes, staffRes, effectiveRes, storeRes, payoutRolesRes] =
          await Promise.all([
            fetch(apiPath(storeSlug, `/business-hours?date=${selectedDate}`)),
            fetch(apiPath(storeSlug, "/staff")),
            fetch(
              apiPath(
                storeSlug,
                `/effective-staff?date=${selectedDate}&include_all=true`
              )
            ),
            fetch(apiPath(storeSlug, "/store")),
            fetch(apiPath(storeSlug, "/payout-policies")),
          ]);

        const hoursData = await hoursRes.json();
        const staffData = await staffRes.json();
        const effectiveData = await effectiveRes.json();
        const storeData = await storeRes.json();
        const payoutRolesData = await payoutRolesRes.json();

        if (!hoursRes.ok) {
          throw new Error(hoursData?.error || "Failed to load business hours");
        }

        if (!staffRes.ok) {
          throw new Error(staffData?.error || "Failed to load staff");
        }

        if (!effectiveRes.ok) {
          throw new Error(
            effectiveData?.error || "Failed to load effective staff"
          );
        }

        if (!storeRes.ok) {
          throw new Error(storeData?.error || "Failed to load store");
        }

        if (!payoutRolesRes.ok) {
          throw new Error(
            payoutRolesData?.error || "Failed to load staff roles"
          );
        }

        const effectiveItems = Array.isArray(effectiveData?.items)
          ? effectiveData.items
          : [];

        const roles = Array.isArray(payoutRolesData)
          ? payoutRolesData.filter((role) => role.is_active !== false)
          : [];

        const normalizedWorking = effectiveItems
          .filter((item) => item.is_working === true)
          .map((item, index) => {
            const roleId = item.payout_policy_id || null;
            const role = roles.find((r) => String(r.id) === String(roleId));

            return {
              staff_id: item.staff_id,
              name: item.name_display || item.name || "Staff",
              staff_code: item.staff_code || "",
              payout_policy_id: roleId,
              role_name:
                item.role_name ||
                item.policy_name ||
                role?.role_name ||
                role?.name ||
                "",
              start_time: normalizeTime(
                item.start_time,
                normalizeTime(hoursData?.open_time, "09:00")
              ),
              end_time: normalizeTime(
                item.end_time,
                normalizeTime(hoursData?.close_time, "18:00")
              ),
              display_order:
                item.display_order !== undefined && item.display_order !== null
                  ? item.display_order
                  : index + 1,
              source: item.source || "roster",
              is_working: true,
              daily_guarantee_override:
                item.daily_guarantee_override !== null &&
                item.daily_guarantee_override !== undefined
                  ? String(item.daily_guarantee_override)
                  : null,
            };
          })
          .sort((a, b) => {
            const aOrder = a.display_order ?? 0;
            const bOrder = b.display_order ?? 0;

            if (aOrder !== bOrder) return aOrder - bOrder;

            return (a.name || "").localeCompare(b.name || "");
          })
          .map((item, index) => ({
            ...item,
            display_order: index + 1,
          }));

        setBusinessHours(hoursData || null);
        setStoreInfo(storeData || null);
        setAllStaff(Array.isArray(staffData) ? staffData : []);
        setPayoutRoles(roles);
        setWorkingToday(normalizedWorking);
        setRemovedStaffIds([]);
      } catch (error) {
        console.error("Failed to load start day setup:", error);

        setBusinessHours(null);
        setStoreInfo(null);
        setAllStaff([]);
        setPayoutRoles([]);
        setWorkingToday([]);
        setRemovedStaffIds([]);

        setErrorMessage(
          error?.message ||
            "Could not load start day setup. Please try again."
        );
      } finally {
        setLoadingSetup(false);
      }
    }

    loadSetupData();
  }, [open, selectedDate, storeSlug]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const enableDailyGuarantee = Boolean(storeInfo?.enable_daily_guarantee);
  const defaultGuarantee = getDefaultGuaranteeForDate(storeInfo, selectedDate);

  const defaultStartTime = normalizeTime(businessHours?.open_time, "09:00");
  const defaultEndTime = normalizeTime(businessHours?.close_time, "18:00");

  const availableToAdd = useMemo(() => {
    const workingIds = new Set(
      workingToday.map((staff) => String(staff.staff_id))
    );

    return allStaff
      .filter((staff) => !workingIds.has(String(staff.id)))
      .sort((a, b) => {
        const aName = a.name_display || a.name || "";
        const bName = b.name_display || b.name || "";
        return aName.localeCompare(bName);
      });
  }, [allStaff, workingToday]);

  if (!open) return null;

  function normalizeWorkingOrder(list) {
    return list.map((row, index) => ({
      ...row,
      display_order: index + 1,
    }));
  }

  function getRoleNameById(roleId) {
    if (!roleId) return "";

    const role = payoutRoles.find((item) => String(item.id) === String(roleId));

    return role?.role_name || role?.name || "";
  }

  function moveStaff(staffId, direction) {
    setWorkingToday((prev) => {
      const next = [...prev];

      const index = next.findIndex(
        (row) => String(row.staff_id) === String(staffId)
      );

      if (index === -1) return prev;

      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= next.length) {
        return prev;
      }

      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;

      return normalizeWorkingOrder(next);
    });
  }

  function removeFromToday(staffId) {
    setWorkingToday((prev) =>
      normalizeWorkingOrder(
        prev.filter((row) => String(row.staff_id) !== String(staffId))
      )
    );

    setRemovedStaffIds((prev) => {
      if (prev.includes(staffId)) return prev;
      return [...prev, staffId];
    });
  }

  function updateStaffGuarantee(staffId, value) {
    setWorkingToday((prev) =>
      prev.map((staff) => {
        if (String(staff.staff_id) !== String(staffId)) {
          return staff;
        }

        return {
          ...staff,
          daily_guarantee_override: value === "" ? "" : value,
        };
      })
    );
  }

  function addExistingStaff(staff) {
    const roleId = staff.payout_policy_id || null;

    setWorkingToday((prev) =>
      normalizeWorkingOrder([
        ...prev,
        {
          staff_id: staff.id,
          name: staff.name_display || staff.name || "Staff",
          staff_code: staff.staff_code || "",
          payout_policy_id: roleId,
          role_name:
            staff.role_name ||
            staff.policy_name ||
            getRoleNameById(roleId),
          start_time: defaultStartTime,
          end_time: defaultEndTime,
          display_order: prev.length + 1,
          source: "override",
          is_working: true,
          daily_guarantee_override: enableDailyGuarantee
            ? String(defaultGuarantee)
            : null,
        },
      ])
    );

    setRemovedStaffIds((prev) =>
      prev.filter((id) => String(id) !== String(staff.id))
    );

    setShowAddExisting(false);
  }

  async function createTemporaryStaff() {
    try {
      if (!newStaffName.trim()) {
        setErrorMessage("Please enter a display name for temporary staff.");
        return;
      }

      setIsCreatingStaff(true);
      setErrorMessage("");

      const createRes = await fetch(apiPath(storeSlug, "/staff"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name_display: newStaffName.trim(),
          staff_code: newStaffCode.trim() || null,
          payout_policy_id: newRoleId ? Number(newRoleId) : null,
        }),
      });

      const createdStaff = await createRes.json().catch(() => null);

      if (!createRes.ok) {
        throw new Error(createdStaff?.error || "Failed to create staff");
      }

      const createdRoleId =
        createdStaff?.payout_policy_id || (newRoleId ? Number(newRoleId) : null);

      setAllStaff((prev) => [...prev, createdStaff]);

      setWorkingToday((prev) =>
        normalizeWorkingOrder([
          ...prev,
          {
            staff_id: createdStaff.id,
            name:
              createdStaff.name_display ||
              createdStaff.name ||
              newStaffName.trim(),
            staff_code: createdStaff.staff_code || "",
            payout_policy_id: createdRoleId,
            role_name: getRoleNameById(createdRoleId),
            start_time: defaultStartTime,
            end_time: defaultEndTime,
            display_order: prev.length + 1,
            source: "override",
            is_working: true,
            daily_guarantee_override: enableDailyGuarantee
              ? newGuaranteeOverride !== ""
                ? String(newGuaranteeOverride)
                : String(defaultGuarantee)
              : null,
          },
        ])
      );

      setNewStaffName("");
      setNewStaffCode("");
      setNewRoleId("");
      setNewGuaranteeOverride("");
      setShowQuickAdd(false);
    } catch (error) {
      console.error("Create temporary staff failed:", error);

      setErrorMessage(error?.message || "Could not create temporary staff.");
    } finally {
      setIsCreatingStaff(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    const numericStartTill = Number(startTill);

    if (!Number.isFinite(numericStartTill) || numericStartTill < 0) {
      setErrorMessage("Please enter a valid starting till amount.");
      return;
    }

    if (workingToday.length === 0) {
      setErrorMessage("Please add at least one working staff for today.");
      return;
    }

    setSaving(true);

    try {
      const storeDayRes = await fetch(apiPath(storeSlug, "/store-day"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          day_date: selectedDate,
          start_till: numericStartTill,
          opening_note: openingNote.trim() || null,
        }),
      });

      const storeDayData = await storeDayRes.json().catch(() => null);

      if (!storeDayRes.ok) {
        throw new Error(storeDayData?.error || "Failed to start day");
      }

      const workingPayloads = workingToday.map((staff, index) => ({
        staff_id: staff.staff_id,
        override_date: selectedDate,
        is_working: true,
        start_time: `${normalizeTime(staff.start_time, defaultStartTime)}:00`,
        end_time: `${normalizeTime(staff.end_time, defaultEndTime)}:00`,
        display_order: index + 1,
        daily_guarantee_override: enableDailyGuarantee
          ? staff.daily_guarantee_override !== null &&
            staff.daily_guarantee_override !== undefined &&
            staff.daily_guarantee_override !== ""
            ? Number(staff.daily_guarantee_override)
            : null
          : null,
      }));

      const removedPayloads = removedStaffIds.map((staffId) => ({
        staff_id: staffId,
        override_date: selectedDate,
        is_working: false,
        daily_guarantee_override: null,
      }));

      await Promise.all(
        [...workingPayloads, ...removedPayloads].map(async (payload) => {
          const res = await fetch(apiPath(storeSlug, "/staff-overrides"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const data = await res.json().catch(() => null);

          if (!res.ok) {
            throw new Error(
              data?.error || "Failed to save start day staff setup"
            );
          }
        })
      );

      onStarted?.(storeDayData?.store_day || null);
    } catch (error) {
      console.error("Failed to start day:", error);

      setErrorMessage(
        error?.message || "Could not confirm start day. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-4xl border border-[#E8DED6] bg-[#FFFCFA] shadow-[0_20px_60px_rgba(63,55,51,0.08)]">
        <div className="flex flex-col gap-3 border-b border-[#E8DED6] bg-[#F8F1EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9A8A84]">
              Start of day
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#3F3733]">
              Confirm today’s opening
            </h2>
          </div>

          <p className="max-w-xl text-sm text-[#6F625C] sm:text-right">
            Review the opening till, staff order, and daily guarantees before starting the day.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="grid gap-4 p-5 sm:grid-cols-[1fr_1.25fr] sm:p-6">
            <section className="space-y-4">
              <div className="rounded-2xl border border-[#E8DED6] bg-white p-4 text-sm text-[#3F3733]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9A8A84]">
                      Store
                    </p>
                    <p className="mt-2 text-sm text-[#3F3733]">
                      {storeName || "Store"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9A8A84]">
                      Date
                    </p>
                    <p className="mt-2 text-sm text-[#3F3733]">{selectedDate}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#9A8A84]">
                      Business hours
                    </p>
                    <p className="mt-2 text-sm text-[#3F3733]">
                      {businessHours?.is_open === false
                        ? "Closed"
                        : `${defaultStartTime} - ${defaultEndTime}`}
                    </p>
                  </div>

                  {enableDailyGuarantee ? (
                    <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#9A8A84]">
                        Default guarantee
                      </p>
                      <p className="mt-2 text-sm text-[#3F3733]">
                        ${Number(defaultGuarantee || 0).toFixed(0)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-[#E8DED6] bg-white p-4">
                <label className="text-sm font-semibold text-[#3F3733]">
                  Starting till amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={startTill}
                  onWheel={handleNumberWheel}
                  onChange={(e) => setStartTill(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                  disabled={saving}
                />
              </div>

              <div className="rounded-2xl border border-[#E8DED6] bg-white p-4">
                <label className="text-sm font-semibold text-[#3F3733]">
                  Opening note (optional)
                </label>
                <textarea
                  rows={3}
                  value={openingNote}
                  onChange={(e) => setOpeningNote(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                  disabled={saving}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9A8A84]">
                    Staff setup
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-[#3F3733]">
                    Today&apos;s grid order
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddExisting((prev) => !prev);
                      setShowQuickAdd(false);
                    }}
                    className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-semibold text-[#6F625C] transition hover:bg-[#FFF9F6]"
                  >
                    {showAddExisting ? "Hide add staff" : "Add staff"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickAdd((prev) => !prev);
                      setShowAddExisting(false);
                    }}
                    className="rounded-2xl bg-[#B86F52] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#A86248]"
                  >
                    {showQuickAdd ? "Hide quick add" : "Add temporary / casual"}
                  </button>
                </div>
              </div>

              {loadingSetup ? (
                <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-4 text-sm text-[#6F625C]">
                  Loading...
                </div>
              ) : (
                <div className="space-y-3">
                  {workingToday.length === 0 ? (
                    <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-4 text-sm text-[#6F625C]">
                      No staff selected for today yet.
                    </div>
                  ) : (
                    workingToday.map((staff, index) => {
                      const effectiveGuarantee =
                        staff.daily_guarantee_override !== null &&
                        staff.daily_guarantee_override !== undefined &&
                        staff.daily_guarantee_override !== ""
                          ? Number(staff.daily_guarantee_override)
                          : defaultGuarantee;

                      return (
                        <div
                          key={staff.staff_id}
                          className="rounded-2xl border border-[#E8DED6] bg-white p-3"
                        >
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                            <div className="min-w-0 space-y-2">
                              <p className="truncate text-sm font-semibold text-[#3F3733]">
                                {index + 1}. {staff.name}
                              </p>

                              <div className="space-y-1 text-xs text-[#6F625C]">
                                <p className="truncate">
                                  {staff.staff_code || "No staff code"}
                                  {staff.role_name ? ` • ${staff.role_name}` : ""}
                                </p>
                                <p className="truncate">
                                  {normalizeTime(staff.start_time, defaultStartTime)} – {normalizeTime(staff.end_time, defaultEndTime)}
                                  {staff.source ? ` • ${staff.source}` : ""}
                                </p>
                              </div>
                            </div>

                            {enableDailyGuarantee ? (
                              <div className="sm:w-44 rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-3">
                                <label className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#9A8A84]">
                                  Guarantee
                                </label>

                                <input
                                  type="number"
                                  value={staff.daily_guarantee_override ?? ""}
                                  placeholder={String(defaultGuarantee)}
                                  onWheel={handleNumberWheel}
                                  onChange={(e) =>
                                    updateStaffGuarantee(
                                      staff.staff_id,
                                      e.target.value
                                    )
                                  }
                                  className="mt-2 w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                                />

                                <p className="mt-2 text-[10px] text-[#9A8A84]">
                                  Effective: ${Number(effectiveGuarantee).toFixed(0)}
                                </p>
                              </div>
                            ) : null}

                            <div className="flex flex-wrap items-start justify-end gap-2 sm:flex-col sm:items-end">
                              <button
                                type="button"
                                onClick={() => moveStaff(staff.staff_id, "up")}
                                disabled={index === 0}
                                className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2 text-sm font-semibold text-[#6F625C] transition hover:bg-[#FFF9F6] disabled:opacity-40"
                              >
                                ↑
                              </button>

                              <button
                                type="button"
                                onClick={() => moveStaff(staff.staff_id, "down")}
                                disabled={index === workingToday.length - 1}
                                className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] px-3 py-2 text-sm font-semibold text-[#6F625C] transition hover:bg-[#FFF9F6] disabled:opacity-40"
                              >
                                ↓
                              </button>

                              <button
                                type="button"
                                onClick={() => removeFromToday(staff.staff_id)}
                                className="rounded-2xl border border-[#F3B2A5] bg-[#FFF1EE] px-3 py-2 text-sm font-semibold text-[#9F3A2E] transition hover:bg-[#FFE7DD]"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {showAddExisting ? (
                <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-[#3F3733]">
                    Add existing staff
                  </h3>

                  {availableToAdd.length === 0 ? (
                    <p className="text-sm text-[#9A8A84]">
                      No more staff available to add.
                    </p>
                  ) : (
                    <div className="max-h-70 space-y-2 overflow-y-auto">
                      {availableToAdd.map((staff) => {
                        const displayName =
                          staff.name_display || staff.name || "Staff";

                        const roleName =
                          staff.role_name ||
                          staff.policy_name ||
                          getRoleNameById(staff.payout_policy_id);

                        return (
                          <button
                            key={staff.id}
                            type="button"
                            onClick={() => addExistingStaff(staff)}
                            className="flex w-full items-center justify-between rounded-2xl border border-[#E8DED6] bg-white px-4 py-3 text-left text-sm text-[#3F3733] transition hover:bg-[#FFF9F6]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#3F3733]">
                                {displayName}
                              </p>

                              <p className="mt-1 text-xs text-[#6F625C]">
                                {staff.staff_code || "No staff code"}
                                {roleName ? ` • ${roleName}` : ""}
                              </p>
                            </div>

                            <span className="shrink-0 rounded-full bg-[#EFF5F0] px-3 py-1 text-sm font-semibold text-[#1F4E36]">
                              Add
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              {showQuickAdd ? (
                <div className="rounded-2xl border border-[#E8DED6] bg-[#FFFCFA] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-[#3F3733]">
                    Add temporary / casual staff
                  </h3>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                      placeholder="Display name"
                    />

                    <input
                      type="text"
                      value={newStaffCode}
                      onChange={(e) => setNewStaffCode(e.target.value)}
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                      placeholder="Staff code"
                    />

                    <select
                      value={newRoleId}
                      onChange={(e) => setNewRoleId(e.target.value)}
                      className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                    >
                      <option value="">No staff role selected</option>

                      {payoutRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.role_name || role.name}
                        </option>
                      ))}
                    </select>

                    <p className="text-xs text-[#9A8A84]">
                      Staff role controls payout calculation.
                    </p>

                    {enableDailyGuarantee ? (
                      <input
                        type="number"
                        value={newGuaranteeOverride}
                        onWheel={handleNumberWheel}
                        onChange={(e) =>
                          setNewGuaranteeOverride(e.target.value)
                        }
                        className="w-full rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm text-[#3F3733] outline-none transition focus:border-[#B86F52] focus:ring-1 focus:ring-[#F3D1C6]"
                        placeholder={`Guarantee (${defaultGuarantee})`}
                      />
                    ) : null}

                    <button
                      type="button"
                      disabled={isCreatingStaff}
                      onClick={createTemporaryStaff}
                      className="w-full rounded-2xl bg-[#B86F52] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#A86248] disabled:opacity-50"
                    >
                      {isCreatingStaff ? "Creating..." : "Create and add"}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          {errorMessage ? (
            <div className="px-5 pb-3">
              <div className="rounded-2xl border border-[#F3B2A5] bg-[#FFF1EE] px-4 py-3 text-sm text-[#9F3A2E]">
                {errorMessage}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-end border-t border-[#E8DED6] bg-[#FFFCFA] px-5 py-4">
            <button
              type="submit"
              disabled={saving || loadingSetup}
              className="rounded-2xl bg-[#B86F52] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#A86248] disabled:opacity-50"
            >
              {saving ? "Confirming..." : "Confirm Start Day"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}