"use client";

import Link from "next/link";
import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  CalendarDays,
  Users,
  Briefcase,
  Clock3,
  ChevronLeft,
  Settings,
  FileText,
} from "lucide-react";

const LOCALE_STORAGE_KEY = "keenie:owner-overview-locale";

const COPY = {
  en: {
    shell: {
      overview: "Overview",
      roster: "Roster",
      staff: "Staff",
      services: "Services",
      businessHours: "Business Hours",
      reports: "Reports",
      settings: "Settings",
      keenieOwner: "Keenie Owner",
      storeSetup: "Manage store setup and operations",
      storeManagement: "Store Management",
      ownerConfig: "Owner-only setup and configuration",
      backToFrontDesk: "Back to Front Desk",
      back: "Back",
    },
    overview: {
      bookingPageActive: "Booking page active",
      staffMember: "staff member",
      staffMembers: "staff members",
      service: "service",
      services: "services",
      loadingOverview: "Loading store overview...",
      bookingPage: "Booking Page",
      shareLinkTitle: "Share this link with customers",
      shareLinkBody:
        "Customers can choose services, staff, and appointment times from your public booking page.",
      copyLink: "Copy Link",
      copied: "Copied",
      openBookingPage: "Open Booking Page",
      scanToBook: "Scan to book",
      downloadQr: "Download QR",
      actionNeeded: "Action needed",
      beforeBookings: "Before you take bookings",
      beforeBookingsBody:
        "Set your Front Desk PIN and test your booking page before sharing it with customers.",
      setFrontDeskPin: "Set Front Desk PIN",
      setupSubtitle:
        "Review these items before sharing your booking page with customers.",
      required: "Required",
      recommended: "Recommended",
      reviewed: "Reviewed",
      needsReview: "Needs review",
      configured: "Configured",
      notConfigured: "Not configured",
      businessHours: "Business Hours",
      servicesTitle: "Services",
      staffTitle: "Staff",
      frontDeskPin: "Front Desk PIN",
      roster: "Roster",
      testBooking: "Test Booking",
      review: "Review",
      addService: "Add service",
      addStaff: "Add staff",
      manage: "Manage",
      setPin: "Set PIN",
      openBookingPageLower: "Open booking page",
      quickAccess: "Quick Access",
      frontDesk: "Front Desk",
      reports: "Reports",
      settings: "Settings",
      customHoursSet: "Custom hours set",
      defaultHoursActive: "Default hours active",
      noHoursFound: "No hours found",
      available: "available",
      noServicesAvailable: "No services available",
      noStaffAvailable: "No staff available",
      weeklyRosterActive: "Weekly roster active",
      noRosterRowsFound: "No roster rows found",
      posterTitleLines: ["Book your", "appointment"],
      posterScanOnline: "Scan to book online",
      poweredBy: "Powered by Keenie",
    },
  },
  th: {
    shell: {
      overview: "ภาพรวม",
      roster: "ตารางเวร",
      staff: "พนักงาน",
      services: "บริการ",
      businessHours: "เวลาทำการ",
      reports: "รายงาน",
      settings: "ตั้งค่า",
      keenieOwner: "Keenie Owner",
      storeSetup: "จัดการการตั้งค่าและการทำงานของร้าน",
      storeManagement: "จัดการร้าน",
      ownerConfig: "ตั้งค่าและจัดการสำหรับเจ้าของร้าน",
      backToFrontDesk: "กลับไป Front Desk",
      back: "กลับ",
    },
    overview: {
      bookingPageActive: "หน้า Booking เปิดใช้งานแล้ว",
      staffMember: "พนักงาน",
      staffMembers: "พนักงาน",
      service: "บริการ",
      services: "บริการ",
      loadingOverview: "กำลังโหลดภาพรวมร้าน...",
      bookingPage: "หน้า Booking",
      shareLinkTitle: "แชร์ลิงก์นี้ให้ลูกค้า",
      shareLinkBody:
        "ลูกค้าสามารถเลือกบริการ พนักงาน และเวลานัดหมายได้จากหน้า Booking ของร้าน",
      copyLink: "คัดลอกลิงก์",
      copied: "คัดลอกแล้ว",
      openBookingPage: "เปิดหน้า Booking",
      scanToBook: "สแกนเพื่อจอง",
      downloadQr: "ดาวน์โหลด QR",
      actionNeeded: "ต้องดำเนินการ",
      beforeBookings: "ก่อนเริ่มรับ Booking",
      beforeBookingsBody:
        "ตั้งค่า Front Desk PIN และทดสอบหน้า Booking ก่อนแชร์ให้ลูกค้า",
      setFrontDeskPin: "ตั้งค่า Front Desk PIN",
      setupSubtitle: "ตรวจสอบรายการเหล่านี้ก่อนแชร์หน้า Booking ให้ลูกค้า",
      required: "จำเป็น",
      recommended: "แนะนำ",
      reviewed: "ตรวจสอบแล้ว",
      needsReview: "ควรตรวจสอบ",
      configured: "ตั้งค่าแล้ว",
      notConfigured: "ยังไม่ได้ตั้งค่า",
      businessHours: "เวลาทำการ",
      servicesTitle: "บริการ",
      staffTitle: "พนักงาน",
      frontDeskPin: "Front Desk PIN",
      roster: "ตารางเวร",
      testBooking: "ทดสอบ Booking",
      review: "ตรวจสอบ",
      addService: "เพิ่มบริการ",
      addStaff: "เพิ่มพนักงาน",
      manage: "จัดการ",
      setPin: "ตั้ง PIN",
      openBookingPageLower: "เปิดหน้า Booking",
      quickAccess: "ทางลัด",
      frontDesk: "Front Desk",
      reports: "รายงาน",
      settings: "ตั้งค่า",
      customHoursSet: "ตั้งเวลาทำการแล้ว",
      defaultHoursActive: "ใช้เวลาทำการเริ่มต้น",
      noHoursFound: "ยังไม่พบเวลาทำการ",
      available: "พร้อมใช้งาน",
      noServicesAvailable: "ยังไม่มีบริการ",
      noStaffAvailable: "ยังไม่มีพนักงาน",
      weeklyRosterActive: "มีตารางเวรรายสัปดาห์แล้ว",
      noRosterRowsFound: "ยังไม่พบตารางเวร",
      posterTitleLines: ["จอง", "นัดหมาย"],
      posterScanOnline: "สแกนเพื่อจองออนไลน์",
      poweredBy: "Powered by Keenie",
    },
  },
};

