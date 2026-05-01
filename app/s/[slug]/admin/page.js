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

import useAuthStore from "@/store/useAuthStore";
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
    missingAssignedPaidBookings: [],
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

  async function loadStoreDayForDate(dateToLoad) {
    if (!store?.slug || !dateToLoad) return null;

    setLoadingStoreDay(true);

    try {
      const res = await fetch(
        storeApiUrl(
          store.slug,
          `/store-day?date=${dateToLoad}&t=${Date.now()}`
        ),
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load store day");
      }

      const nextStoreDay = data?.store_day || null;
      setStoreDay(nextStoreDay);

      return nextStoreDay;
    } catch (error) {
      console.error("Failed to load store day:", error);
      setStoreDay(null);
      return null;
    } finally {
      setLoadingStoreDay(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function run() {
      if (!store?.slug || !selectedDate) return;

      setLoadingStoreDay(true);

      try {
        const res = await fetch(
          storeApiUrl(
            store.slug,
            `/store-day?date=${selectedDate}&t=${Date.now()}`
          ),
          {
            cache: "no-store",
          }
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

    run();

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

  const missingAssignedPaidCount =
    trayData.missingAssignedPaidBookings?.length || 0;

  const isTodaySelected = selectedDate === todayInStoreTz;
  const isStoreDayStarted = Boolean(storeDay?.is_open);
  const shouldBlockTodayOps =
    isTodaySelected && !loadingStoreDay && !isStoreDayStarted;

  function refreshGridNow() {
    setGridRefreshToken((prev) => prev + 1);
  }

  async function handleStartedDay(startedStoreDay) {
    const nextStoreDay =
      startedStoreDay?.store_day || startedStoreDay || null;

    if (nextStoreDay) {
      setStoreDay(nextStoreDay);
    }

    await loadStoreDayForDate(selectedDate);
    refreshGridNow();
  }

  function handleStaffControlsUpdated() {
    refreshGridNow();
  }

  function handleWalkInCreated() {
    setShowWalkInModal(false);
    refreshGridNow();
  }

  function handleNewBookingCreated() {
    setShowNewBookingModal(false);
    refreshGridNow();
  }

  return (
    <main className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-white">
      <div className="sticky top-0 z-40 shrink-0 border-b bg-white">
        <StoreInfoBar
          shopName={store.name}
          shopPhone={store.phone}
          shopAddress={store.address}
          ownerHref={`/s/${store.slug}/owner-login`}
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

      {unassignedCount > 0 && (
        <div className="sticky top-[146px] z-20 shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-amber-800">
              <span className="font-semibold">
                {unassignedCount} booking
                {unassignedCount > 1 ? "s" : ""} need reassignment
              </span>
              <span className="ml-2 text-amber-700">
                These are pending bookings without an active staff.
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowUnassignedBookingsModal(true)}
              className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              Review unassigned
            </button>
          </div>
        </div>
      )}

      {missingAssignedPaidCount > 0 && (
        <div className="sticky top-[146px] z-20 shrink-0 border-b border-blue-200 bg-blue-50 px-4 py-3">
          <div className="text-sm text-blue-800">
            <span className="font-semibold">
              {missingAssignedPaidCount} paid booking
              {missingAssignedPaidCount > 1 ? "s are" : " is"} linked to staff
              not on today&apos;s grid
            </span>
            <span className="ml-2 text-blue-700">
              Check if the service is still ongoing or staff has changed.
            </span>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        <ScheduleGrid
          selectedDate={selectedDate}
          onDataChange={setTrayData}
          refreshToken={gridRefreshToken}
          externalSelectedBooking={bookingToOpenFromUnassigned}
          onExternalBookingHandled={() =>
            setBookingToOpenFromUnassigned(null)
          }
          storeSlug={store.slug}
        />
      </div>

      <div className="shrink-0 border-t bg-white">
        <BottomDayTray
          selectedDate={selectedDate}
          totalBookings={trayData.bookings?.length || 0}
          activeCount={trayData.activeBookings?.length || 0}
          cancelledCount={
            trayData.inactiveBookings?.filter(
              (booking) => booking.status?.toLowerCase() === "cancelled"
            ).length || 0
          }
          noShowCount={
            trayData.inactiveBookings?.filter(
              (booking) => booking.status?.toLowerCase() === "no_show"
            ).length || 0
          }
          unassignedCount={trayData.unassignedBookings?.length || 0}
          onOpenInactive={() => setShowInactiveBookingsModal(true)}
          onOpenUnassigned={() => setShowUnassignedBookingsModal(true)}
          onOpenStaffControls={() => setShowStaffControlsModal(true)}
          onOpenEndDay={() => setShowEndDayReport(true)}
          storeDay={storeDay}
        />
      </div>

      <StartDayModal
        open={shouldBlockTodayOps}
        selectedDate={selectedDate}
        storeSlug={store.slug}
        storeName={store.name}
        existingStoreDay={storeDay}
        onStarted={handleStartedDay}
      />

      <AddWalkInModal
        open={showWalkInModal}
        selectedDate={selectedDate}
        onClose={() => setShowWalkInModal(false)}
        onCreated={handleWalkInCreated}
        storeSlug={store.slug}
      />

      <NewBookingModal
        open={showNewBookingModal}
        selectedDate={selectedDate}
        onClose={() => setShowNewBookingModal(false)}
        onCreated={handleNewBookingCreated}
        storeSlug={store.slug}
      />

      <InactiveBookingsModal
        open={showInactiveBookingsModal}
        bookings={trayData.inactiveBookings || []}
        onClose={() => setShowInactiveBookingsModal(false)}
      />

      <UnassignedBookingsModal
        open={showUnassignedBookingsModal}
        bookings={trayData.unassignedBookings || []}
        onClose={() => setShowUnassignedBookingsModal(false)}
        onOpenBooking={(booking) => {
          setShowUnassignedBookingsModal(false);
          setBookingToOpenFromUnassigned(booking);
        }}
      />

      <StaffControlsModal
        open={showStaffControlsModal}
        onClose={() => setShowStaffControlsModal(false)}
        selectedDate={selectedDate}
        storeSlug={store.slug}
        onUpdated={handleStaffControlsUpdated}
      />

      {showEndDayReport && (
        <EndDayReport
          bookings={trayData.bookings || []}
          selectedDate={selectedDate}
          storeSlug={store.slug}
          onClose={() => setShowEndDayReport(false)}
          onFinish={() => {
            setShowEndDayReport(false);
            loadStoreDayForDate(selectedDate);
            refreshGridNow();
          }}
        />
      )}
    </main>
  );
}