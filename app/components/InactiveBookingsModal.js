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
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8DED6] bg-white px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#3F3733]">
            {booking.customer_name || "Walk-in"}
          </p>
          <p className="mt-0.5 text-xs font-medium text-[#6F625C]">
            {(booking.services?.name || booking.service_name || "Service") +
              " • " +
              (booking.time?.substring(0, 5) || "--:--")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRecover?.(booking)}
          className="ml-3 rounded-2xl bg-[#B86F52] px-3 py-2 text-sm font-semibold text-white hover:bg-[#A86248]"
        >
          Recover
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-[#E8DED6] bg-[#FFFCFA]">
        <div className="flex items-center justify-between border-b border-[#E8DED6] px-5 py-3 bg-[#F8F1EC] text-[#3F3733]">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Cancelled / No-show
            </h2>
            <p className="mt-1 text-xs text-[#6F625C]">Review inactive bookings and recover mistakes.</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-medium text-[#6F625C] hover:bg-[#FAF5F1]"
          >
            Close
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto px-5 py-4 md:grid-cols-2">
          <section>
            <h3 className="mb-2 text-xs font-semibold text-[#3F3733]">
              Cancelled <span className="text-sm text-[#9A8A84">({cancelledBookings.length})</span>
            </h3>

            <div className="space-y-2">
              {cancelledBookings.length === 0 ? (
                <p className="text-sm text-[#9A8A84]">No cancelled bookings.</p>
              ) : (
                cancelledBookings.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold text-[#3F3733]">
              No-show <span className="text-sm text-[#9A8A84">({noShowBookings.length})</span>
            </h3>

            <div className="space-y-2">
              {noShowBookings.length === 0 ? (
                <p className="text-sm text-[#9A8A84]">No no-show bookings.</p>
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