function formatTimeRange(startTime, duration) {
  if (!startTime) return "--:-- - --:--";

  const safeTime = String(startTime).substring(0, 5);
  const [hours, minutes] = safeTime.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return `${safeTime} - --:--`;
  }

  const startTotal = hours * 60 + minutes;
  const endTotal = startTotal + (Number(duration) || 30);

  const endHours = Math.floor(endTotal / 60);
  const endMinutes = endTotal % 60;

  const endTime = `${String(endHours).padStart(2, "0")}:${String(
    endMinutes
  ).padStart(2, "0")}`;

  return `${safeTime} - ${endTime}`;
}

export default function BookingCard({
  customer_name,
  customer_phone,
  service_name,
  time,
  duration,
  status,
  notes,
  compact = false,
  is_staff_requested = false,
  requested_staff_name = "",
  is_walk_in = false,
  is_unassigned = false,
}) {
  const statusStyles = {
    pending: {
      card:
        "border-amber-200 bg-gradient-to-br from-amber-50 to-[#FFF9F6]",
      badge:
        "border-amber-200 bg-amber-100 text-amber-800",
      accent: "bg-amber-400",
      label: "Pending",
    },

    paid: {
      card:
        "border-emerald-200 bg-gradient-to-br from-emerald-50 to-[#F7FBF8]",
      badge:
        "border-emerald-200 bg-emerald-100 text-emerald-800",
      accent: "bg-emerald-500",
      label: "Paid",
    },

    completed: {
      card:
        "border-teal-200 bg-gradient-to-br from-teal-50 to-[#F7FBF8]",
      badge:
        "border-teal-200 bg-teal-100 text-teal-800",
      accent: "bg-teal-500",
      label: "Completed",
    },

    cancelled: {
      card:
        "border-rose-200 bg-gradient-to-br from-rose-50 to-[#FFF8F8] opacity-85",
      badge:
        "border-rose-200 bg-rose-100 text-rose-700",
      accent: "bg-rose-400",
      label: "Cancelled",
    },

    no_show: {
      card:
        "border-slate-300 bg-gradient-to-br from-slate-100 to-slate-50 opacity-85",
      badge:
        "border-slate-300 bg-slate-200 text-slate-700",
      accent: "bg-slate-400",
      label: "No-show",
    },
  };

  const currentStyle = statusStyles[status] || statusStyles.pending;
  const timeRange = formatTimeRange(time, duration);

  return (
    <div
      className={`group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[22px] border shadow-[0_6px_18px_rgba(0,0,0,0.06)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)] ${
        currentStyle.card
      } ${is_unassigned ? "ring-2 ring-amber-300" : ""} ${
        compact ? "p-2" : "p-3"
      }`}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1.5 ${currentStyle.accent}`}
      />

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={`truncate font-black tracking-tight text-[#4A3A34] ${
                compact ? "text-xs" : "text-[15px]"
              }`}
            >
              {timeRange}
            </p>

            <p
              className={`mt-1 truncate font-semibold text-[#6B5B55] ${
                compact ? "text-[11px]" : "text-xs"
              }`}
            >
              {service_name} • {duration}m
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 font-bold tracking-wide shadow-sm ${
              compact ? "text-[9px]" : "text-[10px]"
            } ${currentStyle.badge}`}
          >
            {currentStyle.label}
          </span>
        </div>

        <div className="mt-3 rounded-2xl bg-white/70 px-3 py-2 backdrop-blur-sm">
          <p
            className={`truncate font-semibold text-gray-900 ${
              compact ? "text-[11px]" : "text-sm"
            }`}
          >
            {customer_name}
          </p>

          {customer_phone ? (
            <p
              className={`mt-0.5 truncate text-gray-500 ${
                compact ? "text-[10px]" : "text-[11px]"
              }`}
            >
              {customer_phone}
            </p>
          ) : null}
        </div>

        {notes ? (
          <div className="mt-2 rounded-xl border border-black/5 bg-black/[0.03] px-2.5 py-2">
            <p
              className={`truncate text-gray-600 ${
                compact ? "text-[10px]" : "text-[11px]"
              }`}
            >
              {notes}
            </p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {is_walk_in ? (
            <span
              className={`rounded-full bg-[#E9DED8] px-2.5 py-1 font-semibold text-[#6B4F45] ${
                compact ? "text-[9px]" : "text-[10px]"
              }`}
            >
              Walk-in
            </span>
          ) : null}

          {is_unassigned ? (
            <span
              className={`rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 ${
                compact ? "text-[9px]" : "text-[10px]"
              }`}
            >
              Unassigned
            </span>
          ) : null}

          {is_staff_requested && requested_staff_name ? (
            <span
              className={`truncate rounded-full bg-[#F5E5D8] px-2.5 py-1 font-semibold text-[#8B5E3C] ${
                compact ? "text-[9px]" : "text-[10px]"
              }`}
            >
              Requested: {requested_staff_name}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
