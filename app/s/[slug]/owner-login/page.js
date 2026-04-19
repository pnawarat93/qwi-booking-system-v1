"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import { useStore } from "../StoreContext";
import { ShieldCheck, ArrowRight, Loader2, KeyRound } from "lucide-react";

export default function OwnerLoginPage() {
  const [pin, setPin] = useState("");
  const [localError, setLocalError] = useState("");

  const { login, logout, loading, error, clearError } = useAuthStore();
  const store = useStore();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pin.length < 4) return;

    setLocalError("");

    const loggedInUser = await login(pin, store.slug);

    if (!loggedInUser) return;

    if (loggedInUser.role !== "owner") {
      logout();
      setLocalError("Owner PIN required");
      return;
    }

    router.push(`/s/${store.slug}/owner`);
  };

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    if (value.length <= 4) {
      setPin(value);

      if (typeof clearError === "function") {
        clearError();
      }

      setLocalError("");
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-[#FFF9F6] flex items-center justify-center p-4">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#F0C4CB]/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#E5BCA9]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="rounded-[2rem] border border-[#E8D8CC] bg-white/70 p-8 shadow-[0_20px_60px_rgba(180,140,120,0.15)] backdrop-blur-xl">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#E5BCA9]/60 bg-[#FBEAD6]/80 px-3 py-1.5 text-xs font-medium text-[#6B7556]">
            <ShieldCheck className="h-4 w-4 text-[#C87D87]" />
            {store.name} — Owner Dashboard
          </div>

          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-[#FFF9F6] rounded-2xl border border-[#F1E4DA] flex items-center justify-center shadow-sm mb-4">
              <KeyRound className="w-8 h-8 text-[#C87D87]" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#4A3A34]">
              Owner Access
            </h1>
            <p className="mt-2 text-sm text-[#7A675F]">
              Enter owner PIN to open the owner dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={handlePinChange}
                  placeholder="••••"
                  className="w-full text-center text-4xl tracking-[0.5em] rounded-2xl border border-[#E5BCA9]/60 bg-white px-4 py-4 text-[#4A3A34] shadow-inner outline-none transition focus:border-[#C87D87] focus:ring-4 focus:ring-[#F0C4CB]/30"
                  autoFocus
                />
              </div>

              {displayError ? (
                <p className="mt-2 text-center text-sm font-medium text-red-500 animate-pulse">
                  {displayError}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={pin.length < 4 || loading}
              className={`w-full flex items-center justify-center gap-2 rounded-2xl px-5 py-4 font-semibold text-white shadow-md transition-all ${
                pin.length === 4 && !loading
                  ? "bg-[#4A3A34] hover:bg-[#3b2f2b] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                  : "bg-[#B8ADA8] cursor-not-allowed"
              }`}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Open Owner Dashboard</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}