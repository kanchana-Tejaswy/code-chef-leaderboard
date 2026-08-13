"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Trophy, 
  ArrowLeft, 
  Users, 
  Calendar, 
  Clock, 
  RefreshCw, 
  Search, 
  AlertTriangle,
  Award,
  ChevronLeft,
  ChevronRight,
  Filter,
  BarChart2,
  PieChart as PieIcon,
  Crown,
  Loader2
} from "lucide-react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";

function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return `${formatDate(d)} at ${formatTime(d)}`;
}


interface Participant {
  id: string;
  rank: number | null;
  score: number | null;
  problemsSolved: number | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingChange: number | null;
  platformUsername: string;
  student: {
    id: string;
    name: string;
    rollNumber: string;
  };
  studentEnrollment: {
    cohort: { code: string };
    department: { code: string };
    classSection: { name: string } | null;
  } | null;
}

interface StatsData {
  totalEligible: number;
  participantCount: number;
  participationPercentage: number;
  highestRank: number | null;
  averageRank: number | null;
  averageRatingChange: number | null;
}

interface Breakdowns {
  department: Record<string, number>;
  cohort: Record<string, number>;
  section: Record<string, number>;
}

interface TopPerformer {
  studentId: string;
  name: string;
  rollNumber: string;
  rank: number | null;
  ratingAfter: number | null;
  ratingChange: number | null;
  department: string | null;
  cohort: string | null;
  section: string | null;
}

interface ContestDetailClientProps {
  contestSlug: string;
  contestName: string;
  platform: string;
  platformContestId: string;
  startTime: string;
  endTime: string;
  duration: number;
  lastResultSync: string | null;
  userRole: string;
}

const COLORS = ["#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#8B5CF6", "#EC4899"];