const OwnerLocaleContext = createContext({
  locale: "en",
  setLocale: () => {},
  t: COPY.en,
});

const ownerNavItems = [
  {
    labelKey: "overview",
    href: (slug) => `/s/${slug}/owner`,
    icon: LayoutGrid,
  },
  {
    labelKey: "roster",
    href: (slug) => `/s/${slug}/owner/roster`,
    icon: CalendarDays,
  },
  {
    labelKey: "staff",
    href: (slug) => `/s/${slug}/owner/staff`,
    icon: Users,
  },
  {
    labelKey: "services",
    href: (slug) => `/s/${slug}/owner/services`,
    icon: Briefcase,
  },
  {
    labelKey: "businessHours",
    href: (slug) => `/s/${slug}/owner/business-hours`,
    icon: Clock3,
  },
  {
    labelKey: "reports",
    href: (slug) => `/s/${slug}/owner/reports`,
    icon: FileText,
  },
  {
    labelKey: "settings",
    href: (slug) => `/s/${slug}/owner/settings`,
    icon: Settings,
  },
];

function isActivePath(pathname, href) {
  if (href.endsWith("/owner")) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function useOwnerLocale() {
  return useContext(OwnerLocaleContext);
}

export default function OwnerClientLayout({ children, activeSlug, storeName }) {
  const pathname = usePathname();
  const [locale, setLocaleState] = useState(() => {
    if (typeof window === "undefined") return "en";

    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);

    if (savedLocale === "en" || savedLocale === "th") {
      return savedLocale;
    }

    return "en";
  });
  const t = COPY[locale] || COPY.en;

  function setLocale(nextLocale) {
    if (nextLocale !== "en" && nextLocale !== "th") return;

    setLocaleState(nextLocale);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    }
  }

  return (
    <OwnerLocaleContext.Provider value={{ locale, setLocale, t }}>
      <main className="flex min-h-[100dvh] bg-[#FCFAF8] text-[#2F2723]">
      <aside className="hidden w-72 shrink-0 border-r border-[#E8D8CC] bg-white lg:flex lg:flex-col">
        <div className="border-b border-[#E8D8CC] px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C87D87]">
            {t.shell.keenieOwner}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#4A3A34]">
            {storeName}
          </h1>
          <p className="mt-1 text-sm text-[#7A675F]">
            {t.shell.storeSetup}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <nav className="space-y-1">
            {ownerNavItems.filter(Boolean).map((item) => {
              const href = item.href(activeSlug);
              const active = isActivePath(pathname, href);
              const Icon = item.icon;

              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${active
                      ? "bg-[#FBEAD6] text-[#4A3A34]"
                      : "text-[#7A675F] hover:bg-[#FFF4EC] hover:text-[#4A3A34]"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.shell[item.labelKey]}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#E8D8CC] p-4">
          <Link
            href={`/s/${activeSlug}/admin`}
            className="flex items-center gap-2 rounded-2xl border border-[#D9C5B8] bg-[#FFF9F6] px-4 py-3 text-sm font-semibold text-[#6B7556] transition hover:bg-[#FBEAD6]/60"
          >
            <ChevronLeft className="h-4 w-4" />
            {t.shell.backToFrontDesk}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[#E8D8CC] bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C87D87] lg:hidden">
                {t.shell.keenieOwner}
              </p>
              <h2 className="truncate text-lg font-semibold text-[#4A3A34]">
                {t.shell.storeManagement}
              </h2>
              <p className="text-sm text-[#7A675F]">
                {t.shell.ownerConfig}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="inline-flex rounded-2xl border border-[#E8D8CC] bg-[#FFF9F6] p-1">
                {["en", "th"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLocale(option)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold uppercase transition ${
                      locale === option
                        ? "bg-[#C87D87] text-white shadow-sm"
                        : "text-[#7A675F] hover:bg-white"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <Link
                href={`/s/${activeSlug}/admin`}
                className="rounded-xl border border-[#D9C5B8] bg-[#FFF9F6] px-3 py-2 text-sm font-semibold text-[#6B7556] transition hover:bg-[#FBEAD6]/60 lg:hidden"
              >
                {t.shell.back}
              </Link>
            </div>
          </div>
        </header>

        <section className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6">
          {children}
        </section>
      </div>
      </main>
    </OwnerLocaleContext.Provider>
  );
}
