"use client";

import { Sparkles, Clock, ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

function addDaysToDateString(dateString, daysToAdd) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + daysToAdd);
  return utcDate.toISOString().slice(0, 10);
}

function formatDateInTimeZone(dateString, timeZone = "Australia/Sydney") {
  if (!dateString) return null;

  const [year, month, day] = String(dateString).split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(utcDate.getTime())) return dateString;

  return utcDate.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  });
}

function safeTime(value, fallback) {
  if (!value) return fallback;
  return String(value).substring(0, 5);
}

function getNowPartsInTimeZone(timeZone = "Australia/Sydney") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value || "";

  return {
    weekday: get("weekday"),
    hour: Number(get("hour") || 0),
    minute: Number(get("minute") || 0),
  };
}

function timeStringToMinutes(value) {
  if (!value) return null;

  const safe = String(value).substring(0, 5);
  const [hour, minute] = safe.split(":").map(Number);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

export default function StoreHomePage() {
  const store = useStore();
  const storeTimeZone = store.timezone || "Australia/Sydney";

  const [todayHours, setTodayHours] = useState(null);
  const [upcomingNotices, setUpcomingNotices] = useState([]);
  const [loadingHours, setLoadingHours] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadHomeBusinessData() {
      try {
        setLoadingHours(true);

        const today = getTodayInTimeZone(storeTimeZone);

        const todayRes = await fetch(
          storeApiUrl(store.slug, `/business-hours?date=${today}`)
        );
        const todayData = await todayRes.json();

        if (!todayRes.ok) {
          throw new Error(todayData?.error || "Failed to load today's hours");
        }

        if (isMounted) {
          setTodayHours(todayData || null);
        }

        const next30Dates = Array.from({ length: 30 }, (_, index) =>
          addDaysToDateString(today, index + 1)
        );

        const upcomingResults = await Promise.all(
          next30Dates.map(async (date) => {
            const res = await fetch(
              storeApiUrl(store.slug, `/business-hours?date=${date}`)
            );
            const data = await res.json();

            if (!res.ok) return null;
            if (data?.source !== "special_date") return null;

            return {
              date,
              is_open: data.is_open,
              open_time: data.open_time,
              close_time: data.close_time,
              note: data.note || null,
            };
          })
        );

        if (isMounted) {
          setUpcomingNotices(upcomingResults.filter(Boolean).slice(0, 4));
        }
      } catch (error) {
        console.error("Failed to load home business data:", error);
        if (isMounted) {
          setTodayHours(null);
          setUpcomingNotices([]);
        }
      } finally {
        if (isMounted) {
          setLoadingHours(false);
        }
      }
    }

    loadHomeBusinessData();

    return () => {
      isMounted = false;
    };
  }, [store.slug, storeTimeZone]);

  const openStatus = useMemo(() => {
    const fallbackStart = safeTime(store.business_hours_start, "10:00");
    const fallbackEnd = safeTime(store.business_hours_end, "20:00");

    const now = getNowPartsInTimeZone(storeTimeZone);
    const nowMinutes = now.hour * 60 + now.minute;

    const sourceIsOpen =
      todayHours?.is_open !== undefined ? todayHours.is_open : true;

    const sourceStart = safeTime(todayHours?.open_time, fallbackStart);
    const sourceEnd = safeTime(todayHours?.close_time, fallbackEnd);

    if (!sourceIsOpen) {
      return {
        label: "Closed Today",
        sublabel: todayHours?.note || `${now.weekday} · Not trading today`,
        hoursLabel: "Closed today",
      };
    }

    const startMinutes = timeStringToMinutes(sourceStart);
    const endMinutes = timeStringToMinutes(sourceEnd);

    if (startMinutes === null || endMinutes === null) {
      return {
        label: "Hours unavailable",
        sublabel: "Please check with the store",
        hoursLabel: "Hours unavailable",
      };
    }

    const isOpenNow = nowMinutes >= startMinutes && nowMinutes < endMinutes;

    if (isOpenNow) {
      return {
        label: "Open Now",
        sublabel: `${now.weekday} · Until ${sourceEnd}`,
        hoursLabel: `From ${sourceStart} to ${sourceEnd}`,
      };
    }

    if (nowMinutes < startMinutes) {
      return {
        label: "Closed Now",
        sublabel: `${now.weekday} · Opens at ${sourceStart}`,
        hoursLabel: `From ${sourceStart} to ${sourceEnd}`,
      };
    }

    return {
      label: "Closed Now",
      sublabel: `${now.weekday} · Closed for today`,
      hoursLabel: `From ${sourceStart} to ${sourceEnd}`,
    };
  }, [store.business_hours_start, store.business_hours_end, storeTimeZone, todayHours]);

  return (
    <section id="shopdetail" className="space-y-4">
      <div className="overflow-hidden rounded-[1.75rem] border border-[#E8D8CC] bg-white/70 shadow-[0_10px_40px_rgba(180,140,120,0.12)] backdrop-blur-sm sm:rounded-4xl">
        <div className="bg-linear-to-br from-[#FBEAD6]/90 via-[#FFF9F6] to-[#F0C4CB]/45 px-5 py-6 sm:px-8 sm:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full min-w-0">
              <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-[#E5BCA9]/60 bg-white/70 px-3 py-1 text-xs text-[#7A675F] shadow-sm sm:text-sm">
                <Sparkles className="h-4 w-4 shrink-0 text-[#C87D87]" />
                <span className="truncate">Powered by Qwi</span>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-[#4A3A34] sm:text-4xl lg:text-5xl">
                {store.name}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#7A675F] sm:text-base sm:leading-7 lg:text-lg">
                Relaxing treatments in a calm, elegant space. Book your service
                in just a few steps.
              </p>

              {store.address && (
                <div className="mt-5 inline-flex max-w-full items-center rounded-full border border-[#E5BCA9]/50 bg-[#FBEAD6]/80 px-4 py-2 text-sm text-[#6B7556]">
                  <span className="wrap-break-word">{store.address}</span>
                </div>
              )}
            </div>

            <div className="w-full lg:max-w-[320px]">
              <div className="rounded-3xl border border-[#E8D8CC] bg-white/85 p-4 shadow-[0_8px_24px_rgba(160,120,110,0.10)] sm:rounded-[1.75rem] sm:p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FBEAD6]">
                    <Clock className="h-5 w-5 text-[#6B7556]" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[#4A3A34] sm:text-lg">
                      {loadingHours ? "Checking hours..." : openStatus.label}
                    </p>
                    <p className="text-sm text-[#7A675F]">
                      {loadingHours ? "Please wait" : openStatus.sublabel}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#F0E2D8] bg-[#FFF9F6] px-4 py-3 text-sm text-[#6B7556]">
                  {loadingHours ? "Loading..." : openStatus.hoursLabel}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-white/50 px-5 py-5 sm:gap-4 sm:px-8 sm:py-6 md:flex-row md:justify-center">
          <Link href={`/s/${store.slug}/booking`} className="w-full md:w-auto">
            <button className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C87D87] px-6 py-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:text-base md:min-w-[250px]">
              Start booking a service
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
          </Link>

          <Link
            href={`/s/${store.slug}/availability`}
            className="w-full md:w-auto"
          >
            <button className="w-full rounded-2xl border border-[#D9C5B8] bg-[#FFF9F6] px-6 py-4 text-sm font-semibold text-[#6B7556] shadow-sm transition hover:bg-[#FBEAD6]/60 sm:text-base md:min-w-[250px]">
              Check availability
            </button>
          </Link>
        </div>
      </div>

      {upcomingNotices.length > 0 && (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50/80 p-5 shadow-[0_8px_24px_rgba(180,140,120,0.08)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70">
              <CalendarDays className="h-5 w-5 text-amber-700" />
            </div>

            <div className="min-w-0">
              <h3 className="text-base font-semibold text-amber-900">
                Upcoming store notices
              </h3>
              <p className="mt-1 text-sm text-amber-800">
                Changes to trading hours coming up within the next month.
              </p>

              <div className="mt-4 space-y-3">
                {upcomingNotices.map((item) => (
                  <div
                    key={item.date}
                    className="rounded-2xl border border-amber-200 bg-white/70 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-[#4A3A34]">
                      {formatDateInTimeZone(item.date, storeTimeZone)}
                    </p>

                    <p className="mt-1 text-sm text-[#7A675F]">
                      {item.is_open
                        ? `Special hours: ${safeTime(item.open_time, "")} - ${safeTime(
                            item.close_time,
                            ""
                          )}`
                        : "Store closed"}
                    </p>

                    {item.note && (
                      <p className="mt-1 text-xs text-[#8A7A72]">{item.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}