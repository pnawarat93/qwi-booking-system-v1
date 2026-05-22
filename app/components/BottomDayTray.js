"use client";

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function StatPill({ label, value, color, onClick }) {
  const content = (
    <div
      className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${color}`}
    >
      <span>{label}</span>
      <span className="ml-1.5 font-black">{value}</span>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left">
        {content}
      </button>
    );
  }

  return content;
}

export default function BottomDayTray({
  selectedDate,
  totalBookings = 0,
  activeCount = 0,
  cancelledCount = 0,
  noShowCount = 0,
  unassignedCount = 0,
  onOpenInactive,
  onOpenUnassigned,
  onOpenStaffControls,
  onOpenEndDay,
  storeDay,
  startTill = 0,
  cashOnTill = 0,
}) {
  const inactiveCount = cancelledCount + noShowCount;


  return (
    <div className="border-t border-[#E9DED8] bg-[#FFF9F6]/95 px-5 py-2.5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatPill
            label="Active"
            value={activeCount}
            color="border-amber-200 bg-amber-50 text-amber-800"
          />

          <StatPill
            label="Total"
            value={totalBookings}
            color="border-[#E9DED8] bg-white text-[#4A3A34]"
          />

          <StatPill
            label="Inactive"
            value={inactiveCount}
            color="border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
            onClick={onOpenInactive}
          />

          <StatPill
            label="Unassigned"
            value={unassignedCount}
            color="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            onClick={onOpenUnassigned}
          />

          <StatPill
            label="Start Till"
            value={money(startTill)}
            color="border-[#E9DED8] bg-white text-[#4A3A34]"
          />

          <StatPill
            label="Cash Till"
            value={money(cashOnTill)}
            color="border-emerald-200 bg-emerald-50 text-emerald-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenStaffControls}
            className="rounded-full border border-[#E9DED8] bg-white px-5 py-2.5 text-sm font-semibold text-[#5B4B45] transition hover:border-[#D8B6BD] hover:bg-[#FFF5F7] hover:text-[#4A3A34] hover:shadow-sm"
          >
            Staff Controls
          </button>

          <button
            type="button"
            onClick={onOpenEndDay}
            className="rounded-full bg-[#4A3A34] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-[#5A4740] hover:shadow-md"
          >
            End of Day Report
          </button>
        </div>
      </div>
    </div>
  );
}