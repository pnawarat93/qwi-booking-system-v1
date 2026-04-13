"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StoreInfoBar from "@/app/components/StoreInfoBar";
import ScheduleToolbar from "@/app/components/ScheduleToolbar";
import ScheduleGrid from "@/app/components/ScheduleGrid";
import BottomDayTray from "@/app/components/BottomDayTray";
import EndDayReport from "@/app/components/EndDayReport";
import AddWalkInModal from "@/app/components/AddWalkInModal";
import NewBookingModal from "@/app/components/NewBookingModal";
import InactiveBookingsModal from "@/app/components/InactiveBookingsModal";
import UnassignedBookingsModal from "@/app/components/UnassignedBookingsModal";
import StaffControlsModal from "@/app/components/StaffControlsModal";
import { useAuthStore } from "@/store/useAuthStore";
import { useStore } from "../StoreContext";
import { storeApiUrl } from "@/lib/storeApi";
import { getSydneyTodayDate } from "@/lib/sydneyDate";

export default function StoreAdminPage() {
  const store = useStore();
  const [selectedDate, setSelectedDate] = useState(getSydneyTodayDate());

  const [trayData, setTrayData] = useState({
    bookings: [],
    activeBookings: [],
    inactiveBookings: [],
    unassignedBookings: [],
  });

  const [showEndDayReport, setShowEndDayReport] = useState(false);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [showInactiveBookingsModal, setShowInactiveBookingsModal] =
    useState(false);
  const [showUnassignedBookingsModal, setShowUnassignedBookingsModal] =
    useState(false);
  const [showStaffControlsModal, setShowStaffControlsModal] = useState(false);
  const [gridRefreshToken, setGridRefreshToken] = useState(0);
  const [bookingToOpenFromUnassigned, setBookingToOpenFromUnassigned] =
    useState(null);

  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user || user.store_slug !== store.slug) {
      router.push(`/s/${store.slug}/login`);
    }
  }, [user, router, store.slug]);

  const dateLabel = (() => {
    const [year, month, day] = String(selectedDate).split("-").map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));

    return utcDate.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: store.timezone || "Australia/Sydney",
    });
  })();

  const unassignedCount = trayData.unassignedBookings?.length || 0;

  return (
    <main className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b bg-white">
        <StoreInfoBar
          shopName={store.name}
          shopPhone={store.phone}
          shopAddress={store.address}
        />
      </div>

      <div className="shrink-0 border-b bg-white">
        <ScheduleToolbar
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          dateLabel={dateLabel}
          onOpenWalkIn={() => setShowWalkInModal(true)}
          onOpenNewBooking={() => setShowNewBookingModal(true)}
        />
      </div>

      {unassignedCount > 0 && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-amber-800">
              <span className="font-semibold">
                {unassignedCount} booking
                {unassignedCount > 1 ? "s" : ""} need reassignment
              </span>
              <span className="ml-2 text-amber-700">
                These bookings belong to staff who are not on today&apos;s shift.
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowUnassignedBookingsModal(true)}
              className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
            >
              Review unassigned
            </button>
          </div>
        </div>
      )}

      <section className="min-h-0 flex-1 overflow-hidden">
        <ScheduleGrid
          selectedDate={selectedDate}
          onDataChange={setTrayData}
          refreshToken={gridRefreshToken}
          externalSelectedBooking={bookingToOpenFromUnassigned}
          onExternalBookingHandled={() => setBookingToOpenFromUnassigned(null)}
          storeSlug={store.slug}
        />
      </section>

      <BottomDayTray
        selectedDate={selectedDate}
        bookings={trayData.bookings}
        activeBookings={trayData.activeBookings}
        inactiveBookings={trayData.inactiveBookings}
        onOpenEndDay={() => setShowEndDayReport(true)}
        onOpenStaffControls={() => {
          setShowStaffControlsModal(true);
        }}
        onOpenInactiveBookings={() => {
          setShowInactiveBookingsModal(true);
        }}
      />

      {showEndDayReport && (
        <EndDayReport
          bookings={trayData.bookings}
          selectedDate={selectedDate}
          onClose={() => setShowEndDayReport(false)}
          onFinish={() => setShowEndDayReport(false)}
          storeSlug={store.slug}
        />
      )}

      <AddWalkInModal
        open={showWalkInModal}
        selectedDate={selectedDate}
        onClose={() => setShowWalkInModal(false)}
        onCreated={() => {
          setGridRefreshToken((prev) => prev + 1);
        }}
        storeSlug={store.slug}
      />

      <NewBookingModal
        open={showNewBookingModal}
        selectedDate={selectedDate}
        onClose={() => setShowNewBookingModal(false)}
        onCreated={() => {
          setShowNewBookingModal(false);
          setGridRefreshToken((prev) => prev + 1);
        }}
        storeSlug={store.slug}
      />

      <InactiveBookingsModal
        open={showInactiveBookingsModal}
        bookings={trayData.inactiveBookings}
        onClose={() => setShowInactiveBookingsModal(false)}
        onRecover={async (booking) => {
          try {
            const res = await fetch(storeApiUrl(store.slug, `/booking/${booking.id}`), {
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

      <UnassignedBookingsModal
        open={showUnassignedBookingsModal}
        bookings={trayData.unassignedBookings}
        onClose={() => setShowUnassignedBookingsModal(false)}
        onOpenBooking={(booking) => {
          setShowUnassignedBookingsModal(false);
          setBookingToOpenFromUnassigned(booking);
        }}
      />

      <StaffControlsModal
        open={showStaffControlsModal}
        selectedDate={selectedDate}
        onClose={() => setShowStaffControlsModal(false)}
        onUpdated={() => {
          setGridRefreshToken((prev) => prev + 1);
        }}
        storeSlug={store.slug}
      />
    </main>
  );
}
