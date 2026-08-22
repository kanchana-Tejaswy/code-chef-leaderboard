import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, ShieldCheck, Zap, GraduationCap, ChevronRight } from "lucide-react";
import { getAuthenticatedUserAccess, getRoleHomePath } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const access = await getAuthenticatedUserAccess();
  if (access) {
    redirect(getRoleHomePath(access));
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden bg-brand-bg text-brand-text">
      {/* Background Gradients */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-[#EAB308]/10 to-transparent blur-[120px] dark:from-[#EAB308]/5" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-gradient-to-tr from-blue-500/10 to-transparent blur-[120px] dark:from-blue-500/5" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-8 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-border bg-brand-card/40 backdrop-blur-md text-xs font-semibold text-[#EAB308] tracking-wide animate-pulse">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Phase 1 Live: CodeChef Analytics</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-none text-brand-text">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#EAB308] via-amber-500 to-amber-600">
                CODE AROHA
              </span>
            </h1>

            <p className="text-lg text-brand-muted max-w-2xl leading-relaxed">
              Empowering Engineering Talent Through Real-Time Competitive Programming Analytics.
              Discover, track, and showcase student coding excellence based on verified external achievements.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href="/dashboard"
                className="px-8 py-4 rounded-xl font-bold text-sm tracking-wide bg-[#EAB308] text-[#0A0A0A] hover:bg-[#FACC15] hover:scale-[1.02] shadow-[0_4px_20px_rgba(234,179,8,0.25)] transition-all duration-300 flex items-center justify-center gap-2 group"
              >
                Access Platform
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Micro highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-6 border-t border-brand-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-brand-muted">Verified Profiles</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#EAB308]/10 text-[#EAB308]">
                  <Zap className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-brand-muted">Real-Time Sync</span>
              </div>
              <div className="flex items-center gap-2.5 col-span-2 sm:col-span-1">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-brand-muted">Placement Ready</span>
              </div>
            </div>
          </div>

          {/* Right Preview Card / Features Visual */}
          <div className="lg:col-span-5 relative flex justify-center lg:justify-end">
            <div className="w-full max-w-md p-8 rounded-3xl border border-brand-border bg-brand-card/45 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#EAB308]/10 to-transparent blur-2xl" />
              
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-brand-border/60">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-[#EAB308]" />
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                </div>
                <span className="text-[10px] font-bold tracking-widest text-[#EAB308] uppercase">System Live</span>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-extrabold tracking-wide uppercase text-brand-text">
                  Key Capabilities
                </h3>

                <div className="space-y-4">
                  {[
                    { title: "AI Powered Analytics", desc: "Automated talent indexing & performance mapping" },
                    { title: "CodeChef Insights", desc: "Verified rating, rank, stars & problem stats" },
                    { title: "LeetCode Analytics", desc: "Consistency logs & topic mastery radar (Soon)" },
                    { title: "GitHub Portfolio Tracking", desc: "Commit timelines & repo quality scores (Soon)" },
                    { title: "Placement Readiness", desc: "Intelligent analytics for placement officers" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-brand-bg/50 border border-brand-border/40 hover:border-[#EAB308]/20 transition-all duration-300">
                      <div className="h-5 w-5 rounded-full bg-[#EAB308]/10 text-[#EAB308] flex items-center justify-center shrink-0 mt-0.5">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-brand-text">{item.title}</h4>
                        <p className="text-[10px] text-brand-muted mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer info */}
      <div className="border-t border-brand-border py-6 relative z-10 bg-brand-card/20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-brand-muted">
            &copy; 2026 CODE AROHA. All rights reserved. Powered by Supabase & Next.js.
          </p>
        </div>
      </div>
    </div>
  );
}
