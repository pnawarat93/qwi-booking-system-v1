"use client";

export default function UnassignedBookingsModal({
  open,
  bookings = [],
  onClose,
  onOpenBooking,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Unassigned bookings
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              These bookings belong to staff who are not on today’s shift.
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

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {bookings.length === 0 ? (
            <p className="text-sm text-gray-400">No unassigned bookings.</p>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between rounded-xl border bg-white px-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {booking.customer_name || "Walk-in"}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {(booking.services?.name || booking.service_name || "Service") +
                        " • " +
                        (booking.time?.substring(0, 5) || "--:--")}
                    </p>

                    <p className="mt-1 text-xs text-amber-700">
                      Assigned staff not on today’s shift
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenBooking?.(booking)}
                    className="ml-4 shrink-0 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Open booking
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}