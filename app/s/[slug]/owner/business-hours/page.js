"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, CalendarDays, Clock3 } from "lucide-react";
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

const EMPTY_SPECIAL_FORM = {
  special_date: "",
  is_closed: false,
  open_time: "10:00",
  close_time: "20:00",
  note: "",
};

function apiPath(slug, path) {
  return `/api/s/${slug}${path}`;
}

function normalizeTimeForInput(value, fallback = "10:00") {
  if (!value) return fallback;
  return String(value).substring(0, 5);
}

export default function OwnerBusinessHoursPage() {
  const store = useStore();

  const [weeklyHours, setWeeklyHours] = useState([]);
  const [specialDates, setSpecialDates] = useState([]);

  const [specialForm, setSpecialForm] = useState(EMPTY_SPECIAL_FORM);
  const [editingSpecialId, setEditingSpecialId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [savingSpecial, setSavingSpecial] = useState(false);
  const [deletingSpecialId, setDeletingSpecialId] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const [weeklyRes, specialRes] = await Promise.all([
        fetch(apiPath(store.slug, "/weekly-business-hours")),
        fetch(apiPath(store.slug, "/special-dates")),
      ]);

      const weeklyData = await weeklyRes.json();
      const specialData = await specialRes.json();

      if (!weeklyRes.ok) {
        throw new Error(weeklyData?.error || "Failed to load weekly hours");
      }

      if (!specialRes.ok) {
        throw new Error(specialData?.error || "Failed to load special dates");
      }

      setWeeklyHours(
        Array.isArray(weeklyData?.items)
          ? weeklyData.items.map((item) => ({
              weekday: Number(item.weekday),
              is_open: Boolean(item.is_open),
              open_time: normalizeTimeForInput(item.open_time, "10:00"),
              close_time: normalizeTimeForInput(item.close_time, "20:00"),
              note: item.note || "",
            }))
          : []
      );

      setSpecialDates(Array.isArray(specialData) ? specialData : []);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Failed to load business hours");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!store.slug) return;
    loadData();
  }, [store.slug]);

  const weeklyHoursByDay = useMemo(() => {
    const map = new Map();
    weeklyHours.forEach((item) => {
      map.set(Number(item.weekday), item);
    });
    return map;
  }, [weeklyHours]);

  function updateWeeklyDay(weekday, patch) {
    setWeeklyHours((prev) =>
      prev.map((item) =>
        Number(item.weekday) === Number(weekday)
          ? { ...item, ...patch }
          : item
      )
    );
  }

  async function handleSaveWeeklyHours() {
    try {
      setSavingWeekly(true);
      setErrorMessage("");
      setSuccessMessage("");

      const payload = weeklyHours.map((item) => ({
        weekday: item.weekday,
        is_open: Boolean(item.is_open),
        open_time: item.is_open
          ? `${normalizeTimeForInput(item.open_time)}:00`
          : null,
        close_time: item.is_open
          ? `${normalizeTimeForInput(item.close_time)}:00`
          : null,
        note: item.note || null,
      }));

      const res = await fetch(apiPath(store.slug, "/weekly-business-hours"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: payload }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save weekly hours");
      }

      setWeeklyHours(
        Array.isArray(data?.items)
          ? data.items.map((item) => ({
              weekday: Number(item.weekday),
              is_open: Boolean(item.is_open),
              open_time: normalizeTimeForInput(item.open_time, "10:00"),
              close_time: normalizeTimeForInput(item.close_time, "20:00"),
              note: item.note || "",
            }))
          : []
      );

      setSuccessMessage("Weekly business hours saved");
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Could not save weekly business hours");
    } finally {
      setSavingWeekly(false);
    }
  }

  function startEditSpecialDate(row) {
    setEditingSpecialId(row.id);
    setSpecialForm({
      special_date: row.special_date || "",
      is_closed: Boolean(row.is_closed),
      open_time: normalizeTimeForInput(row.open_time, "10:00"),
      close_time: normalizeTimeForInput(row.close_time, "20:00"),
      note: row.note || "",
    });
    setErrorMessage("");
    setSuccessMessage("");
  }

  function resetSpecialForm() {
    setEditingSpecialId(null);
    setSpecialForm(EMPTY_SPECIAL_FORM);
  }

  async function handleSaveSpecialDate() {
    try {
      setSavingSpecial(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!specialForm.special_date) {
        throw new Error("Please choose a date");
      }

      const payload = {
        special_date: specialForm.special_date,
        is_closed: Boolean(specialForm.is_closed),
        open_time: specialForm.is_closed
          ? null
          : `${normalizeTimeForInput(specialForm.open_time)}:00`,
        close_time: specialForm.is_closed
          ? null
          : `${normalizeTimeForInput(specialForm.close_time)}:00`,
        note: specialForm.note || null,
      };

      const isEdit = Boolean(editingSpecialId);
      const url = isEdit
        ? apiPath(store.slug, `/special-dates/${editingSpecialId}`)
        : apiPath(store.slug, "/special-dates");
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save special date");
      }

      await loadData();
      resetSpecialForm();
      setSuccessMessage(isEdit ? "Special date updated" : "Special date added");
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Could not save special date");
    } finally {
      setSavingSpecial(false);
    }
  }

  async function handleDeleteSpecialDate(id) {
    try {
      setDeletingSpecialId(id);
      setErrorMessage("");
      setSuccessMessage("");

      const res = await fetch(apiPath(store.slug, `/special-dates/${id}`), {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete special date");
      }

      await loadData();

      if (editingSpecialId === id) {
        resetSpecialForm();
      }

      setSuccessMessage("Special date deleted");
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Could not delete special date");
    } finally {
      setDeletingSpecialId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-emerald-600">Owner Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          Business Hours
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Set normal weekly opening hours and override them for special dates.
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
            <Clock3 className="h-5 w-5 text-gray-700" />
          </div>

          <div className="w-full">
            <h2 className="text-lg font-semibold text-gray-900">
              Weekly business hours
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Set your normal opening hours for each day of the week.
            </p>

            {loading ? (
              <div className="mt-5 rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500">
                Loading weekly hours...
              </div>
            ) : (
              <>
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 rounded-2xl border border-gray-200">
                    <thead className="bg-gray-50 text-left text-sm text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Day</th>
                        <th className="px-4 py-3 font-medium">Open</th>
                        <th className="px-4 py-3 font-medium">From</th>
                        <th className="px-4 py-3 font-medium">To</th>
                        <th className="px-4 py-3 font-medium">Note</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200 bg-white">
                      {weekdays.map((day) => {
                        const row =
                          weeklyHoursByDay.get(day.value) || {
                            weekday: day.value,
                            is_open: true,
                            open_time: "10:00",
                            close_time: "20:00",
                            note: "",
                          };

                        return (
                          <tr key={day.value}>
                            <td className="px-4 py-4 text-sm font-medium text-gray-900">
                              {day.label}
                            </td>

                            <td className="px-4 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  updateWeeklyDay(day.value, {
                                    is_open: !row.is_open,
                                  })
                                }
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  row.is_open
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {row.is_open ? "Open" : "Closed"}
                              </button>
                            </td>

                            <td className="px-4 py-4">
                              <input
                                type="time"
                                value={row.open_time}
                                disabled={!row.is_open}
                                onChange={(e) =>
                                  updateWeeklyDay(day.value, {
                                    open_time: e.target.value,
                                  })
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                              />
                            </td>

                            <td className="px-4 py-4">
                              <input
                                type="time"
                                value={row.close_time}
                                disabled={!row.is_open}
                                onChange={(e) =>
                                  updateWeeklyDay(day.value, {
                                    close_time: e.target.value,
                                  })
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                              />
                            </td>

                            <td className="px-4 py-4">
                              <input
                                value={row.note || ""}
                                onChange={(e) =>
                                  updateWeeklyDay(day.value, {
                                    note: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                placeholder="Optional"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={handleSaveWeeklyHours}
                  disabled={savingWeekly}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingWeekly ? "Saving..." : "Save weekly hours"}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
            <CalendarDays className="h-5 w-5 text-gray-700" />
          </div>

          <div className="w-full">
            <h2 className="text-lg font-semibold text-gray-900">Special dates</h2>
            <p className="mt-1 text-sm text-gray-500">
              Add public holidays, temporary closures, or custom hours for specific dates.
            </p>

            <div className="mt-5 grid gap-4 lg:grid-cols-[420px,1fr]">
              <div className="rounded-2xl border border-gray-200 p-5">
                <h3 className="text-base font-semibold text-gray-900">
                  {editingSpecialId ? "Edit special date" : "Add special date"}
                </h3>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Date
                    </label>
                    <input
                      type="date"
                      value={specialForm.special_date}
                      onChange={(e) =>
                        setSpecialForm((prev) => ({
                          ...prev,
                          special_date: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setSpecialForm((prev) => ({
                          ...prev,
                          is_closed: !prev.is_closed,
                        }))
                      }
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        specialForm.is_closed
                          ? "bg-red-100 text-red-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {specialForm.is_closed ? "Closed all day" : "Open with custom hours"}
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Open time
                      </label>
                      <input
                        type="time"
                        value={specialForm.open_time}
                        disabled={specialForm.is_closed}
                        onChange={(e) =>
                          setSpecialForm((prev) => ({
                            ...prev,
                            open_time: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm disabled:bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Close time
                      </label>
                      <input
                        type="time"
                        value={specialForm.close_time}
                        disabled={specialForm.is_closed}
                        onChange={(e) =>
                          setSpecialForm((prev) => ({
                            ...prev,
                            close_time: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Note
                    </label>
                    <textarea
                      rows={3}
                      value={specialForm.note}
                      onChange={(e) =>
                        setSpecialForm((prev) => ({
                          ...prev,
                          note: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
                      placeholder="Optional"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleSaveSpecialDate}
                      disabled={savingSpecial}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {savingSpecial
                        ? "Saving..."
                        : editingSpecialId
                        ? "Save changes"
                        : "Add special date"}
                    </button>

                    {editingSpecialId ? (
                      <button
                        type="button"
                        onClick={resetSpecialForm}
                        className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 p-5">
                <h3 className="text-base font-semibold text-gray-900">
                  Saved special dates
                </h3>

                <div className="mt-4 space-y-3">
                  {loading ? (
                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                      Loading special dates...
                    </div>
                  ) : specialDates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                      No special dates yet.
                    </div>
                  ) : (
                    specialDates.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {row.special_date}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {row.is_closed
                                ? "Closed all day"
                                : `${normalizeTimeForInput(
                                    row.open_time,
                                    "10:00"
                                  )} - ${normalizeTimeForInput(
                                    row.close_time,
                                    "20:00"
                                  )}`}
                            </p>
                            {row.note ? (
                              <p className="mt-2 text-sm text-gray-600">{row.note}</p>
                            ) : null}
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditSpecialDate(row)}
                              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              disabled={deletingSpecialId === row.id}
                              onClick={() => handleDeleteSpecialDate(row.id)}
                              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingSpecialId === row.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}