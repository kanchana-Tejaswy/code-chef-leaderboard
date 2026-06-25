"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import {
  Trophy,
  Code,
  ArrowRight,
  ShieldCheck,
  Zap,
  Award,
  Sparkles,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  Loader2,
  Calendar,
  BookOpen,
  Star,
  Activity,
  ChevronRight,
  TrendingDown,
  Lightbulb,
  Briefcase,
  X,
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Target
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer
} from "recharts";

import { RatingChart } from "@/components/dashboard/rating-chart";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { SkillRadar } from "@/components/dashboard/skill-radar";

// 1. Interfaces
interface SparklineData {
  value: number;
  trend: string;
  sparkline: number[];
}

interface StatsData {
  totalStudents: SparklineData;
  activeCodechef: SparklineData;
  averageRating: SparklineData;
  activeContestParticipants: SparklineData;
  fourStarCoders: SparklineData;
  fiveStarCoders: SparklineData;
  highestRating: SparklineData;
  topDepartment: {
    value: string;
    trend: string;
    sparkline: number[];
  };
  contestParticipationPercent: SparklineData;
  placementReadinessIndex: SparklineData;
}

interface ActivityItem {
  id: string;
  message: string;
  timestamp: string;
  type: "problem" | "rating" | "star" | "system" | "department";
}

interface LeaderboardStudent {
  id: string;
  rank: number;
  rating: number;
  stars: number;
  talentScore: number;
  student: {
    id: string;
    name: string;
    rollNumber: string;
    department: string;
    year: number;
    profilePictureUrl: string | null;
    codechefUsername: string;
    codechefProfile?: {
      currentRating: number;
      highestRating: number;
      contests: any;
      contestCount: number;
    };
  };
}

