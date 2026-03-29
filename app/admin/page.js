"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

import StoreInfoBar from "../components/StoreInfoBar";
import ScheduleToolbar from "../components/ScheduleToolbar";
import ScheduleGrid from "../components/ScheduleGrid";
import { useAuthStore } from "../store/useAuthStore";
import EndDayReport from "../components/EndDayReport";

export default function AdminPage() {
  const [showEndDayReport, setShowEndDayReport] = useState(false);
  const [todayBooking, setTodayBooking] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  return (
    <main className="flex h-full flex-col">
      <p className="p-4 text-sm text-gray-500">
        Logged in as <strong>{user?.name}</strong>
      </p>
      <button
        onClick={() => {
          setShowEndDayReport(true);
          fetch(`/api/booking?date=${selectedDate}`)
            .then((res) => res.json())
            .then((data) => setTodayBooking(data))
            .catch(() => setTodayBooking([]));
        }}
        className="mx-4 mb-4 self-start rounded-xl bg-[#C87D87] py-2 px-4 text-sm font-semibold text-white"
      >
        End Day Report
      </button>
      <div className="shrink-0 border-b bg-white">
        <StoreInfoBar
          shopName="Wellness Thai Massage"
          shopPhone="02 1234 5678"
          shopAddress="123 Pitt Street, Sydney"
        />
      </div>

      <div className="shrink-0 border-b bg-white">
        <ScheduleToolbar
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          dateLabel={format(new Date(selectedDate), "EEEE, d MMMM yyyy")}
        />
      </div>

      <section className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <ScheduleGrid selectedDate={selectedDate} />
        </div>
        {showEndDayReport && (
          <EndDayReport
            bookings={todayBooking}
            onClose={() => setShowEndDayReport(false)}
            onFinish={() => setShowEndDayReport(false)}
          />
        )}
      </section>
    </main>
  );
}