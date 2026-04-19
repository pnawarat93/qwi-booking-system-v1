"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Save, RotateCcw, Clock3, History } from "lucide-react";
import { getSydneyTodayDate } from "@/lib/sydneyDate";
import { useStore } from "../../StoreContext";

const weekdays = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

function apiPath(slug, path) {
  return `/api/s/${slug}${path}`;
}

function normalizeTimeForInput(value, fallback = "10:00") {
  if (!value) return fallback;
  return String(value).substring(0, 5);
}

function buildWeeklyHoursMap(items) {
  const map = {};

  (Array.isArray(items) ? items : []).forEach((item) => {
    map[String(item.weekday)] = {
      weekday: Number(item.weekday),
      is_open: Boolean(item.is_open),
      open_time: normalizeTimeForInput(item.open_time, "10:00"),
      close_time: normalizeTimeForInput(item.close_time, "20:00"),
      note: item.note || "",
      source: item.source || "weekly_default",
    };
  });

  return map;
}

function buildDefaultCell(staff, weekday, weeklyHoursMap) {
  const hours = weeklyHoursMap[String(weekday)];

  if (hours && hours.is_open === false) {
    return {
      staff_id: staff.id,
      weekday,
      is_working: false,
      start_time: normalizeTimeForInput(hours.open_time, "10:00"),
      end_time: normalizeTimeForInput(hours.close_time, "20:00"),
      display_order: 0,
      note: "",
      is_active: true,
    };
  }

  return {
    staff_id: staff.id,
    weekday,
    is_working: false,
    start_time: normalizeTimeForInput(hours?.open_time, "10:00"),
    end_time: normalizeTimeForInput(hours?.close_time, "20:00"),
    display_order: 0,
    note: "",
    is_active: true,
  };
}

function normalizeWorkingOrder(list) {
  return list.map((row, index) => ({
    ...row,
    display_order: index + 1,
  }));
}

