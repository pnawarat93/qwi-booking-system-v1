"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

function getTodayInSydney() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDay(dateString) {
  if (!dateString) return "";

  const [year, month, day] = String(dateString).split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    timeZone: "Australia/Sydney",
  });
}

export default function ScheduleToolbar({
  selectedDate,
  onDateChange,
  onOpenWalkIn,
  onOpenNewBooking,
  copy = {},
}) {
  const labels = {
    goToday: "Go to Today",
    addWalkIn: "Add Walk-in",
    newBooking: "New Booking",
    ...copy,
  };

  function shiftDate(days) {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);

    const nextDate = current.toISOString().split("T")[0];
    onDateChange(nextDate);
  }

  function goToday() {
    onDateChange(getTodayInSydney());
  }

  return (
    <div className="border-b border-[#E9DED8] bg-[#FFF9F6]/90 px-4 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-[#E9DED8] bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#6B5B55] transition hover:bg-[#F5ECE7] hover:text-[#4A3A34]"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-2 px-1">
            <span className="min-w-[80px] text-center text-sm font-bold text-[#4A3A34]">
              {formatDay(selectedDate)}
            </span>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="rounded-xl border border-[#EFE7E2] bg-[#FFFCFA] px-3 py-2 text-sm font-medium text-[#4A3A34] outline-none transition focus:border-[#D8B6BD] focus:ring-4 focus:ring-[#F5DDE2]"
            />
          </div>

          <button
            type="button"
            onClick={() => shiftDate(1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#6B5B55] transition hover:bg-[#F5ECE7] hover:text-[#4A3A34]"
          >
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            onClick={goToday}
            className="ml-1 rounded-xl bg-[#F5ECE7] px-3 py-2 text-xs font-bold text-[#8B5E3C] transition hover:bg-[#EADBD3]"
          >
            {labels.goToday}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenWalkIn}
            className="rounded-2xl border border-[#E9DED8] bg-white px-5 py-2.5 text-sm font-semibold text-[#5B4B45] shadow-sm transition hover:border-[#D8B6BD] hover:bg-[#FFF5F7] hover:text-[#4A3A34]"
          >
            {labels.addWalkIn}
          </button>

          <button
            type="button"
            onClick={onOpenNewBooking}
            className="rounded-2xl bg-[#4A3A34] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#5A4740] hover:shadow-md"
          >
            {labels.newBooking}
          </button>
        </div>
      </div>
    </div>
  );
}
