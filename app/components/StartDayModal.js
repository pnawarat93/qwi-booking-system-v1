"use client";

import { useEffect, useState } from "react";
import { storeApiUrl } from "@/lib/storeApi";

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
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();

    setErrorMessage("");

    const numericStartTill = Number(startTill);

    if (!Number.isFinite(numericStartTill) || numericStartTill < 0) {
      setErrorMessage("Please enter a valid starting till amount.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(storeApiUrl(storeSlug, "/store-day"), {
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

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to start day");
      }

      onStarted?.(data?.store_day || null);
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
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
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
            Confirm today&apos;s opening before front-desk operations continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <p>
              <span className="font-semibold text-gray-900">Store:</span>{" "}
              {storeName || "Store"}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-gray-900">Date:</span>{" "}
              {selectedDate}
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

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This confirmation is required before using today&apos;s front-desk
            operations.
          </div>

          <div className="flex items-center justify-end border-t pt-4">
            <button
              type="submit"
              disabled={saving}
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