"use client";

import Link from "next/link";
import {
  CalendarDays,
  Users,
  Briefcase,
  Clock3,
  Settings,
  ArrowRight,
  CheckCircle2,
  Store,
} from "lucide-react";
import { useStore } from "../StoreContext";

const setupCards = [
  {
    title: "Set up roster",
    description:
      "Create the default weekly working pattern for your staff.",
    href: (slug) => `/s/${slug}/owner/roster`,
    icon: CalendarDays,
  },
  {
    title: "Manage staff",
    description:
      "Add team members, display names, staff codes, and active status.",
    href: (slug) => `/s/${slug}/owner/staff`,
    icon: Users,
  },
  {
    title: "Manage services",
    description:
      "Add or update services, prices, durations, and payout defaults.",
    href: (slug) => `/s/${slug}/owner/services`,
    icon: Briefcase,
  },
  {
    title: "Business hours",
    description:
      "Set your regular opening hours and special trading days.",
    href: (slug) => `/s/${slug}/owner/business-hours`,
    icon: Clock3,
  },
];

const quickLinks = [
  {
    label: "Store settings",
    href: (slug) => `/s/${slug}/owner/settings`,
    icon: Settings,
  },
  {
    label: "Back to front desk",
    href: (slug) => `/s/${slug}/admin`,
    icon: Store,
  },
];

export default function OwnerOverviewPage() {
  const store = useStore();

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1.75rem] border border-[#E8D8CC] bg-white shadow-[0_10px_30px_rgba(180,140,120,0.08)]">
        <div className="bg-linear-to-br from-[#FBEAD6]/90 via-[#FFF9F6] to-[#F7D9DE]/55 px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C87D87]">
            Owner Dashboard
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#4A3A34] sm:text-4xl">
            Welcome to {store.name}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#7A675F] sm:text-base sm:leading-7">
            This is your owner-only area for setting up staff, services,
            roster, and business rules for your store.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/s/${store.slug}/owner/roster`}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#C87D87] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Start with roster
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href={`/s/${store.slug}/admin`}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#D9C5B8] bg-[#FFF9F6] px-5 py-3 text-sm font-semibold text-[#6B7556] transition hover:bg-[#FBEAD6]/60"
            >
              Go to front desk
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-[#E8D8CC] bg-white p-5 shadow-[0_10px_24px_rgba(180,140,120,0.06)] sm:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-[#4A3A34]">
              Store setup
            </h2>
            <p className="mt-1 text-sm text-[#7A675F]">
              Start with these core areas to get your store ready for daily use.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {setupCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.title}
                  href={card.href(store.slug)}
                  className="group rounded-[1.25rem] border border-[#E8D8CC] bg-[#FFFDFC] p-5 transition hover:border-[#E5BCA9] hover:bg-[#FFF7F1]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FBEAD6]">
                      <Icon className="h-5 w-5 text-[#6B7556]" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-[#4A3A34]">
                        {card.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[#7A675F]">
                        {card.description}
                      </p>

                      <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#C87D87]">
                        Open
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-[#E8D8CC] bg-white p-5 shadow-[0_10px_24px_rgba(180,140,120,0.06)] sm:p-6">
            <h2 className="text-xl font-semibold text-[#4A3A34]">
              Suggested checklist
            </h2>
            <p className="mt-1 text-sm text-[#7A675F]">
              A simple order to set up your store without getting overwhelmed.
            </p>

            <div className="mt-5 space-y-3">
              {[
                "Add your staff",
                "Add your services",
                "Set business hours",
                "Set your weekly roster",
                "Review your booking page",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-[#F1E4DA] bg-[#FFF9F6] px-4 py-3"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#6B7556]" />
                  <p className="text-sm text-[#4A3A34]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#E8D8CC] bg-white p-5 shadow-[0_10px_24px_rgba(180,140,120,0.06)] sm:p-6">
            <h2 className="text-xl font-semibold text-[#4A3A34]">
              Quick access
            </h2>
            <div className="mt-4 space-y-3">
              {quickLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    href={item.href(store.slug)}
                    className="flex items-center justify-between rounded-2xl border border-[#F1E4DA] bg-[#FFFDFC] px-4 py-3 text-sm font-medium text-[#4A3A34] transition hover:border-[#E5BCA9] hover:bg-[#FFF7F1]"
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-[#6B7556]" />
                      {item.label}
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#C87D87]" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}