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
  storeFeatures,
  storeDay,
  startTill = 0,
  cashOnTill = 0,
  copy = {},
}) {
  const labels = {
    active: "Active",
    total: "Total",
    inactive: "Inactive",
    unassigned: "Unassigned",
    startTill: "Start Till",
    cashTill: "Cash Till",
    staffControls: "Staff Controls",
    endOfDayReport: "End of Day Report",
    ...copy,
  };
  const inactiveCount = cancelledCount + noShowCount;
  const financialControlsEnabled =
    storeFeatures?.FINANCIAL_CONTROLS === true;
  const isLiteStore =
    storeFeatures?.LITE_MODE === true ||
    !financialControlsEnabled;


  return (
    <div className="border-t border-[#E9DED8] bg-[#FFF9F6]/95 px-5 py-2.5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatPill
            label={labels.active}
            value={activeCount}
            color="border-amber-200 bg-amber-50 text-amber-800"
          />

          <StatPill
            label={labels.total}
            value={totalBookings}
            color="border-[#E9DED8] bg-white text-[#4A3A34]"
          />

          <StatPill
            label={labels.inactive}
            value={inactiveCount}
            color="border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
            onClick={onOpenInactive}
          />

          <StatPill
            label={labels.unassigned}
            value={unassignedCount}
            color="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            onClick={onOpenUnassigned}
          />

          {!isLiteStore ? (
            <>
              <StatPill
                label={labels.startTill}
                value={money(startTill)}
                color="border-[#E9DED8] bg-white text-[#4A3A34]"
              />

              <StatPill
                label={labels.cashTill}
                value={money(cashOnTill)}
                color="border-emerald-200 bg-emerald-50 text-emerald-800"
              />
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenStaffControls}
            className="rounded-full border border-[#E9DED8] bg-white px-5 py-2.5 text-sm font-semibold text-[#5B4B45] transition hover:border-[#D8B6BD] hover:bg-[#FFF5F7] hover:text-[#4A3A34] hover:shadow-sm"
          >
            {labels.staffControls}
          </button>

          <button
            type="button"
            onClick={onOpenEndDay}
            className="rounded-full bg-[#4A3A34] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-[#5A4740] hover:shadow-md"
          >
            {labels.endOfDayReport}
          </button>
        </div>
      </div>
    </div>
  );
}
