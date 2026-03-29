"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

import StoreInfoBar from "../components/StoreInfoBar";
import ScheduleToolbar from "../components/ScheduleToolbar";
import ScheduleGrid from "../components/ScheduleGrid";
import BottomDayTray from "../components/BottomDayTray";
import EndDayReport from "../components/EndDayReport";
import AddWalkInModal from "../components/AddWalkInModal";
import InactiveBookingsModal from "../components/InactiveBookingsModal";
import { useAuthStore } from "../store/useAuthStore";

export default function AdminPage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [trayData, setTrayData] = useState({
    bookings: [],
    activeBookings: [],
    inactiveBookings: [],
  });

  const [showEndDayReport, setShowEndDayReport] = useState(false);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [showInactiveBookingsModal, setShowInactiveBookingsModal] =
    useState(false);
  const [gridRefreshToken, setGridRefreshToken] = useState(0);

  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  return (
    <main className="flex h-full min-h-0 flex-col">
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
          onOpenWalkIn={() => setShowWalkInModal(true)}
          onOpenNewBooking={() => {
            console.log("Open new booking modal later");
          }}
        />
      </div>

      <section className="min-h-0 flex-1 overflow-hidden">
        <ScheduleGrid
          selectedDate={selectedDate}
          onDataChange={setTrayData}
          refreshToken={gridRefreshToken}
        />
      </section>

      <BottomDayTray
        selectedDate={selectedDate}
        bookings={trayData.bookings}
        activeBookings={trayData.activeBookings}
        inactiveBookings={trayData.inactiveBookings}
        onOpenEndDay={() => setShowEndDayReport(true)}
        onOpenStaffControls={() => {
          console.log("Open staff controls later");
        }}
        onOpenInactiveBookings={() => {
          setShowInactiveBookingsModal(true);
        }}
      />

      {showEndDayReport && (
        <EndDayReport
          bookings={trayData.bookings}
          onClose={() => setShowEndDayReport(false)}
          onFinish={() => setShowEndDayReport(false)}
        />
      )}

      <AddWalkInModal
        open={showWalkInModal}
        selectedDate={selectedDate}
        onClose={() => setShowWalkInModal(false)}
        onCreated={() => {
          setGridRefreshToken((prev) => prev + 1);
        }}
      />

      <InactiveBookingsModal
        open={showInactiveBookingsModal}
        bookings={trayData.inactiveBookings}
        onClose={() => setShowInactiveBookingsModal(false)}
        onRecover={async (booking) => {
          try {
            const res = await fetch(`/api/booking/${booking.id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status: "pending" }),
            });

            if (!res.ok) {
              throw new Error("Failed to recover booking");
            }

            setGridRefreshToken((prev) => prev + 1);
          } catch (error) {
            console.error(error);
            alert("Could not recover booking.");
          }
        }}
      />
    </main>
  );
}