import { AlarmCheck, Users, SunMedium } from "lucide-react";

export default function TypeBox(props) {
  const selectedStyles = props.selected
    ? "border-[#C87D87] bg-[#FDF1F3] shadow-[0_8px_24px_rgba(200,125,135,0.16)]"
    : "border-[#E8D8CC] bg-white hover:border-[#E5BCA9] hover:bg-[#FFF9F6]";

  if (props.type === "service") {
    return (
      <div
        className={`w-full rounded-3xl border p-4 shadow-sm transition ${selectedStyles}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-[#4A3A34] wrap-break-word">
              {props.title}
            </p>
            <p className="mt-1 text-sm text-[#7A675F]">
              Relaxing treatment option
            </p>
          </div>

          <div className="shrink-0 rounded-full bg-[#FBEAD6] px-2.5 py-1 text-xs font-medium text-[#6B7556]">
            <div className="flex items-center gap-1">
              <AlarmCheck size={14} />
              <span>{props.servtime}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <p className="text-sm text-[#7A675F]">Price</p>
          <p className="text-xl font-bold text-[#C87D87]">${props.price}</p>
        </div>
      </div>
    );
  }

  if (props.type === "numberppl") {
    return (
      <div
        className={`w-full rounded-3xl border p-4 shadow-sm transition sm:p-5 ${selectedStyles}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-[#4A3A34]">
              {props.pplnum} {props.pplnum === 1 ? "person" : "people"}
            </p>
            <p className="mt-1 text-sm text-[#7A675F]">Booking party size</p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FBEAD6]">
            <Users size={18} className="text-[#6B7556]" />
          </div>
        </div>
      </div>
    );
  }

  if (props.type === "time") {
    return (
      <div
        className={`w-full rounded-3xl border p-4 shadow-sm transition sm:p-5 ${selectedStyles}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-[#4A3A34]">
              {props.time}
            </p>
            <p className="mt-1 text-sm text-[#7A675F]">
              Preferred time of day
            </p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FBEAD6]">
            <SunMedium size={18} className="text-[#6B7556]" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}