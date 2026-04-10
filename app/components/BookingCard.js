function formatTimeRange(startTime, duration) {
  if (!startTime) return "--:-- - --:--";

  const safeTime = startTime.substring(0, 5);
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
}) {
  const statusStyles = {
    pending: "bg-blue-50 border-blue-200 text-blue-700",
    paid: "bg-green-50 border-green-200 text-green-700",
    cancelled: "bg-red-50 border-red-200 text-red-700",
    no_show: "bg-gray-100 border-gray-300 text-gray-600",
  };

  const timeRange = formatTimeRange(time, duration);

  return (
    <div
      className={`flex h-full w-full flex-col justify-between overflow-hidden rounded-lg border shadow-sm transition ${
        statusStyles[status] || statusStyles.pending
      } ${compact ? "p-1.5" : "p-2"}`}
    >
      <div className="min-w-0">
        <p
          className={`truncate font-bold text-gray-900 ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {timeRange}
        </p>

        <p
          className={`mt-1 truncate text-gray-800 ${
            compact ? "text-[11px] font-medium" : "text-xs font-semibold"
          }`}
        >
          {service_name} • {duration}m
        </p>

        {notes ? (
          <p
            className={`mt-1 truncate text-gray-500 ${
              compact ? "text-[10px]" : "text-[11px]"
            }`}
          >
            Note: {notes}
          </p>
        ) : null}

        <p
          className={`mt-1 truncate text-gray-600 ${
            compact ? "text-[10px]" : "text-[11px]"
          }`}
        >
          {customer_name}
          {customer_phone ? ` • ${customer_phone}` : ""}
        </p>

        {is_staff_requested && requested_staff_name ? (
          <p
            className={`mt-1 truncate font-medium text-amber-700 ${
              compact ? "text-[10px]" : "text-[11px]"
            }`}
          >
            Requested staff: {requested_staff_name}
          </p>
        ) : null}
      </div>
    </div>
  );
}