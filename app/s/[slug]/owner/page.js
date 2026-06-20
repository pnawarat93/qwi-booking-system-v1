"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  KeyRound,
  Settings,
  Store,
  Users,
} from "lucide-react";
import { getStoreFeatures } from "@/lib/config/features";
import { storeApiUrl } from "@/lib/storeApi";
import { useStore } from "../StoreContext";

function apiPath(slug, path) {
  return storeApiUrl(slug, path);
}

function getPlanLabel(plan) {
  const normalizedPlan = String(plan || "lite").toLowerCase();

  if (normalizedPlan === "enterprise") return "Keenie Enterprise";
  if (normalizedPlan === "pro") return "Keenie Pro";
  return "Keenie Lite";
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

const SETUP_VIEWED_KEYS = [
  "business_hours",
  "services",
  "staff",
  "roster",
  "front_desk_pin",
  "test_booking",
];

function viewedStorageKey(slug, key) {
  return `keenie:${slug}:overview-viewed:${key}`;
}

function readViewedFlags(slug) {
  if (!slug || typeof window === "undefined") return {};

  return SETUP_VIEWED_KEYS.reduce((flags, key) => {
    flags[key] = window.localStorage.getItem(viewedStorageKey(slug, key)) === "true";
    return flags;
  }, {});
}

function writeViewedFlag(slug, key) {
  if (!slug || !key || typeof window === "undefined") return;
  window.localStorage.setItem(viewedStorageKey(slug, key), "true");
}

function SetupCard({
  title,
  status,
  href,
  actionLabel,
  icon: Icon,
  external,
  needsAction,
  viewed,
  onView,
}) {
  const showNeedsAction = needsAction && !viewed;

  return (
    <div
      className={`rounded-[1.25rem] border p-5 shadow-[0_8px_22px_rgba(180,140,120,0.05)] transition ${
        showNeedsAction
          ? "border-[#E8B9A6] bg-[#FFF7F1]"
          : viewed
            ? "border-[#F1E4DA] bg-[#FFFDFC] shadow-none"
            : "border-[#E8D8CC] bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            showNeedsAction
              ? "bg-[#F4CDBD]"
              : viewed
                ? "bg-[#FFF4EA]"
                : "bg-[#FBEAD6]"
          }`}
        >
          <Icon
            className={`h-5 w-5 ${
              showNeedsAction
                ? "text-[#9B5F4D]"
                : viewed
                  ? "text-[#8A7A70]"
                  : "text-[#6B7556]"
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[#4A3A34]">{title}</h3>
            {viewed ? (
              <span className="rounded-full border border-[#E8D8CC] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#7A675F]">
                Viewed
              </span>
            ) : null}
          </div>
          <p className="mt-1 min-h-10 text-sm leading-5 text-[#7A675F]">
            {status}
          </p>

          <Link
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            onClick={onView}
            className={`mt-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              showNeedsAction
                ? "border-[#C87D87] bg-[#C87D87] text-white hover:opacity-90"
                : viewed
                  ? "border-[#E8D8CC] bg-white text-[#6B5B55] hover:bg-[#FFF9F6]"
                  : "border-[#D9C5B8] bg-[#FFF9F6] text-[#4A3A34] hover:bg-[#FBEAD6]/70"
            }`}
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function QuickAccessCard({ title, href, icon: Icon }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-[1.25rem] border border-[#E8D8CC] bg-white px-5 py-4 text-sm font-semibold text-[#4A3A34] shadow-[0_8px_22px_rgba(180,140,120,0.05)] transition hover:border-[#E5BCA9] hover:bg-[#FFF7F1]"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FBEAD6]">
          <Icon className="h-4 w-4 text-[#6B7556]" />
        </span>
        {title}
      </span>
      <ArrowRight className="h-4 w-4 text-[#C87D87]" />
    </Link>
  );
}

export default function OwnerOverviewPage() {
  const store = useStore();
  const storeFeatures = getStoreFeatures(store);
  const planLabel = getPlanLabel(storeFeatures.subscriptionPlan);
  const bookingPath = store.slug ? `/s/${store.slug}/booking` : "";

  const [overviewData, setOverviewData] = useState({
    storeInfo: null,
    weeklyHours: [],
    services: [],
    staff: [],
    rosterRows: [],
  });
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [absoluteBookingLink, setAbsoluteBookingLink] = useState("");
  const [copiedBookingLink, setCopiedBookingLink] = useState(false);
  const [viewedSetupCards, setViewedSetupCards] = useState({});

  useEffect(() => {
    if (!bookingPath || typeof window === "undefined") return;
    setAbsoluteBookingLink(`${window.location.origin}${bookingPath}`);
  }, [bookingPath]);

  useEffect(() => {
    setViewedSetupCards(readViewedFlags(store.slug));
  }, [store.slug]);

  useEffect(() => {
    if (!store.slug) return;

    let isMounted = true;

    async function loadOverviewData() {
      try {
        setLoadingOverview(true);
        setOverviewError("");

        const [storeRes, hoursRes, servicesRes, staffRes, rosterRes] =
          await Promise.all([
            fetch(apiPath(store.slug, "/store"), { cache: "no-store" }),
            fetch(apiPath(store.slug, "/weekly-business-hours"), {
              cache: "no-store",
            }),
            fetch(apiPath(store.slug, "/services?status=active"), {
              cache: "no-store",
            }),
            fetch(apiPath(store.slug, "/staff?status=active"), {
              cache: "no-store",
            }),
            fetch(apiPath(store.slug, "/staff-rosters"), {
              cache: "no-store",
            }),
          ]);

        const [storeData, hoursData, servicesData, staffData, rosterData] =
          await Promise.all([
            storeRes.json(),
            hoursRes.json(),
            servicesRes.json(),
            staffRes.json(),
            rosterRes.json(),
          ]);

        const failedResponse = [
          [storeRes, storeData, "store details"],
          [hoursRes, hoursData, "business hours"],
          [servicesRes, servicesData, "services"],
          [staffRes, staffData, "staff"],
          [rosterRes, rosterData, "roster"],
        ].find(([res]) => !res.ok);

        if (failedResponse) {
          const [, data, label] = failedResponse;
          throw new Error(data?.error || `Failed to load ${label}`);
        }

        if (!isMounted) return;

        setOverviewData({
          storeInfo: storeData || null,
          weeklyHours: Array.isArray(hoursData?.items) ? hoursData.items : [],
          services: Array.isArray(servicesData) ? servicesData : [],
          staff: Array.isArray(staffData) ? staffData : [],
          rosterRows: Array.isArray(rosterData) ? rosterData : [],
        });
      } catch (error) {
        console.error("Failed to load owner overview:", error);

        if (isMounted) {
          setOverviewError(error?.message || "Could not load store overview.");
        }
      } finally {
        if (isMounted) {
          setLoadingOverview(false);
        }
      }
    }

    loadOverviewData();

    return () => {
      isMounted = false;
    };
  }, [store.slug]);

  async function copyBookingLink() {
    try {
      if (!bookingPath || typeof window === "undefined") return;

      await window.navigator.clipboard.writeText(
        absoluteBookingLink || bookingPath
      );
      setCopiedBookingLink(true);
      setTimeout(() => setCopiedBookingLink(false), 1600);
    } catch (error) {
      console.error("Could not copy booking link:", error);
    }
  }

  function markSetupCardViewed(key) {
    if (!key) return;

    writeViewedFlag(store.slug, key);
    setViewedSetupCards((prev) => ({
      ...prev,
      [key]: true,
    }));
  }

  const setupStatuses = useMemo(() => {
    const customHoursCount = overviewData.weeklyHours.filter(
      (row) => row.source === "weekly_default" || row.id
    ).length;
    const serviceCount = overviewData.services.length;
    const staffCount = overviewData.staff.length;
    const workingRosterRows = overviewData.rosterRows.filter(
      (row) => row.is_active !== false && row.is_working
    ).length;

    return {
      businessHours:
        customHoursCount > 0
          ? "Custom hours set"
          : overviewData.weeklyHours.length > 0
            ? "Default hours active"
            : "Review hours",
      services:
        serviceCount > 0
          ? `${pluralize(serviceCount, "service")} available`
          : "Add your first service",
      staff:
        staffCount > 0
          ? `${pluralize(staffCount, "staff member")} available`
          : "Add your first staff member",
      roster:
        workingRosterRows > 0 ? "Weekly roster active" : "Review roster",
      frontDeskPin: overviewData.storeInfo?.has_staff_pin
        ? "Configured"
        : "Not configured",
      testBooking: "Open booking page to test",
    };
  }, [overviewData]);

  const serviceCount = overviewData.services.length;
  const staffCount = overviewData.staff.length;
  const bookingUrlForDisplay = absoluteBookingLink || bookingPath;
  const hasFrontDeskPin = overviewData.storeInfo?.has_staff_pin === true;

  const recommendedSetupCards = [
    {
      setupKey: "business_hours",
      title: "Business Hours",
      status: setupStatuses.businessHours,
      href: `/s/${store.slug}/owner/business-hours`,
      actionLabel: "Review",
      icon: Clock3,
      viewed: Boolean(viewedSetupCards.business_hours),
    },
    {
      setupKey: "services",
      title: "Services",
      status: setupStatuses.services,
      href: `/s/${store.slug}/owner/services`,
      actionLabel: serviceCount > 0 ? "Review" : "Add service",
      icon: Briefcase,
      viewed: Boolean(viewedSetupCards.services),
    },
    {
      setupKey: "staff",
      title: "Staff",
      status: setupStatuses.staff,
      href: `/s/${store.slug}/owner/staff`,
      actionLabel: staffCount > 0 ? "Review" : "Add staff",
      icon: Users,
      viewed: Boolean(viewedSetupCards.staff),
    },
    {
      setupKey: "roster",
      title: "Roster",
      status: setupStatuses.roster,
      href: `/s/${store.slug}/owner/roster`,
      actionLabel: "Review",
      icon: CalendarDays,
      viewed: Boolean(viewedSetupCards.roster),
    },
    {
      setupKey: "front_desk_pin",
      title: "Front Desk PIN",
      status: setupStatuses.frontDeskPin,
      href: `/s/${store.slug}/owner/settings`,
      actionLabel: hasFrontDeskPin ? "Manage" : "Set PIN",
      icon: KeyRound,
      needsAction: !hasFrontDeskPin,
      viewed: Boolean(viewedSetupCards.front_desk_pin),
    },
    {
      setupKey: "test_booking",
      title: "Test Booking",
      status: setupStatuses.testBooking,
      href: bookingPath || `/s/${store.slug}`,
      actionLabel: "Open booking page",
      icon: ExternalLink,
      external: true,
      needsAction: !hasFrontDeskPin,
      viewed: Boolean(viewedSetupCards.test_booking),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-[#E8D8CC] bg-white p-5 shadow-[0_10px_30px_rgba(180,140,120,0.08)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#C87D87]">
              {planLabel}
            </p>
            <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight text-[#4A3A34] sm:text-4xl">
              {store.name || "Store"}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#E8EFE8] px-3 py-1.5 text-sm font-semibold text-[#4F6A55]">
                Booking page active
              </span>
              <span className="rounded-full bg-[#FFF9F6] px-3 py-1.5 text-sm font-medium text-[#7A675F] ring-1 ring-[#E8D8CC]">
                {pluralize(staffCount, "staff member")}
              </span>
              <span className="rounded-full bg-[#FFF9F6] px-3 py-1.5 text-sm font-medium text-[#7A675F] ring-1 ring-[#E8D8CC]">
                {pluralize(serviceCount, "service")}
              </span>
            </div>
          </div>

          {overviewError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {overviewError}
            </div>
          ) : loadingOverview ? (
            <div className="rounded-2xl border border-[#E8D8CC] bg-[#FFFDFC] px-4 py-3 text-sm text-[#7A675F]">
              Loading store overview...
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[#E8D8CC] bg-white p-5 shadow-[0_10px_30px_rgba(180,140,120,0.08)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-stretch">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C87D87]">
              Booking Page
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#4A3A34]">
              Share this link with customers
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#7A675F]">
              Customers can choose services, staff, and appointment times from
              your public booking page.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={bookingUrlForDisplay}
                readOnly
                className="min-w-0 flex-1 rounded-2xl border border-[#E8D8CC] bg-[#FFFDFC] px-4 py-3 text-sm font-medium text-[#4A3A34]"
              />

              <button
                type="button"
                onClick={copyBookingLink}
                disabled={!bookingPath}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D9C5B8] bg-white px-4 py-3 text-sm font-semibold text-[#4A3A34] transition hover:bg-[#FFF7F1] disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
                {copiedBookingLink ? "Copied" : "Copy Link"}
              </button>

              <Link
                href={bookingPath || "#"}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition ${
                  bookingPath
                    ? "bg-[#C87D87] hover:opacity-90"
                    : "pointer-events-none bg-[#D9B3B8] opacity-60"
                }`}
              >
                Open Booking Page
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="flex min-h-60 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[#D9C5B8] bg-[#FFF9F6] p-5 text-center">
            <div className="grid h-32 w-32 grid-cols-5 gap-1 rounded-2xl bg-white p-3 shadow-inner">
              {Array.from({ length: 25 }).map((_, index) => (
                <span
                  key={index}
                  className={`rounded-sm ${
                    [0, 1, 2, 5, 7, 10, 11, 12, 14, 16, 18, 20, 21, 24].includes(index)
                      ? "bg-[#4A3A34]"
                      : "bg-[#F1E4DA]"
                  }`}
                />
              ))}
            </div>
            <p className="mt-4 text-sm font-semibold text-[#4A3A34]">
              QR code placeholder
            </p>
            <p className="mt-1 text-xs text-[#7A675F]">Scan to book</p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-4">
          {!loadingOverview && !overviewError && !hasFrontDeskPin ? (
            <div className="rounded-[1.5rem] border border-[#E8B9A6] bg-[#FFF7F1] p-5 shadow-[0_10px_26px_rgba(200,125,135,0.12)] sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C87D87]">
                    Recommended next step
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#4A3A34]">
                    Finish setting up your store
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#7A675F]">
                    A few quick checks help your team start smoothly.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
                  <Link
                    href={`/s/${store.slug}/owner/settings`}
                    onClick={() => markSetupCardViewed("front_desk_pin")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#C87D87] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                  >
                    Set Front Desk PIN
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={bookingPath || `/s/${store.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => markSetupCardViewed("test_booking")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D9C5B8] bg-white px-4 py-3 text-sm font-semibold text-[#4A3A34] transition hover:bg-[#FFF9F6]"
                  >
                    Try a test booking
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <h2 className="text-xl font-semibold text-[#4A3A34]">
              Recommended setup
            </h2>
            <p className="mt-1 text-sm text-[#7A675F]">
              {hasFrontDeskPin
                ? "Review the defaults when you have time."
                : "Focus on the couple of actions that help your team get started."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recommendedSetupCards.map((card) => (
            <SetupCard
              key={card.title}
              {...card}
              onView={() => markSetupCardViewed(card.setupKey)}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-[#4A3A34]">
            Quick Access
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickAccessCard
            title="Front Desk"
            href={`/s/${store.slug}/admin`}
            icon={Store}
          />
          <QuickAccessCard
            title="Reports"
            href={`/s/${store.slug}/owner/reports`}
            icon={FileText}
          />
          <QuickAccessCard
            title="Settings"
            href={`/s/${store.slug}/owner/settings`}
            icon={Settings}
          />
        </div>
      </section>
    </div>
  );
}
