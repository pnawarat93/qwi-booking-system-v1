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

  const [loading, setLoading] = useState(false);
  const [savingIds, setSavingIds] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState("");

  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCode, setNewStaffCode] = useState("");
  const [newEmploymentType, setNewEmploymentType] = useState("temporary");
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    try {
      const [staffRes, effectiveRes, hoursRes] = await Promise.all([
        fetch(apiPath(storeSlug, "/staffs")),
        fetch(
          apiPath(
            storeSlug,
            `/effective-staff?date=${selectedDate}&include_all=true`
          )
        ),
        fetch(apiPath(storeSlug, `/business-hours?date=${selectedDate}`)),
      ]);

      const staffData = await staffRes.json();
      const effectiveData = await effectiveRes.json();
      const hoursData = await hoursRes.json();

      if (!staffRes.ok) {
        throw new Error(staffData?.error || "Failed to load staff");
      }

      if (!effectiveRes.ok) {
        throw new Error(effectiveData?.error || "Failed to load effective staff");
      }

      if (!hoursRes.ok) {
        throw new Error(hoursData?.error || "Failed to load business hours");
      }

      setAllStaff(Array.isArray(staffData) ? staffData : []);
      setEffectiveStaff(Array.isArray(effectiveData?.items) ? effectiveData.items : []);
      setBusinessHours(hoursData || null);
    } catch (err) {
      console.error("Failed to load staff controls:", err);
      setAllStaff([]);
      setEffectiveStaff([]);
      setBusinessHours(null);
      setErrorMessage(err.message || "Failed to load staff controls");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open, selectedDate, storeSlug]);

  const workingToday = useMemo(() => {
    return (effectiveStaff || [])
      .filter((s) => s.is_working === true)
      .map((s, index) => ({
        staff_id: s.staff_id,
        name: s.name_display || s.name || "Staff",
        staff_code: s.staff_code || "",
        start_time: normalizeTime(
          s.start_time,
          normalizeTime(businessHours?.open_time, "09:00")
        ),
        end_time: normalizeTime(
          s.end_time,
          normalizeTime(businessHours?.close_time, "18:00")
        ),
        display_order:
          s.display_order !== undefined && s.display_order !== null
            ? s.display_order
            : index + 1,
        source: s.source || "override",
      }))
      .sort((a, b) => {
        const aOrder = a.display_order ?? 0;
        const bOrder = b.display_order ?? 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.name || "").localeCompare(b.name || "");
      });
  }, [effectiveStaff, businessHours]);

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

  const defaultStartTime = normalizeTime(businessHours?.open_time, "09:00");
  const defaultEndTime = normalizeTime(businessHours?.close_time, "18:00");

  function setSaving(staffId, isSaving) {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (isSaving) next.add(staffId);
      else next.delete(staffId);
      return next;
    });
  }

  async function createOrUpdateOverride(payload) {
    const res = await fetch(apiPath(storeSlug, "/staff-overrides"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || "Failed to update staff override");
    }

    return data;
  }

  async function syncWholeWorkingOrder(nextWorkingList, removedStaffIds = []) {
    const workingPayloads = nextWorkingList.map((staff, index) => ({
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
          throw new Error(data?.error || "Failed to update daily staff order");
        }
      })
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

      const next = [...workingToday];
      const index = next.findIndex((row) => String(row.staff_id) === String(staffId));
      if (index === -1) return;

      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return;

      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;

      const normalized = normalizeWorkingOrder(next);
      await syncWholeWorkingOrder(normalized);
      await loadData();
      onUpdated?.();
    } catch (err) {
      console.error("Move staff failed:", err);
      setErrorMessage(err.message || "Could not update staff order.");
    } finally {
      setSaving(staffId, false);
    }
  }

  async function toggleOff(staff) {
    const staffId = staff.staff_id;

    try {
      setSaving(staffId, true);
      setErrorMessage("");

      const remaining = normalizeWorkingOrder(
        workingToday.filter((row) => String(row.staff_id) !== String(staffId))
      );

      await syncWholeWorkingOrder(remaining, [staffId]);
      await loadData();
      onUpdated?.();
    } catch (err) {
      console.error("Toggle off failed:", err);
      setErrorMessage(err.message || "Could not update staff.");
    } finally {
      setSaving(staffId, false);
    }
  }

  async function addExistingStaff(staff) {
    try {
      setSaving(staff.id, true);
      setErrorMessage("");

      const next = normalizeWorkingOrder([
        ...workingToday,
        {
          staff_id: staff.id,
          name: staff.name_display || staff.name || "Staff",
          staff_code: staff.staff_code || "",
          start_time: defaultStartTime,
          end_time: defaultEndTime,
          display_order: workingToday.length + 1,
          source: "override",
        },
      ]);

      await syncWholeWorkingOrder(next);
      await loadData();
      onUpdated?.();
      setShowAddExisting(false);
    } catch (err) {
      console.error("Add existing staff failed:", err);
      setErrorMessage(err.message || "Could not add staff.");
    } finally {
      setSaving(staff.id, false);
    }
  }

  async function createTemporaryStaff() {
    try {
      if (!newStaffName.trim()) {
        setErrorMessage("Please enter a display name.");
        return;
      }

      setIsCreatingStaff(true);
      setErrorMessage("");

      const createRes = await fetch(apiPath(storeSlug, "/staffs"), {
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

      const next = normalizeWorkingOrder([
        ...workingToday,
        {
          staff_id: createdStaff.id,
          name: createdStaff.name_display || createdStaff.name || newStaffName.trim(),
          staff_code: createdStaff.staff_code || "",
          start_time: defaultStartTime,
          end_time: defaultEndTime,
          display_order: workingToday.length + 1,
          source: "override",
        },
      ]);

      await syncWholeWorkingOrder(next);
      await loadData();
      onUpdated?.();

      setNewStaffName("");
      setNewStaffCode("");
      setNewEmploymentType("temporary");
      setShowQuickAdd(false);
    } catch (err) {
      console.error("Create temporary staff failed:", err);
      setErrorMessage(err.message || "Could not create and add staff.");
    } finally {
      setIsCreatingStaff(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Staff controls
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage who is working on {selectedDate}.
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

        <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[1.3fr_1fr]">
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Today’s staff
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Add people during the day or adjust order. New staff always go to the far right.
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

            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : workingToday.length === 0 ? (
              <div className="rounded-xl border bg-gray-50 px-4 py-6 text-sm text-gray-500">
                No staff working on this date yet.
              </div>
            ) : (
              <div className="space-y-3">
                {workingToday.map((staff, index) => {
                  const saving = savingIds.has(staff.staff_id);

                  return (
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
                          disabled={saving || index === 0}
                          onClick={() => moveStaff(staff.staff_id, "left")}
                          className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                          ←
                        </button>

                        <button
                          type="button"
                          disabled={saving || index === workingToday.length - 1}
                          onClick={() => moveStaff(staff.staff_id, "right")}
                          className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                          →
                        </button>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => toggleOff(staff)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Set off"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-4">
            {showAddExisting && (
              <div className="rounded-xl border bg-gray-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Add existing staff to this date
                </h3>

                {loading ? (
                  <p className="text-sm text-gray-400">Loading...</p>
                ) : availableToAdd.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No more active staff available to add.
                  </p>
                ) : (
                  <div className="max-h-[320px] space-y-3 overflow-auto">
                    {availableToAdd.map((staff) => {
                      const displayName =
                        staff.name_display || staff.name || "Staff";
                      const saving = savingIds.has(staff.id);

                      return (
                        <div
                          key={staff.id}
                          className="flex items-center justify-between rounded-xl border bg-white px-4 py-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {displayName}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {staff.staff_code || "No staff code"}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => addExistingStaff(staff)}
                            className="rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                          >
                            {saving ? "Adding..." : "Add to end"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {showQuickAdd && (
              <div className="rounded-xl border bg-gray-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Quick add temporary / casual staff
                </h3>

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

            {!showAddExisting && !showQuickAdd && (
              <div className="rounded-xl border bg-gray-50 px-4 py-6 text-sm text-gray-500">
                Use <span className="font-medium text-gray-700">Add staff</span>{" "}
                to bring in an existing team member for this date, or{" "}
                <span className="font-medium text-gray-700">
                  Add temporary / casual
                </span>{" "}
                for short-notice cover.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}