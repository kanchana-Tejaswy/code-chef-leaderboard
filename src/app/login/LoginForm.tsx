"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Loader2, ShieldCheck, Lock } from "lucide-react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!trimmedPassword) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid email or password.");
      }

      // Success! Redirect to dashboard
      window.location.href = data.redirectTo || "/dashboard";
    } catch (err: any) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-[#0A0A0A] py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="w-full max-w-md space-y-8 bg-[#FFFFFF] dark:bg-[#111111] p-8 sm:p-10 rounded-2xl shadow-xl border border-[rgba(15,23,42,0.10)] dark:border-[#262626]">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center space-y-3">
          {/* Logo & Branding */}
          <div className="relative p-1 rounded-2xl bg-gradient-to-b from-[#EAB308]/20 to-transparent border border-[#EAB308]/30">
            <Image
              src="/ace-logo-ldb.jpg"
              alt="ACE Logo"
              width={52}
              height={52}
              className="rounded-xl shadow-md"
            />
          </div>

          <div className="flex flex-col items-center">
            <span className="text-sm font-extrabold tracking-wider uppercase text-[#0F172A] dark:text-[#FAFAFA]">
              ACE Talent Intelligence
            </span>
            <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#EAB308]/30 bg-[#EAB308]/10 text-[#EAB308] text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3 text-[#EAB308]" />
              <span>Staff Portal</span>
            </div>
          </div>

          <div className="pt-2 space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-[#0F172A] dark:text-[#FAFAFA]">
              Welcome back
            </h1>
            <p className="text-xs text-[#64748B] dark:text-[#A3A3A3] max-w-xs leading-relaxed">
              Sign in to manage student talent intelligence and platform analytics.
            </p>
          </div>
        </div>

        {/* Error Alert (Strictly Amber/Red, NO BLUE) */}
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl text-xs font-semibold text-red-700 dark:text-red-400 bg-red-500/10 border border-red-500/20 text-center animate-fade-in flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA] mb-1.5"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
                placeholder="staff@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[rgba(15,23,42,0.10)] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#1A1A1A]/50 text-[#0F172A] dark:text-[#FAFAFA] placeholder-[#64748B] dark:placeholder-[#A3A3A3] text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/40 focus:border-[#EAB308] transition-all disabled:opacity-60"
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-[rgba(15,23,42,0.10)] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#1A1A1A]/50 text-[#0F172A] dark:text-[#FAFAFA] placeholder-[#64748B] dark:placeholder-[#A3A3A3] text-sm focus:outline-none focus:ring-2 focus:ring-[#EAB308]/40 focus:border-[#EAB308] transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#64748B] dark:text-[#A3A3A3] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-[#EAB308]" />
                  ) : (
                    <Eye className="w-4 h-4 text-[#64748B] dark:text-[#A3A3A3]" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            className="w-full py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-[#0A0A0A] bg-[#EAB308] hover:bg-[#FACC15] focus:outline-none focus:ring-2 focus:ring-[#EAB308]/50 shadow-[0_4px_20px_rgba(234,179,8,0.25)] hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0A0A0A]" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In to Staff Portal</span>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="pt-4 border-t border-[rgba(15,23,42,0.10)] dark:border-[#262626] text-center">
          <p className="text-[11px] font-medium text-[#64748B] dark:text-[#A3A3A3] tracking-wide">
            This portal is available to authorised administrators and institutional staff.
          </p>
        </div>

      </div>
    </div>
  );
}
