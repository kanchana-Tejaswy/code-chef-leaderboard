"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Trophy } from "lucide-react";

export default function CodeChefContestsPage() {
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const fetchContests = async () => {
      try {
        const res = await fetch("/api/contests");
        const data = await res.json();
        if (data.success) {
          const list = (data.contests || []).filter(
            (c: any) => c.platform === "codechef"
          );
          setContests(list);
        }
      } catch (err) {
        console.error("Failed to fetch contests:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchContests();
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getGroup = (c: any) => {
    const start = new Date(c.startTime);
    const end = new Date(c.endTime);
    if (now >= start && now <= end) return "live";
    const diffDays = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (start.toDateString() === now.toDateString() || (diffDays >= 0 && diffDays < 1)) return "today";
    if (diffDays >= 1 && diffDays <= 7) return "thisWeek";
    return "later";
  };

  const renderCountdown = (targetDateStr: string, isLive: boolean, endTimeStr: string) => {
    const target = new Date(isLive ? endTimeStr : targetDateStr);
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return isLive ? "Contest ended" : "Starting...";
    const secs = Math.floor(diff / 1000) % 60;
    const mins = Math.floor(diff / (1000 * 60)) % 60;
    const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (mins > 0 || hours > 0 || days > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return isLive ? `Ends in: ${parts.join(" ")}` : `Starts in: ${parts.join(" ")}`;
  };

  return (
    <div className="min-h-screen bg-brand-bg text-[#FAFAFA] font-sans antialiased p-6 md:p-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto flex flex-col gap-8 relative z-10">
        {/* Navigation */}
        <div>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Leaderboard
          </Link>
        </div>

        {/* Header */}
        <div className="border border-brand-border bg-brand-card/50 backdrop-blur-xl rounded-3xl p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-600/10 border border-purple-500/20 text-purple-400 rounded-2xl shadow-inner">
              <Trophy className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                CodeChef Contests
                <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300">
                  Official Schedule
                </span>
              </h1>
              <p className="text-sm text-brand-muted mt-1">
                Recent, live, and upcoming contests aggregated directly from CodeChef
              </p>
            </div>
          </div>
          <a
            href="https://www.codechef.com/contests"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 font-bold text-xs text-white shadow-lg transition-all text-center"
          >
            Go to CodeChef Website
          </a>
        </div>

        {/* Content grid */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        ) : contests.length === 0 ? (
          <div className="border border-brand-border bg-brand-card/30 rounded-3xl p-16 text-center shadow-lg">
            <Trophy className="h-12 w-12 text-zinc-500 mx-auto mb-4" />
            <h3 className="text-sm font-extrabold text-white">No Upcoming Contests Found</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
              We couldn't retrieve any CodeChef contests at the moment. Please check back later.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contests.map((c) => {
              const start = new Date(c.startTime);
              const group = getGroup(c);
              const isLive = group === "live";
              const hours = Math.floor(c.duration / 60);
              const mins = c.duration % 60;
              const durationStr = `${hours > 0 ? `${hours}h ` : ""}${mins > 0 ? `${mins}m` : ""}`.trim() || `${c.duration}m`;

              return (
                <a
                  key={c.id}
                  href={c.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block p-6 rounded-2xl border border-brand-border/40 bg-brand-card/30 hover:bg-brand-card/90 hover:border-purple-500/50 transition-all duration-200 relative overflow-hidden group ${
                    isLive ? "ring-1 ring-emerald-500/30 border-emerald-500/20 bg-emerald-950/5" : ""
                  }`}
                >
                  {isLive && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[8px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-wider animate-pulse">
                      🟢 LIVE NOW
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-[8px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded font-extrabold uppercase">
                      CodeChef
                    </span>
                    <span className="text-[8px] bg-zinc-900 border border-brand-border/40 text-zinc-400 font-bold px-2 py-0.5 rounded uppercase">
                      {c.type || "Rated"}
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-white group-hover:text-purple-400 transition-colors leading-tight mb-4 min-h-[2.5rem] line-clamp-2">
                    {c.name}
                  </h3>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-[10px] text-zinc-400 font-bold border-t border-brand-border/20 pt-4">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-zinc-500" />
                      <span>{durationStr}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                      <span>
                        {start.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5 mt-1">
                      <span className="text-zinc-500 font-medium">Local Start:</span>
                      <span className="text-zinc-300">
                        {start.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className={`mt-4 text-[10px] font-extrabold px-3 py-2 rounded-xl border flex items-center justify-between ${
                    isLive 
                      ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/25" 
                      : "bg-purple-500/10 text-purple-300 border-purple-500/20"
                  }`}>
                    <span>{isLive ? "Ends in" : "Time to Start"}</span>
                    <span className="font-mono tracking-wider">
                      {renderCountdown(c.startTime, isLive, c.endTime)}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
