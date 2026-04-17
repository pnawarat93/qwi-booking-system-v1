"use client";

import { useEffect, useMemo, useState } from "react";
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
import StartDayModal from "@/app/components/StartDayModal";
import { useAuthStore } from "@/store/useAuthStore";
import { useStore } from "../StoreContext";
import { storeApiUrl } from "@/lib/storeApi";

function getTodayInTimeZone(timeZone = "Australia/Sydney") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

export default function StoreAdminPage() {
  const store = useStore();
  const storeTimeZone = store.timezone || "Australia/Sydney";
  const todayInStoreTz = getTodayInTimeZone(storeTimeZone);

  const [selectedDate, setSelectedDate] = useState(todayInStoreTz);

  const [trayData, setTrayData] = useState({
    bookings: [],
    activeBookings: [],
    inactiveBookings: [],
    unassignedBookings: [],
  });

  const [storeDay, setStoreDay] = useState(null);
  const [loadingStoreDay, setLoadingStoreDay] = useState(true);

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

  useEffect(() => {
    setSelectedDate((prev) => prev || getTodayInTimeZone(storeTimeZone));
  }, [storeTimeZone]);

  useEffect(() => {
    let isMounted = true;

    async function loadStoreDay() {
      if (!store?.slug || !selectedDate) return;

      try {
        setLoadingStoreDay(true);

        const res = await fetch(
          storeApiUrl(store.slug, `/store-day?date=${selectedDate}`)
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load store day");
        }

        if (isMounted) {
          setStoreDay(data?.store_day || null);
        }
      } catch (error) {
        console.error("Failed to load store day:", error);
        if (isMounted) {
          setStoreDay(null);
        }
      } finally {
        if (isMounted) {
          setLoadingStoreDay(false);
        }
      }
    }

    loadStoreDay();

    return () => {
      isMounted = false;
    };
  }, [store?.slug, selectedDate]);

  const dateLabel = useMemo(() => {
    const [year, month, day] = String(selectedDate).split("-").map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));

    return utcDate.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: storeTimeZone,
    });
  }, [selectedDate, storeTimeZone]);

  const unassignedCount = trayData.unassignedBookings?.length || 0;

  const isTodaySelected = selectedDate === todayInStoreTz;
  const isStoreDayStarted = Boolean(storeDay?.is_open);
  const shouldBlockTodayOps =
    isTodaySelected && !loadingStoreDay && !isStoreDayStarted;

  return (
    <main className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-white">
      <div className="sticky top-0 z-40 shrink-0 border-b bg-white">
        <StoreInfoBar
          shopName={store.name}
          shopPhone={store.phone}
          shopAddress={store.address}
        />
      </div>

      <div className="sticky top-[73px] z-30 shrink-0 border-b bg-white">
        <ScheduleToolbar
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          dateLabel={dateLabel}
          onOpenWalkIn={() => setShowWalkInModal(true)}
          onOpenNewBooking={() => setShowNewBookingModal(true)}
        />
      </div>

      {isTodaySelected && (
        <div className="shrink-0 border-b bg-[#FFF9F6] px-4 py-2 text-sm text-[#7A675F]">
          {loadingStoreDay ? (
            <span>Checking today&apos;s opening status...</span>
          ) : isStoreDayStarted ? (
            <span>
              Store day started · Start till: $
              {Number(storeDay?.start_till || 0).toFixed(2)}
            </span>
          ) : (
            <span className="font-medium text-amber-800">
              Start Day confirmation required for today before front-desk operations continue.
            </span>
          )}
        </div>
      )}

      {unassignedCount > 0 && (
        <div className="sticky top-[146px] z-20 shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3">
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

      <section className="relative min-h-0 flex-1 overflow-hidden">
        <ScheduleGrid
          selectedDate={selectedDate}
          onDataChange={setTrayData}
          refreshToken={gridRefreshToken}
          externalSelectedBooking={bookingToOpenFromUnassigned}
          onExternalBookingHandled={() => setBookingToOpenFromUnassigned(null)}
          storeSlug={store.slug}
        />

        {shouldBlockTodayOps && (
          <div className="absolute inset-0 z-40 bg-white/60 backdrop-blur-[1px]" />
        )}
      </section>

      <div className="shrink-0">
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
      </div>

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
            const res = await fetch(
              storeApiUrl(store.slug, `/booking/${booking.id}`),
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ status: "pending" }),
              }
            );

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

      <StartDayModal
        open={shouldBlockTodayOps}
        selectedDate={selectedDate}
        storeSlug={store.slug}
        storeName={store.name}
        existingStoreDay={storeDay}
        onStarted={(startedDay) => {
          setStoreDay(startedDay);
          setGridRefreshToken((prev) => prev + 1);
        }}
      />
    </main>
  );
}