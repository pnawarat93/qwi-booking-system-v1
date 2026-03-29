"use client";

export default function ScheduleToolbar({
  selectedDate,
  dateLabel = "Sunday, 15 March 2026",
  onDateChange,
  onOpenWalkIn,
  onOpenNewBooking,
}) {
  const shiftDate = (days) => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + days);
    onDateChange(d.toISOString().split("T")[0]);
  };

  const setToday = () => {
    onDateChange(new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="w-full bg-white px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => shiftDate(-1)}
          >
            ←
          </button>

          <button
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={setToday}
          >
            Today
          </button>

          <button
            className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => shiftDate(1)}
          >
            →
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="ml-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700"
          />

          <div className="text-sm font-medium text-gray-600">{dateLabel}</div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenWalkIn}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            + Walk-in
          </button>

          <button
            type="button"
            onClick={onOpenNewBooking}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            + New Booking
          </button>
        </div>
      </div>
    </div>
  );
}