export default function OwnerRosterPage() {
  const store = useStore();

  const [staffList, setStaffList] = useState([]);
  const [rosterMap, setRosterMap] = useState({});
  const [initialRosterMap, setInitialRosterMap] = useState({});
  const [weeklyHoursMap, setWeeklyHoursMap] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const [selectedOverrideDate, setSelectedOverrideDate] = useState(
    getSydneyTodayDate()
  );
  const [businessHours, setBusinessHours] = useState(null);
  const [effectiveStaffRows, setEffectiveStaffRows] = useState([]);
  const [overrideRows, setOverrideRows] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [dailyError, setDailyError] = useState("");
  const [dailyMessage, setDailyMessage] = useState("");

  const [savingIds, setSavingIds] = useState(new Set());
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffCode, setNewStaffCode] = useState("");
  const [newEmploymentType, setNewEmploymentType] = useState("temporary");
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadWeeklyData() {
      try {
        setLoading(true);
        setLoadError("");
        setSaveMessage("");

        const [staffRes, rosterRes, weeklyHoursRes] = await Promise.all([
          fetch(apiPath(store.slug, "/staff")),
          fetch(apiPath(store.slug, "/staff-rosters")),
          fetch(apiPath(store.slug, "/weekly-business-hours")),
        ]);

        const staffData = await staffRes.json();
        const rosterData = await rosterRes.json();
        const weeklyHoursData = await weeklyHoursRes.json();

        if (!staffRes.ok) {
          throw new Error(staffData?.error || "Failed to load staff");
        }

        if (!rosterRes.ok) {
          throw new Error(rosterData?.error || "Failed to load roster");
        }

        if (!weeklyHoursRes.ok) {
          throw new Error(
            weeklyHoursData?.error || "Failed to load weekly business hours"
          );
        }

        const staffRows = Array.isArray(staffData) ? staffData : [];
        const rosterRows = Array.isArray(rosterData) ? rosterData : [];
        const nextWeeklyHoursMap = buildWeeklyHoursMap(weeklyHoursData?.items);

        const nextMap = {};

        staffRows.forEach((staff, staffIndex) => {
          weekdays.forEach((day) => {
            const found = rosterRows.find(
              (row) =>
                String(row.staff_id) === String(staff.id) &&
                Number(row.weekday) === Number(day.value)
            );

            const defaultCell = {
              ...buildDefaultCell(staff, day.value, nextWeeklyHoursMap),
              display_order: staffIndex,
            };

            nextMap[`${staff.id}-${day.value}`] = found
              ? {
                  staff_id: staff.id,
                  weekday: day.value,
                  is_working: Boolean(found.is_working),
                  start_time: normalizeTimeForInput(
                    found.start_time,
                    defaultCell.start_time
                  ),
                  end_time: normalizeTimeForInput(
                    found.end_time,
                    defaultCell.end_time
                  ),
                  display_order:
                    found.display_order !== undefined &&
                    found.display_order !== null
                      ? found.display_order
                      : staffIndex,
                  note: found.note || "",
                  is_active:
                    found.is_active === undefined
                      ? true
                      : Boolean(found.is_active),
                }
              : defaultCell;
          });
        });

        if (isMounted) {
          setStaffList(staffRows);
          setWeeklyHoursMap(nextWeeklyHoursMap);
          setRosterMap(nextMap);
          setInitialRosterMap(JSON.parse(JSON.stringify(nextMap)));
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setLoadError(error.message || "Failed to load roster");
          setStaffList([]);
          setWeeklyHoursMap({});
          setRosterMap({});
          setInitialRosterMap({});
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadWeeklyData();

    return () => {
      isMounted = false;
    };
  }, [store.slug]);

  async function loadDailyData() {
    try {
      setLoadingDaily(true);
      setDailyError("");
      setDailyMessage("");

      const [effectiveRes, overridesRes, hoursRes] = await Promise.all([
        fetch(
          apiPath(
            store.slug,
            `/effective-staff?date=${selectedOverrideDate}&include_all=true`
          )
        ),
        fetch(apiPath(store.slug, `/staff-overrides?date=${selectedOverrideDate}`)),
        fetch(apiPath(store.slug, `/business-hours?date=${selectedOverrideDate}`)),
      ]);

      const effectiveData = await effectiveRes.json();
      const overridesData = await overridesRes.json();
      const hoursData = await hoursRes.json();

      if (!effectiveRes.ok) {
        throw new Error(effectiveData?.error || "Failed to load effective staff");
      }

      if (!overridesRes.ok) {
        throw new Error(overridesData?.error || "Failed to load overrides");
      }

      if (!hoursRes.ok) {
        throw new Error(hoursData?.error || "Failed to load business hours");
      }

      setEffectiveStaffRows(
        Array.isArray(effectiveData?.items) ? effectiveData.items : []
      );
      setOverrideRows(Array.isArray(overridesData) ? overridesData : []);
      setBusinessHours(hoursData || null);
    } catch (error) {
      console.error(error);
      setDailyError(error.message || "Failed to load daily override");
      setEffectiveStaffRows([]);
      setOverrideRows([]);
      setBusinessHours(null);
    } finally {
      setLoadingDaily(false);
    }
  }

  useEffect(() => {
    if (!store.slug || !selectedOverrideDate) return;
    loadDailyData();
  }, [store.slug, selectedOverrideDate]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(rosterMap) !== JSON.stringify(initialRosterMap);
  }, [rosterMap, initialRosterMap]);

  function updateCell(staffId, weekday, patch) {
    const key = `${staffId}-${weekday}`;

    setRosterMap((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...patch,
      },
    }));
  }

  function toggleWorking(staffId, weekday) {
    const key = `${staffId}-${weekday}`;
    const current = rosterMap[key];
    const hours = weeklyHoursMap[String(weekday)];

    const fallbackStart = normalizeTimeForInput(hours?.open_time, "10:00");
    const fallbackEnd = normalizeTimeForInput(hours?.close_time, "20:00");

    if (!current?.is_working) {
      updateCell(staffId, weekday, {
        is_working: true,
        start_time: current?.start_time || fallbackStart,
        end_time: current?.end_time || fallbackEnd,
      });
      return;
    }

    updateCell(staffId, weekday, {
      is_working: false,
    });
  }

  async function handleSaveWeeklyRoster() {
    try {
      setSaving(true);
      setSaveMessage("");
      setLoadError("");

      const rows = Object.values(rosterMap).map((row) => ({
        staff_id: row.staff_id,
        weekday: row.weekday,
        is_working: Boolean(row.is_working),
        start_time: row.is_working
          ? `${normalizeTimeForInput(row.start_time)}:00`
          : null,
        end_time: row.is_working
          ? `${normalizeTimeForInput(row.end_time)}:00`
          : null,
        display_order:
          row.display_order !== undefined && row.display_order !== null
            ? Number(row.display_order)
            : 0,
        note: row.note || null,
        is_active: true,
      }));

      const res = await fetch(apiPath(store.slug, "/staff-rosters"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save roster");
      }

      const refreshedRows = Array.isArray(data) ? data : [];
      const refreshedMap = {};

      staffList.forEach((staff, staffIndex) => {
        weekdays.forEach((day) => {
          const found = refreshedRows.find(
            (row) =>
              String(row.staff_id) === String(staff.id) &&
              Number(row.weekday) === Number(day.value)
          );

          const defaultCell = {
            ...buildDefaultCell(staff, day.value, weeklyHoursMap),
            display_order: staffIndex,
          };

          refreshedMap[`${staff.id}-${day.value}`] = found
            ? {
                staff_id: staff.id,
                weekday: day.value,
                is_working: Boolean(found.is_working),
                start_time: normalizeTimeForInput(
                  found.start_time,
                  defaultCell.start_time
                ),
                end_time: normalizeTimeForInput(
                  found.end_time,
                  defaultCell.end_time
                ),
                display_order:
                  found.display_order !== undefined &&
                  found.display_order !== null
                    ? found.display_order
                    : staffIndex,
                note: found.note || "",
                is_active:
                  found.is_active === undefined
                    ? true
                    : Boolean(found.is_active),
              }
            : defaultCell;
        });
      });

      setRosterMap(refreshedMap);
      setInitialRosterMap(JSON.parse(JSON.stringify(refreshedMap)));
      setSaveMessage("Weekly roster saved");
    } catch (error) {
      console.error(error);
      setLoadError(error.message || "Could not save roster");
    } finally {
      setSaving(false);
    }
  }

  function handleResetWeeklyRoster() {
    setRosterMap(JSON.parse(JSON.stringify(initialRosterMap)));
    setSaveMessage("");
  }

  const defaultStartTime = normalizeTimeForInput(businessHours?.open_time, "09:00");
  const defaultEndTime = normalizeTimeForInput(businessHours?.close_time, "18:00");

  const workingToday = useMemo(() => {
    return (effectiveStaffRows || [])
      .filter((s) => s.is_working === true)
      .map((s, index) => ({
        staff_id: s.staff_id,
        name: s.name_display || s.name || "Staff",
        staff_code: s.staff_code || "",
        start_time: normalizeTimeForInput(
          s.start_time,
          defaultStartTime
        ),
        end_time: normalizeTimeForInput(
          s.end_time,
          defaultEndTime
        ),
        display_order:
          s.display_order !== undefined && s.display_order !== null
            ? s.display_order
            : index + 1,
        source: s.source || "override",
        note: s.note || "",
        override_id: s.override_id || null,
      }))
      .sort((a, b) => {
        const aOrder = a.display_order ?? 0;
        const bOrder = b.display_order ?? 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.name || "").localeCompare(b.name || "");
      });
  }, [effectiveStaffRows, defaultStartTime, defaultEndTime]);

  const offToday = useMemo(() => {
    return (effectiveStaffRows || [])
      .filter((s) => s.is_working === false)
      .map((s) => ({
        staff_id: s.staff_id,
        name: s.name_display || s.name || "Staff",
        staff_code: s.staff_code || "",
        source: s.source || "override",
        note: s.note || "",
        override_id: s.override_id || null,
      }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [effectiveStaffRows]);

  const availableToAdd = useMemo(() => {
    const workingIds = new Set(workingToday.map((staff) => String(staff.staff_id)));

    return staffList
      .filter((staff) => Boolean(staff.is_active))
      .filter((staff) => !workingIds.has(String(staff.id)))
      .sort((a, b) => {
        const aName = a.name_display || a.name || "";
        const bName = b.name_display || b.name || "";
        return aName.localeCompare(bName);
      });
  }, [staffList, workingToday]);

  const overrideHistory = useMemo(() => {
    return [...overrideRows].sort((a, b) => {
      const aOrder = a.display_order ?? 9999;
      const bOrder = b.display_order ?? 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;

      const aName =
        (Array.isArray(a.staff) ? a.staff[0] : a.staff)?.name_display ||
        (Array.isArray(a.staff) ? a.staff[0] : a.staff)?.name ||
        "";
      const bName =
        (Array.isArray(b.staff) ? b.staff[0] : b.staff)?.name_display ||
        (Array.isArray(b.staff) ? b.staff[0] : b.staff)?.name ||
        "";
      return aName.localeCompare(bName);
    });
  }, [overrideRows]);

function setRowSaving(staffId, isSaving) {
  setSavingIds((prev) => {
    const next = new Set(prev);
    if (isSaving) next.add(String(staffId));
    else next.delete(String(staffId));
    return next;
  });
}

  async function createOrUpdateOverride(payload) {
    const res = await fetch(apiPath(store.slug, "/staff-overrides"), {
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

  async function removeOverride(staffId) {
    const res = await fetch(apiPath(store.slug, "/staff-overrides"), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        staff_id: Number(staffId),
        override_date: selectedOverrideDate,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || "Failed to delete override");
    }

    return data;
  }

  async function syncWholeWorkingOrder(nextWorkingList, removedStaffIds = []) {
    const workingPayloads = nextWorkingList.map((staff, index) => ({
      staff_id: staff.staff_id,
      override_date: selectedOverrideDate,
      is_working: true,
      start_time: `${normalizeTimeForInput(staff.start_time, defaultStartTime)}:00`,
      end_time: `${normalizeTimeForInput(staff.end_time, defaultEndTime)}:00`,
      display_order: index + 1,
      note: staff.note || null,
    }));

    const removedPayloads = removedStaffIds.map((staffId) => ({
      staff_id: Number(staffId),
      override_date: selectedOverrideDate,
      is_working: false,
      note: null,
    }));

    await Promise.all(
      [...workingPayloads, ...removedPayloads].map(async (payload) => {
        await createOrUpdateOverride(payload);
      })
    );
  }

  async function moveStaff(staffId, direction) {
    try {
      setRowSaving(staffId, true);
      setDailyError("");
      setDailyMessage("");

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
      await loadDailyData();
      setDailyMessage("Daily order updated");
    } catch (err) {
      console.error("Move staff failed:", err);
      setDailyError(err.message || "Could not update staff order.");
    } finally {
      setRowSaving(staffId, false);
    }
  }

  async function setOffForDate(staff) {
    const staffId = staff.staff_id || staff.id;

    try {
      setRowSaving(staffId, true);
      setDailyError("");
      setDailyMessage("");

      const remaining = normalizeWorkingOrder(
        workingToday.filter((row) => String(row.staff_id) !== String(staffId))
      );

      await syncWholeWorkingOrder(remaining, [staffId]);
      await loadDailyData();
      setDailyMessage("Staff marked off for selected date");
    } catch (err) {
      console.error("Set off failed:", err);
      setDailyError(err.message || "Could not update staff.");
    } finally {
      setRowSaving(staffId, false);
    }
  }

  async function addExistingStaff(staff) {
    try {
      setRowSaving(staff.id, true);
      setDailyError("");
      setDailyMessage("");

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
          note: "",
        },
      ]);

      await syncWholeWorkingOrder(next);
      await loadDailyData();
      setDailyMessage("Staff added to selected date");
      setShowAddExisting(false);
    } catch (err) {
      console.error("Add existing staff failed:", err);
      setDailyError(err.message || "Could not add staff.");
    } finally {
      setRowSaving(staff.id, false);
    }
  }

  async function createTemporaryStaff() {
    try {
      if (!newStaffName.trim()) {
        setDailyError("Please enter a display name.");
        return;
      }

      setIsCreatingStaff(true);
      setDailyError("");
      setDailyMessage("");

      const createRes = await fetch(apiPath(store.slug, "/staff"), {
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
          note: "",
        },
      ]);

      await syncWholeWorkingOrder(next);
      await loadDailyData();

      setNewStaffName("");
      setNewStaffCode("");
      setNewEmploymentType("temporary");
      setShowQuickAdd(false);
      setDailyMessage("Temporary / casual staff created and added");
    } catch (err) {
      console.error("Create temporary staff failed:", err);
      setDailyError(err.message || "Could not create and add staff.");
    } finally {
      setIsCreatingStaff(false);
    }
  }

  async function saveSingleOverrideTime(staff) {
    try {
      setRowSaving(staff.staff_id, true);
      setDailyError("");
      setDailyMessage("");

      await createOrUpdateOverride({
        staff_id: Number(staff.staff_id),
        override_date: selectedOverrideDate,
        is_working: true,
        start_time: `${normalizeTimeForInput(staff.start_time, defaultStartTime)}:00`,
        end_time: `${normalizeTimeForInput(staff.end_time, defaultEndTime)}:00`,
        display_order:
          staff.display_order !== undefined && staff.display_order !== null
            ? Number(staff.display_order)
            : 1,
        note: staff.note || null,
      });

      await loadDailyData();
      setDailyMessage("Daily override updated");
    } catch (err) {
      console.error("Save single override failed:", err);
      setDailyError(err.message || "Could not update override.");
    } finally {
      setRowSaving(staff.staff_id, false);
    }
  }

  async function revertToWeeklyRoster(staffId) {
    try {
      setRowSaving(staffId, true);
      setDailyError("");
      setDailyMessage("");

      await removeOverride(staffId);
      await loadDailyData();
      setDailyMessage("Override removed. Weekly roster restored.");
    } catch (err) {
      console.error("Revert override failed:", err);
      setDailyError(err.message || "Could not remove override.");
    } finally {
      setRowSaving(staffId, false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.75rem] border border-[#E8D8CC] bg-white p-6 shadow-[0_10px_30px_rgba(180,140,120,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C87D87]">
              Roster
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[#4A3A34]">
              Weekly staff roster
            </h1>
            <p className="mt-1 text-sm text-[#7A675F]">
              Set the default weekly working pattern for your team. Daily changes
              can be handled below as date-specific overrides.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleResetWeeklyRoster}
              disabled={!hasChanges || saving}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#D9C5B8] bg-[#FFF9F6] px-4 py-2 text-sm font-semibold text-[#6B7556] transition hover:bg-[#FBEAD6]/60 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset changes
            </button>

            <button
              type="button"
              onClick={handleSaveWeeklyRoster}
              disabled={saving || loading || !hasChanges}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#C87D87] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save roster"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-[#E8D8CC] bg-white p-6 shadow-[0_10px_24px_rgba(180,140,120,0.06)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FBEAD6]">
            <CalendarDays className="h-5 w-5 text-[#6B7556]" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[#4A3A34]">
              How this works
            </h2>
            <div className="mt-2 space-y-2 text-sm text-[#7A675F]">
              <p>• Weekly roster = your normal recurring pattern.</p>
              <p>
                • Daily override = changes for one specific date only.
              </p>
              <p>
                • The system reads override first, then falls back to weekly
                roster.
              </p>
            </div>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {saveMessage && !loadError && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {saveMessage}
        </div>
      )}

      <div className="rounded-[1.5rem] border border-[#E8D8CC] bg-white shadow-[0_10px_24px_rgba(180,140,120,0.06)]">
        <div className="border-b border-[#E8D8CC] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#4A3A34]">
            Weekly pattern
          </h2>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-sm text-[#7A675F]">Loading roster...</div>
        ) : staffList.length === 0 ? (
          <div className="px-6 py-8 text-sm text-[#7A675F]">
            No staff found. Add staff first before setting the roster.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full border-collapse">
              <thead>
                <tr className="bg-[#FFF9F6] text-left text-sm text-[#7A675F]">
                  <th className="px-4 py-3 font-medium">Staff</th>
                  {weekdays.map((day) => (
                    <th key={day.value} className="px-4 py-3 font-medium">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {staffList.map((staff, staffIndex) => {
                  const displayName = staff.name_display || staff.name || "Staff";

                  return (
                    <tr key={staff.id} className="border-t border-[#F1E4DA] align-top">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-semibold text-[#4A3A34]">
                            {displayName}
                          </p>
                          <p className="mt-1 text-xs text-[#7A675F]">
                            {staff.staff_code || "No staff code"}
                          </p>
                        </div>
                      </td>

                      {weekdays.map((day) => {
                        const key = `${staff.id}-${day.value}`;
                        const hours = weeklyHoursMap[String(day.value)];
                        const cell =
                          rosterMap[key] || {
                            ...buildDefaultCell(staff, day.value, weeklyHoursMap),
                            display_order: staffIndex,
                          };

                        return (
                          <td key={day.value} className="px-3 py-3">
                            <div className="rounded-xl border border-[#F1E4DA] bg-[#FFFDFC] p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-[#7A675F]">
                                  Working
                                </span>

                                <button
                                  type="button"
                                  onClick={() => toggleWorking(staff.id, day.value)}
                                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                    cell.is_working
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {cell.is_working ? "On" : "Off"}
                                </button>
                              </div>

                              <div className="mb-3 text-[11px] text-[#8A7A72]">
                                Store hours:{" "}
                                {hours?.is_open === false
                                  ? "Closed"
                                  : `${normalizeTimeForInput(
                                      hours?.open_time,
                                      "10:00"
                                    )} - ${normalizeTimeForInput(
                                      hours?.close_time,
                                      "20:00"
                                    )}`}
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="mb-1 block text-[11px] text-[#8A7A72]">
                                    Start
                                  </label>
                                  <input
                                    type="time"
                                    value={cell.start_time}
                                    disabled={!cell.is_working}
                                    onChange={(e) =>
                                      updateCell(staff.id, day.value, {
                                        start_time: e.target.value,
                                      })
                                    }
                                    className="w-full rounded-lg border border-[#E5D7CE] bg-white px-2 py-2 text-sm text-[#4A3A34] disabled:bg-gray-50 disabled:text-gray-400"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-[11px] text-[#8A7A72]">
                                    End
                                  </label>
                                  <input
                                    type="time"
                                    value={cell.end_time}
                                    disabled={!cell.is_working}
                                    onChange={(e) =>
                                      updateCell(staff.id, day.value, {
                                        end_time: e.target.value,
                                      })
                                    }
                                    className="w-full rounded-lg border border-[#E5D7CE] bg-white px-2 py-2 text-sm text-[#4A3A34] disabled:bg-gray-50 disabled:text-gray-400"
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-[1.5rem] border border-[#E8D8CC] bg-white shadow-[0_10px_24px_rgba(180,140,120,0.06)]">
        <div className="border-b border-[#E8D8CC] px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#4A3A34]">
                Daily override
              </h2>
              <p className="mt-1 text-sm text-[#7A675F]">
                Plan changes for one specific date without editing the weekly
                roster.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#8A7A72]">
                  Selected date
                </label>
                <input
                  type="date"
                  value={selectedOverrideDate}
                  min={getSydneyTodayDate()}
                  onChange={(e) => setSelectedOverrideDate(e.target.value)}
                  className="rounded-xl border border-[#D9C5B8] bg-white px-3 py-2 text-sm text-[#4A3A34]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          {dailyError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {dailyError}
            </div>
          )}

          {dailyMessage && !dailyError && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {dailyMessage}
            </div>
          )}

          <div className="rounded-2xl border border-[#E8D8CC] bg-[#FFF9F6] px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FBEAD6]">
                <Clock3 className="h-4 w-4 text-[#6B7556]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#4A3A34]">
                  Business hours for selected date
                </h3>
                {loadingDaily ? (
                  <p className="mt-1 text-sm text-[#7A675F]">Loading...</p>
                ) : businessHours?.is_open === false ? (
                  <p className="mt-1 text-sm text-[#7A675F]">
                    Store closed
                    {businessHours?.note ? ` · ${businessHours.note}` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-[#7A675F]">
                    {defaultStartTime} - {defaultEndTime}
                    {businessHours?.note ? ` · ${businessHours.note}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#4A3A34]">
                    Effective staff on {selectedOverrideDate}
                  </h3>
                  <p className="mt-1 text-sm text-[#7A675F]">
                    This is what booking and schedule grid should read for this
                    date.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddExisting((prev) => !prev);
                      setShowQuickAdd(false);
                    }}
                    className="rounded-xl border border-[#D9C5B8] bg-white px-3 py-2 text-sm font-medium text-[#4A3A34] hover:bg-[#FFF9F6]"
                  >
                    {showAddExisting ? "Hide add existing" : "Add existing"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickAdd((prev) => !prev);
                      setShowAddExisting(false);
                    }}
                    className="rounded-xl bg-[#4A3A34] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    {showQuickAdd ? "Hide quick add" : "Quick add temp/casual"}
                  </button>
                </div>
              </div>

              {loadingDaily ? (
                <div className="rounded-2xl border border-dashed border-[#E8D8CC] px-4 py-8 text-sm text-[#7A675F]">
                  Loading daily override...
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-[#4A3A34]">
                      Working ({workingToday.length})
                    </h4>

                    {workingToday.length === 0 ? (
                      <div className="rounded-xl border bg-gray-50 px-4 py-6 text-sm text-gray-500">
                        No staff working on this date yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {workingToday.map((staff, index) => {
                          const savingRow = savingIds.has(String(staff.staff_id));

                          return (
                            <div
                              key={staff.staff_id}
                              className="rounded-xl border border-[#E8D8CC] bg-white p-4"
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[#4A3A34]">
                                    {index + 1}. {staff.name}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#7A675F]">
                                    <span>{staff.staff_code || "No staff code"}</span>
                                    <span>•</span>
                                    <span className="capitalize">{staff.source}</span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={savingRow || index === 0}
                                    onClick={() => moveStaff(staff.staff_id, "left")}
                                    className="rounded-lg border px-3 py-2 text-sm font-medium text-[#4A3A34] hover:bg-[#FFF9F6] disabled:opacity-40"
                                  >
                                    ←
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      savingRow || index === workingToday.length - 1
                                    }
                                    onClick={() => moveStaff(staff.staff_id, "right")}
                                    className="rounded-lg border px-3 py-2 text-sm font-medium text-[#4A3A34] hover:bg-[#FFF9F6] disabled:opacity-40"
                                  >
                                    →
                                  </button>

                                  <button
                                    type="button"
                                    disabled={savingRow}
                                    onClick={() => setOffForDate(staff)}
                                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    {savingRow ? "Saving..." : "Set off"}
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3 md:grid-cols-[140px_140px_1fr_auto_auto]">
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-[#8A7A72]">
                                    Start
                                  </label>
                                  <input
                                    type="time"
                                    value={staff.start_time}
                                    onChange={(e) => {
                                      setEffectiveStaffRows((prev) =>
                                        prev.map((row) =>
                                          String(row.staff_id) ===
                                          String(staff.staff_id)
                                            ? {
                                                ...row,
                                                start_time: e.target.value,
                                              }
                                            : row
                                        )
                                      );
                                    }}
                                    className="w-full rounded-lg border border-[#E5D7CE] bg-white px-3 py-2 text-sm text-[#4A3A34]"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-[#8A7A72]">
                                    End
                                  </label>
                                  <input
                                    type="time"
                                    value={staff.end_time}
                                    onChange={(e) => {
                                      setEffectiveStaffRows((prev) =>
                                        prev.map((row) =>
                                          String(row.staff_id) ===
                                          String(staff.staff_id)
                                            ? {
                                                ...row,
                                                end_time: e.target.value,
                                              }
                                            : row
                                        )
                                      );
                                    }}
                                    className="w-full rounded-lg border border-[#E5D7CE] bg-white px-3 py-2 text-sm text-[#4A3A34]"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-[#8A7A72]">
                                    Note
                                  </label>
                                  <input
                                    type="text"
                                    value={staff.note || ""}
                                    onChange={(e) => {
                                      setEffectiveStaffRows((prev) =>
                                        prev.map((row) =>
                                          String(row.staff_id) ===
                                          String(staff.staff_id)
                                            ? {
                                                ...row,
                                                note: e.target.value,
                                              }
                                            : row
                                        )
                                      );
                                    }}
                                    placeholder="Optional note for this date"
                                    className="w-full rounded-lg border border-[#E5D7CE] bg-white px-3 py-2 text-sm text-[#4A3A34]"
                                  />
                                </div>

                                <div className="self-end">
                                  <button
                                    type="button"
                                    disabled={savingRow}
                                    onClick={() => {
                                      const latest = effectiveStaffRows.find(
                                        (row) =>
                                          String(row.staff_id) ===
                                          String(staff.staff_id)
                                      );

                                      saveSingleOverrideTime({
                                        staff_id: staff.staff_id,
                                        start_time:
                                          normalizeTimeForInput(
                                            latest?.start_time,
                                            staff.start_time
                                          ),
                                        end_time:
                                          normalizeTimeForInput(
                                            latest?.end_time,
                                            staff.end_time
                                          ),
                                        display_order: staff.display_order,
                                        note: latest?.note || "",
                                      });
                                    }}
                                    className="rounded-lg border border-[#D9C5B8] px-3 py-2 text-sm font-medium text-[#4A3A34] hover:bg-[#FFF9F6] disabled:opacity-50"
                                  >
                                    Save row
                                  </button>
                                </div>

                                <div className="self-end">
                                  <button
                                    type="button"
                                    disabled={savingRow}
                                    onClick={() => revertToWeeklyRoster(staff.staff_id)}
                                    className="rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                  >
                                    Revert
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-[#4A3A34]">
                      Off / hidden by override ({offToday.length})
                    </h4>

                    {offToday.length === 0 ? (
                      <div className="rounded-xl border bg-gray-50 px-4 py-4 text-sm text-gray-500">
                        No staff marked off by override for this date.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {offToday.map((staff) => {
                          const savingRow = savingIds.has(String(staff.staff_id));

                          return (
                            <div
                              key={staff.staff_id}
                              className="flex flex-col gap-3 rounded-xl border border-[#E8D8CC] bg-[#FFFDFC] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="text-sm font-semibold text-[#4A3A34]">
                                  {staff.name}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#7A675F]">
                                  <span>{staff.staff_code || "No staff code"}</span>
                                  <span>•</span>
                                  <span className="capitalize">{staff.source}</span>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={savingRow}
                                onClick={() => revertToWeeklyRoster(staff.staff_id)}
                                className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                {savingRow ? "Saving..." : "Restore weekly roster"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {showAddExisting && (
                    <div className="rounded-xl border border-[#E8D8CC] bg-[#FFF9F6] p-4">
                      <h4 className="mb-3 text-sm font-semibold text-[#4A3A34]">
                        Add existing staff to selected date
                      </h4>

                      {availableToAdd.length === 0 ? (
                        <p className="text-sm text-[#7A675F]">
                          No more active staff available to add.
                        </p>
                      ) : (
                        <div className="max-h-[320px] space-y-3 overflow-auto">
                          {availableToAdd.map((staff) => {
                            const displayName =
                              staff.name_display || staff.name || "Staff";
                            const savingRow = savingIds.has(String(staff.id));

                            return (
                              <div
                                key={staff.id}
                                className="flex items-center justify-between rounded-xl border bg-white px-4 py-4"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-[#4A3A34]">
                                    {displayName}
                                  </p>
                                  <p className="mt-1 text-xs text-[#7A675F]">
                                    {staff.staff_code || "No staff code"}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  disabled={savingRow}
                                  onClick={() => addExistingStaff(staff)}
                                  className="rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                                >
                                  {savingRow ? "Adding..." : "Add to end"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {showQuickAdd && (
                    <div className="rounded-xl border border-[#E8D8CC] bg-[#FFF9F6] p-4">
                      <h4 className="mb-3 text-sm font-semibold text-[#4A3A34]">
                        Quick add temporary / casual staff
                      </h4>

                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#8A7A72]">
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
                          <label className="mb-1 block text-xs font-medium text-[#8A7A72]">
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
                          <label className="mb-1 block text-xs font-medium text-[#8A7A72]">
                            Employment type
                          </label>
                          <select
                            value={newEmploymentType}
                            onChange={(e) => setNewEmploymentType(e.target.value)}
                            className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                          >
                            <option value="temporary">temporary</option>
                            <option value="casual">casual</option>
                            <option value="part_time">part_time</option>
                            <option value="full_time">full_time</option>
                            <option value="contractor">contractor</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          disabled={isCreatingStaff}
                          onClick={createTemporaryStaff}
                          className="w-full rounded-lg bg-[#4A3A34] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {isCreatingStaff ? "Creating..." : "Create and add to end"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="rounded-xl border border-[#E8D8CC] bg-[#FFF9F6] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FBEAD6]">
                    <History className="h-4 w-4 text-[#6B7556]" />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-[#4A3A34]">
                      Override history
                    </h3>
                    <p className="mt-1 text-xs text-[#7A675F]">
                      These are the date-specific changes already saved for this day.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {loadingDaily ? (
                    <p className="text-sm text-[#7A675F]">Loading...</p>
                  ) : overrideHistory.length === 0 ? (
                    <p className="text-sm text-[#7A675F]">
                      No override records for this date yet.
                    </p>
                  ) : (
                    overrideHistory.map((row) => {
                      const member = Array.isArray(row.staff) ? row.staff[0] : row.staff;
                      const displayName =
                        member?.name_display || member?.name || "Staff";
                      const savingRow = savingIds.has(String(row.staff_id));

                      return (
                        <div
                          key={row.id}
                          className="rounded-xl border bg-white px-4 py-4"
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[#4A3A34]">
                                  {displayName}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#7A675F]">
                                  <span>{member?.staff_code || "No staff code"}</span>
                                  <span>•</span>
                                  <span>
                                    {row.is_working
                                      ? `${normalizeTimeForInput(
                                          row.start_time,
                                          defaultStartTime
                                        )} - ${normalizeTimeForInput(
                                          row.end_time,
                                          defaultEndTime
                                        )}`
                                      : "Off"}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Order:{" "}
                                    {row.display_order !== null &&
                                    row.display_order !== undefined
                                      ? row.display_order
                                      : "-"}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={savingRow}
                                onClick={() => revertToWeeklyRoster(row.staff_id)}
                                className="rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                              >
                                {savingRow ? "Saving..." : "Revert"}
                              </button>
                            </div>

                            {row.note ? (
                              <p className="text-xs text-[#7A675F]">
                                Note: {row.note}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}