"use client";

import { useState } from "react";
import {
  CalendarDays,
  Users,
  Clock3,
  Plus,
  Copy,
} from "lucide-react";
import { useStore } from "../../StoreContext";

const weekdays = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

export default function OwnerRosterPage() {
  const store = useStore();

  const [selectedStaff, setSelectedStaff] = useState(null);

  return (
    <div className="space-y-6">
      <div className="rounded-[1.75rem] border border-[#E8D8CC] bg-white p-6 shadow-[0_10px_30px_rgba(180,140,120,0.08)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C87D87]">
              Roster
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[#4A3A34]">
              Weekly staff roster
            </h1>
            <p className="mt-1 text-sm text-[#7A675F]">
              Set your default weekly schedule. You only need to update it when something changes.
            </p>
          </div>

          <button className="inline-flex items-center gap-2 rounded-2xl bg-[#C87D87] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" />
            Add staff to roster
          </button>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-[#E8D8CC] bg-white p-6 shadow-[0_10px_24px_rgba(180,140,120,0.06)]">
        <h2 className="text-lg font-semibold text-[#4A3A34]">
          How this works
        </h2>

        <div className="mt-4 space-y-3 text-sm text-[#7A675F]">
          <p>
            • Set a weekly pattern once. The system will reuse it for future days.
          </p>
          <p>
            • You only edit specific days when staff take leave or schedules change.
          </p>
          <p>
            • This controls availability for online booking and daily scheduling.
          </p>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-[#E8D8CC] bg-white shadow-[0_10px_24px_rgba(180,140,120,0.06)]">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-[#4A3A34]">
            Weekly pattern
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr className="bg-[#FFF9F6] text-left text-sm text-[#7A675F]">
                <th className="px-4 py-3 font-medium">Staff</th>
                {weekdays.map((day) => (
                  <th key={day.value} className="px-4 py-3 font-medium">
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {[1, 2, 3].map((row) => (
                <tr
                  key={row}
                  className="border-t text-sm text-[#4A3A34]"
                >
                  <td className="px-4 py-3 font-semibold">
                    Staff {row}
                  </td>

                  {weekdays.map((day) => (
                    <td key={day.value} className="px-3 py-3">
                      <div className="flex flex-col gap-1 rounded-xl border border-[#F1E4DA] bg-[#FFFDFC] px-3 py-2">
                        <span className="text-xs text-[#7A675F]">
                          10:00 - 18:00
                        </span>
                        <span className="text-[11px] text-[#C87D87]">
                          Working
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-[#E8D8CC] bg-white p-6 shadow-[0_10px_24px_rgba(180,140,120,0.06)]">
          <h2 className="text-lg font-semibold text-[#4A3A34]">
            Generate daily shifts
          </h2>

          <p className="mt-2 text-sm text-[#7A675F]">
            Apply this roster to upcoming days so booking and scheduling can use it.
          </p>

          <button className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[#D9C5B8] bg-[#FFF9F6] px-4 py-2 text-sm font-semibold text-[#6B7556] hover:bg-[#FBEAD6]/60">
            <Copy className="h-4 w-4" />
            Generate next 14 days
          </button>
        </div>

        <div className="rounded-[1.5rem] border border-[#E8D8CC] bg-white p-6 shadow-[0_10px_24px_rgba(180,140,120,0.06)]">
          <h2 className="text-lg font-semibold text-[#4A3A34]">
            What happens next
          </h2>

          <ul className="mt-3 space-y-2 text-sm text-[#7A675F]">
            <li>• Online booking will use this schedule</li>
            <li>• Staff availability will follow this pattern</li>
            <li>• Daily grid will show correct staff</li>
            <li>• You can override any specific day later</li>
          </ul>
        </div>
      </div>
    </div>
  );
}