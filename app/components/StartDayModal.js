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
  const [allStaff, setAllStaff] = useState([]);
  const [workingToday, setWorkingToday] = useState([]);
  const [removedStaffIds, setRemovedStaffIds] = useState([]);

  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCode, setNewStaffCode] = useState("");
  const [newEmploymentType, setNewEmploymentType] = useState("temporary");
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
        const [hoursRes, staffRes, effectiveRes] = await Promise.all([
          fetch(apiPath(storeSlug, `/business-hours?date=${selectedDate}`)),
          fetch(apiPath(storeSlug, "/staff")),
          fetch(
            apiPath(
              storeSlug,
              `/effective-staff?date=${selectedDate}&include_all=true`
            )
          ),
        ]);

        const hoursData = await hoursRes.json();
        const staffData = await staffRes.json();
        const effectiveData = await effectiveRes.json();

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

        const effectiveItems = Array.isArray(effectiveData?.items)
          ? effectiveData.items
          : [];

        const normalizedWorking = effectiveItems
          .filter((item) => item.is_working === true)
          .map((item, index) => ({
            staff_id: item.staff_id,
            name: item.name_display || item.name || "Staff",
            staff_code: item.staff_code || "",
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
          }))
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
        setAllStaff(Array.isArray(staffData) ? staffData : []);
        setWorkingToday(normalizedWorking);
        setRemovedStaffIds([]);
      } catch (error) {
        console.error("Failed to load start day setup:", error);
        setBusinessHours(null);
        setAllStaff([]);
        setWorkingToday([]);
        setRemovedStaffIds([]);
        setErrorMessage(
          error?.message || "Could not load start day setup. Please try again."
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

  const defaultStartTime = normalizeTime(businessHours?.open_time, "09:00");
  const defaultEndTime = normalizeTime(businessHours?.close_time, "18:00");

  const availableToAdd = useMemo(() => {
    const workingIds = new Set(workingToday.map((staff) => String(staff.staff_id)));

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

  function moveStaff(staffId, direction) {
    setWorkingToday((prev) => {
      const next = [...prev];
      const index = next.findIndex((row) => String(row.staff_id) === String(staffId));
      if (index === -1) return prev;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;

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

  function addExistingStaff(staff) {
    setWorkingToday((prev) =>
      normalizeWorkingOrder([
        ...prev,
        {
          staff_id: staff.id,
          name: staff.name_display || staff.name || "Staff",
          staff_code: staff.staff_code || "",
          start_time: defaultStartTime,
          end_time: defaultEndTime,
          display_order: prev.length + 1,
          source: "override",
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
          employment_type: newEmploymentType,
        }),
      });

      const createdStaff = await createRes.json().catch(() => null);

      if (!createRes.ok) {
        throw new Error(createdStaff?.error || "Failed to create staff");
      }

      setAllStaff((prev) => [...prev, createdStaff]);

      setWorkingToday((prev) =>
        normalizeWorkingOrder([
          ...prev,
          {
            staff_id: createdStaff.id,
            name:
              createdStaff.name_display || createdStaff.name || newStaffName.trim(),
            staff_code: createdStaff.staff_code || "",
            start_time: defaultStartTime,
            end_time: defaultEndTime,
            display_order: prev.length + 1,
            source: "override",
          },
        ])
      );

      setNewStaffName("");
      setNewStaffCode("");
      setNewEmploymentType("temporary");
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
      }));

      const removedPayloads = removedStaffIds.map((staffId) => ({
        staff_id: staffId,
        override_date: selectedDate,
        is_working: false,
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
            throw new Error(data?.error || "Failed to save start day staff setup");
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-day-title"
      >
        <div className="border-b px-6 py-5">
          <h2
            id="start-day-title"
            className="text-xl font-semibold text-gray-900"
          >
            Start Day Confirmation
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Confirm today&apos;s opening, till amount, and staff order before front-desk operations continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_1.2fr]">
            <section className="space-y-5">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                <p>
                  <span className="font-semibold text-gray-900">Store:</span>{" "}
                  {storeName || "Store"}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-gray-900">Date:</span>{" "}
                  {selectedDate}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-gray-900">Business hours:</span>{" "}
                  {businessHours?.is_open === false
                    ? "Closed"
                    : `${defaultStartTime} - ${defaultEndTime}`}
                </p>
              </div>

              <div>
                <label
                  htmlFor="start-till"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Starting till amount
                </label>
                <input
                  id="start-till"
                  type="number"
                  min="0"
                  step="0.01"
                  value={startTill}
                  onChange={(e) => setStartTill(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="0.00"
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the cash float prepared for the start of today.
                </p>
              </div>

              <div>
                <label
                  htmlFor="opening-note"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Opening note (optional)
                </label>
                <textarea
                  id="opening-note"
                  rows={3}
                  value={openingNote}
                  onChange={(e) => setOpeningNote(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Any quick note for today"
                  disabled={saving}
                />
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                This confirmation is required before using today&apos;s front-desk operations.
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Today&apos;s grid order
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Leftmost staff gets the first customer. Arrange from first arrival to last.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddExisting((prev) => !prev);
                      setShowQuickAdd(false);
                    }}
                    className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {showAddExisting ? "Hide add staff" : "Add staff"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickAdd((prev) => !prev);
                      setShowAddExisting(false);
                    }}
                    className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
                  >
                    {showQuickAdd ? "Hide quick add" : "Add temporary / casual"}
                  </button>
                </div>
              </div>

              {loadingSetup ? (
                <div className="rounded-xl border bg-gray-50 px-4 py-6 text-sm text-gray-500">
                  Loading start day setup...
                </div>
              ) : workingToday.length === 0 ? (
                <div className="rounded-xl border bg-gray-50 px-4 py-6 text-sm text-gray-500">
                  No staff added for today yet. Add at least one staff member before confirming.
                </div>
              ) : (
                <div className="space-y-3">
                  {workingToday.map((staff, index) => (
                    <div
                      key={staff.staff_id}
                      className="flex items-center justify-between rounded-xl border bg-white px-4 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {index + 1}. {staff.name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>{staff.staff_code || "No staff code"}</span>
                          <span>•</span>
                          <span>
                            {normalizeTime(staff.start_time, defaultStartTime)} -{" "}
                            {normalizeTime(staff.end_time, defaultEndTime)}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{staff.source}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveStaff(staff.staff_id, "up")}
                          disabled={index === 0}
                          className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                          ←
                        </button>

                        <button
                          type="button"
                          onClick={() => moveStaff(staff.staff_id, "down")}
                          disabled={index === workingToday.length - 1}
                          className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                          →
                        </button>

                        <button
                          type="button"
                          onClick={() => removeFromToday(staff.staff_id)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showAddExisting && (
                <div className="rounded-xl border bg-gray-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-gray-900">
                    Add existing staff
                  </h4>

                  {availableToAdd.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No more staff available to add.
                    </p>
                  ) : (
                    <div className="max-h-[260px] space-y-3 overflow-auto">
                      {availableToAdd.map((staff) => (
                        <div
                          key={staff.id}
                          className="flex items-center justify-between rounded-xl border bg-white px-4 py-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {staff.name_display || staff.name || "Staff"}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {staff.staff_code || "No staff code"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => addExistingStaff(staff)}
                            className="rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
                          >
                            Add to end
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showQuickAdd && (
                <div className="rounded-xl border bg-gray-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-gray-900">
                    Quick add temporary / casual staff
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Display name
                      </label>
                      <input
                        type="text"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                        placeholder="e.g. Nancy"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Staff code (optional)
                      </label>
                      <input
                        type="text"
                        value={newStaffCode}
                        onChange={(e) => setNewStaffCode(e.target.value)}
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                        placeholder="e.g. NANCY-07"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Employment type
                      </label>
                      <select
                        value={newEmploymentType}
                        onChange={(e) => setNewEmploymentType(e.target.value)}
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                      >
                        <option value="temporary">temporary</option>
                        <option value="casual">casual</option>
                        <option value="permanent">permanent</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={isCreatingStaff}
                      onClick={createTemporaryStaff}
                      className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                    >
                      {isCreatingStaff ? "Creating..." : "Create and add to end"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>

          {errorMessage && (
            <div className="px-6 pb-2">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end border-t px-6 py-4">
            <button
              type="submit"
              disabled={saving || loadingSetup}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {saving ? "Confirming..." : "Confirm Start Day"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}