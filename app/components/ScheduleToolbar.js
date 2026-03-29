export default function ScheduleToolbar({ dateLabel = "Sunday, 15 March 2026", onDateChange }) {
  const shiftDate = (days) => {
    const d = new Date(dateLabel);
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().split("T")[0];
    onDateChange(newDate)
  }
  const setToday = () => {
    onDateChange(new Date().toISOString().split("T")[0])
  }
    
  return (
    <div className="w-full bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => shiftDate(-1)}
          >
            ←
          </button>

          <button className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={setToday}
          >
            Today
          </button>

          <button className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => shiftDate(1)}
          >
            →
          </button>

          <div className="ml-2">
        <input
              type="date"
              value={dateLabel}
              onChange={(e) => onDateChange(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            />
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