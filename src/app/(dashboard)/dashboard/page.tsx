"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";
import Link from "next/link";
import {
  Trophy,
  Award,
  BookOpen,
  Calendar,
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Briefcase,
  Loader2,
  RefreshCw,
  Star,
  Users,
  Code,
  Target,
  GraduationCap,
  ShieldCheck,
  CheckCircle,
  Activity,
  ArrowRight,
  Eye
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

import { RatingChart } from "@/components/dashboard/rating-chart";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { SkillRadar } from "@/components/dashboard/skill-radar";

// --- Sparkline Component for Institutional Dashboard ---
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

// --- Interfaces ---
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
  createdAt: string;
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
  };
}

interface StudentDashboardData {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  year: number;
  profilePictureUrl: string | null;
  codechefUsername: string | null;
  role: string;
  codechefProfile: {
    username: string;
    currentRating: number;
    highestRating: number;
    globalRank: number | null;
    countryRank: number | null;
    stars: number;
    problemsSolved: number;
    contestCount: number;
    contests: {
      code: string;
      name: string;
      rating: number;
      rank: number;
      date: string;
    }[];
    lastFetchedAt: string;
  } | null;
  aiAnalysis: {
    talentScore: number;
    consistencyScore: number;
    problemSolvingScore: number;
    competitiveProgrammingScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    careerSuggestions: string[];
    generatedAt: string;
  } | null;
  leaderboardEntry: {
    id: string;
    studentId: string;
    rank: number;
    rating: number;
    stars: number;
    talentScore: number;
    updatedAt: string;
  } | null;
}

