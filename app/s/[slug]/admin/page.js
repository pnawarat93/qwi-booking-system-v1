"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  ClipboardList,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

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
import { getStoreFeatures } from "@/lib/config/features";
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

function NotStartedDayState({ dateLabel, onStartDay }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
          +
        </div>

        <h2 className="mt-5 text-2xl font-semibold text-gray-900">
          Day not started
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          Start this day before taking bookings or closing the day.
        </p>

        <p className="mt-3 text-sm font-medium text-amber-700">
          {dateLabel}
        </p>

        <button
          type="button"
          onClick={onStartDay}
          className="mt-6 rounded-2xl bg-[#4F6A55] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#435B49] hover:shadow-md"
        >
          Start Day
        </button>
      </div>
    </div>
  );
}

function SidebarButton({ title, icon: Icon, onClick, accent = false }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-sm transition ${
        accent
          ? "border-[#4F6A55] bg-[#4F6A55] text-white shadow-sm hover:bg-[#435B49]"
          : "border-[#E3D6C8] bg-white text-[#4F6A55] hover:border-[#BFCDBF] hover:bg-[#E8EFE8]"
      }`}
    >
      <Icon size={18} />
    </button>
  );
}

export default function StoreAdminPage() {
  const store = useStore();
  const storeFeatures = getStoreFeatures(store);
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
  const [endDayGuardMessage, setEndDayGuardMessage] = useState("");
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [showInactiveBookingsModal, setShowInactiveBookingsModal] =
    useState(false);
  const [showUnassignedBookingsModal, setShowUnassignedBookingsModal] =
    useState(false);
  const [showStaffControlsModal, setShowStaffControlsModal] = useState(false);
  const [showStartDayModal, setShowStartDayModal] = useState(false);

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
    setEndDayGuardMessage("");
    setShowEndDayReport(false);
  }, [selectedDate]);

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
    Boolean(storeDay?.closed_at);

  const isStoreDayStarted = Boolean(storeDay);

  const shouldBlockTodayOps =
    isTodaySelected &&
    !loadingStoreDay &&
    !storeDay &&
    !isStoreDayClosed;

  const canStartSelectedDay =
    !loadingStoreDay && !isStoreDayStarted && !isStoreDayClosed;

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

    setShowStartDayModal(false);

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

  function handleOpenEndDay() {
    if (!isTodaySelected && !storeDay) {
      setShowEndDayReport(false);
      setEndDayGuardMessage(
        "This date was never opened. Start Day must be created before End Day can be finalized."
      );
      return;
    }

    setEndDayGuardMessage("");
    setShowEndDayReport(true);
  }

  return (
    <main className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#F6F1EA] p-3">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-[#E3D6C8] bg-[#FFFDF9] shadow-[0_18px_48px_rgba(47,41,38,0.12)]">
        <div className="sticky top-0 z-40 shrink-0 border-b border-[#E3D6C8] bg-[#FFFDF9]/95">
          <StoreInfoBar
            shopName={store.name}
            shopPhone={store.phone}
            shopAddress={store.address}
            ownerHref={`/s/${store.slug}/owner-login`}
          />
        </div>

        <div className="sticky top-[73px] z-30 shrink-0 border-b border-[#E3D6C8] bg-[#FFFDF9]/95">
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

        <div className="flex min-h-0 flex-1 bg-[#FFFDF9]">
          <aside className="flex w-16 shrink-0 flex-col items-center justify-between border-r border-[#E3D6C8] bg-[#F8F3EC] px-2 py-4">
            <div className="flex flex-col items-center gap-3">
              <SidebarButton
                title="New Booking"
                icon={CalendarPlus}
                accent
                onClick={() =>
                  guardClosedDay(() => setShowNewBookingModal(true))
                }
              />

              <SidebarButton
                title="Add Walk-in"
                icon={ClipboardList}
                onClick={() =>
                  guardClosedDay(() => setShowWalkInModal(true))
                }
              />

              <SidebarButton
                title="Staff Controls"
                icon={SlidersHorizontal}
                onClick={() =>
                  guardClosedDay(() => setShowStaffControlsModal(true))
                }
              />
            </div>

            <SidebarButton
              title="Owner Dashboard"
              icon={ShieldCheck}
              onClick={() => router.push(`/s/${store.slug}/owner-login`)}
            />
          </aside>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {isStoreDayClosed ? (
              <div className="shrink-0 border-b border-[#BFCDBF] bg-[#E8EFE8] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-[#3F5747]">
                    <span className="font-semibold">Store closed</span>
                    <span className="ml-2 text-[#4F6A55]">
                      Today&apos;s records are finalized. Front desk actions are
                      locked for this date.
                    </span>
                  </div>

                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#4F6A55] ring-1 ring-[#BFCDBF]">
                    Finalized
                  </span>
                </div>
              </div>
            ) : null}

            {!isStoreDayClosed && endDayGuardMessage ? (
              <div className="shrink-0 border-b border-[#D6B894] bg-[#F1E4D5] px-4 py-3">
                <div className="text-sm text-[#6B4F35]">
                  <span className="font-semibold">End Day unavailable</span>
                  <span className="ml-2">{endDayGuardMessage}</span>
                </div>
              </div>
            ) : null}

            {!isStoreDayClosed && unassignedCount > 0 && (
              <div className="sticky top-[146px] z-20 shrink-0 border-b border-[#D6B894] bg-[#F1E4D5] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-[#6B4F35]">
                    <span className="font-semibold">
                      {unassignedCount} booking
                      {unassignedCount > 1 ? "s" : ""} need reassignment
                    </span>
                    <span className="ml-2">
                      These are pending bookings without an active staff.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowUnassignedBookingsModal(true)}
                    className="rounded-xl border border-[#D6B894] bg-white/80 px-3 py-2 text-sm font-medium text-[#6B4F35] hover:bg-white"
                  >
                    Review unassigned
                  </button>
                </div>
              </div>
            )}

            {!isStoreDayClosed && missingAssignedPaidCount > 0 && (
              <div className="sticky top-[146px] z-20 shrink-0 border-b border-[#BFCDBF] bg-[#E8EFE8] px-4 py-3">
                <div className="text-sm text-[#3F5747]">
                  <span className="font-semibold">
                    {missingAssignedPaidCount} paid booking
                    {missingAssignedPaidCount > 1 ? "s are" : " is"} linked to
                    staff not on today&apos;s grid
                  </span>
                  <span className="ml-2 text-[#4F6A55]">
                    Check if the service is still ongoing or staff has changed.
                  </span>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-hidden bg-white">
              {loadingStoreDay ? (
                <div className="flex h-full items-center justify-center bg-[#FFFDF9] text-sm text-[#7A675F]">
                  Loading day status...
                </div>
              ) : isStoreDayClosed ? (
                <ClosedDayState
                  dateLabel={dateLabel}
                  closedAtLabel={closedAtLabel}
                  isTodaySelected={isTodaySelected}
                />
              ) : canStartSelectedDay ? (
                <NotStartedDayState
                  dateLabel={dateLabel}
                  onStartDay={() => setShowStartDayModal(true)}
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

            {!isStoreDayClosed && !canStartSelectedDay && (
              <div className="shrink-0 border-t border-[#E3D6C8] bg-[#FFFDF9]">
                <BottomDayTray
                  selectedDate={selectedDate}
                  totalBookings={trayData.bookings?.length || 0}
                  activeCount={trayData.activeBookings?.length || 0}
                  cancelledCount={
                    trayData.inactiveBookings?.filter(
                      (booking) =>
                        booking.status?.toLowerCase() === "cancelled"
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
                  onOpenEndDay={handleOpenEndDay}
                  storeFeatures={storeFeatures}
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
          </section>
        </div>
      </div>

      <StartDayModal
        open={shouldBlockTodayOps || showStartDayModal}
        selectedDate={selectedDate}
        storeSlug={store.slug}
        storeName={store.name}
        storeFeatures={storeFeatures}
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
        onRecover={async (booking) => {
          try {
            const res = await fetch(
              storeApiUrl(
                store.slug,
              ),
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  status: "pending",
                }),
              }
            );

            const data = await res.json();

            if (!res.ok) {
              throw new Error(
                data?.error || "Failed to recover booking"
              );
            }

            setShowInactiveBookingsModal(false);

            setTrayData((prev) => ({
              ...prev,
              inactiveBookings: (prev.inactiveBookings || []).filter(
                (item) => String(item.id) !== String(booking.id)
              ),
            }));

            await loadEndDaySummary(selectedDate);
            refreshGridNow();
          } catch (error) {
            console.error(error);
          }
        }}
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
          storeFeatures={storeFeatures}
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
