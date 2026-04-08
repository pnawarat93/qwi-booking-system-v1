export default function BookingCard({
  customer_name,
  service_name,
  time,
  duration,
  status,
  compact = false,
}) {
  const statusStyles = {
    pending: "bg-blue-50 border-blue-200 text-blue-700",
    paid: "bg-green-50 border-green-200 text-green-700",
    cancelled: "bg-red-50 border-red-200 text-red-700",
    no_show: "bg-gray-100 border-gray-300 text-gray-600",
  };

  return (
    <div
      className={`flex h-full w-full flex-col justify-between overflow-hidden rounded-lg border shadow-sm transition ${
        statusStyles[status] || statusStyles.pending
      } ${compact ? "p-1.5" : "p-2"}`}
    >
      <div className="min-w-0">
        <p
          className={`truncate font-semibold text-gray-900 ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {customer_name}
        </p>

        <p
          className={`mt-1 text-gray-600 ${
            compact ? "truncate text-[11px]" : "line-clamp-2 text-xs"
          }`}
        >
          {service_name}
        </p>
      </div>

      <p
        className={`mt-2 font-medium text-gray-500 ${
          compact ? "text-[11px]" : "text-xs"
        }`}
      >
        {time} • {duration}m
      </p>
    </div>
  );
}