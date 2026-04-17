import { Sparkles } from "lucide-react";

export default function Header({ storeName }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#E8D8CC]/80 bg-[#FFF9F6]/80 backdrop-blur-xl">
      <div className="mx-auto flex w-[92%] max-w-5xl items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F0C4CB]/45 border border-[#E5BCA9]/50 shadow-sm">
            <Sparkles className="h-5 w-5 text-[#C87D87]" />
          </div>

          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-[0.18em] text-[#4A3A34]">
              {storeName || "JONG"}
            </span>
            <span className="text-xs text-[#7A675F]">
              Elegant booking experience powered by Qwi
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}