export function ContestDetailClient({
  contestSlug,
  contestName,
  platform,
  platformContestId,
  startTime,
  endTime,
  duration,
  lastResultSync: initialLastResultSync,
  userRole
}: ContestDetailClientProps) {
  // Sync state
  const [lastResultSync, setLastResultSync] = useState<string | null>(initialLastResultSync);
  const [isSyncing, setIsSyncing] = useState(false);

  // Stats states
  const [stats, setStats] = useState<StatsData | null>(null);
  const [breakdowns, setBreakdowns] = useState<Breakdowns | null>(null);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Participants list states
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  
  // Filter and pagination states
  const [search, setSearch] = useState("");
  const [selectedCohort, setSelectedCohort] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [sortBy, setSortBy] = useState("rank");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalParticipants, setTotalParticipants] = useState(0);

  // Distribution chart buckets computed in client
  const [distributionData, setDistributionData] = useState<any[]>([]);

  const fetchStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch(`/api/contests/${contestSlug}/stats`);
      if (!res.ok) throw new Error("Failed to fetch contest statistics");
      const json = await res.json();
      if (json.success) {
        setStats(json.stats);
        setBreakdowns(json.breakdowns);
        setTopPerformers(json.topPerformers);
      } else {
        throw new Error(json.error || "Failed to load stats");
      }
    } catch (err: any) {
      console.error(err);
      setStatsError(err.message || "An error occurred fetching statistics.");
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchParticipants = async () => {
    setParticipantsLoading(true);
    setParticipantsError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        sort: sortBy,
        order: sortOrder,
      });
      if (search) params.append("search", search);
      if (selectedCohort) params.append("cohort", selectedCohort);
      if (selectedDept) params.append("department", selectedDept);
      if (selectedSection) params.append("section", selectedSection);

      const res = await fetch(`/api/contests/${contestSlug}/participants?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch participants");
      const json = await res.json();
      if (json.success) {
        setParticipants(json.data);
        setTotalPages(json.pagination.totalPages);
        setTotalParticipants(json.pagination.total);
      } else {
        throw new Error(json.error || "Failed to load participants");
      }
    } catch (err: any) {
      console.error(err);
      setParticipantsError(err.message || "An error occurred fetching participants.");
    } finally {
      setParticipantsLoading(false);
    }
  };

  // Trigger results sync (ADMIN/GK_SIR only)
  const handleSyncResults = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      // Find contest ID from stats or API
      const listRes = await fetch(`/api/contests?search=${platformContestId}`);
      const listJson = await listRes.json();
      const contestId = listJson.data?.[0]?.id;

      if (!contestId) {
        throw new Error("Could not resolve internal contest ID.");
      }

      const res = await fetch("/api/admin/contests/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_results", contestId }),
      });
      if (!res.ok) throw new Error("Sync results failed");
      const json = await res.json();
      if (json.success) {
        setLastResultSync(new Date().toISOString());
        fetchStats();
        fetchParticipants();
      } else {
        alert(json.error || "Failed to sync results");
      }
    } catch (err: any) {
      alert(err.message || "Error syncing results");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [contestSlug]);

  useEffect(() => {
    fetchParticipants();
  }, [contestSlug, page, sortBy, sortOrder, selectedCohort, selectedDept, selectedSection]);

  // Handle live search reset
  useEffect(() => {
    setPage(1);
  }, [search, selectedCohort, selectedDept, selectedSection]);

  // Compute distribution buckets once participants list is loaded
  useEffect(() => {
    if (!participants || participants.length === 0) return;

    // Check if score exists, otherwise fallback to rank bucketing
    const hasScores = participants.some(p => p.score !== null);
    
    if (hasScores) {
      // Bucket by scores (500+, 400-499, etc.)
      const buckets = {
        "500+": 0,
        "400-499": 0,
        "300-399": 0,
        "200-299": 0,
        "<200": 0
      };
      participants.forEach(p => {
        if (p.score !== null) {
          if (p.score >= 500) buckets["500+"]++;
          else if (p.score >= 400) buckets["400-499"]++;
          else if (p.score >= 300) buckets["300-399"]++;
          else if (p.score >= 200) buckets["200-299"]++;
          else buckets["<200"]++;
        }
      });
      setDistributionData(Object.entries(buckets).map(([name, count]) => ({ name, count })));
    } else {
      // CodeChef fallback: bucket by ranks (<100, 100-499, 500-1999, 2000-4999, 5000+)
      const buckets = {
        "Top 100": 0,
        "100-499": 0,
        "500-1999": 0,
        "2000-4999": 0,
        "5000+": 0
      };
      participants.forEach(p => {
        if (p.rank !== null) {
          if (p.rank < 100) buckets["Top 100"]++;
          else if (p.rank < 500) buckets["100-499"]++;
          else if (p.rank < 2000) buckets["500-1999"]++;
          else if (p.rank < 5000) buckets["2000-4999"]++;
          else buckets["5000+"]++;
        }
      });
      setDistributionData(Object.entries(buckets).map(([name, count]) => ({ name, count })));
    }
  }, [participants]);

  // Extract keys for filtering dropdowns from breakdowns
  const departmentsList = breakdowns?.department ? Object.keys(breakdowns.department) : [];
  const cohortsList = breakdowns?.cohort ? Object.keys(breakdowns.cohort) : [];
  const sectionsList = breakdowns?.section ? Object.keys(breakdowns.section) : [];

  // Recharts Pie Chart Formatter
  const departmentChartData = breakdowns?.department 
    ? Object.entries(breakdowns.department).map(([name, value]) => ({ name, value })) 
    : [];

  const cohortChartData = breakdowns?.cohort
    ? Object.entries(breakdowns.cohort).map(([name, value]) => ({ name, value }))
    : [];

  const sectionChartData = breakdowns?.section
    ? Object.entries(breakdowns.section).map(([name, value]) => ({ name, value }))
    : [];

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const formattedStartTime = formatDateTime(startTime);
  const durationHours = (duration / 60).toFixed(1);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back button and Header */}
      <div className="mb-8">
        <Link href="/contests" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-brand-muted hover:text-[#EAB308] transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Contests
        </Link>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-500">
                {platform}
              </span>
              <span className="text-xs font-bold text-brand-muted">ID: {platformContestId}</span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-brand-text sm:text-3xl">
              {contestName}
            </h1>
            <p className="mt-2 text-xs font-medium text-brand-muted flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formattedStartTime}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {durationHours} Hours duration</span>
              {lastResultSync && (
                <span>Last Sync: {formatDateTime(lastResultSync)}</span>
              )}
            </p>
          </div>

          {/* Sync Button */}
          {(userRole === "ADMIN" || userRole === "GK_SIR") && (
            <button
              onClick={handleSyncResults}
              disabled={isSyncing}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#EAB308]/20 bg-[#EAB308]/5 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#EAB308] transition-all hover:bg-[#EAB308] hover:text-[#0A0A0A] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync Results"}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {statsLoading ? (
        <div className="mb-8 grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-brand-border bg-brand-card animate-pulse" />
          ))}
        </div>
      ) : statsError ? (
        <div className="mb-8 rounded-xl border border-red-500/10 bg-red-500/5 p-4 text-xs font-bold text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {statsError}
        </div>
      ) : stats && (
        <div className="mb-8 grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "ACE Students", value: stats.totalEligible },
            { label: "Participants", value: stats.participantCount },
            { label: "Participation %", value: `${stats.participationPercentage}%` },
            { label: "Highest Rank", value: stats.highestRank !== null ? stats.highestRank : "N/A" },
            { label: "Average Rank", value: stats.averageRank !== null ? Math.round(stats.averageRank) : "N/A" },
            { label: "Avg Rating Change", value: stats.averageRatingChange !== null ? `${stats.averageRatingChange > 0 ? "+" : ""}${stats.averageRatingChange}` : "N/A" }
          ].map((card, idx) => (
            <div key={idx} className="rounded-xl border border-brand-border bg-brand-card p-4 flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted">{card.label}</span>
              <span className="mt-2 text-xl font-black text-brand-text">{card.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top Performers Podium */}
      {!statsLoading && topPerformers.length > 0 && (
        <div className="mb-8 rounded-2xl border border-brand-border bg-brand-card p-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-brand-muted flex items-center gap-1.5 mb-6">
            <Crown className="h-4 w-4 text-[#EAB308]" /> Top Performers
          </h2>
          
          <div className="flex flex-col items-end justify-center gap-6 sm:flex-row sm:gap-4 md:gap-8 pt-4">
            {/* 2nd Place */}
            {topPerformers[1] && (
              <div className="flex flex-col items-center w-full max-w-[12rem] order-2 sm:order-1">
                <div className="relative mb-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-950 font-extrabold text-zinc-500 dark:text-zinc-400 text-sm">
                    🥈
                  </div>
                </div>
                <span className="text-xs font-extrabold text-brand-text text-center line-clamp-1">{topPerformers[1].name}</span>
                <span className="text-[9px] font-bold text-brand-muted">{topPerformers[1].rollNumber}</span>
                <div className="mt-3 flex h-20 w-full flex-col items-center justify-center rounded-t-xl border border-zinc-200 dark:border-zinc-700/30 bg-zinc-100/50 dark:bg-zinc-950/40 p-2">
                  <span className="text-xs font-black text-zinc-700 dark:text-zinc-400">Rank {topPerformers[1].rank}</span>
                  <span className="text-[10px] text-brand-muted mt-1">Change: {topPerformers[1].ratingChange !== null ? `${topPerformers[1].ratingChange > 0 ? "+" : ""}${topPerformers[1].ratingChange}` : "N/A"}</span>
                </div>
              </div>
            )}

            {/* 1st Place */}
            {topPerformers[0] && (
              <div className="flex flex-col items-center w-full max-w-[14rem] order-1 sm:order-2">
                <div className="relative mb-2">
                  <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 h-5 w-5 text-[#EAB308] animate-bounce" />
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-500/30 dark:border-[#EAB308]/40 bg-[#EAB308]/10 dark:bg-zinc-950 font-extrabold text-[#EAB308] text-lg shadow-[0_4px_20px_rgba(234,179,8,0.15)]">
                    🥇
                  </div>
                </div>
                <span className="text-sm font-black text-brand-text text-center line-clamp-1">{topPerformers[0].name}</span>
                <span className="text-[9px] font-bold text-brand-muted">{topPerformers[0].rollNumber}</span>
                <div className="mt-3 flex h-24 w-full flex-col items-center justify-center rounded-t-xl border border-amber-500/10 dark:border-[#EAB308]/15 bg-gradient-to-t from-amber-500/5 dark:from-zinc-950/80 to-amber-500/15 dark:to-[#EAB308]/5 p-2">
                  <span className="text-sm font-black text-[#EAB308]">Rank {topPerformers[0].rank}</span>
                  <span className="text-[10px] text-brand-muted mt-1">Change: {topPerformers[0].ratingChange !== null ? `${topPerformers[0].ratingChange > 0 ? "+" : ""}${topPerformers[0].ratingChange}` : "N/A"}</span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {topPerformers[2] && (
              <div className="flex flex-col items-center w-full max-w-[12rem] order-3">
                <div className="relative mb-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-orange-200 dark:border-amber-800/30 bg-orange-100 dark:bg-zinc-950 font-extrabold text-amber-700 dark:text-amber-600 text-sm">
                    🥉
                  </div>
                </div>
                <span className="text-xs font-extrabold text-brand-text text-center line-clamp-1">{topPerformers[2].name}</span>
                <span className="text-[9px] font-bold text-brand-muted">{topPerformers[2].rollNumber}</span>
                <div className="mt-3 flex h-16 w-full flex-col items-center justify-center rounded-t-xl border border-amber-900/10 dark:border-amber-800/10 bg-amber-500/5 dark:bg-zinc-950/40 p-2">
                  <span className="text-xs font-black text-amber-700 dark:text-amber-600">Rank {topPerformers[2].rank}</span>
                  <span className="text-[10px] text-brand-muted mt-1">Change: {topPerformers[2].ratingChange !== null ? `${topPerformers[2].ratingChange > 0 ? "+" : ""}${topPerformers[2].ratingChange}` : "N/A"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Charts Layout */}
      {!statsLoading && breakdowns && (
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          {/* Department breakdown pie chart */}
          <div className="rounded-2xl border border-brand-border bg-brand-card p-5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-brand-muted mb-4 flex items-center gap-1.5">
              <PieIcon className="h-4 w-4 text-[#EAB308]" /> Participation by Department
            </h3>
            <div className="h-64">
              {departmentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departmentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${percent !== undefined ? (percent * 100).toFixed(0) : 0}%)`}
                    >
                      {departmentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "var(--chart-tooltip-bg)", borderColor: "var(--chart-tooltip-border)", borderRadius: "8px" }} labelStyle={{ color: "var(--chart-tooltip-text)" }} itemStyle={{ color: "var(--chart-tooltip-text)" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-brand-muted">No department statistics available</div>
              )}
            </div>
          </div>

          {/* Distribution chart */}
          <div className="rounded-2xl border border-brand-border bg-brand-card p-5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-brand-muted mb-4 flex items-center gap-1.5">
              <BarChart2 className="h-4 w-4 text-[#EAB308]" /> Rank/Score Distribution
            </h3>
            <div className="h-64">
              {distributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={10} fontWeight="bold" />
                    <YAxis stroke="var(--chart-axis)" fontSize={10} fontWeight="bold" />
                    <Tooltip cursor={{ fill: "rgba(234, 179, 8, 0.05)" }} contentStyle={{ backgroundColor: "var(--chart-tooltip-bg)", borderColor: "var(--chart-tooltip-border)", borderRadius: "8px" }} labelStyle={{ color: "var(--chart-tooltip-text)" }} itemStyle={{ color: "var(--chart-tooltip-text)" }} />
                    <Bar dataKey="count" fill="#EAB308" radius={[4, 4, 0, 0]}>
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#EAB308" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-brand-muted">No distribution data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Participant Table Search and Filters */}
      <div className="mb-6 rounded-2xl border border-brand-border bg-brand-card p-5">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-brand-muted mb-4 flex items-center gap-1.5">
          <Users className="h-4 w-4 text-[#EAB308]" /> Contest Standings
        </h3>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 mb-4">
          {/* Search */}
          <div className="relative col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, roll number, handle..."
              className="w-full rounded-lg border border-brand-border bg-brand-bg pl-9 pr-4 py-2.5 text-xs font-bold text-brand-text placeholder-brand-muted focus:border-[#EAB308] focus:ring-1 focus:ring-[#EAB308] outline-none"
            />
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-brand-muted" />
          </div>

          {/* Cohort Filter */}
          <div className="relative">
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="w-full appearance-none rounded-lg border border-brand-border bg-brand-bg px-3 py-2.5 pr-8 text-xs font-bold text-brand-text focus:border-[#EAB308] outline-none"
            >
              <option value="">All Cohorts</option>
              {cohortsList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <Filter className="absolute right-3 top-3.5 h-3.5 w-3.5 text-brand-muted pointer-events-none" />
          </div>

          {/* Department Filter - Only show options if user is not HOD */}
          {userRole !== "HOD" ? (
            <div className="relative">
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full appearance-none rounded-lg border border-brand-border bg-brand-bg px-3 py-2.5 pr-8 text-xs font-bold text-brand-text focus:border-[#EAB308] outline-none"
              >
                <option value="">All Departments</option>
                {departmentsList.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <Filter className="absolute right-3 top-3.5 h-3.5 w-3.5 text-brand-muted pointer-events-none" />
            </div>
          ) : (
            <div className="rounded-lg border border-brand-border/40 bg-brand-highlight px-3 py-2.5 text-xs font-bold text-brand-muted flex items-center justify-between">
              <span>Dept: {breakdowns?.department ? Object.keys(breakdowns.department)[0] : "Scoped"}</span>
              <Filter className="h-3.5 w-3.5 text-brand-muted/40" />
            </div>
          )}

          {/* Section Filter */}
          <div className="relative">
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full appearance-none rounded-lg border border-brand-border bg-brand-bg px-3 py-2.5 pr-8 text-xs font-bold text-brand-text focus:border-[#EAB308] outline-none"
            >
              <option value="">All Sections</option>
              {sectionsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Filter className="absolute right-3 top-3.5 h-3.5 w-3.5 text-brand-muted pointer-events-none" />
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto rounded-lg border border-brand-border bg-brand-bg">
          {participantsLoading ? (
            <div className="flex h-48 items-center justify-center text-xs font-bold text-brand-muted">
              <Loader2 className="h-6 w-6 animate-spin text-[#EAB308] mr-2" /> Loading Standings...
            </div>
          ) : participantsError ? (
            <div className="flex h-48 flex-col items-center justify-center text-xs font-bold text-red-400 p-4">
              <AlertTriangle className="h-6 w-6 mb-2" /> {participantsError}
            </div>
          ) : participants.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs font-bold text-brand-muted">
              No participants matched the filter criteria.
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs font-bold">
              <thead>
                <tr className="border-b border-brand-border/80 bg-brand-card uppercase tracking-wider text-brand-muted select-none">
                  <th onClick={() => handleSort("rank")} className="cursor-pointer py-3.5 px-4 transition-colors hover:text-brand-text">
                    Rank {sortBy === "rank" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th onClick={() => handleSort("name")} className="cursor-pointer py-3.5 px-4 transition-colors hover:text-brand-text">
                    Student {sortBy === "name" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th onClick={() => handleSort("rollNumber")} className="cursor-pointer py-3.5 px-4 transition-colors hover:text-brand-text">
                    Roll Number {sortBy === "rollNumber" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3.5 px-4">Cohort</th>
                  <th className="py-3.5 px-4">Dept</th>
                  <th className="py-3.5 px-4">Section</th>
                  <th className="py-3.5 px-4 text-right">Problems</th>
                  <th onClick={() => handleSort("ratingChange")} className="cursor-pointer py-3.5 px-4 text-right transition-colors hover:text-brand-text">
                    Rating Change {sortBy === "ratingChange" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3.5 px-4 text-right">Rating After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/60">
                {participants.map((p) => (
                  <tr key={p.id} className="hover:bg-brand-muted/5 transition-colors text-brand-text">
                    <td className="py-3.5 px-4 text-brand-text font-extrabold">#{p.rank ?? "N/A"}</td>
                    <td className="py-3.5 px-4">
                      {userRole === "STUDENT" && p.student.id !== p.student.id ? (
                        <span className="text-brand-muted">Private Profile</span>
                      ) : (
                        <Link href={`/student/${p.student.id}`} className="text-brand-text hover:text-[#EAB308] hover:underline">
                          {p.student.name}
                        </Link>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-brand-muted">{p.student.rollNumber}</td>
                    <td className="py-3.5 px-4">{p.studentEnrollment?.cohort.code}</td>
                    <td className="py-3.5 px-4">{p.studentEnrollment?.department.code}</td>
                    <td className="py-3.5 px-4">{p.studentEnrollment?.classSection?.name ?? "N/A"}</td>
                    <td className="py-3.5 px-4 text-right">{p.problemsSolved ?? "N/A"}</td>
                    <td className="py-3.5 px-4 text-right">
                      {p.ratingChange !== null ? (
                        <span className={p.ratingChange > 0 ? "text-green-500" : p.ratingChange < 0 ? "text-red-500" : "text-brand-muted"}>
                          {p.ratingChange > 0 ? "+" : ""}{p.ratingChange}
                        </span>
                      ) : "N/A"}
                    </td>
                    <td className="py-3.5 px-4 text-right text-brand-text font-extrabold">{p.ratingAfter ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Standings Pagination */}
        {!participantsLoading && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-brand-border/40 pt-4">
            <span className="text-xs font-bold text-brand-muted">
              Showing standings page <strong className="text-brand-text">{page}</strong> of <strong className="text-brand-text">{totalPages}</strong> ({totalParticipants} total participants)
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center justify-center rounded-lg border border-brand-border bg-brand-card p-2 text-brand-muted hover:text-[#EAB308] disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
