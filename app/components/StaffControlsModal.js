"use client";

import { useEffect, useMemo, useState } from "react";
import { storeApiUrl } from "@/lib/storeApi";

function apiPath(slug, path) {
  return slug ? storeApiUrl(slug, path) : `/api${path}`;
}

export default function StaffControlsModal({
  open,
  selectedDate,
  onClose,
  onUpdated,
  storeSlug,
}) {
  const [todayShifts, setTodayShifts] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCode, setNewStaffCode] = useState("");
  const [newEmploymentType, setNewEmploymentType] = useState("temporary");
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  useEffect(() => {
    if (!open || !selectedDate) return;

    async function fetchData() {
      setLoading(true);

      try {
        const [shiftRes, staffRes] = await Promise.all([
          fetch(apiPath(storeSlug, `/staff-shifts?date=${selectedDate}`)),
          fetch(apiPath(storeSlug, "/staffs")),
        ]);

        const shiftData = await shiftRes.json();
        const staffData = await staffRes.json();

        if (!shiftRes.ok) {
          throw new Error(shiftData?.error || "Failed to load shifts");
        }

        if (!staffRes.ok) {
          throw new Error(staffData?.error || "Failed to load staff");
        }

        setTodayShifts(Array.isArray(shiftData) ? shiftData : []);
        setAllStaff(Array.isArray(staffData) ? staffData : []);
      } catch (error) {
        console.error(error);
        alert(error.message || "Failed to load staff controls");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [open, selectedDate]);

  const workingStaff = useMemo(() => {
    return todayShifts.filter((shift) => shift.is_working);
  }, [todayShifts]);

  const offTodayStaff = useMemo(() => {
    return todayShifts.filter((shift) => !shift.is_working);
  }, [todayShifts]);

  const todayShiftMap = useMemo(() => {
    const map = new Map();
    todayShifts.forEach((shift) => {
      map.set(String(shift.staff_id), shift);
    });
    return map;
  }, [todayShifts]);

  const availableToAdd = useMemo(() => {
    return allStaff.filter((staff) => !todayShiftMap.has(String(staff.id)));
  }, [allStaff, todayShiftMap]);

  async function refreshAll() {
    const [shiftRes, staffRes] = await Promise.all([
      fetch(apiPath(storeSlug, `/staff-shifts?date=${selectedDate}`)),
      fetch(apiPath(storeSlug, "/staffs")),
    ]);

    const shiftData = await shiftRes.json();
    const staffData = await staffRes.json();

    if (!shiftRes.ok) {
      throw new Error(shiftData?.error || "Failed to load shifts");
    }

    if (!staffRes.ok) {
      throw new Error(staffData?.error || "Failed to load staff");
    }

    setTodayShifts(Array.isArray(shiftData) ? shiftData : []);
    setAllStaff(Array.isArray(staffData) ? staffData : []);
  }

  async function toggleShift(staffId, nextValue) {
    try {
      setSavingId(staffId);

      const res = await fetch(apiPath(storeSlug, "/staff-shifts/toggle"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          staff_id: staffId,
          shift_date: selectedDate,
          is_working: nextValue,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "Failed to update shift");
      }

      setTodayShifts((prev) =>
        prev.some((shift) => String(shift.staff_id) === String(staffId))
          ? prev.map((shift) =>
              String(shift.staff_id) === String(staffId)
                ? { ...shift, is_working: nextValue }
                : shift
            )
          : prev
      );

      onUpdated?.();
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not update staff shift.");
    } finally {
      setSavingId(null);
    }
  }

  async function addStaffToToday(staff) {
    try {
      setSavingId(staff.id);

      const displayOrder =
        workingStaff.length + offTodayStaff.length + 1;

      const res = await fetch(apiPath(storeSlug, "/staff-shifts"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          staff_id: staff.id,
          shift_date: selectedDate,
          display_order: displayOrder,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "Failed to add staff to today");
      }

      setTodayShifts((prev) => [
        ...prev,
        {
          ...result,
          is_working: true,
          users: {
            id: staff.id,
            name: staff.name,
            name_display: staff.name_display,
            staff_code: staff.staff_code,
          },
        },
      ]);

      onUpdated?.();
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not add staff.");
    } finally {
      setSavingId(null);
    }
  }

  async function createTemporaryStaff() {
    try {
      if (!newStaffName.trim()) {
        alert("Please enter a display name.");
        return;
      }

      setIsCreatingStaff(true);

      const createRes = await fetch(apiPath(storeSlug, "/staffs"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name_display: newStaffName.trim(),
          staff_code: newStaffCode.trim(),
          employment_type: newEmploymentType,
        }),
      });

      const createdStaff = await createRes.json();

      if (!createRes.ok) {
        throw new Error(createdStaff?.error || "Failed to create staff");
      }

      const shiftRes = await fetch(apiPath(storeSlug, "/staff-shifts"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          staff_id: createdStaff.id,
          shift_date: selectedDate,
          display_order: workingStaff.length + offTodayStaff.length + 1,
        }),
      });

      const shiftResult = await shiftRes.json();

      if (!shiftRes.ok) {
        throw new Error(shiftResult?.error || "Failed to add new staff to today");
      }

      setNewStaffName("");
      setNewStaffCode("");
      setNewEmploymentType("temporary");

      await refreshAll();
      onUpdated?.();
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not create new staff.");
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

        <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-3">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Today’s staff
            </h3>

            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : workingStaff.length === 0 ? (
              <p className="text-sm text-gray-400">No staff working today.</p>
            ) : (
              <div className="space-y-3">
                {workingStaff.map((shift) => {
                  const displayName =
                    shift.users?.name_display || shift.users?.name || "Staff";

                  return (
                    <div
                      key={shift.id}
                      className="flex items-center justify-between rounded-xl border bg-white px-4 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {displayName}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {shift.users?.staff_code || "No staff code"}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={savingId === shift.staff_id}
                        onClick={() => toggleShift(shift.staff_id, false)}
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {savingId === shift.staff_id ? "Updating..." : "Set off"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Off today
            </h3>

            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : offTodayStaff.length === 0 ? (
              <p className="text-sm text-gray-400">No staff set off today.</p>
            ) : (
              <div className="space-y-3">
                {offTodayStaff.map((shift) => {
                  const displayName =
                    shift.users?.name_display || shift.users?.name || "Staff";

                  return (
                    <div
                      key={shift.id}
                      className="flex items-center justify-between rounded-xl border bg-gray-50 px-4 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {displayName}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {shift.users?.staff_code || "No staff code"}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={savingId === shift.staff_id}
                        onClick={() => toggleShift(shift.staff_id, true)}
                        className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        {savingId === shift.staff_id ? "Updating..." : "Restore"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                Add staff to today
              </h3>

              {loading ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : availableToAdd.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No more active staff to add.
                </p>
              ) : (
                <div className="space-y-3">
                  {availableToAdd.map((staff) => {
                    const displayName =
                      staff.name_display || staff.name || "Staff";

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
                          disabled={savingId === staff.id}
                          onClick={() => addStaffToToday(staff)}
                          className="rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                        >
                          {savingId === staff.id ? "Adding..." : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                Quick add new staff
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
                  {isCreatingStaff ? "Creating..." : "Create and add to today"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}