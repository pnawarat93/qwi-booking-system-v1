"use client";

import { useStore } from "../StoreContext";
import { ShieldCheck, LogIn, ExternalLink } from "lucide-react";

export default function OwnerLoginPage() {
  const store = useStore();

  const handlePortalLogin = () => {
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "http://localhost:3000";
    window.location.href = `${portalUrl}/login?callbackUrl=${window.location.origin}/s/${store.slug}/owner`;
  };

  return (
    <div className="min-h-screen bg-[#FFF9F6] flex items-center justify-center p-4">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#F0C4CB]/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#E5BCA9]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="rounded-[2rem] border border-[#E8D8CC] bg-white/70 p-10 shadow-[0_20px_60px_rgba(180,140,120,0.15)] backdrop-blur-xl text-center">
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-[#E5BCA9]/60 bg-[#FBEAD6]/80 px-3 py-1.5 text-xs font-medium text-[#6B7556]">
            <ShieldCheck className="h-4 w-4 text-[#C87D87]" />
            {store.name} — Restricted Area
          </div>

          <div className="mb-10">
            <div className="mx-auto w-20 h-20 bg-[#FFF9F6] rounded-[1.5rem] border border-[#F1E4DA] flex items-center justify-center shadow-sm mb-6">
              <LogIn className="w-10 h-10 text-[#C87D87]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#4A3A34] mb-3">
              Owner Management
            </h1>
            <p className="text-[#7A675F] text-sm leading-relaxed">
              PIN access for owners has been deprecated for security. 
              Please log in via the <strong>Qwi SaaS Portal</strong> to manage your business.
            </p>
          </div>

          <button
            onClick={handlePortalLogin}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-[#C87D87] px-6 py-5 font-bold text-white shadow-lg shadow-[#C87D87]/20 transition-all hover:bg-[#B66B75] hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
          >
            <span>Log in via Qwi Portal</span>
            <ExternalLink className="w-5 h-5" />
          </button>

          <p className="mt-8 text-xs text-gray-400">
            Are you staff? Go back to <a href={`/s/${store.slug}/admin`} className="underline decoration-[#C87D87]/30 hover:text-[#C87D87] font-medium transition-colors">Front Desk PIN login</a>.
          </p>
        </div>
      </div>
    </div>
  );
}