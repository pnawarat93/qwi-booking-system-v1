"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "../StoreContext";
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2, AlertCircle } from "lucide-react";

export default function OwnerLoginPage() {
  const store = useStore();
  const router = useRouter();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/s/${store.slug}/owner-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid email or password");
        setLoading(false);
        return;
      }

      // Session cookie is now set — redirect to owner dashboard
      router.push(`/s/${store.slug}/owner`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FFF9F6] flex items-center justify-center p-4">
      {/* Blurred background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#F0C4CB]/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#E5BCA9]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="rounded-[2rem] border border-[#E8D8CC] bg-white/70 p-10 shadow-[0_20px_60px_rgba(180,140,120,0.15)] backdrop-blur-xl">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E5BCA9]/60 bg-[#FBEAD6]/80 px-3 py-1.5 text-xs font-medium text-[#6B7556]">
              <ShieldCheck className="h-4 w-4 text-[#C87D87]" />
              {store.name} — Owner Portal
            </span>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-[#FFF9F6] rounded-2xl border border-[#F1E4DA] flex items-center justify-center shadow-sm mb-4">
              <ShieldCheck className="w-8 h-8 text-[#C87D87]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#4A3A34]">
              Owner Sign In
            </h1>
            <p className="mt-2 text-sm text-[#7A675F]">
              Sign in to manage your store
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#4A3A34] mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9A8A82]" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-[#E5BCA9]/60 bg-white py-3.5 pl-11 pr-4 text-[#4A3A34] shadow-inner outline-none transition placeholder:text-[#C0ABA4] focus:border-[#C87D87] focus:ring-4 focus:ring-[#F0C4CB]/30"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-[#4A3A34] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9A8A82]" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full rounded-2xl border border-[#E5BCA9]/60 bg-white py-3.5 pl-11 pr-4 text-[#4A3A34] shadow-inner outline-none transition placeholder:text-[#C0ABA4] focus:border-[#C87D87] focus:ring-4 focus:ring-[#F0C4CB]/30"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-2xl bg-[#C87D87] px-6 py-4 font-bold text-white shadow-lg shadow-[#C87D87]/20 transition-all hover:bg-[#B66B75] hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-[#9A8A82]">
            Are you staff?{" "}
            <a
              href={`/s/${store.slug}/login`}
              className="underline decoration-[#C87D87]/30 hover:text-[#C87D87] font-medium transition-colors"
            >
              Go to PIN login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}