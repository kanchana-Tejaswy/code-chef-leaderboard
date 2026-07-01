"use client";

import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  BarChart2,
  LineChart as LineChartIcon,
  Percent,
  TrendingDown,
  Loader2,
  PieChart as PieChartIcon,
  Activity,
  Layers,
  Award
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid
} from "recharts";

interface DeptPerformance {
  name: string;
  averageRating: number;
  activeCount: number;
}

interface DistributionBand {
  range: string;
  count: number;
}

interface TimelineTrend {
  date: string;
  count: number;
}

interface RegistrationGrowth {
  month: string;
  count: number;
}

interface PlatformDataset {
  departmentPerformance: { name: string; value: number; activeCount: number }[];
  distribution: { range: string; count: number }[];
  growth: { month: string; count: number }[];
}

interface AnalyticsData {
  departmentPerformance: DeptPerformance[];
  ratingDistribution: DistributionBand[];
  talentScoreDistribution: DistributionBand[];
  contestParticipation: TimelineTrend[];
  monthlyGrowth: RegistrationGrowth[];
  platforms?: {
    overall: PlatformDataset;
    codechef: PlatformDataset;
    leetcode: PlatformDataset;
    github: PlatformDataset;
  };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overall" | "codechef" | "leetcode" | "github">("overall");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch("/api/analytics");
        if (!response.ok) {
          throw new Error("Failed to load institutional analytics.");
        }
        const json = await response.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "An error occurred.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 min-h-[calc(100vh-4rem)] bg-brand-bg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-[#EAB308]" />
          <span className="text-xs text-brand-muted font-bold tracking-wider uppercase">
            Compiling Academic Algorithmic Analytics...
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-brand-bg text-center">
        <div className="glass-card max-w-md p-8 rounded-2xl border border-red-500/10">
          <TrendingDown className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Analytics Loading Failed</h2>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            {error || "An error occurred while building analytical models."}
          </p>
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

  // Compute stats
  const totalProfiles = data.departmentPerformance.reduce((acc, curr) => acc + curr.activeCount, 0);

