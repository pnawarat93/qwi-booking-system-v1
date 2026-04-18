"use client";

import Link from "next/link";
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
import { useStore } from "../StoreContext";

const ownerNavItems = [
  {
    label: "Overview",
    href: (slug) => `/s/${slug}/owner`,
    icon: LayoutGrid,
  },
  {
    label: "Roster",
    href: (slug) => `/s/${slug}/owner/roster`,
    icon: CalendarDays,
  },
  {
    label: "Staff",
    href: (slug) => `/s/${slug}/owner/staff`,
    icon: Users,
  },
  {
    label: "Services",
    href: (slug) => `/s/${slug}/owner/services`,
    icon: Briefcase,
  },
  {
    label: "Business Hours",
    href: (slug) => `/s/${slug}/owner/business-hours`,
    icon: Clock3,
  },
  {
    label: "Reports",
    href: (slug) => `/s/${slug}/owner/reports`,
    icon: FileText,
  },
  {
    label: "Settings",
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

export default function OwnerLayout({ children }) {
  const pathname = usePathname();
  const store = useStore();

  return (
    <main className="flex min-h-[100dvh] bg-[#FCFAF8] text-[#2F2723]">
      <aside className="hidden w-72 shrink-0 border-r border-[#E8D8CC] bg-white lg:flex lg:flex-col">
        <div className="border-b border-[#E8D8CC] px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C87D87]">
            Qwi Owner
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#4A3A34]">
            {store.name}
          </h1>
          <p className="mt-1 text-sm text-[#7A675F]">
            Manage store setup and operations
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <nav className="space-y-1">
            {ownerNavItems.map((item) => {
              const href = item.href(store.slug);
              const active = isActivePath(pathname, href);
              const Icon = item.icon;

              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-[#FBEAD6] text-[#4A3A34]"
                      : "text-[#7A675F] hover:bg-[#FFF4EC] hover:text-[#4A3A34]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#E8D8CC] p-4">
          <Link
            href={`/s/${store.slug}/admin`}
            className="flex items-center gap-2 rounded-2xl border border-[#D9C5B8] bg-[#FFF9F6] px-4 py-3 text-sm font-semibold text-[#6B7556] transition hover:bg-[#FBEAD6]/60"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Front Desk
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[#E8D8CC] bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C87D87] lg:hidden">
                Qwi Owner
              </p>
              <h2 className="truncate text-lg font-semibold text-[#4A3A34]">
                Store Management
              </h2>
              <p className="text-sm text-[#7A675F]">
                Owner-only setup and configuration
              </p>
            </div>

            <Link
              href={`/s/${store.slug}/admin`}
              className="rounded-xl border border-[#D9C5B8] bg-[#FFF9F6] px-3 py-2 text-sm font-semibold text-[#6B7556] transition hover:bg-[#FBEAD6]/60 lg:hidden"
            >
              Back
            </Link>
          </div>
        </header>

        <section className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6">
          {children}
        </section>
      </div>
    </main>
  );
}