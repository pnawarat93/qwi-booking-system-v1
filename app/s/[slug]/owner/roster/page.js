"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Save, RotateCcw } from "lucide-react";
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

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
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

    loadData();

    return () => {
      isMounted = false;
    };
  }, [store.slug]);

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

  async function handleSave() {
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
      setSaveMessage("Roster saved");
    } catch (error) {
      console.error(error);
      setLoadError(error.message || "Could not save roster");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setRosterMap(JSON.parse(JSON.stringify(initialRosterMap)));
    setSaveMessage("");
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
              can be handled later with staff controls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasChanges || saving}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#D9C5B8] bg-[#FFF9F6] px-4 py-2 text-sm font-semibold text-[#6B7556] transition hover:bg-[#FBEAD6]/60 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset changes
            </button>

            <button
              type="button"
              onClick={handleSave}
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
              <p>• Turn a day on if the staff member normally works that day.</p>
              <p>
                • Default times now follow the store’s weekly business hours for
                each day.
              </p>
              <p>
                • If someone takes leave or covers a shift, that can be handled
                later as a date-specific override.
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
    </div>
  );
}