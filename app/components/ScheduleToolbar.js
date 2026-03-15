export default function ScheduleToolbar({ dateLabel = "Sunday, 15 March 2026" }) {
  return (
    <div className="w-full border-b bg-white px-6 py-4 sticky top-0 z-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            ←
          </button>

          <button className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Today
          </button>

          <button className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            →
          </button>

          <div className="ml-2">
            <h3 className="text-base font-semibold text-gray-800">
              {dateLabel}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
            + Walk-in
          </button>

          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
            + New Booking
          </button>
        </div>
      </div>
    </div>
  );
}