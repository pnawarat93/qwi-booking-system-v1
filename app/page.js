import { Sparkles, Clock } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <>

      <section id="shopdetail">
        <div className="border-2 rounded-3xl">

          <div className="flex items-center justify-between gap-6 py-10 px-6">

            <div className="w-full min-h-60 flex flex-col justify-center gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-10 text-[#6b9161]" />
                <h1 className="text-5xl">Wellness Thai Massage</h1>
              </div>
              <h2 className="text-2xl">123 Pitts street, Sydney</h2>
            </div>

            <div className="w-[320px]">
              <div className="bg-white shadow-md rounded-2xl flex flex-col items-center p-5 gap-2">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="text-yellow-400" />
                  <p className="font-semibold text-2xl">Open Now</p>
                </div>
                <p className="text-sm text-gray-600">From 10:00 AM to 8:00 PM</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center items-center gap-6 py-8 rounded-b-3xl">
            <Link href="/booking">
              <button className="bg-[#E8F5BD] text-[#6b9161] font-semibold px-6 py-2 rounded-2xl hover:bg-gray-100 border-2">
                Start booking a service
              </button>
            </Link>

            <Link href="/availability">
              <button className="bg-white text-[#6b9161] font-semibold px-6 py-2 rounded-2xl hover:bg-gray-100 border-2">
                Check availability
              </button>
            </Link>
          </div>
        </div>
      </section>

    </>
  );
}