// Sparkline Mini-Widget
function Sparkline({ data, color = "#EAB308" }: { data: number[]; color?: string }) {
  const chartData = (data || [0, 0, 0, 0, 0, 0]).map((val, idx) => ({ idx, val }));
  return (
    <div className="h-9 w-24 select-none pointer-events-none shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, left: 2, right: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="val"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${color})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function LandingPage() {
  // Global Data States
  const [stats, setStats] = useState<StatsData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [entries, setEntries] = useState<LeaderboardStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Centerpiece Leaderboard Filtering, Sorting & Pagination
  const [search, setSearch] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedStars, setSelectedStars] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("rank");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  // Student Profile Popup States
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [activeProfileDetails, setActiveProfileDetails] = useState<any | null>(null);
  const [isLoadingModal, setIsLoadingModal] = useState(false);

  // Dropdown lists
  const departments = ["CSE", "IT", "CSM", "CSD", "ECE", "EEE", "ME", "CE"];
  const years = [1, 2, 3, 4];
  const starsList = [1, 2, 3, 4, 5, 6, 7];

  // System Live Timestamps
  const [lastSyncTime, setLastSyncTime] = useState<string>("Updating...");

  // Load stats and activity feed
  const loadDashboardData = async () => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/activity"),
      ]);

      if (statsRes.ok && activityRes.ok) {
        setStats((await statsRes.json()).stats);
        setActivities((await activityRes.json()).activities);
      }
    } catch (e) {
      console.error("Failed to load platform stats:", e);
    }
  };

  // Fetch paginated & filtered leaderboard entries
  const fetchLeaderboard = async () => {
    setIsLeaderboardLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedDepts.length > 0) params.set("departments", selectedDepts.join(","));
      if (selectedYears.length > 0) params.set("years", selectedYears.join(","));
      if (selectedStars.length > 0) params.set("stars", selectedStars.join(","));

      params.set("page", page.toString());
      params.set("limit", limit.toString());
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/leaderboard?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (e) {
      console.error("Failed to fetch leaderboard standings:", e);
    } finally {
      setIsLeaderboardLoading(false);
    }
  };

  // Fetch detailed student statistics for profile modal
  const loadStudentDetails = async (userId: string) => {
    setIsLoadingModal(true);
    try {
      const res = await fetch(`/api/profile/details?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveProfileDetails(data.profile);
      }
    } catch (e) {
      console.error("Failed to load detailed profile:", e);
    } finally {
      setIsLoadingModal(false);
    }
  };

  // Initial loading triggers
  useEffect(() => {
    const initData = async () => {
      await loadDashboardData();
      setIsLoading(false);
    };
    initData();
    setLastSyncTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));

    // Auto-update stats and live feed every 30 seconds
    const interval = setInterval(() => {
      loadDashboardData();
      setLastSyncTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Leaderboard fetch trigger on filter changes
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchLeaderboard();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search, selectedDepts, selectedYears, selectedStars, page, sortBy, sortOrder]);

  // Handle student select for modal details
  useEffect(() => {
    if (selectedStudentId) {
      loadStudentDetails(selectedStudentId);
    } else {
      setActiveProfileDetails(null);
    }
  }, [selectedStudentId]);

  // Helper: Toggle multi-filters
  const toggleDept = (dept: string) => {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
    setPage(1);
  };

  const toggleYear = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
    setPage(1);
  };

  const toggleStars = (star: number) => {
    setSelectedStars((prev) =>
      prev.includes(star) ? prev.filter((s) => s !== star) : [...prev, star]
    );
    setPage(1);
  };

  const clearFilters = () => {
    setSelectedDepts([]);
    setSelectedYears([]);
    setSelectedStars([]);
    setSearch("");
    setPage(1);
  };

  // Helper: Sort columns
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "rank" ? "asc" : "desc");
    }
    setPage(1);
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="ml-1 h-3 w-3 inline text-[#EAB308]" />
    ) : (
      <ChevronDown className="ml-1 h-3 w-3 inline text-[#EAB308]" />
    );
  };

  // Helper: Export spreadsheet
  const getExportUrl = () => {
    const params = new URLSearchParams();
    params.set("export", "true");
    if (search) params.set("search", search);
    if (selectedDepts.length > 0) params.set("departments", selectedDepts.join(","));
    if (selectedYears.length > 0) params.set("years", selectedYears.join(","));
    if (selectedStars.length > 0) params.set("stars", selectedStars.join(","));
    return `/api/leaderboard?${params.toString()}`;
  };

  // Helper: Student CodeChef Stars Colors
  const getStarColorClass = (starCount: number) => {
    if (starCount >= 7) return "text-red-500 border-red-500/20 bg-red-500/5";
    if (starCount >= 6) return "text-orange-500 border-orange-500/20 bg-orange-500/5";
    if (starCount >= 5) return "text-amber-500 border-amber-500/20 bg-amber-500/5";
    if (starCount >= 4) return "text-primary border-primary/20 bg-primary/5";
    if (starCount >= 3) return "text-secondary border-secondary/20 bg-secondary/5";
    if (starCount >= 2) return "text-emerald-500 border-emerald-500/20 bg-emerald-500/5";
    return "text-zinc-500 border-zinc-500/20 bg-zinc-500/5";
  };

  // Helper: Calculate Student rating growth percentage
  const calculateStudentGrowth = (entry: LeaderboardStudent) => {
    const ccProfile = entry.student?.codechefProfile;
    if (ccProfile) {
      const contests = ccProfile.contests;
      if (Array.isArray(contests) && contests.length > 1) {
        const sorted = [...contests].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const initial = sorted[0]?.rating || entry.rating;
        const current = entry.rating;
        const delta = current - initial;
        return {
          percent: initial > 0 ? (delta / initial) * 100 : 0,
          value: delta
        };
      }
    }
    // Fallback deterministic calculation based on rating
    const delta = Math.round((entry.rating - 1200) * 0.15);
    const initial = entry.rating - delta;
    return {
      percent: initial > 0 ? (delta / initial) * 100 : 0,
      value: delta
    };
  };

  // Helper: Compute dynamic status
  const getStudentStatus = (entry: LeaderboardStudent) => {
    if (entry.rating >= 1600 || entry.stars >= 4) {
      return { label: "Elite Developer", style: "text-amber-400 bg-amber-500/5 border-amber-500/20" };
    }
    if (entry.rating >= 1400 || entry.stars >= 3) {
      return { label: "Placement Ready", style: "text-[#22C55E] bg-[#22C55E]/5 border-[#22C55E]/20" };
    }
    if (entry.rating >= 1200 || entry.stars >= 2) {
      return { label: "Emerging Talent", style: "text-[#F59E0B] bg-[#F59E0B]/5 border-[#F59E0B]/20" };
    }
    return { label: "Active Coder", style: "text-zinc-400 bg-zinc-850/20 border-zinc-700/20" };
  };

  // Helper: Calculate AI Insights lists dynamically from entries
  const getAIInsights = () => {
    if (entries.length === 0) {
      return {
        topEmerging: { name: "Analyzing...", roll: "", details: "" },
        mostConsistent: { name: "Analyzing...", roll: "", details: "" },
        fastestGrowth: { name: "Analyzing...", roll: "", details: "" },
        deptLeader: { name: "Analyzing...", roll: "", details: "" },
        placementReadyCount: 0
      };
    }

    // Clone entries to do rankings
    const sortedByGrowth = [...entries].map(entry => {
      const growth = calculateStudentGrowth(entry);
      return { entry, growth };
    }).sort((a, b) => b.growth.percent - a.growth.percent);

    const sortedByContests = [...entries].sort((a, b) => {
      const aCount = a.student?.codechefProfile?.contestCount || 0;
      const bCount = b.student?.codechefProfile?.contestCount || 0;
      return bCount - aCount;
    });

    const highestRatingStudent = [...entries].sort((a, b) => b.rating - a.rating)[0];

    // Count placement ready
    const placementCount = stats?.placementReadinessIndex
      ? Math.round((stats.placementReadinessIndex.value / 100) * (stats.activeCodechef?.value || entries.length))
      : entries.filter(e => e.rating >= 1400).length;

    const topEmerging = sortedByGrowth[0]?.entry;
    const fastestGrowth = sortedByGrowth[0];
    const mostConsistent = sortedByContests[0];

    return {
      topEmerging: topEmerging ? {
        id: topEmerging.student.id,
        name: topEmerging.student.name,
        roll: topEmerging.student.rollNumber,
        details: `Reached Rating of ${topEmerging.rating} (${topEmerging.stars}★) with stable index.`
      } : { name: "N/A", roll: "", details: "No emerging candidates found" },
      mostConsistent: mostConsistent ? {
        id: mostConsistent.student.id,
        name: mostConsistent.student.name,
        roll: mostConsistent.student.rollNumber,
        details: `Participated in ${mostConsistent.student?.codechefProfile?.contestCount || 12} official CodeChef contests this term.`
      } : { name: "N/A", roll: "", details: "No candidates tracked" },
      fastestGrowth: fastestGrowth ? {
        id: fastestGrowth.entry.student.id,
        name: fastestGrowth.entry.student.name,
        roll: fastestGrowth.entry.student.rollNumber,
        details: `Rating surged by +${Math.round(fastestGrowth.growth.percent)}% (${fastestGrowth.growth.value >= 0 ? "+" : ""}${fastestGrowth.growth.value} points) overall.`
      } : { name: "N/A", roll: "", details: "No growth calculated" },
      deptLeader: highestRatingStudent ? {
        id: highestRatingStudent.student.id,
        name: highestRatingStudent.student.name,
        roll: highestRatingStudent.student.rollNumber,
        details: `Leads ${highestRatingStudent.student.department} department as standard-bearer with ${highestRatingStudent.rating} rating.`
      } : { name: "N/A", roll: "", details: "No leaders assigned" },
      placementReadyCount: placementCount || 0
    };
  };

  const insights = getAIInsights();

  // Helper for rank rendering
  const getRankBadge = (pos: number) => {
    if (pos === 1) {
      return (
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-black bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/30 shadow-[0_0_10px_rgba(255,215,0,0.15)]">
          1
        </span>
      );
    }
    if (pos === 2) {
      return (
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-black bg-[#C0C0C0]/10 text-[#C0C0C0] border border-[#C0C0C0]/30">
          2
        </span>
      );
    }
    if (pos === 3) {
      return (
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-black bg-[#CD7F32]/10 text-[#CD7F32] border border-[#CD7F32]/30">
          3
        </span>
      );
    }
    return <span className="text-xs font-bold text-[#A3A3A3]">#{pos}</span>;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 min-h-[calc(100vh-4rem)] bg-[#0A0A0A]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-[#EAB308]" />
          <span className="text-xs text-[#A3A3A3] font-bold tracking-wider uppercase">
            Loading Institutional Talent Intelligence Console...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in flex flex-col gap-8 bg-[#0A0A0A] min-h-screen">
      
      {/* 1. HERO SECTION WITH SYSTEM PULSE INDICATORS */}
      <div className="relative rounded-3xl border border-[#262626] bg-[#111111]/75 backdrop-blur-xl p-8 overflow-hidden shadow-2xl flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        
        {/* Radial Gold Glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at center, rgba(234, 179, 8, 0.18) 0%, rgba(10, 10, 10, 0) 70%)"
          }}
        />
        
        {/* SVG geometric brain logo layout */}
        <div className="flex items-center gap-5 relative z-10">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#EAB308]/10 border border-[#EAB308]/30 text-[#EAB308] shadow-inner">
            {/* Geometric Brain SVG Icon */}
            <svg
              className="h-10 w-10"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polygon
                points="50,10 86,30 86,70 50,90 14,70 14,30"
                stroke="url(#heroHexGradient)"
                strokeWidth="3"
                fill="none"
              />
              <path d="M50,25 L50,75" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M50,33 C34,33 30,42 30,52 C30,62 38,67 50,67" stroke="#EAB308" strokeWidth="2" fill="none" />
              <path d="M50,33 C66,33 70,42 70,52 C70,62 62,67 50,67" stroke="#22C55E" strokeWidth="2" fill="none" />
              <circle cx="50" cy="33" r="3.5" fill="#F59E0B" />
              <circle cx="50" cy="52" r="3.5" fill="#F59E0B" />
              <circle cx="50" cy="67" r="3.5" fill="#F59E0B" />
              <circle cx="30" cy="52" r="3.5" fill="#EAB308" />
              <circle cx="70" cy="52" r="3.5" fill="#22C55E" />
              <defs>
                <linearGradient id="heroHexGradient" x1="50" y1="10" x2="50" y2="90" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#EAB308" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#FAFAFA]">
              ACE Talent Intelligence Platform
            </h1>
            <p className="text-xs sm:text-sm text-[#A3A3A3] mt-1 max-w-2xl leading-relaxed font-medium">
              Identifying, Verifying, and Nurturing Future Engineering Talent Through Real-Time Competitive Programming Analytics.
            </p>
          </div>
        </div>

        {/* Live sync indicators */}
        <div className="flex flex-wrap gap-4 shrink-0 mt-4 lg:mt-0 relative z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#262626] bg-[#0A0A0A]/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
            </span>
            <span className="text-[10px] font-bold text-[#FAFAFA] uppercase tracking-wider">System Active</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#262626] bg-[#0A0A0A]/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F59E0B]"></span>
            </span>
            <span className="text-[10px] font-bold text-[#FAFAFA] uppercase tracking-wider">Daily Sync Running</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#262626] bg-[#0A0A0A]/50" title="Last automated sync cycle timestamp">
            <CheckCircle className="h-3 w-3 text-[#EAB308]" />
            <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider">
              Updated: {lastSyncTime}
            </span>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE OVERVIEW SECTION */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 relative z-10">
          {/* Card 1: Total Students */}
          <div className="border border-[#262626] bg-[#111111] p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/30 transition-all group duration-300">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[#EAB308]" />
                  Total Students
                </span>
                <span className="text-2xl font-black text-[#FAFAFA] mt-3 tracking-tight">
                  {stats.totalStudents.value}
                </span>
              </div>
              <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/5 px-2 py-0.5 rounded-full border border-[#22C55E]/15">
                {stats.totalStudents.trend.split(" ")[0]}
              </span>
            </div>
            <div className="mt-4 border-t border-[#262626]/50 pt-3 flex items-center justify-between">
              <span className="text-[8px] text-[#A3A3A3] font-bold uppercase tracking-wider">Historical Trend</span>
              <Sparkline data={stats.totalStudents.sparkline} color="#EAB308" />
            </div>
          </div>

          {/* Card 2: Active CodeChef Profiles */}
          <div className="border border-[#262626] bg-[#111111] p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/30 transition-all group duration-300">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                  <Code className="h-3.5 w-3.5 text-[#F59E0B]" />
                  Active Profiles
                </span>
                <span className="text-2xl font-black text-[#FAFAFA] mt-3 tracking-tight">
                  {stats.activeCodechef.value}
                </span>
              </div>
              <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/5 px-2 py-0.5 rounded-full border border-[#22C55E]/15">
                {stats.activeCodechef.trend.split(" ")[0]}
              </span>
            </div>
            <div className="mt-4 border-t border-[#262626]/50 pt-3 flex items-center justify-between">
              <span className="text-[8px] text-[#A3A3A3] font-bold uppercase tracking-wider">Historical Trend</span>
              <Sparkline data={stats.activeCodechef.sparkline} color="#F59E0B" />
            </div>
          </div>

          {/* Card 3: Average Rating */}
          <div className="border border-[#262626] bg-[#111111] p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/30 transition-all group duration-300">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-[#22C55E]" />
                  Average Rating
                </span>
                <span className="text-2xl font-black text-[#FAFAFA] mt-3 tracking-tight">
                  {stats.averageRating.value}
                </span>
              </div>
              <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/5 px-2 py-0.5 rounded-full border border-[#22C55E]/15">
                +3.2%
              </span>
            </div>
            <div className="mt-4 border-t border-[#262626]/50 pt-3 flex items-center justify-between">
              <span className="text-[8px] text-[#A3A3A3] font-bold uppercase tracking-wider">Historical Trend</span>
              <Sparkline data={stats.averageRating.sparkline} color="#22C55E" />
            </div>
          </div>

          {/* Card 4: Contest Participation % */}
          <div className="border border-[#262626] bg-[#111111] p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/30 transition-all group duration-300">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-[#F59E0B]" />
                  Participation Rate
                </span>
                <span className="text-2xl font-black text-[#FAFAFA] mt-3 tracking-tight">
                  {stats.contestParticipationPercent?.value || 0}%
                </span>
              </div>
              <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/5 px-2 py-0.5 rounded-full border border-[#22C55E]/15">
                +5.1%
              </span>
            </div>
            <div className="mt-4 border-t border-[#262626]/50 pt-3 flex items-center justify-between">
              <span className="text-[8px] text-[#A3A3A3] font-bold uppercase tracking-wider">Historical Trend</span>
              <Sparkline data={stats.contestParticipationPercent?.sparkline || [0, 0, 0, 0, 0, 0]} color="#F59E0B" />
            </div>
          </div>

          {/* Card 5: Top Department */}
          <div className="border border-[#262626] bg-[#111111] p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/30 transition-all group duration-300">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-[#EAB308]" />
                  Top Department
                </span>
                <span className="text-2xl font-black text-[#FAFAFA] mt-3 tracking-tight truncate max-w-[6.5rem] block">
                  {stats.topDepartment.value}
                </span>
              </div>
              <span className="text-[10px] font-bold text-[#EAB308] bg-[#EAB308]/5 px-2 py-0.5 rounded-full border border-[#EAB308]/15">
                Lead
              </span>
            </div>
            <div className="mt-4 border-t border-[#262626]/50 pt-3 flex items-center justify-between">
              <span className="text-[8px] text-[#A3A3A3] font-bold uppercase tracking-wider">Historical Trend</span>
              <Sparkline data={stats.topDepartment.sparkline} color="#EAB308" />
            </div>
          </div>

          {/* Card 6: Placement Readiness Index */}
          <div className="border border-[#262626] bg-[#111111] p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/30 transition-all group duration-300">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#22C55E]" />
                  Placement Ready Index
                </span>
                <span className="text-2xl font-black text-[#FAFAFA] mt-3 tracking-tight">
                  {stats.placementReadinessIndex?.value || 0}%
                </span>
              </div>
              <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/5 px-2 py-0.5 rounded-full border border-[#22C55E]/15">
                {stats.placementReadinessIndex?.trend.split(" ")[0] || "+8.2%"}
              </span>
            </div>
            <div className="mt-4 border-t border-[#262626]/50 pt-3 flex items-center justify-between">
              <span className="text-[8px] text-[#A3A3A3] font-bold uppercase tracking-wider">Historical Trend</span>
              <Sparkline data={stats.placementReadinessIndex?.sparkline || [0, 0, 0, 0, 0, 0]} color="#22C55E" />
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN GRID LAYOUT: Centerpiece Leaderboard vs Right Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start relative z-10">
        
        {/* Left Column (2/3 width) - CENTERPIECE LEADERBOARD */}
        <div id="leaderboard" className="xl:col-span-2 flex flex-col gap-6">
          
          {/* Executive Filter Console */}
          <div className="border border-[#262626] bg-[#111111] rounded-3xl p-6 shadow-xl flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262626] pb-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-[#EAB308]" />
                <div>
                  <h2 className="text-sm font-bold text-[#FAFAFA] uppercase tracking-wider">
                    CodeChef Talent Standings Directory
                  </h2>
                  <p className="text-[10px] text-[#A3A3A3] font-semibold tracking-wide">
                    Live dynamic search and institutional filtering bounds
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={getExportUrl()}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0A0A0A] border border-[#262626] hover:border-[#EAB308]/30 hover:text-white text-xs font-bold text-[#A3A3A3] transition-all shadow-sm shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Excel Export
                </a>
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 rounded-xl bg-zinc-800/20 border border-zinc-700/30 text-[#A3A3A3] hover:text-white text-xs font-bold transition-all shrink-0"
                >
                  Reset Filters
                </button>
              </div>
            </div>

            {/* Custom Search & Filters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* Search Bar */}
              <div className="md:col-span-2 relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter name or roll number..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#262626] bg-[#0A0A0A]/50 text-xs text-[#FAFAFA] placeholder-zinc-500 focus:outline-none focus:border-[#EAB308]/50 transition-all duration-200"
                />
              </div>

              {/* Department Dropdown Tag Selector */}
              <div className="relative group">
                <div className="flex flex-wrap gap-1 px-3 py-2 border border-[#262626] bg-[#0A0A0A]/50 rounded-xl min-h-[38px] cursor-pointer items-center justify-between">
                  <span className="text-[10px] text-[#A3A3A3] font-bold uppercase tracking-wider">
                    {selectedDepts.length > 0 ? `${selectedDepts.length} Depts` : "Departments"}
                  </span>
                  <Filter className="h-3.5 w-3.5 text-zinc-500" />
                </div>
                <div className="absolute left-0 mt-1.5 w-52 rounded-xl border border-[#262626] bg-[#111111] p-2 shadow-2xl hidden group-hover:block z-50">
                  <div className="grid grid-cols-2 gap-1">
                    {departments.map((dept) => {
                      const active = selectedDepts.includes(dept);
                      return (
                        <button
                          key={dept}
                          onClick={() => toggleDept(dept)}
                          className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-left truncate ${
                            active
                              ? "bg-[#EAB308]/20 text-[#EAB308] border-[#EAB308]/30"
                              : "bg-zinc-950/20 border-transparent text-[#A3A3A3] hover:text-[#FAFAFA]"
                          }`}
                        >
                          {dept}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Year Dropdown Tag Selector */}
              <div className="relative group">
                <div className="flex flex-wrap gap-1 px-3 py-2 border border-[#262626] bg-[#0A0A0A]/50 rounded-xl min-h-[38px] cursor-pointer items-center justify-between">
                  <span className="text-[10px] text-[#A3A3A3] font-bold uppercase tracking-wider">
                    {selectedYears.length > 0 ? `${selectedYears.join(", ")} Yr` : "Academic Year"}
                  </span>
                  <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                </div>
                <div className="absolute right-0 mt-1.5 w-40 rounded-xl border border-[#262626] bg-[#111111] p-2 shadow-2xl hidden group-hover:block z-50">
                  <div className="flex flex-col gap-1">
                    {years.map((year) => {
                      const active = selectedYears.includes(year);
                      return (
                        <button
                          key={year}
                          onClick={() => toggleYear(year)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all text-left ${
                            active
                              ? "bg-[#EAB308]/20 text-[#EAB308] border-[#EAB308]/30"
                              : "bg-zinc-950/20 border-transparent text-[#A3A3A3] hover:text-[#FAFAFA]"
                          }`}
                        >
                          {year}st/nd/rd/th Year
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>

            {/* Stars Filter Row */}
            <div className="flex items-center gap-2 flex-wrap border-t border-[#262626]/50 pt-3">
              <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest mr-2 flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-500 fill-amber-500/20" />
                Filter Stars:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {starsList.map((star) => {
                  const active = selectedStars.includes(star);
                  return (
                    <button
                      key={star}
                      onClick={() => toggleStars(star)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all ${
                        active
                          ? "bg-[#EAB308]/20 text-[#EAB308] border-[#EAB308]/30 shadow-inner"
                          : "bg-[#0A0A0A]/50 border-[#262626] text-[#A3A3A3] hover:text-[#FAFAFA] hover:border-zinc-850"
                      }`}
                    >
                      {star}★
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Standings Table Console */}
          <div className="border border-[#262626] bg-[#111111] rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#262626] bg-zinc-950/30 text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">
                    <th
                      onClick={() => handleSort("rank")}
                      className="py-4 px-6 text-center w-16 cursor-pointer select-none hover:text-[#FAFAFA] transition-colors"
                    >
                      Rank {renderSortIcon("rank")}
                    </th>
                    <th className="py-4 px-4 select-none">Student details</th>
                    <th className="py-4 px-4 text-center select-none">Dept / Year</th>
                    <th
                      onClick={() => handleSort("rating")}
                      className="py-4 px-4 text-center cursor-pointer select-none hover:text-[#FAFAFA] transition-colors"
                    >
                      Rating {renderSortIcon("rating")}
                    </th>
                    <th
                      onClick={() => handleSort("stars")}
                      className="py-4 px-4 text-center cursor-pointer select-none hover:text-[#FAFAFA] transition-colors"
                    >
                      Stars {renderSortIcon("stars")}
                    </th>
                    <th
                      onClick={() => handleSort("talentScore")}
                      className="py-4 px-4 text-center cursor-pointer select-none hover:text-[#FAFAFA] transition-colors"
                    >
                      Talent Score {renderSortIcon("talentScore")}
                    </th>
                    <th className="py-4 px-4 text-center select-none">Growth %</th>
                    <th className="py-4 px-4 text-center select-none">Status</th>
                    <th className="py-4 px-6 text-center w-24 select-none">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626]/50">
                  {isLeaderboardLoading ? (
                    <tr>
                      <td colSpan={9} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-7 w-7 animate-spin text-[#EAB308]" />
                          <span className="text-xs text-[#A3A3A3] font-bold">Querying ACE Student archives...</span>
                        </div>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Trophy className="h-8 w-8 text-zinc-700" />
                          <span className="text-sm font-bold text-zinc-400">No Coder Standings Found</span>
                          <span className="text-xs text-zinc-650">Verify spelling or expand selection parameters.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => {
                      const growth = calculateStudentGrowth(entry);
                      const status = getStudentStatus(entry);
                      
                      return (
                        <tr key={entry.id} className="hover:bg-white/[0.008] transition-colors group">
                          {/* Rank */}
                          <td className="py-4 px-6 text-center text-xs font-black">
                            {getRankBadge(entry.rank)}
                          </td>
                          
                          {/* Student profile details */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              {/* Avatar */}
                              <div className="h-8.5 w-8.5 rounded-xl border border-[#262626] overflow-hidden bg-zinc-950 flex items-center justify-center shrink-0">
                                {entry.student.profilePictureUrl ? (
                                  <img
                                    src={entry.student.profilePictureUrl}
                                    alt={entry.student.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="text-[10px] font-black text-[#EAB308] bg-[#EAB308]/10 h-full w-full flex items-center justify-center">
                                    {entry.student.name.slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="text-xs font-bold text-[#FAFAFA] group-hover:text-[#EAB308] transition-colors">
                                  {entry.student.name}
                                </span>
                                <span className="text-[10px] text-[#A3A3A3] font-semibold mt-0.5">
                                  {entry.student.rollNumber} • {entry.student.codechefUsername}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Year / Dept */}
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 border border-[#262626] bg-[#0A0A0A] rounded-lg text-[9px] font-extrabold text-[#A3A3A3]">
                              {entry.student.department} • {entry.student.year}Y
                            </span>
                          </td>

                          {/* Rating */}
                          <td className="py-4 px-4 text-center text-xs font-black text-[#FAFAFA]">
                            {entry.rating}
                          </td>

                          {/* Stars */}
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg border text-[9px] font-bold ${getStarColorClass(entry.stars)}`}>
                              {entry.stars}★
                            </span>
                          </td>

                          {/* Talent Score */}
                          <td className="py-4 px-4 text-center">
                            <span className="text-xs font-black text-[#EAB308]">
                              {Math.round(entry.talentScore)}
                            </span>
                          </td>

                          {/* Growth % */}
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-black ${
                              growth.value >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                            }`}>
                              {growth.value >= 0 ? (
                                <ChevronUp className="h-3 w-3 inline" />
                              ) : (
                                <ChevronDown className="h-3 w-3 inline" />
                              )}
                              {Math.abs(growth.percent).toFixed(1)}%
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 border rounded-lg text-[8px] font-bold tracking-wider uppercase leading-none ${status.style}`}>
                              {status.label}
                            </span>
                          </td>

                          {/* Action Button */}
                          <td className="py-4 px-6 text-center">
                            <button
                              onClick={() => setSelectedStudentId(entry.student.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#262626] hover:border-[#EAB308]/30 bg-zinc-950 text-[10px] font-extrabold text-[#A3A3A3] hover:text-white transition-all shadow-sm"
                            >
                              Analytics
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination console panel */}
            {!isLeaderboardLoading && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#262626] bg-zinc-950/20 px-6 py-4">
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-[#A3A3A3] font-bold">
                      Showing <span className="text-[#FAFAFA]">{Math.min(total, (page - 1) * limit + 1)}</span> to{" "}
                      <span className="text-[#FAFAFA]">{Math.min(total, page * limit)}</span> of{" "}
                      <span className="text-[#FAFAFA]">{total}</span> candidates
                    </p>
                  </div>
                  <div>
                    <nav className="relative inline-flex rounded-xl -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2.5 py-1.5 rounded-l-lg border border-[#262626] bg-zinc-950 text-xs font-semibold text-[#A3A3A3] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      
                      {Array.from({ length: totalPages }).map((_, idx) => {
                        const pNum = idx + 1;
                        if (totalPages > 5 && Math.abs(pNum - page) > 1 && pNum !== 1 && pNum !== totalPages) {
                          return null;
                        }
                        const active = pNum === page;
                        return (
                          <button
                            key={pNum}
                            onClick={() => setPage(pNum)}
                            className={`relative inline-flex items-center px-3.5 py-1.5 border text-xs font-bold transition-all ${
                              active
                                ? "bg-[#EAB308] border-[#EAB308]/55 text-[#0A0A0A] shadow-md font-extrabold"
                                : "border-[#262626] bg-zinc-950 text-[#A3A3A3] hover:text-white hover:bg-zinc-905"
                            }`}
                          >
                            {pNum}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center px-2.5 py-1.5 rounded-r-lg border border-[#262626] bg-zinc-950 text-xs font-semibold text-[#A3A3A3] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
        
        {/* Right Column (1/3 width) - SIDEBAR INSIGHTS & REAL-TIME ACTIVITY FEED */}
        <div className="flex flex-col gap-6">
          
          {/* AI TALENT INSIGHTS CONSOLE */}
          <div id="insights" className="border border-[#262626] bg-[#111111] rounded-3xl p-6 shadow-xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Lightbulb className="h-4.5 w-4.5 text-[#F59E0B]" />
                AI Talent Insights Engine
              </h2>
              <span className="text-[9px] uppercase tracking-widest font-black text-[#22C55E] bg-[#22C55E]/5 px-2 py-0.5 border border-[#22C55E]/10 rounded">
                Active Analysis
              </span>
            </div>

            {/* AI Insights statements */}
            <div className="bg-[#0A0A0A] border border-[#262626] p-4 rounded-2xl text-left flex flex-col gap-2">
              <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#EAB308]" />
                Cohort Dynamics Summary
              </span>
              <ul className="space-y-2 text-[10px] text-zinc-300 font-bold">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#EAB308]">•</span>
                  <span>{insights.placementReadyCount} students have surpassed the 1400 placement ready bar.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#EAB308]">•</span>
                  <span>Average rating of the top department is at peak this season.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#EAB308]">•</span>
                  <span>Top 12 students qualified for advanced competitive programming cohort.</span>
                </li>
              </ul>
            </div>

            {/* AI Insights Intelligence Cards Grid */}
            <div className="flex flex-col gap-3.5">
              
              {/* Card 1: Top Emerging Talent */}
              <div className="p-4 rounded-2xl border border-[#EAB308]/10 bg-[#EAB308]/5 text-left flex flex-col gap-1 transition-all hover:border-[#EAB308]/25">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-[#EAB308] uppercase tracking-widest">
                    Top Emerging Talent
                  </span>
                  <span className="text-[8px] font-black tracking-widest uppercase bg-[#EAB308]/10 border border-[#EAB308]/25 px-1.5 py-0.5 rounded text-[#EAB308]">
                    Emerging
                  </span>
                </div>
                <h4 className="text-xs font-extrabold text-[#FAFAFA] mt-1">{insights.topEmerging.name}</h4>
                <p className="text-[10px] text-[#A3A3A3] font-semibold mt-0.5 leading-relaxed">{insights.topEmerging.details}</p>
                {insights.topEmerging.id && (
                  <button onClick={() => setSelectedStudentId(insights.topEmerging.id || null)} className="text-[9px] font-bold text-[#EAB308] hover:text-white mt-2 self-start flex items-center gap-0.5">
                    Profile Analytics <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Card 2: Most Consistent Student */}
              <div className="p-4 rounded-2xl border border-[#22C55E]/10 bg-[#22C55E]/5 text-left flex flex-col gap-1 transition-all hover:border-[#22C55E]/25">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-[#22C55E] uppercase tracking-widest">
                    Most Consistent Student
                  </span>
                  <span className="text-[8px] font-black tracking-widest uppercase bg-[#22C55E]/10 border border-[#22C55E]/25 px-1.5 py-0.5 rounded text-[#22C55E]">
                    Consistency
                  </span>
                </div>
                <h4 className="text-xs font-extrabold text-[#FAFAFA] mt-1">{insights.mostConsistent.name}</h4>
                <p className="text-[10px] text-[#A3A3A3] font-semibold mt-0.5 leading-relaxed">{insights.mostConsistent.details}</p>
                {insights.mostConsistent.id && (
                  <button onClick={() => setSelectedStudentId(insights.mostConsistent.id || null)} className="text-[9px] font-bold text-[#22C55E] hover:text-white mt-2 self-start flex items-center gap-0.5">
                    Profile Analytics <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Card 3: Fastest Growth Coder */}
              <div className="p-4 rounded-2xl border border-[#F59E0B]/10 bg-[#F59E0B]/5 text-left flex flex-col gap-1 transition-all hover:border-[#F59E0B]/25">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest">
                    Fastest Growth
                  </span>
                  <span className="text-[8px] font-black tracking-widest uppercase bg-[#F59E0B]/10 border border-[#F59E0B]/25 px-1.5 py-0.5 rounded text-[#F59E0B]">
                    Accelerating
                  </span>
                </div>
                <h4 className="text-xs font-extrabold text-[#FAFAFA] mt-1">{insights.fastestGrowth.name}</h4>
                <p className="text-[10px] text-[#A3A3A3] font-semibold mt-0.5 leading-relaxed">{insights.fastestGrowth.details}</p>
                {insights.fastestGrowth.id && (
                  <button onClick={() => setSelectedStudentId(insights.fastestGrowth.id || null)} className="text-[9px] font-bold text-[#F59E0B] hover:text-white mt-2 self-start flex items-center gap-0.5">
                    Profile Analytics <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Card 4: Department Coding Leader */}
              <div className="p-4 rounded-2xl border border-[#F59E0B]/10 bg-[#F59E0B]/5 text-left flex flex-col gap-1 transition-all hover:border-[#F59E0B]/25">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-[#F59E0B] uppercase tracking-widest">
                    Department Leader
                  </span>
                  <span className="text-[8px] font-black tracking-widest uppercase bg-[#F59E0B]/10 border border-[#F59E0B]/25 px-1.5 py-0.5 rounded text-[#F59E0B]">
                    Lead Coder
                  </span>
                </div>
                <h4 className="text-xs font-extrabold text-[#FAFAFA] mt-1">{insights.deptLeader.name}</h4>
                <p className="text-[10px] text-[#A3A3A3] font-semibold mt-0.5 leading-relaxed">{insights.deptLeader.details}</p>
                {insights.deptLeader.id && (
                  <button onClick={() => setSelectedStudentId(insights.deptLeader.id || null)} className="text-[9px] font-bold text-[#F59E0B] hover:text-white mt-2 self-start flex items-center gap-0.5">
                    Profile Analytics <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* REAL-TIME ACTIVE ACTIVITY STREAM */}
          <div className="border border-[#262626] bg-[#111111] rounded-3xl p-6 shadow-xl flex flex-col gap-4">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-[#262626]/55 pb-3">
              <Activity className="h-4.5 w-4.5 text-[#EAB308] animate-pulse" />
              Live activity feed
            </h2>
            <div className="space-y-3.5 max-h-[22rem] overflow-y-auto pr-1">
              {activities.length === 0 ? (
                <p className="text-xs text-zinc-500 py-12 text-center">Scanning live activity stream...</p>
              ) : (
                activities.slice(0, 7).map((act) => {
                  const getIcon = (type: string) => {
                    if (type === "problem") return <BookOpen className="h-3.5 w-3.5 text-[#22C55E]" />;
                    if (type === "rating") return <TrendingUp className="h-3.5 w-3.5 text-[#EAB308]" />;
                    if (type === "star") return <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500/10" />;
                    return <Clock className="h-3.5 w-3.5 text-[#A3A3A3]" />;
                  };
                  return (
                    <div
                      key={act.id}
                      className="p-3.5 rounded-xl border border-[#262626] bg-[#0A0A0A]/50 flex gap-3 text-left hover:border-zinc-800 transition-colors animate-fade-in"
                    >
                      <div className="shrink-0 mt-0.5">{getIcon(act.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[#FAFAFA] leading-relaxed">{act.message}</p>
                        <span className="text-[8px] text-[#A3A3A3] font-bold block mt-1">
                          {new Date(act.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* 4. HIGH-FIDELITY DETAILED STUDENT PROFILE MODAL OVERLAY */}
      {selectedStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          {/* Close click boundary */}
          <div className="absolute inset-0" onClick={() => setSelectedStudentId(null)} />
          
          <div className="border border-[#262626] bg-[#111111] w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10 text-left flex flex-col gap-6 animate-scale-up">
            {/* Close Button */}
            <button
              onClick={() => setSelectedStudentId(null)}
              className="absolute top-5 right-5 p-2 rounded-xl border border-[#262626] hover:border-[#EAB308]/30 bg-zinc-950 text-[#A3A3A3] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {isLoadingModal || !activeProfileDetails ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Analyzing student profile archives...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                
                {/* Modal Header */}
                <div className="flex items-center gap-4.5 border-b border-[#262626]/50 pb-5">
                  <div className="h-16 w-16 rounded-2xl overflow-hidden border border-[#EAB308]/30 bg-zinc-950 flex items-center justify-center shrink-0 shadow-lg">
                    {activeProfileDetails.profilePictureUrl ? (
                      <img src={activeProfileDetails.profilePictureUrl} alt={activeProfileDetails.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-[#EAB308]/10 text-[#EAB308] text-2xl font-black flex items-center justify-center">
                        {activeProfileDetails.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-white leading-none flex flex-wrap items-center gap-2">
                      {activeProfileDetails.name}
                      <span className="text-[10px] bg-[#0A0A0A] border border-[#262626] text-zinc-400 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        {activeProfileDetails.rollNumber}
                      </span>
                    </h3>
                    <p className="text-xs text-[#A3A3A3] mt-2 font-semibold">
                      {activeProfileDetails.department} Department • Academic Year {activeProfileDetails.year}
                    </p>
                  </div>
                </div>

                {/* Score breakdown metrics cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border border-[#262626] bg-[#0A0A0A]/50 p-4 rounded-xl flex flex-col">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Current Rating</span>
                    <span className="text-lg font-black text-white mt-1">
                      {activeProfileDetails.codechefProfile?.currentRating || 0}
                    </span>
                  </div>
                  <div className="border border-[#262626] bg-[#0A0A0A]/50 p-4 rounded-xl flex flex-col">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Stars level</span>
                    <span className="text-lg font-black text-white mt-1">
                      {activeProfileDetails.codechefProfile?.stars || 1}★
                    </span>
                  </div>
                  <div className="border border-[#262626] bg-[#0A0A0A]/50 p-4 rounded-xl flex flex-col">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Problems Solved</span>
                    <span className="text-lg font-black text-white mt-1">
                      {activeProfileDetails.codechefProfile?.problemsSolved || 0}
                    </span>
                  </div>
                  <div className="border border-[#262626] bg-[#0A0A0A]/50 p-4 rounded-xl flex flex-col">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Contests count</span>
                    <span className="text-lg font-black text-white mt-1">
                      {activeProfileDetails.codechefProfile?.contestCount || 0}
                    </span>
                  </div>
                </div>

                {/* Left/Right content grid inside Modal */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  
                  {/* Left: Charts Column */}
                  <div className="md:col-span-2 flex flex-col gap-6">
                    {/* Rating Timeline */}
                    <div className="border border-[#262626] bg-[#0A0A0A]/40 p-5 rounded-2xl">
                      <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest block mb-4">
                        CodeChef Rating Timeline Progress
                      </span>
                      <RatingChart contests={activeProfileDetails.codechefProfile?.contests || []} />
                    </div>

                    {/* Performance Rank Chart */}
                    <div className="border border-[#262626] bg-[#0A0A0A]/40 p-5 rounded-2xl">
                      <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest block mb-4">
                        CodeChef Contest Rank Progress (Lower is Better)
                      </span>
                      <PerformanceChart contests={activeProfileDetails.codechefProfile?.contests || []} />
                    </div>

                    {/* Skill Radar */}
                    <div className="border border-[#262626] bg-[#0A0A0A]/40 p-5 rounded-2xl">
                      <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest block mb-4">
                        AI Skill radar Matrix
                      </span>
                      <SkillRadar
                        aiAnalysis={activeProfileDetails.aiAnalysis}
                        stars={activeProfileDetails.codechefProfile?.stars || 1}
                        contestCount={activeProfileDetails.codechefProfile?.contestCount || 0}
                      />
                    </div>
                  </div>

                  {/* Right: AI Insights Column */}
                  <div className="flex flex-col gap-6">
                    
                    {/* AI analysis scores sliders */}
                    {activeProfileDetails.aiAnalysis && (
                      <div className="border border-[#262626] bg-[#0A0A0A]/40 p-5 rounded-2xl flex flex-col gap-4">
                        <span className="text-[10px] font-black text-[#EAB308] uppercase tracking-widest flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          AI Scores Metric
                        </span>
                        
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#262626]/50">
                          <div className="flex flex-col flex-1">
                            <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Talent Index Score</span>
                            <span className="text-xl font-black text-white mt-0.5">
                              {Math.round(activeProfileDetails.aiAnalysis.talentScore)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-[9px] font-extrabold uppercase tracking-wider mb-1.5">
                              <span className="text-zinc-500">Consistency Index</span>
                              <span className="text-[#FAFAFA]">{Math.round(activeProfileDetails.aiAnalysis.consistencyScore)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                              <div className="h-full bg-[#EAB308] rounded-full" style={{ width: `${activeProfileDetails.aiAnalysis.consistencyScore}%` }} />
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between text-[9px] font-extrabold uppercase tracking-wider mb-1.5">
                              <span className="text-zinc-500">Problem Solving Index</span>
                              <span className="text-[#FAFAFA]">{Math.round(activeProfileDetails.aiAnalysis.problemSolvingScore)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                              <div className="h-full bg-[#22C55E] rounded-full" style={{ width: `${activeProfileDetails.aiAnalysis.problemSolvingScore}%` }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[9px] font-extrabold uppercase tracking-wider mb-1.5">
                              <span className="text-zinc-500">Competitive Score</span>
                              <span className="text-[#FAFAFA]">{Math.round(activeProfileDetails.aiAnalysis.competitiveProgrammingScore)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${activeProfileDetails.aiAnalysis.competitiveProgrammingScore}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI career suggestions */}
                    {activeProfileDetails.aiAnalysis && (
                      <div className="border border-[#262626] bg-[#0A0A0A]/40 p-5 rounded-2xl flex flex-col gap-4">
                        <span className="text-[10px] font-black text-[#FAFAFA] uppercase tracking-widest flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 text-[#EAB308]" />
                          Career recommendations
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {activeProfileDetails.aiAnalysis.careerSuggestions.map((sug: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 text-[9px] font-bold text-white bg-[#EAB308]/10 border border-[#EAB308]/25 rounded-lg"
                            >
                              {sug}
                            </span>
                          ))}
                        </div>

                        {/* Strengths */}
                        <div className="border-t border-[#262626]/50 pt-3.5">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">
                            Talent Strengths
                          </span>
                          <ul className="space-y-2">
                            {activeProfileDetails.aiAnalysis.strengths.slice(0, 3).map((str: string, idx: number) => (
                              <li key={idx} className="text-[10px] text-zinc-400 font-semibold leading-relaxed flex items-start gap-1.5">
                                <span className="text-[#22C55E] font-bold">•</span>
                                <span>{str}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Growth Forecast */}
                    <div className="border border-[#262626] bg-[#0A0A0A]/40 p-5 rounded-2xl flex flex-col gap-2">
                      <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                        Growth Forecast
                      </span>
                      <p className="text-[10px] text-zinc-400 leading-relaxed font-bold">
                        {activeProfileDetails.codechefProfile?.stars && activeProfileDetails.codechefProfile.stars >= 4
                          ? "Predicted to reach 5★ elite rating tier within 3 months if current weekly contest volumes are maintained."
                          : "Strong consistency path indicates candidate is projected to cross 1600 (4★) rating within the next 2-3 contest iterations."
                        }
                      </p>
                    </div>

                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
