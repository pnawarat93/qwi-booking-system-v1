import { Sparkles, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <section id="shopdetail">
      <div className="overflow-hidden rounded-[1.75rem] border border-[#E8D8CC] bg-white/70 shadow-[0_10px_40px_rgba(180,140,120,0.12)] backdrop-blur-sm sm:rounded-4xl">
        <div className="bg-linear-to-br from-[#FBEAD6]/90 via-[#FFF9F6] to-[#F0C4CB]/45 px-5 py-6 sm:px-8 sm:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full min-w-0">
              <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-[#E5BCA9]/60 bg-white/70 px-3 py-1 text-xs text-[#7A675F] shadow-sm sm:text-sm">
                <Sparkles className="h-4 w-4 shrink-0 text-[#C87D87]" />
                <span className="truncate">Premium Thai wellness experience</span>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-[#4A3A34] sm:text-4xl lg:text-5xl">
                Wellness Thai Massage
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#7A675F] sm:text-base sm:leading-7 lg:text-lg">
                Relaxing treatments in a calm, elegant space. Book your service
                in just a few steps.
              </p>

              <div className="mt-5 inline-flex max-w-full items-center rounded-full border border-[#E5BCA9]/50 bg-[#FBEAD6]/80 px-4 py-2 text-sm text-[#6B7556]">
                <span className="wrap-break-word">123 Pitts Street, Sydney</span>
              </div>
            </div>

            <div className="w-full lg:max-w-[320px]">
              <div className="rounded-3xl border border-[#E8D8CC] bg-white/85 p-4 shadow-[0_8px_24px_rgba(160,120,110,0.10)] sm:rounded-[1.75rem] sm:p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FBEAD6]">
                    <Clock className="h-5 w-5 text-[#6B7556]" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[#4A3A34] sm:text-lg">
                      Open Now
                    </p>
                    <p className="text-sm text-[#7A675F]">
                      Today’s hours available
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#F0E2D8] bg-[#FFF9F6] px-4 py-3 text-sm text-[#6B7556]">
                  From 10:00 AM to 8:00 PM
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-white/50 px-5 py-5 sm:gap-4 sm:px-8 sm:py-6 md:flex-row md:justify-center">
          <Link href="/booking" className="w-full md:w-auto">
            <button className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C87D87] px-6 py-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:text-base md:min-w-[250px]">
              Start booking a service
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
          </Link>

          <Link href="/availability" className="w-full md:w-auto">
            <button className="w-full rounded-2xl border border-[#D9C5B8] bg-[#FFF9F6] px-6 py-4 text-sm font-semibold text-[#6B7556] shadow-sm transition hover:bg-[#FBEAD6]/60 sm:text-base md:min-w-[250px]">
              Check availability
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}