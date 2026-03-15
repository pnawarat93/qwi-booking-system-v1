export default function BookingCard({
  customer_name,
  service_name,
  time,
  duration,
  status,
}) {
  const statusStyles = {
    confirmed: "bg-blue-50 border-blue-200 text-blue-700",
    "in-progress": "bg-amber-50 border-amber-200 text-amber-700",
    done: "bg-green-50 border-green-200 text-green-700",
  };

  return (
    <div
      className={`w-full rounded-lg border p-2 shadow-sm ${
        statusStyles[status] || statusStyles.confirmed
      }`}
    >
      <p className="text-sm font-semibold text-gray-900">
        {customer_name}
      </p>

      <p className="mt-1 text-xs text-gray-600">
        {service_name}
      </p>

      <p className="mt-2 text-xs font-medium text-gray-500">
        {time} • {duration} mins
      </p>
    </div>
  );
}