// ==========================================
// 1. INSTITUTIONAL GLOBAL DASHBOARD VIEW
// ==========================================
function InstitutionalDashboardView() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [topStudents, setTopStudents] = useState<LeaderboardStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGlobalData = async () => {
      try {
        const [statsRes, activityRes, leaderboardRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/activity"),
          fetch("/api/leaderboard?limit=5"),
        ]);

        if (!statsRes.ok || !activityRes.ok || !leaderboardRes.ok) {
          throw new Error("Failed to load global metrics.");
        }

        const statsData = await statsRes.json();
        const activityData = await activityRes.json();
        const leaderboardData = await leaderboardRes.json();

        setStats(statsData.stats);
        setActivities(activityData.activities || []);
        setTopStudents(leaderboardData.entries || []);
      } catch (err: any) {
        setError(err.message || "An error occurred.");
      } finally {
        setIsLoading(false);
      }
    };
    loadGlobalData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 min-h-[calc(100vh-10rem)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-[#EAB308]" />
          <span className="text-xs text-[#A3A3A3] font-bold tracking-wider uppercase">
            Loading Institution Overview Dashboard...
          </span>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="glass-card max-w-md p-8 rounded-2xl border border-red-500/10">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Failed to Load Dashboard</h2>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">{error || "No database data available."}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-300 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Calculate dynamic AI highlights summary from the top students list
  const getAIInsightsSummary = () => {
    if (topStudents.length === 0) {
      return [
        "Analyzing student profiles...",
        "Evaluating database consistency...",
      ];
    }
    const highestRatingCoder = topStudents[0];
    const topImproving = topStudents.sort((a, b) => b.talentScore - a.talentScore)[0];
    
    return [
      `High Talent Density: ${highestRatingCoder.student.name} leads the institution standings at Rank #1 with a rating of ${highestRatingCoder.rating} (${highestRatingCoder.stars}★).`,
      `Optimal Performance Vector: ${topImproving.student.name} has achieved an elite Talent Score of ${Math.round(topImproving.talentScore)}/100.`,
      `Branch Intelligence: The ${stats.topDepartment.value} department currently dominates overall rating performance with a branch average rating of ${stats.topDepartment.trend.split(" ")[0]} points.`,
      `Industry Readiness: Approximately ${stats.placementReadinessIndex.value}% of active CodeChef profiles are classified as Job-Ready, scoring above the 1400 rating threshold.`,
    ];
  };

  const insightsList = getAIInsightsSummary();

  const getStarColorClass = (starCount: number) => {
    if (starCount >= 5) return "text-amber-500 border-amber-500/20 bg-amber-500/5";
    if (starCount >= 4) return "text-primary border-primary/20 bg-primary/5";
    if (starCount >= 3) return "text-secondary border-secondary/20 bg-secondary/5";
    return "text-zinc-500 border-zinc-500/20 bg-zinc-500/5";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in flex flex-col gap-8">
      {/* Hero Header */}
      <div className="relative rounded-3xl border border-[#262626] bg-[#111111]/75 backdrop-blur-xl p-8 overflow-hidden shadow-2xl flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at center, rgba(234, 179, 8, 0.1) 0%, rgba(10, 10, 10, 0) 75%)"
          }}
        />
        <div className="flex items-center gap-5 relative z-10">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EAB308]/10 border border-[#EAB308]/30 text-[#EAB308] shadow-inner">
            <Brain className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#FAFAFA]">
              Main Console Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-[#A3A3A3] mt-1 max-w-2xl leading-relaxed">
              Institutional intelligence summary of student competitive programming and placement readiness indicators.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards (Overview stats) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Students */}
        <div className="border border-[#262626] bg-[#111111] p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/30 transition-all duration-300">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#EAB308]" />
              Total Students
            </span>
            <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/5 px-2 py-0.5 rounded-full border border-[#22C55E]/15">
              {stats.totalStudents.trend.split(" ")[0]}
            </span>
          </div>
          <span className="text-2xl font-black text-[#FAFAFA] mt-3">
            {stats.totalStudents.value}
          </span>
          <div className="mt-4 border-t border-[#262626]/50 pt-3 flex items-center justify-between">
            <span className="text-[8px] text-[#A3A3A3] font-bold uppercase tracking-wider">Timeline</span>
            <Sparkline data={stats.totalStudents.sparkline} color="#EAB308" />
          </div>
        </div>

        {/* Card 2: Active CodeChef Profiles */}
        <div className="border border-[#262626] bg-[#111111] p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/30 transition-all duration-300">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
              <Code className="h-3.5 w-3.5 text-[#F59E0B]" />
              Active Profiles
            </span>
            <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/5 px-2 py-0.5 rounded-full border border-[#22C55E]/15">
              {stats.activeCodechef.trend.split(" ")[0]}
            </span>
          </div>
          <span className="text-2xl font-black text-[#FAFAFA] mt-3">
            {stats.activeCodechef.value}
          </span>
          <div className="mt-4 border-t border-[#262626]/50 pt-3 flex items-center justify-between">
            <span className="text-[8px] text-[#A3A3A3] font-bold uppercase tracking-wider">Timeline</span>
            <Sparkline data={stats.activeCodechef.sparkline} color="#F59E0B" />
          </div>
        </div>

        {/* Card 3: Average Rating */}
        <div className="border border-[#262626] bg-[#111111] p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/30 transition-all duration-300">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-[#22C55E]" />
              Average Rating
            </span>
            <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/5 px-2 py-0.5 rounded-full border border-[#22C55E]/15">
              {stats.averageRating.trend.split(" ")[0]}
            </span>
          </div>
          <span className="text-2xl font-black text-[#FAFAFA] mt-3">
            {stats.averageRating.value}
          </span>
          <div className="mt-4 border-t border-[#262626]/50 pt-3 flex items-center justify-between">
            <span className="text-[8px] text-[#A3A3A3] font-bold uppercase tracking-wider">Timeline</span>
            <Sparkline data={stats.averageRating.sparkline} color="#22C55E" />
          </div>
        </div>

        {/* Card 4: Placement Readiness */}
        <div className="border border-[#262626] bg-[#111111] p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/30 transition-all duration-300">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-450" />
              Job Ready Index
            </span>
            <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/5 px-2 py-0.5 rounded-full border border-[#22C55E]/15">
              {stats.placementReadinessIndex.trend.split(" ")[0]}
            </span>
          </div>
          <span className="text-2xl font-black text-[#FAFAFA] mt-3">
            {stats.placementReadinessIndex.value}%
          </span>
          <div className="mt-4 border-t border-[#262626]/50 pt-3 flex items-center justify-between">
            <span className="text-[8px] text-[#A3A3A3] font-bold uppercase tracking-wider">Timeline</span>
            <Sparkline data={stats.placementReadinessIndex.sparkline} color="#10B981" />
          </div>
        </div>
      </div>

      {/* Main Grid: Standings (Top Students) vs Activity/Insights Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        {/* Left 2/3 - Top Students Standings */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          <div className="glass-card rounded-3xl overflow-hidden border border-[#262626] shadow-xl">
            <div className="px-6 py-5 border-b border-[#262626] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Top Performing Students</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Top 5 students ranked by current competitive programming metrics</p>
              </div>
              <Link
                href="/leaderboard"
                className="text-xs font-bold text-[#EAB308] hover:text-[#FACC15] flex items-center gap-1 transition-all"
              >
                Full Leaderboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#262626] bg-zinc-950/40 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    <th className="py-4 px-6 text-center w-16">Rank</th>
                    <th className="py-4 px-4">Student</th>
                    <th className="py-4 px-4 text-center">Rating</th>
                    <th className="py-4 px-4 text-center">Stars</th>
                    <th className="py-4 px-4 text-center">Talent Score</th>
                    <th className="py-4 px-6 text-center w-20">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626]/50">
                  {topStudents.map((entry) => (
                    <tr key={entry.id} className="hover:bg-white/[0.005] transition-all group">
                      <td className="py-3 px-6 text-center font-black text-sm text-[#EAB308]">
                        #{entry.rank}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full overflow-hidden border border-[#262626] flex items-center justify-center bg-zinc-950 shrink-0">
                            {entry.student.profilePictureUrl ? (
                              <img src={entry.student.profilePictureUrl} alt={entry.student.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full bg-[#EAB308]/10 text-[#EAB308] text-[10px] font-extrabold flex items-center justify-center">
                                {entry.student.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white group-hover:text-[#EAB308] transition-colors">
                              {entry.student.name}
                            </span>
                            <span className="text-[9px] text-[#A3A3A3] font-semibold mt-0.5">
                              {entry.student.rollNumber} • {entry.student.department} • {entry.student.year} Yr
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-xs text-white">
                        {entry.rating}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full border text-[9px] font-bold ${getStarColorClass(entry.stars)}`}>
                          <span>{entry.stars}</span>
                          <span>★</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-black text-xs text-[#EAB308]">
                        {Math.round(entry.talentScore)}
                      </td>
                      <td className="py-3 px-6 text-center">
                        <Link
                          href={`/dashboard?userId=${entry.student.id}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#262626] hover:border-[#EAB308]/30 hover:bg-zinc-900 text-[#A3A3A3] hover:text-white transition-all"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1/3 - Sidebar Activity & Insights Summary */}
        <div className="flex flex-col gap-6">
          {/* AI Insights Summary Card */}
          <div className="glass-card rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col gap-4">
            <h3 className="text-xs font-bold text-[#EAB308] uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#EAB308] animate-pulse" />
              AI Insights Summary
            </h3>
            <div className="flex flex-col gap-3 pt-2">
              {insightsList.map((insight, idx) => (
                <div key={idx} className="flex gap-2 text-xs leading-relaxed text-zinc-400">
                  <span className="text-[#EAB308] shrink-0 font-bold">•</span>
                  <p>{insight}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="glass-card rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col gap-4">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-emerald-400" />
              Recent Activity logs
            </h3>
            <div className="flex flex-col gap-4.5 pt-2 max-h-60 overflow-y-auto">
              {activities.length === 0 ? (
                <span className="text-xs text-zinc-500 font-semibold py-4 text-center block">
                  No synchronization logs available.
                </span>
              ) : (
                activities.slice(0, 4).map((act) => (
                  <div key={act.id} className="flex gap-2.5 items-start text-xs border-b border-[#262626]/50 pb-3 last:border-0 last:pb-0">
                    <div className="h-2 w-2 rounded-full bg-[#EAB308] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-zinc-300 font-medium leading-relaxed">{act.message}</p>
                      <span className="text-[9px] text-zinc-500 mt-1 block">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. INDIVIDUAL STUDENT PORTFOLIO VIEW
// ==========================================
interface StudentDashboardViewProps {
  userId: string;
}

function StudentDashboardView({ userId }: StudentDashboardViewProps) {
  const { user, profile: currentUserProfile } = useAuth();
  const [dashboardData, setDashboardData] = useState<StudentDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"rating" | "rank" | "skills">("rating");

  const fetchDashboardData = async (uid: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/profile?userId=${uid}`);
      if (!response.ok) {
        throw new Error("Failed to load student profile.");
      }
      const data = await response.json();
      
      if (!data.profile) {
        throw new Error("Student profile record not found.");
      }

      const fullProfileResponse = await fetch(`/api/profile/details?userId=${uid}`);
      if (fullProfileResponse.ok) {
        const fullData = await fullProfileResponse.json();
        setDashboardData(fullData.profile);
      } else {
        setDashboardData({
          ...data.profile,
          codechefProfile: null,
          aiAnalysis: null,
          leaderboardEntry: null,
        });
      }
    } catch (e: any) {
      setError(e.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchDashboardData(userId);
    }
  }, [userId]);

  const handleSyncNow = async () => {
    if (!dashboardData) return;
    setIsSyncing(true);
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: dashboardData.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to synchronise.");
      }
      await fetchDashboardData(dashboardData.id);
    } catch (e: any) {
      alert(e.message || "Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-zinc-500 font-semibold">Loading student dashboard...</span>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="glass-card max-w-md p-8 rounded-2xl border border-red-500/10">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Failed to Load Dashboard</h2>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">{error || "No student data available."}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-300 rounded-lg"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const { codechefProfile, aiAnalysis } = dashboardData;
  const isOwnProfile = user && user.id === dashboardData.id;

  const getStarColorClass = (starCount: number) => {
    if (starCount >= 7) return "text-red-500 border-red-500/20 bg-red-500/5";
    if (starCount >= 6) return "text-orange-500 border-orange-500/20 bg-orange-500/5";
    if (starCount >= 5) return "text-amber-500 border-amber-500/20 bg-amber-500/5";
    if (starCount >= 4) return "text-primary border-primary/20 bg-primary/5";
    if (starCount >= 3) return "text-secondary border-secondary/20 bg-secondary/5";
    if (starCount >= 2) return "text-emerald-500 border-emerald-500/20 bg-emerald-500/5";
    return "text-zinc-500 border-zinc-500/20 bg-zinc-500/5";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 animate-fade-in flex flex-col gap-8">
      {/* Banner Header */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-primary/5 blur-[80px]" />
        
        <div className="flex items-center gap-4.5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/25 text-primary shrink-0">
            <Trophy className="h-8 w-8" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {dashboardData.name}
              </h1>
              <span className="text-[10px] font-bold tracking-wider uppercase bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-full text-zinc-400">
                {dashboardData.rollNumber}
              </span>
            </div>
            
            <p className="text-sm text-zinc-400 mt-1.5 flex items-center gap-2">
              <span>{dashboardData.department} Department</span>
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
              <span>{dashboardData.year} Year Student</span>
              {codechefProfile?.username && (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                  <span className="text-primary font-medium">CodeChef: {codechefProfile.username}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {codechefProfile?.username && (isOwnProfile || ["ADMIN", "FACULTY"].includes(currentUserProfile?.role || "")) && (
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all shrink-0"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync CodeChef Now
          </button>
        )}
      </div>

      {!codechefProfile ? (
        <div className="glass-card rounded-3xl p-12 text-center border border-white/5">
          <Award className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Verified Metrics Found</h3>
          <p className="text-xs text-zinc-500 leading-relaxed max-w-sm mx-auto mb-8">
            This student profile does not have a verified CodeChef username linked, or data has not been successfully synchronized yet.
          </p>
          {isOwnProfile && (
            <Link
              href="/profile"
              className="inline-flex items-center justify-center bg-primary hover:bg-primary-hover text-xs font-bold text-[#0A0A0A] px-5 py-3 rounded-xl transition-all"
            >
              Configure CodeChef Account
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 flex flex-col gap-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  Rating Profile
                </span>
                <div>
                  <div className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                    {codechefProfile.currentRating}
                  </div>
                  <span className="text-[10px] text-zinc-400 font-medium">
                    Peak: {codechefProfile.highestRating}
                  </span>
                </div>
              </div>

              <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                  Ranking Info
                </span>
                <div className="space-y-1 mt-1">
                  <div className="flex justify-between items-center text-[10px] leading-tight">
                    <span className="text-zinc-500 font-semibold">Leaderboard:</span>
                    <span className="text-white font-extrabold">
                      {dashboardData.leaderboardEntry ? `#${dashboardData.leaderboardEntry.rank}` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] leading-tight">
                    <span className="text-zinc-500 font-semibold">Global:</span>
                    <span className="text-zinc-400 font-bold">
                      {codechefProfile.globalRank ? `#${codechefProfile.globalRank}` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] leading-tight">
                    <span className="text-zinc-500 font-semibold">Country:</span>
                    <span className="text-zinc-400 font-bold">
                      {codechefProfile.countryRank ? `#${codechefProfile.countryRank}` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-amber-500" />
                  Stars Tier
                </span>
                <div>
                  <span className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full border text-[11px] font-extrabold ${getStarColorClass(codechefProfile.stars)}`}>
                    <span>{codechefProfile.stars}</span>
                    <Star className="h-3 w-3 fill-current" />
                  </span>
                </div>
              </div>

              <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
                  Solved Problems
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-white">
                  {codechefProfile.problemsSolved}
                </span>
              </div>

              <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Contests Run
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-white">
                  {codechefProfile.contestCount}
                </span>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-base font-bold text-white">Performance Analytics</h2>
                
                <div className="flex rounded-xl bg-zinc-950 p-1 border border-white/5 select-none shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => setActiveTab("rating")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === "rating"
                        ? "bg-primary text-[#0A0A0A] shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Rating Trend
                  </button>
                  <button
                    onClick={() => setActiveTab("rank")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === "rank"
                        ? "bg-primary text-[#0A0A0A] shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Rank Progress
                  </button>
                  <button
                    onClick={() => setActiveTab("skills")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === "skills"
                        ? "bg-primary text-[#0A0A0A] shadow-md"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Skill Analysis
                  </button>
                </div>
              </div>

              <div className="w-full">
                {activeTab === "rating" && (
                  <RatingChart contests={codechefProfile.contests} />
                )}
                {activeTab === "rank" && (
                  <PerformanceChart contests={codechefProfile.contests} />
                )}
                {activeTab === "skills" && (
                  <SkillRadar
                    aiAnalysis={aiAnalysis}
                    stars={codechefProfile.stars}
                    contestCount={codechefProfile.contestCount}
                  />
                )}
              </div>
            </div>

            <div className="glass-card rounded-3xl overflow-hidden border border-white/5 shadow-xl">
              <div className="px-6 py-5 border-b border-white/5">
                <h2 className="text-base font-bold text-white">Contest Participation Logs</h2>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-zinc-950/40 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      <th className="py-3 px-6">Contest Code</th>
                      <th className="py-3 px-4">Contest Name</th>
                      <th className="py-3 px-4 text-center">Rank</th>
                      <th className="py-3 px-6 text-center">Contest Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {codechefProfile.contests.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-xs text-zinc-500 font-semibold">
                          No contest history logs available.
                        </td>
                      </tr>
                    ) : (
                      codechefProfile.contests.map((c, i) => (
                        <tr key={i} className="hover:bg-white/[0.005]">
                          <td className="py-3.5 px-6 font-bold text-xs text-zinc-300">{c.code}</td>
                          <td className="py-3.5 px-4 font-semibold text-xs text-white">{c.name}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-xs text-zinc-400">#{c.rank}</td>
                          <td className="py-3.5 px-6 text-center font-extrabold text-xs text-primary">{c.rating}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            <div className="glass-card rounded-3xl p-6 relative overflow-hidden flex flex-col items-center justify-center text-center">
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest mb-6 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                AI Talent Analytics Profile
              </span>

              <div className="relative flex items-center justify-center h-32 w-32 mb-6">
                <div className="absolute inset-0 rounded-full border-[10px] border-zinc-900" />
                <div className="absolute inset-0 rounded-full border-[10px] border-primary/30 glow-gold" />
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-black text-white">
                    {aiAnalysis ? Math.round(aiAnalysis.talentScore) : "N/A"}
                  </span>
                  <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Talent Score
                  </span>
                </div>
              </div>

              {aiAnalysis && (
                <div className="w-full space-y-4 pt-4 border-t border-white/5 text-left">
                  <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                      <span className="text-zinc-500">Consistency Score</span>
                      <span className="text-white">{Math.round(aiAnalysis.consistencyScore)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${aiAnalysis.consistencyScore}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                      <span className="text-zinc-500">Problem Solving</span>
                      <span className="text-white">{Math.round(aiAnalysis.problemSolvingScore)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${aiAnalysis.problemSolvingScore}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                      <span className="text-zinc-500">Competitive Programming</span>
                      <span className="text-white">{Math.round(aiAnalysis.competitiveProgrammingScore)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${aiAnalysis.competitiveProgrammingScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {aiAnalysis && (
              <div className="glass-card rounded-3xl p-6 flex flex-col gap-6">
                <div>
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-emerald-400" />
                    Strengths
                  </h3>
                  <ul className="space-y-2">
                    {aiAnalysis.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-zinc-400 leading-relaxed">
                        <span className="text-emerald-500 font-bold shrink-0">✓</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {aiAnalysis.weaknesses.length > 0 && (
                  <div className="border-t border-white/5 pt-4">
                    <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Areas for Improvement
                    </h3>
                    <ul className="space-y-2">
                      {aiAnalysis.weaknesses.map((weak, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-zinc-400 leading-relaxed">
                          <span className="text-amber-500 font-bold shrink-0">!</span>
                          <span>{weak}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border-t border-white/5 pt-4">
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    Recommended Actions
                  </h3>
                  <ul className="space-y-2">
                    {aiAnalysis.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-zinc-400 leading-relaxed">
                        <span className="text-primary font-bold shrink-0">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Career Recommendations
                  </h3>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {aiAnalysis.careerSuggestions.map((sug, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 text-[10px] font-bold text-white bg-primary/10 border border-primary/20 rounded-lg shadow-sm"
                      >
                        {sug}
                      </span>
                    ))}
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

// ==========================================
// 3. EXPORT DASHBOARD MAIN ROUTER PAGE
// ==========================================
function DashboardRouter() {
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get("userId");

  if (targetUserId) {
    return <StudentDashboardView userId={targetUserId} />;
  } else {
    return <InstitutionalDashboardView />;
  }
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-zinc-500 font-semibold">Loading dashboard...</span>
        </div>
      </div>
    }>
      <DashboardRouter />
    </Suspense>
  );
}
