"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  KeyRound,
  Settings,
  Store,
  Users,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getStoreFeatures } from "@/lib/config/features";
import { storeApiUrl } from "@/lib/storeApi";
import { useStore } from "../StoreContext";
import { useOwnerLocale } from "./OwnerClientLayout";

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

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || "").split(" ");
  let line = "";
  let cursorY = y;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
  });

  if (line) {
    ctx.fillText(line, x, cursorY);
  }

  return cursorY;
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
  detail,
  href,
  actionLabel,
  icon: Icon,
  external,
  needsAction,
  viewed,
  reviewedLabel = "Reviewed",
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
                {reviewedLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-semibold leading-5 text-[#7A675F]">
            {status}
          </p>
          {detail ? (
            <p className="mt-1 min-h-5 text-xs leading-5 text-[#9A8A84]">
              {detail}
            </p>
          ) : null}

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
  const { t: ownerCopy } = useOwnerLocale();
  const t = ownerCopy.overview;
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
  const qrCodeRef = useRef(null);

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

  async function downloadQrPoster() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const qrSvg = qrCodeRef.current?.querySelector("svg");
    const qrValue = absoluteBookingLink || bookingPath;

    if (!qrSvg || !qrValue) return;

    try {
      const serializedSvg = new XMLSerializer().serializeToString(qrSvg);
      const svgBlob = new Blob([serializedSvg], {
        type: "image/svg+xml;charset=utf-8",
      });
      const svgUrl = URL.createObjectURL(svgBlob);
      const qrImage = new Image();

      await new Promise((resolve, reject) => {
        qrImage.onload = resolve;
        qrImage.onerror = reject;
        qrImage.src = svgUrl;
      });

      const canvas = document.createElement("canvas");
      const width = 1200;
      const height = 1600;
      const scale = window.devicePixelRatio || 1;

      canvas.width = width * scale;
      canvas.height = height * scale;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);

      ctx.fillStyle = "#FFF9F6";
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#F4D7C8";
      ctx.beginPath();
      ctx.arc(1040, 150, 260, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#E8EFE8";
      ctx.beginPath();
      ctx.arc(130, 1430, 240, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      drawRoundedRect(ctx, 120, 120, 960, 1360, 48);
      ctx.fill();

      ctx.strokeStyle = "#E8D8CC";
      ctx.lineWidth = 4;
      drawRoundedRect(ctx, 120, 120, 960, 1360, 48);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "#C87D87";
      ctx.font = "700 34px Arial, sans-serif";
      ctx.fillText(store.name || "Store", width / 2, 280);

      ctx.fillStyle = "#4A3A34";
      ctx.font = "700 76px Arial, sans-serif";
      ctx.fillText(t.posterTitleLines[0], width / 2, 395);
      ctx.fillText(t.posterTitleLines[1], width / 2, 480);

      ctx.fillStyle = "#7A675F";
      ctx.font = "400 34px Arial, sans-serif";
      ctx.fillText(t.posterScanOnline, width / 2, 560);

      ctx.fillStyle = "#FFFFFF";
      drawRoundedRect(ctx, 320, 650, 560, 560, 36);
      ctx.fill();
      ctx.strokeStyle = "#E8D8CC";
      ctx.lineWidth = 3;
      drawRoundedRect(ctx, 320, 650, 560, 560, 36);
      ctx.stroke();

      ctx.drawImage(qrImage, 380, 710, 440, 440);

      ctx.fillStyle = "#4A3A34";
      ctx.font = "700 30px Arial, sans-serif";
      ctx.fillText(t.posterScanOnline, width / 2, 1285);

      ctx.fillStyle = "#7A675F";
      ctx.font = "400 26px Arial, sans-serif";
      drawWrappedText(ctx, qrValue, width / 2, 1340, 760, 34);

      ctx.fillStyle = "#A88B7C";
      ctx.font = "700 24px Arial, sans-serif";
      ctx.fillText(t.poweredBy, width / 2, 1430);

      URL.revokeObjectURL(svgUrl);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `keenie-${store.slug || "booking"}-qr.png`;
      link.click();
    } catch (error) {
      console.error("Could not download QR poster:", error);
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
          ? t.customHoursSet
          : overviewData.weeklyHours.length > 0
            ? t.defaultHoursActive
            : t.noHoursFound,
      services:
        serviceCount > 0
          ? `${pluralize(serviceCount, t.service, t.services)} ${t.available}`
          : t.noServicesAvailable,
      staff:
        staffCount > 0
          ? `${pluralize(staffCount, t.staffMember, t.staffMembers)} ${t.available}`
          : t.noStaffAvailable,
      roster:
        workingRosterRows > 0 ? t.weeklyRosterActive : t.noRosterRowsFound,
      frontDeskPin: overviewData.storeInfo?.has_staff_pin
        ? t.configured
        : t.notConfigured,
      testBooking: t.recommended,
    };
  }, [overviewData, t]);

  const serviceCount = overviewData.services.length;
  const staffCount = overviewData.staff.length;
  const bookingUrlForDisplay = absoluteBookingLink || bookingPath;
  const canDownloadQr = Boolean(bookingUrlForDisplay);
  const hasFrontDeskPin = overviewData.storeInfo?.has_staff_pin === true;

  function reviewStatus(key) {
    return viewedSetupCards[key] ? t.reviewed : t.needsReview;
  }

  const requiredSetupCards = [
    {
      setupKey: "business_hours",
      title: t.businessHours,
      status: reviewStatus("business_hours"),
      detail: setupStatuses.businessHours,
      href: `/s/${store.slug}/owner/business-hours`,
      actionLabel: t.review,
      icon: Clock3,
      viewed: Boolean(viewedSetupCards.business_hours),
    },
    {
      setupKey: "services",
      title: t.servicesTitle,
      status: reviewStatus("services"),
      detail: setupStatuses.services,
      href: `/s/${store.slug}/owner/services`,
      actionLabel: serviceCount > 0 ? t.review : t.addService,
      icon: Briefcase,
      viewed: Boolean(viewedSetupCards.services),
    },
    {
      setupKey: "staff",
      title: t.staffTitle,
      status: reviewStatus("staff"),
      detail: setupStatuses.staff,
      href: `/s/${store.slug}/owner/staff`,
      actionLabel: staffCount > 0 ? t.review : t.addStaff,
      icon: Users,
      viewed: Boolean(viewedSetupCards.staff),
    },
    {
      setupKey: "front_desk_pin",
      title: t.frontDeskPin,
      status: setupStatuses.frontDeskPin,
      href: `/s/${store.slug}/owner/settings`,
      actionLabel: hasFrontDeskPin ? t.manage : t.setPin,
      icon: KeyRound,
      needsAction: !hasFrontDeskPin,
      viewed: Boolean(viewedSetupCards.front_desk_pin),
    },
  ];

  const recommendedSetupCards = [
    {
      setupKey: "roster",
      title: t.roster,
      status: reviewStatus("roster"),
      detail: setupStatuses.roster,
      href: `/s/${store.slug}/owner/roster`,
      actionLabel: t.review,
      icon: CalendarDays,
      viewed: Boolean(viewedSetupCards.roster),
    },
    {
      setupKey: "test_booking",
      title: t.testBooking,
      status: setupStatuses.testBooking,
      href: bookingPath || `/s/${store.slug}`,
      actionLabel: t.openBookingPageLower,
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
                {t.bookingPageActive}
              </span>
              <span className="rounded-full bg-[#FFF9F6] px-3 py-1.5 text-sm font-medium text-[#7A675F] ring-1 ring-[#E8D8CC]">
                {pluralize(staffCount, t.staffMember, t.staffMembers)}
              </span>
              <span className="rounded-full bg-[#FFF9F6] px-3 py-1.5 text-sm font-medium text-[#7A675F] ring-1 ring-[#E8D8CC]">
                {pluralize(serviceCount, t.service, t.services)}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            {overviewError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {overviewError}
              </div>
            ) : loadingOverview ? (
              <div className="rounded-2xl border border-[#E8D8CC] bg-[#FFFDFC] px-4 py-3 text-sm text-[#7A675F]">
                {t.loadingOverview}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[#E8D8CC] bg-white p-5 shadow-[0_10px_30px_rgba(180,140,120,0.08)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-stretch">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C87D87]">
              {t.bookingPage}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#4A3A34]">
              {t.shareLinkTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#7A675F]">
              {t.shareLinkBody}
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
                {copiedBookingLink ? t.copied : t.copyLink}
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
                {t.openBookingPage}
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="flex min-h-60 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[#D9C5B8] bg-[#FFF9F6] p-5 text-center">
            <div ref={qrCodeRef} className="rounded-2xl bg-white p-3 shadow-inner">
              <QRCodeSVG
                value={bookingUrlForDisplay || bookingPath || "/"}
                size={128}
                bgColor="#FFFFFF"
                fgColor="#4A3A34"
                level="M"
              />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#4A3A34]">
              {t.scanToBook}
            </p>
            <button
              type="button"
              onClick={downloadQrPoster}
              disabled={!canDownloadQr}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D9C5B8] bg-white px-4 py-2.5 text-sm font-semibold text-[#4A3A34] transition hover:bg-[#FFF7F1] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {t.downloadQr}
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-4">
          {!loadingOverview && !overviewError && !hasFrontDeskPin ? (
            <div className="rounded-[1.75rem] border-2 border-[#D97762] bg-[#FFF1E8] p-5 shadow-[0_18px_42px_rgba(200,125,98,0.2)] sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <span className="inline-flex rounded-full bg-[#C65F46] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                    {t.actionNeeded}
                  </span>
                  <h2 className="mt-2 text-2xl font-semibold text-[#4A3A34]">
                    {t.beforeBookings}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#7A675F]">
                    {t.beforeBookingsBody}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
                  <Link
                    href={`/s/${store.slug}/owner/settings`}
                    onClick={() => markSetupCardViewed("front_desk_pin")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#C87D87] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                  >
                    {t.setFrontDeskPin}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={bookingPath || `/s/${store.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => markSetupCardViewed("test_booking")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D9C5B8] bg-white px-4 py-3 text-sm font-semibold text-[#4A3A34] transition hover:bg-[#FFF9F6]"
                  >
                    {t.openBookingPage}
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <h2 className="text-xl font-semibold text-[#4A3A34]">
              {t.beforeBookings}
            </h2>
            <p className="mt-1 text-sm text-[#7A675F]">
              {t.setupSubtitle}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#9A6B5C]">
              {t.required}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {requiredSetupCards.map((card) => (
                <SetupCard
                  key={card.title}
                  {...card}
                  reviewedLabel={t.reviewed}
                  onView={() => markSetupCardViewed(card.setupKey)}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#9A6B5C]">
              {t.recommended}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recommendedSetupCards.map((card) => (
                <SetupCard
                  key={card.title}
                  {...card}
                  reviewedLabel={t.reviewed}
                  onView={() => markSetupCardViewed(card.setupKey)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-[#4A3A34]">
            {t.quickAccess}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickAccessCard
            title={t.frontDesk}
            href={`/s/${store.slug}/admin`}
            icon={Store}
          />
          <QuickAccessCard
            title={t.reports}
            href={`/s/${store.slug}/owner/reports`}
            icon={FileText}
          />
          <QuickAccessCard
            title={t.settings}
            href={`/s/${store.slug}/owner/settings`}
            icon={Settings}
          />
        </div>
      </section>
    </div>
  );
}
