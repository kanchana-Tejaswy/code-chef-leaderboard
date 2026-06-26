"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Brain } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-[#0A0A0A] text-center px-4 relative overflow-hidden">
      {/* Radial Gold Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at center, rgba(234, 179, 8, 0.08) 0%, rgba(10, 10, 10, 0) 60%)"
        }}
      />

      <div className="glass-card max-w-md w-full p-8 sm:p-10 rounded-3xl border border-white/5 shadow-2xl relative z-10 flex flex-col items-center gap-6">
        {/* Hexagon Brain SVG Icon */}
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#EAB308]/10 border border-[#EAB308]/30 text-[#EAB308] shadow-inner">
          <Brain className="h-9 w-9" />
          {/* Warning dot */}
          <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white border-2 border-[#111111]">
            !
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black text-white tracking-tight">404</h1>
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Page Not Found</h2>
          <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto">
            The page you are looking for does not exist, has been removed, or has changed boundaries.
          </p>
        </div>

        <div className="w-full pt-4 border-t border-[#262626]/50">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-[#EAB308] hover:bg-[#FACC15] text-xs font-bold text-[#0A0A0A] transition-all shadow-[0_4px_20px_rgba(234,179,8,0.2)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
