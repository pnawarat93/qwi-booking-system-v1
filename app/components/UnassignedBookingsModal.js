"use client";

export default function UnassignedBookingsModal({
  open,
  bookings = [],
  onClose,
  onOpenBooking,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-[#E8DED6] bg-[#FFFCFA]">
        <div className="flex items-center justify-between border-b border-[#E8DED6] px-5 py-3 bg-[#F8F1EC] text-[#3F3733]">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Unassigned bookings</h2>
            <p className="mt-1 text-xs text-[#6F625C]">These bookings belong to staff who are not on today’s shift.</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#E8DED6] bg-white px-3 py-2 text-sm font-medium text-[#6F625C] hover:bg-[#FAF5F1]"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {bookings.length === 0 ? (
            <p className="text-sm text-[#9A8A84]">No unassigned bookings.</p>
          ) : (
            <div className="space-y-2">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8DED6] bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#3F3733]">
                      {booking.customer_name || "Walk-in"}
                    </p>

                    <p className="mt-0.5 text-xs font-medium text-[#6F625C]">
                      {(booking.services?.name || booking.service_name || "Service") +
                        " • " +
                        (booking.time?.substring(0, 5) || "--:--")}
                    </p>

                    <p className="mt-1 text-xs text-amber-700">Assigned staff not on today’s shift</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenBooking?.(booking)}
                    className="ml-3 shrink-0 rounded-2xl bg-[#B86F52] px-3 py-2 text-sm font-semibold text-white hover:bg-[#A86248]"
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