  if (totalProfiles === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-brand-bg text-center min-h-[calc(100vh-4rem)]">
        <div className="border border-dashed border-brand-border bg-brand-card/40 max-w-md p-12 rounded-3xl flex flex-col items-center justify-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-28 w-28 bg-[#EAB308]/5 rounded-full blur-2xl pointer-events-none" />
          <div className="h-12 w-12 rounded-2xl bg-[#EAB308]/10 border border-[#EAB308]/20 flex items-center justify-center text-[#EAB308]">
            <BarChart2 className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-white">No student profiles analyzed yet.</h2>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-xs font-semibold animate-pulse">
            There is no analytics data to compile yet. Please add student profiles on the dashboard to build rating distributions, contest participation timelines, and department performance metrics.
          </p>
          <a
            href="/"
            className="mt-2 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#EAB308] hover:bg-[#FACC15] text-xs font-bold text-[#0A0A0A] transition-all shadow-[0_4px_15px_rgba(234,179,8,0.25)] hover:shadow-[0_4px_20px_rgba(250,204,21,0.4)]"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const activeDataset = data.platforms && data.platforms[activeTab]
    ? data.platforms[activeTab]
    : {
        departmentPerformance: data.departmentPerformance.map((d) => ({ name: d.name, value: d.averageRating, activeCount: d.activeCount })),
        distribution: data.ratingDistribution,
        growth: data.monthlyGrowth,
      };

  const activeProfilesCount = activeDataset.departmentPerformance.reduce((acc, curr) => acc + curr.activeCount, 0);

  const globalAvg = activeProfilesCount > 0
    ? Math.round(activeDataset.departmentPerformance.reduce((acc, curr) => acc + curr.value * curr.activeCount, 0) / activeProfilesCount)
    : 0;

  const totalActivityVolume = activeDataset.growth.reduce((acc, curr) => acc + curr.count, 0);

  const tabColor = {
    overall: "#EAB308",
    codechef: "#8B5CF6",
    leetcode: "#F59E0B",
    github: "#06B6D4",
  }[activeTab];

  const valueLabel = {
    overall: "Average Overall Score",
    codechef: "Global Avg Rating",
    leetcode: "Avg Problems Solved",
    github: "Avg OS Score",
  }[activeTab];

  const bandLabel = {
    overall: "Overall Readiness Bands",
    codechef: "Rating Distribution Bands",
    leetcode: "LeetCode Solved Bands",
    github: "Open Source Score Bands",
  }[activeTab];

  const activityLabel = {
    overall: "System Growth Activity",
    codechef: "Contest Participation Rounds",
    leetcode: "Monthly Submissions Activity",
    github: "OS Contribution Commits",
  }[activeTab];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 animate-fade-in flex flex-col gap-8 bg-brand-bg min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#EAB308]/10 border border-[#EAB308]/20 text-[#EAB308] rounded-xl">
            <BarChart2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans font-black">Institutional Analytics</h1>
            <p className="text-sm text-brand-muted mt-1">
              Deeper algorithmic performance trends and skill distribution datasets across ACE College
            </p>
          </div>
        </div>

        {/* Dynamic Segment Filters */}
        <div className="flex border border-brand-border bg-[#111111]/45 p-1 rounded-2xl gap-1 w-full max-w-md relative z-10">
          {[
            { name: "Overall", value: "overall" },
            { name: "CodeChef", value: "codechef" },
            { name: "LeetCode", value: "leetcode" },
            { name: "GitHub", value: "github" }
          ].map((tab) => {
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value as any)}
                className={`flex-1 py-1.5 text-center rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  active
                    ? "bg-[#EAB308]/20 border border-[#EAB308]/30 text-[#EAB308]"
                    : "border border-transparent text-brand-muted hover:text-brand-text"
                }`}
              >
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="border border-brand-border bg-brand-card p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/20 transition-all duration-300">
          <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[#EAB308]" />
            Ranked Profiles
          </span>
          <span className="text-3xl font-black text-brand-text mt-4 tracking-tight">
            {activeProfilesCount}
          </span>
          <span className="text-[10px] text-zinc-500 font-medium mt-1">
            Across 8 active departments
          </span>
        </div>

        <div className="border border-brand-border bg-brand-card p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/20 transition-all duration-300">
          <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-[#22C55E]" />
            {valueLabel}
          </span>
          <span className="text-3xl font-black text-brand-text mt-4 tracking-tight">
            {globalAvg}
          </span>
          <span className="text-[10px] text-[#22C55E] font-medium mt-1">
            Institutional performance benchmark
          </span>
        </div>

        <div className="border border-brand-border bg-brand-card p-5 rounded-2xl flex flex-col justify-between hover:border-[#EAB308]/20 transition-all duration-300">
          <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#F59E0B]" />
            {activityLabel}
          </span>
          <span className="text-3xl font-black text-brand-text mt-4 tracking-tight">
            {totalActivityVolume}
          </span>
          <span className="text-[10px] text-zinc-500 font-medium mt-1">
            Across last 6 active periods
          </span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 1. Department Performance Bar Chart */}
        <div className="glass-card rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="h-4 w-4 text-[#EAB308]" />
              Department Performance ({valueLabel})
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Average score achieved by active students per department</p>
          </div>
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeDataset.departmentPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={10} fontWeight="bold" tickLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--brand-card)", border: "1px solid var(--brand-border)", borderRadius: "12px" }}
                  labelClassName="text-white text-xs font-bold"
                  itemStyle={{ color: tabColor, fontSize: "11px", fontWeight: "bold" }}
                />
                <Bar dataKey="value" fill={tabColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Rating Distribution Area Chart */}
        <div className="glass-card rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-[#F59E0B]" />
              {bandLabel}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Distribution of active students across levels/bands</p>
          </div>
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeDataset.distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={tabColor} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={tabColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="range" stroke="var(--chart-axis)" fontSize={10} fontWeight="bold" tickLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--brand-card)", border: "1px solid var(--brand-border)", borderRadius: "12px" }}
                  labelClassName="text-white text-xs font-bold"
                  itemStyle={{ color: tabColor, fontSize: "11px", fontWeight: "bold" }}
                />
                <Area type="monotone" dataKey="count" stroke={tabColor} fillOpacity={1} fill="url(#colorRating)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Contest Participation Trend Line Chart */}
        <div className="glass-card rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-[#22C55E]" />
              {activityLabel} Trends (Last 6 Periods)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Submissions volume and contribution activity patterns</p>
          </div>
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activeDataset.growth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--chart-axis)" fontSize={10} fontWeight="bold" tickLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--brand-card)", border: "1px solid var(--brand-border)", borderRadius: "12px" }}
                  labelClassName="text-white text-xs font-bold"
                  itemStyle={{ color: "#22C55E", fontSize: "11px", fontWeight: "bold" }}
                />
                <Line type="monotone" dataKey="count" stroke="#22C55E" strokeWidth={2} activeDot={{ r: 6 }} dot={{ strokeWidth: 2, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Growth & Registration Timeline Chart */}
        <div className="glass-card rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Percent className="h-4 w-4 text-[#EAB308]" />
              Cumulative Institutional Platform growth
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Timeline showing cumulative student registrations over time</p>
          </div>
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EAB308" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--chart-axis)" fontSize={10} fontWeight="bold" tickLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--brand-card)", border: "1px solid var(--brand-border)", borderRadius: "12px" }}
                  labelClassName="text-white text-xs font-bold"
                  itemStyle={{ color: "#EAB308", fontSize: "11px", fontWeight: "bold" }}
                />
                <Area type="monotone" dataKey="count" stroke="#EAB308" fillOpacity={1} fill="url(#colorGrowth)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Talent Score Distribution Chart */}
        <div className="glass-card rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col gap-4 lg:col-span-2">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              Talent score distribution analytics
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Count of students categorized by their overall AI-generated Talent Score tiers</p>
          </div>
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.talentScoreDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="range" stroke="var(--chart-axis)" fontSize={10} fontWeight="bold" tickLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--brand-card)", border: "1px solid var(--brand-border)", borderRadius: "12px" }}
                  labelClassName="text-white text-xs font-bold"
                  itemStyle={{ color: "#10B981", fontSize: "11px", fontWeight: "bold" }}
                />
                <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
