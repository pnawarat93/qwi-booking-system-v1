"use client";

export default function BottomDayTray({
  bookings = [],
  activeBookings = [],
  inactiveBookings = [],
  selectedDate,
  onOpenEndDay,
  onOpenStaffControls,
  onOpenInactiveBookings,
}) {
  const pendingCount = bookings.filter(
    (booking) => booking.status?.toLowerCase() === "pending"
  ).length;

  const paidCount = bookings.filter(
    (booking) => booking.status?.toLowerCase() === "paid"
  ).length;

  const cancelledCount = inactiveBookings.filter(
    (booking) => booking.status?.toLowerCase() === "cancelled"
  ).length;

  const noShowCount = inactiveBookings.filter(
    (booking) => booking.status?.toLowerCase() === "no_show"
  ).length;

  return (
    <section className="shrink-0 border-t bg-white sticky bottom-0 z-10">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="font-semibold text-gray-900">Total</span>:{" "}
          {bookings.length}
        </div>

        <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="font-semibold text-gray-900">Active</span>:{" "}
          {activeBookings.length}
        </div>

        <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="font-semibold text-gray-900">Pending</span>:{" "}
          {pendingCount}
        </div>

        <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="font-semibold text-gray-900">Paid</span>:{" "}
          {paidCount}
        </div>

        <button
          type="button"
          onClick={onOpenInactiveBookings}
          className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <span className="font-semibold text-gray-900">Cancelled</span>:{" "}
          {cancelledCount}
          <span className="mx-1 text-gray-300">|</span>
          <span className="font-semibold text-gray-900">No-show</span>:{" "}
          {noShowCount}
        </button>

        <div className="ml-auto flex items-center gap-3">
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