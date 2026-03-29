"use client";

export default function InactiveBookingsModal({
  open,
  bookings = [],
  onClose,
  onRecover,
}) {
  if (!open) return null;

  const cancelledBookings = bookings.filter(
    (booking) => booking.status?.toLowerCase() === "cancelled"
  );

  const noShowBookings = bookings.filter(
    (booking) => booking.status?.toLowerCase() === "no_show"
  );

  function BookingRow({ booking }) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-white px-3 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {booking.customer_name || "Walk-in"}
          </p>
          <p className="text-xs text-gray-500">
            {(booking.services?.name || booking.service_name || "Service") +
              " • " +
              (booking.time?.substring(0, 5) || "--:--")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRecover?.(booking)}
          className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Recover
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Cancelled / No-show
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Review inactive bookings and recover mistakes.
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

        <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-6 md:grid-cols-2">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Cancelled ({cancelledBookings.length})
            </h3>

            <div className="space-y-3">
              {cancelledBookings.length === 0 ? (
                <p className="text-sm text-gray-400">No cancelled bookings.</p>
              ) : (
                cancelledBookings.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              No-show ({noShowBookings.length})
            </h3>

            <div className="space-y-3">
              {noShowBookings.length === 0 ? (
                <p className="text-sm text-gray-400">No no-show bookings.</p>
              ) : (
                noShowBookings.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}