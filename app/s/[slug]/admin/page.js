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

function formatClosedAt(value, timeZone = "Australia/Sydney") {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-AU", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ClosedDayState({ dateLabel, closedAtLabel, isTodaySelected }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
          ✓
        </div>

        <h2 className="mt-5 text-2xl font-semibold text-gray-900">
          Store closed for this day
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          All records for {dateLabel} have been finalized and saved.
        </p>

        {closedAtLabel ? (
          <p className="mt-3 text-sm font-medium text-green-700">
            Closed at {closedAtLabel}
          </p>
        ) : null}

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-left text-sm text-gray-600">
          <p className="font-semibold text-gray-900">This day is locked.</p>

          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Bookings can no longer be edited from front desk.</li>
            <li>Payments and refunds are locked after closing.</li>
            <li>Historical records are available from Owner Reports.</li>
          </ul>
        </div>

        <p className="mt-5 text-xs text-gray-400">
          Use the date selector above to move to another day.
          {isTodaySelected ? " A new day can be started tomorrow." : ""}
        </p>
      </div>
    </div>
  );
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
  const [endDaySummary, setEndDaySummary] = useState(null);
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

  async function loadEndDaySummary(dateToLoad) {
    if (!store?.slug || !dateToLoad) return null;

    try {
      const res = await fetch(
        storeApiUrl(
          store.slug,
          `/end-day-summary?date=${dateToLoad}&t=${Date.now()}`
        ),
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load end day summary");
      }

      setEndDaySummary(data);
      return data;
    } catch (error) {
      console.error("Failed to load end day summary:", error);
      setEndDaySummary(null);
      return null;
    }
  }

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

      await loadEndDaySummary(dateToLoad);

      return nextStoreDay;
    } catch (error) {
      console.error("Failed to load store day:", error);
      setStoreDay(null);
      setEndDaySummary(null);
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

        await loadEndDaySummary(selectedDate);
      } catch (error) {
        console.error("Failed to load store day:", error);

        if (isMounted) {
          setStoreDay(null);
          setEndDaySummary(null);
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

  const isStoreDayClosed =
    Boolean(storeDay?.closed_at) || storeDay?.is_open === false;

  const shouldBlockTodayOps =
    isTodaySelected &&
    !loadingStoreDay &&
    !storeDay &&
    !isStoreDayClosed;

  const closedAtLabel = formatClosedAt(storeDay?.closed_at, storeTimeZone);

  function refreshGridNow() {
    setGridRefreshToken((prev) => prev + 1);
  }

  async function refreshDayData() {
    await loadStoreDayForDate(selectedDate);
    await loadEndDaySummary(selectedDate);
    refreshGridNow();
  }

  async function handleStartedDay(startedStoreDay) {
    const nextStoreDay =
      startedStoreDay?.store_day || startedStoreDay || null;

    if (nextStoreDay) {
      setStoreDay(nextStoreDay);
    }

    await refreshDayData();
  }

  async function handleStaffControlsUpdated() {
    await loadEndDaySummary(selectedDate);
    refreshGridNow();
  }

  async function handleWalkInCreated() {
    setShowWalkInModal(false);
    await loadEndDaySummary(selectedDate);
    refreshGridNow();
  }

  async function handleNewBookingCreated() {
    setShowNewBookingModal(false);
    await loadEndDaySummary(selectedDate);
    refreshGridNow();
  }

  function guardClosedDay(action) {
    if (isStoreDayClosed) return;
    action();
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
          onOpenWalkIn={() =>
            guardClosedDay(() => setShowWalkInModal(true))
          }
          onOpenNewBooking={() =>
            guardClosedDay(() => setShowNewBookingModal(true))
          }
        />
      </div>

      {isStoreDayClosed ? (
        <div className="shrink-0 border-b border-green-200 bg-green-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-green-800">
              <span className="font-semibold">Store closed</span>
              <span className="ml-2 text-green-700">
                Today&apos;s records are finalized. Front desk actions are
                locked for this date.
              </span>
            </div>

            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-200">
              Finalized
            </span>
          </div>
        </div>
      ) : null}

      {!isStoreDayClosed && unassignedCount > 0 && (
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

      {!isStoreDayClosed && missingAssignedPaidCount > 0 && (
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
        {loadingStoreDay ? (
          <div className="flex h-full items-center justify-center bg-gray-50 text-sm text-gray-500">
            Loading day status...
          </div>
        ) : isStoreDayClosed ? (
          <ClosedDayState
            dateLabel={dateLabel}
            closedAtLabel={closedAtLabel}
            isTodaySelected={isTodaySelected}
          />
        ) : (
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
        )}
      </div>

      {!isStoreDayClosed && (
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
            startTill={
              endDaySummary?.startTill ??
              endDaySummary?.stats?.startTill ??
              storeDay?.start_till ??
              0
            }
            cashOnTill={
              endDaySummary?.cashOnTill ??
              endDaySummary?.stats?.cashOnTill ??
              storeDay?.start_till ??
              0
            }
          />
        </div>
      )}

      <StartDayModal
        open={shouldBlockTodayOps}
        selectedDate={selectedDate}
        storeSlug={store.slug}
        storeName={store.name}
        existingStoreDay={storeDay}
        onStarted={handleStartedDay}
      />

      <AddWalkInModal
        open={!isStoreDayClosed && showWalkInModal}
        selectedDate={selectedDate}
        onClose={() => setShowWalkInModal(false)}
        onCreated={handleWalkInCreated}
        storeSlug={store.slug}
      />

      <NewBookingModal
        open={!isStoreDayClosed && showNewBookingModal}
        selectedDate={selectedDate}
        onClose={() => setShowNewBookingModal(false)}
        onCreated={handleNewBookingCreated}
        storeSlug={store.slug}
      />

      <InactiveBookingsModal
        open={!isStoreDayClosed && showInactiveBookingsModal}
        bookings={trayData.inactiveBookings || []}
        onClose={() => setShowInactiveBookingsModal(false)}
      />

      <UnassignedBookingsModal
        open={!isStoreDayClosed && showUnassignedBookingsModal}
        bookings={trayData.unassignedBookings || []}
        onClose={() => setShowUnassignedBookingsModal(false)}
        onOpenBooking={(booking) => {
          setShowUnassignedBookingsModal(false);
          setBookingToOpenFromUnassigned(booking);
        }}
      />

      <StaffControlsModal
        open={!isStoreDayClosed && showStaffControlsModal}
        onClose={() => setShowStaffControlsModal(false)}
        selectedDate={selectedDate}
        storeSlug={store.slug}
        onUpdated={handleStaffControlsUpdated}
      />

      {showEndDayReport && !isStoreDayClosed && (
        <EndDayReport
          bookings={trayData.bookings || []}
          selectedDate={selectedDate}
          storeSlug={store.slug}
          onClose={() => setShowEndDayReport(false)}
          onFinish={() => {
            setShowEndDayReport(false);
            refreshDayData();
          }}
        />
      )}
    </main>
  );
}