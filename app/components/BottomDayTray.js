"use client";

export default function BottomDayTray({
  selectedDate,
  totalBookings = 0,
  activeCount = 0,
  cancelledCount = 0,
  noShowCount = 0,
  unassignedCount = 0,
  onOpenInactive,
  onOpenUnassigned,
  onOpenStaffControls,
  onOpenEndDay,
  storeDay,
}) {
  const isStoreDayStarted = Boolean(storeDay?.is_open);

  return (
    <section className="shrink-0 border-t bg-white sticky bottom-0 z-10">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="font-semibold text-gray-900">Total</span>:{" "}
          {totalBookings}
        </div>

        <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="font-semibold text-gray-900">Active</span>:{" "}
          {activeCount}
        </div>

        <button
          type="button"
          onClick={onOpenInactive}
          className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <span className="font-semibold text-gray-900">Cancelled</span>:{" "}
          {cancelledCount}
          <span className="mx-1 text-gray-300">|</span>
          <span className="font-semibold text-gray-900">No-show</span>:{" "}
          {noShowCount}
        </button>

        <button
          type="button"
          onClick={onOpenUnassigned}
          className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <span className="font-semibold text-gray-900">Unassigned</span>:{" "}
          {unassignedCount}
        </button>

        <div className="ml-auto flex items-center gap-3">
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              isStoreDayStarted
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {isStoreDayStarted ? (
              <>
                <span className="font-semibold">Start till</span>: $
                {Number(storeDay?.start_till || 0).toFixed(2)}
              </>
            ) : (
              <span className="font-semibold">Day not started</span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenStaffControls}
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Staff controls
          </button>

          <button
            type="button"
            onClick={onOpenEndDay}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            End day
          </button>
        </div>
      </div>

      <div className="border-t px-4 py-2 text-xs text-gray-500">
        {selectedDate}
      </div>
    </section>
  );
}