import { CheckCircle2 } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/70 backdrop-blur">
      <div className="mx-auto w-[92%] max-w-5xl py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="text-emerald-500" size={22} />
          <span className="font-semibold text-slate-800">FLOW</span>
          <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            Booking made easy!
          </span>
        </div>

        <button className="rounded-xl bg-emerald-500 px-4 py-2 text-white font-medium shadow-sm hover:bg-emerald-600 transition">
          Join Now
        </button>
      </div>
    </header>
  );
}