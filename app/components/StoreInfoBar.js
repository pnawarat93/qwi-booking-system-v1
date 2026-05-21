"use client";

import Link from "next/link";
import { MapPin, Phone, ShieldCheck } from "lucide-react";

export default function StoreInfoBar({
  shopName,
  shopPhone,
  shopAddress,
  ownerHref,
}) {
  return (
    <div className="border-b border-[#E9DED8] bg-[#FFF9F6]/95 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#4A3A34] text-white shadow-sm">
              <span className="text-sm font-black tracking-wide">
                {shopName?.charAt(0)?.toUpperCase() || "S"}
              </span>
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-black tracking-tight text-[#4A3A34]">
                {shopName}
              </h1>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#7B6A63]">
                {shopPhone ? (
                  <div className="flex items-center gap-1.5">
                    <Phone size={13} />
                    <span>{shopPhone}</span>
                  </div>
                ) : null}

                {shopAddress ? (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} />
                    <span className="truncate">{shopAddress}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {ownerHref ? (
          <Link
            href={ownerHref}
            className="group flex items-center gap-2 rounded-2xl border border-[#E9DED8] bg-white px-4 py-2.5 text-sm font-semibold text-[#5B4B45] shadow-sm transition-all hover:-translate-y-[1px] hover:border-[#D8B6BD] hover:bg-[#FFF5F7] hover:text-[#4A3A34] hover:shadow-md"
          >
            <ShieldCheck
              size={16}
              className="text-[#C87D87] transition-transform group-hover:scale-105"
            />

            <span>Owner Dashboard</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}