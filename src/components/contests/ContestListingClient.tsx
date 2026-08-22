"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Trophy, 
  Search, 
  Filter, 
  Clock, 
  Calendar, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  RefreshCw,
  AlertTriangle
} from "lucide-react";

function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}


interface Contest {
  id: string;
  platform: string;
  platformContestId: string;
  name: string;
  slug: string;
  status: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  lastResultSync: string | null;
  participantCount: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ContestListingClientProps {
  userRole: string;
}

export function ContestListingClient({ userRole }: ContestListingClientProps) {
  const [activeTab, setActiveTab] = useState<"LIVE" | "UPCOMING" | "COMPLETED">("COMPLETED");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("ALL");
  const [page, setPage] = useState(1);
  const [contests, setContests] = useState<Contest[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchContests = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: activeTab,
        page: page.toString(),
        limit: "9",
      });
      if (search) params.append("search", search);
      if (platform && platform !== "ALL") params.append("platform", platform);

      const res = await fetch(`/api/contests?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch contests");
      }
      const json = await res.json();
      if (json.success) {
        setContests(json.data);
        setPagination(json.pagination);
      } else {
        throw new Error(json.error || "Failed to load data");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, platform]);

  useEffect(() => {
    fetchContests();
  }, [activeTab, page, search, platform]);

  const handleRefreshMetadata = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/admin/contests/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discover" }),
      });
      if (!res.ok) {
        throw new Error("Failed to trigger contest discovery");
      }
      const json = await res.json();
      if (json.success) {
        fetchContests();
      } else {
        alert(json.error || "Failed to refresh contests");
      }
    } catch (err: any) {
      alert(err.message || "Error syncing contests");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getPlatformLabel = (plat: string) => {
    if (plat === "CODECHEF") return "CodeChef";
    if (plat === "LEETCODE") return "LeetCode";
    if (plat === "CODEFORCES") return "Codeforces";
    return plat;
  };

  const getPlatformColor = (plat: string) => {
    if (plat === "CODECHEF") return "bg-amber-500/10 text-amber-500 border-amber-500/25";
    if (plat === "LEETCODE") return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/25";
    if (plat === "CODEFORCES") return "bg-orange-500/10 text-orange-600 dark:text-orange-500 border-orange-500/25";
    return "bg-brand-muted/10 text-brand-muted border-brand-border";
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-text sm:text-3xl flex items-center gap-2">
            <Trophy className="h-8 w-8 text-[#EAB308]" />
            Contest Intelligence
          </h1>
          <p className="mt-1 text-sm text-brand-muted">
            Track student performance, schedules, and participation history across platforms.
          </p>
        </div>

        {/* Refresh button for admins/staff */}
        {(userRole === "ADMIN" || userRole === "GK_SIR") && (
          <button
            onClick={handleRefreshMetadata}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 rounded-lg border border-[#EAB308]/20 bg-zinc-100 dark:bg-zinc-950/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#EAB308] transition-all hover:bg-[#EAB308]/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh Contests List
          </button>
        )}
      </div>

      {/* Tabs and Filters Controls */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-brand-border bg-brand-card p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-brand-border/60 pb-2 sm:border-0 sm:pb-0">
          {(["LIVE", "UPCOMING", "COMPLETED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-2 text-xs font-extrabold tracking-wide uppercase transition-all duration-200 ${
                activeTab === tab
                  ? "bg-[#EAB308] text-[#0A0A0A] shadow-[0_2px_10px_rgba(234,179,8,0.2)]"
                  : "bg-transparent text-brand-muted hover:bg-brand-muted/10 hover:text-brand-text"
              }`}
            >
              {tab === "LIVE" ? "Live Now" : tab === "UPCOMING" ? "Upcoming" : "Past Contests"}
            </button>
          ))}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Platform Filter */}
          <div className="relative flex-1 min-w-[140px] sm:flex-none">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full appearance-none rounded-lg border border-brand-border bg-brand-bg px-3 py-2 pr-8 text-xs font-bold text-brand-text focus:border-[#EAB308] focus:ring-1 focus:ring-[#EAB308] outline-none"
            >
              <option value="ALL">All Platforms</option>
              <option value="CODECHEF">CodeChef</option>
              <option value="LEETCODE">LeetCode</option>
              <option value="CODEFORCES">Codeforces</option>
            </select>
            <Filter className="absolute right-3 top-2.5 h-3.5 w-3.5 text-brand-muted pointer-events-none" />
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contest name..."
              className="w-full rounded-lg border border-brand-border bg-brand-bg pl-9 pr-4 py-2 text-xs font-bold text-brand-text placeholder-brand-muted focus:border-[#EAB308] focus:ring-1 focus:ring-[#EAB308] outline-none"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-brand-muted" />
          </div>
        </div>
      </div>

      {/* Main Listing View */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-xl border border-brand-border/60 bg-brand-card p-5 animate-pulse flex flex-col justify-between"
            >
              <div>
                <div className="h-4 w-20 rounded bg-zinc-800 mb-3" />
                <div className="h-6 w-3/4 rounded bg-zinc-800 mb-2" />
                <div className="h-4 w-1/2 rounded bg-zinc-800" />
              </div>
              <div className="h-8 w-full rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/10 bg-red-500/5 p-12 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4 animate-bounce" />
          <h3 className="text-lg font-bold text-white mb-2">Failed to Load Contests</h3>
          <p className="text-sm text-brand-muted max-w-md">{error}</p>
          <button
            onClick={fetchContests}
            className="mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-400 border border-red-500/25 hover:bg-red-500/20"
          >
            Retry Fetch
          </button>
        </div>
      ) : contests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-border bg-brand-card p-16 text-center">
          <Trophy className="h-12 w-12 text-brand-muted mb-4 opacity-50" />
          <h3 className="text-lg font-extrabold text-white mb-2">No Contests Found</h3>
          <p className="text-xs text-brand-muted max-w-sm">
            There are currently no {activeTab.toLowerCase()} contests matches for this search/filter criteria.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {contests.map((contest) => {
              const formattedDate = formatDate(contest.startTime);
              const formattedTime = formatTime(contest.startTime);
              const durationHours = (contest.duration / 60).toFixed(1);

              return (
                <div
                  key={contest.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-brand-border/60 bg-brand-card p-5 transition-all duration-300 hover:border-[#EAB308]/30 hover:shadow-[0_4px_30px_rgba(234,179,8,0.05)]"
                >
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-amber-500/0 via-[#EAB308]/0 to-amber-500/0 transition-all duration-300 group-hover:via-[#EAB308]/30" />
                  
                  <div>
                    {/* Platform Tag */}
                    <div className="mb-3 flex items-center justify-between">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${getPlatformColor(contest.platform)}`}>
                        {getPlatformLabel(contest.platform)}
                      </span>
                      {contest.status === "LIVE" && (
                        <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          Live Now
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-extrabold text-brand-text group-hover:text-[#EAB308] transition-colors line-clamp-2">
                      {contest.name}
                    </h3>

                    {/* Metadata list */}
                    <div className="mt-4 space-y-2 text-xs font-bold text-brand-muted">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-brand-muted" />
                        <span>{formattedDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-brand-muted" />
                        <span>{formattedTime} ({durationHours} hrs)</span>
                      </div>
                      
                      {contest.status === "COMPLETED" && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-brand-muted" />
                          <span>{contest.participantCount} CODE AROHA Participants</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Button Action */}
                  <div className="mt-5 pt-4 border-t border-brand-border/40">
                    {contest.status === "COMPLETED" ? (
                      <Link
                        href={`/contests/${contest.slug}`}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#EAB308]/20 bg-[#EAB308]/5 py-2.5 text-xs font-extrabold uppercase tracking-widest text-[#EAB308] transition-all hover:bg-[#EAB308] hover:text-[#0A0A0A] shadow-[0_2px_8px_rgba(234,179,8,0.02)]"
                      >
                        View Statistics
                      </Link>
                    ) : (
                      <a
                        href={
                          contest.platform === "CODECHEF"
                            ? `https://www.codechef.com/${contest.platformContestId}`
                            : "https://leetcode.com/contest"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-border bg-brand-bg py-2.5 text-xs font-bold uppercase tracking-widest text-brand-text transition-all hover:bg-brand-muted/10 hover:text-brand-text"
                      >
                        {contest.status === "LIVE" ? "Join Contest" : "Open Platform"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t border-brand-border/40 pt-4">
              <span className="text-xs font-bold text-brand-muted">
                Showing page <strong className="text-brand-text">{pagination.page}</strong> of <strong className="text-brand-text">{pagination.totalPages}</strong> ({pagination.total} total contests)
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center justify-center rounded-lg border border-brand-border bg-brand-card p-2 text-brand-muted hover:text-[#EAB308] disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="flex items-center justify-center rounded-lg border border-brand-border bg-brand-card p-2 text-brand-muted hover:text-[#EAB308] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
