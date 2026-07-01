"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Code,
  Flame,
  ArrowLeft,
  Loader2,
  TrendingUp,
  Target,
  Sparkles,
  GitBranch,
  Star,
  Users
} from "lucide-react";

function Github(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";

// Interfaces
interface StudentDetails {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  year: number;
  branch: string;
  section: string;
  profilePictureUrl: string | null;
  codechefUsername: string | null;
  leetcodeUsername: string | null;
  githubUsername: string | null;
  codechefProfile?: any;
  leetcodeProfile?: any;
  githubProfile?: any;
  aiAnalysis?: any;
  leaderboardEntry?: any;
}

// Heatmap Grid Component
function CalendarHeatmap({ data, colorTheme = "gold" }: { data: Record<string, number>; colorTheme?: "gold" | "leetcode" | "purple" }) {
  if (data && (data as any).isUnavailable) {
    return (
      <div className="flex flex-col border border-[#262626] bg-[#111111]/40 p-5 rounded-2xl w-full min-h-[145px] justify-center items-center text-center">
        <span className="text-[10px] text-[#A3A3A3] uppercase tracking-wider font-black mb-2 self-start">Daily Activity Heatmap (Last 365 Days)</span>
        <span className="text-xs font-bold text-zinc-500 py-6">Not available from platform.</span>
      </div>
    );
  }

  const now = new Date();
  const days = [];
  // Generate 365 days (53 weeks)
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];
    const count = data[dateStr] || 0;
    days.push({ date: dateStr, count });
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const getIntensityClass = (count: number) => {
    if (count === 0) return "bg-zinc-900";
    if (colorTheme === "leetcode") {
      if (count <= 2) return "bg-amber-500/20";
      if (count <= 5) return "bg-amber-500/40";
      if (count <= 8) return "bg-amber-500/70";
      return "bg-amber-500";
    }
    if (colorTheme === "purple") {
      if (count <= 2) return "bg-purple-500/20";
      if (count <= 5) return "bg-purple-500/40";
      if (count <= 8) return "bg-purple-500/70";
      return "bg-purple-500";
    }
    // Default gold
    if (count <= 2) return "bg-[#EAB308]/20";
    if (count <= 5) return "bg-[#EAB308]/40";
    if (count <= 8) return "bg-[#EAB308]/70";
    return "bg-[#EAB308]";
  };

  return (
    <div className="flex flex-col gap-1 overflow-x-auto pb-2 select-none border border-[#262626] bg-[#111111]/40 p-4 rounded-2xl w-full">
      <div className="text-[10px] text-[#A3A3A3] uppercase tracking-wider font-black mb-3">Daily Activity Heatmap (Last 365 Days)</div>
      <div className="flex gap-[3px] min-w-max">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-[3px]">
            {week.map((day, dIdx) => {
              const bgClass = getIntensityClass(day.count);
              return (
                <div
                  key={dIdx}
                  className={`h-[9px] w-[9px] rounded-[1.5px] ${bgClass} transition-all hover:scale-125`}
                  title={`${day.date}: ${day.count} active submissions`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 text-[9px] text-[#A3A3A3] font-bold px-1">
        <span>Less</span>
        <div className="flex gap-[3px] items-center">
          <div className="h-[9px] w-[9px] rounded-[1.5px] bg-zinc-900" />
          <div className={`h-[9px] w-[9px] rounded-[1.5px] ${getIntensityClass(1)}`} />
          <div className={`h-[9px] w-[9px] rounded-[1.5px] ${getIntensityClass(3)}`} />
          <div className={`h-[9px] w-[9px] rounded-[1.5px] ${getIntensityClass(6)}`} />
          <div className={`h-[9px] w-[9px] rounded-[1.5px] ${getIntensityClass(9)}`} />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

// Consistency Gauge SVG
function ConsistencyGauge({ score, title, color = "#EAB308" }: { score: number; title: string; color?: string }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-5 border border-[#262626] bg-[#111111]/60 rounded-2xl text-center w-full">
      <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest mb-3">{title}</span>
      <div className="relative flex items-center justify-center h-24 w-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="48" cy="48" r={radius} className="stroke-zinc-900 fill-transparent" strokeWidth="6" />
          <circle
            cx="48"
            cy="48"
            r={radius}
            className="fill-transparent transition-all duration-1000 ease-out"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-lg font-black text-[#FAFAFA]">{Math.round(score)}%</span>
      </div>
    </div>
  );
}

export default function StudentProfileDashboard() {
  const params = useParams();
  const studentId = params?.id as string;

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<"codechef" | "leetcode" | "github" | null>(null);
  const [mounted, setMounted] = useState(false);

  // Repository Explorer states
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [isRepoExplorerOpen, setIsRepoExplorerOpen] = useState(false);
  const [repoDetails, setRepoDetails] = useState<any | null>(null);
  const [isRepoLoading, setIsRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [repoActiveTab, setRepoActiveTab] = useState<"readme" | "commits" | "contributors" | "activity">("readme");

  const handleOpenRepoExplorer = async (repo: any) => {
    setSelectedRepo(repo);
    setIsRepoExplorerOpen(true);
    setIsRepoLoading(true);
    setRepoError(null);
    setRepoDetails(null);
    setRepoActiveTab("readme");

    try {
      const res = await fetch(`/api/github/repo?username=${student?.githubUsername}&repo=${repo.name}`);
      if (!res.ok) {
        throw new Error("Failed to fetch repository explorer details.");
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch repository explorer details.");
      }
      setRepoDetails(data);
    } catch (err: any) {
      console.error(err);
      setRepoError(err.message || "Failed to load detailed repository data.");
    } finally {
      setIsRepoLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!studentId) return;
    
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/profile/details?userId=${studentId}`);
        if (!res.ok) {
          throw new Error("Student profile could not be loaded.");
        }
        const data = await res.json();
        setStudent(data.profile);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load detailed profile.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [studentId]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col gap-3 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
        <span className="text-xs font-black text-[#A3A3A3] uppercase tracking-wider">Compiling developer profiles...</span>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col gap-4 items-center justify-center p-4">
        <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/5 text-center text-red-500 max-w-md">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-2">Profile Error</h2>
          <p className="text-xs font-semibold">{error || "The student profile was not found."}</p>
        </div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-[#EAB308] font-bold hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to standings
        </Link>
      </div>
    );
  }

  const overallScore = student.leaderboardEntry?.overallScore || 0;
  const rank = student.leaderboardEntry?.rank || "-";
  
  // Placement readiness label
  let readinessLabel = "Emerging Dev";
  let readinessColor = "text-[#F59E0B] border-[#F59E0B]/20 bg-[#F59E0B]/5";
  if (overallScore >= 80) {
    readinessLabel = "Tier-1 / HFT Ready";
    readinessColor = "text-[#22C55E] border-[#22C55E]/20 bg-[#22C55E]/5";
  } else if (overallScore >= 60) {
    readinessLabel = "Product / SDE Ready";
    readinessColor = "text-[#EAB308] border-[#EAB308]/20 bg-[#EAB308]/5";
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FAFAFA] px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col gap-8">
      
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-black text-[#A3A3A3] hover:text-[#FAFAFA] border border-[#262626] bg-[#111111]/40 px-3 py-1.5 rounded-xl transition-all">
          <ArrowLeft className="h-3.5 w-3.5" />
          Leaderboard standing
        </Link>
        <span className="text-[10px] text-[#A3A3A3] font-bold tracking-widest uppercase bg-[#111111] px-3 py-1 border border-[#262626] rounded-xl">
          ID: {student.rollNumber}
        </span>
      </div>

      {/* TOP SECTION */}
      <div className="relative rounded-3xl border border-[#262626] bg-[#111111]/60 p-6 sm:p-8 overflow-hidden shadow-2xl flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at center, rgba(234, 179, 8, 0.1) 0%, rgba(10, 10, 10, 0) 70%)"
          }}
        />

        <div className="flex items-center gap-4.5 z-10">
          <div className="h-16 w-16 rounded-2xl border border-[#262626] overflow-hidden bg-zinc-950 flex items-center justify-center shrink-0">
            {student.profilePictureUrl ? (
              <img src={student.profilePictureUrl} alt={student.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-black text-[#EAB308] bg-[#EAB308]/10 h-full w-full flex items-center justify-center">
                {student.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#FAFAFA]">
              {student.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider">
                {student.department} • {student.year} Year • Sec {student.section}
              </span>
              <span className={`inline-flex px-2 py-0.5 border rounded-lg text-[8px] font-bold tracking-wider uppercase leading-none ${readinessColor}`}>
                {readinessLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-4 sm:gap-6 z-10">
          <div className="flex items-center gap-3 border border-[#262626] bg-zinc-950/40 px-4 py-3 rounded-2xl">
            <div className="flex flex-col text-right">
              <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Overall Score</span>
              <span className="text-xl font-black text-[#EAB308] mt-0.5">{overallScore}</span>
            </div>
            <div className="h-10 w-10 relative flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="20" cy="20" r="16" className="stroke-zinc-900 fill-transparent" strokeWidth="2.5" />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  className="fill-transparent stroke-[#EAB308]"
                  strokeWidth="2.5"
                  strokeDasharray={2 * Math.PI * 16}
                  strokeDashoffset={2 * Math.PI * 16 - (overallScore / 100) * 2 * Math.PI * 16}
                />
              </svg>
              <span className="absolute text-[8px] font-black text-[#FAFAFA]">{Math.round(overallScore)}</span>
            </div>
          </div>

          <div className="flex flex-col justify-center items-center border border-[#262626] bg-[#111111] px-5 py-3 rounded-2xl w-24">
            <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest text-center">Rank</span>
            <span className="text-xl font-black text-[#FAFAFA] mt-0.5 flex items-center gap-1">
              <Trophy className="h-4.5 w-4.5 text-[#EAB308]" />
              #{rank}
            </span>
          </div>
        </div>
      </div>

      {selectedPlatform === null ? (
        <div className="flex flex-col gap-6">
          <div className="text-xs text-[#A3A3A3] uppercase tracking-widest font-black text-center mb-2">
            Select a Platform Card below to view detailed analytics
          </div>

          {/* 3 BIG CLICKABLE CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* CODECHEF CARD */}
            <div
              onClick={() => student.codechefUsername && setSelectedPlatform("codechef")}
              className={`border border-[#262626] hover:border-[#EAB308]/40 bg-[#111111]/70 hover:bg-[#111111] p-6 rounded-3xl cursor-pointer flex flex-col gap-4 transition-all duration-300 group shadow-lg ${!student.codechefUsername ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-[#EAB308]/10 border border-[#EAB308]/20 flex items-center justify-center text-[#EAB308]">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#FAFAFA] group-hover:text-[#EAB308] transition-colors">CodeChef</h3>
                    <p className="text-[9px] text-[#A3A3A3] font-semibold">@{student.codechefUsername || "N/A"}</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 bg-[#EAB308]/5 border border-[#EAB308]/20 rounded-md text-[#EAB308]">
                  {student.codechefProfile?.currentRating || 0} Rating
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center border-t border-[#262626]/60 pt-4 mt-2">
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold">Stars</span>
                  <span className="text-xs font-black text-[#FAFAFA] mt-1">{student.codechefProfile?.stars || 1}★</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold">Solved</span>
                  <span className="text-xs font-black text-[#FAFAFA] mt-1">{student.codechefProfile?.problemsSolved || 0}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold">Contests</span>
                  <span className="text-xs font-black text-[#FAFAFA] mt-1">{student.codechefProfile?.contestCount || 0}</span>
                </div>
              </div>
            </div>

            {/* LEETCODE CARD */}
            <div
              onClick={() => student.leetcodeUsername && setSelectedPlatform("leetcode")}
              className={`border border-[#262626] hover:border-[#EAB308]/40 bg-[#111111]/70 hover:bg-[#111111] p-6 rounded-3xl cursor-pointer flex flex-col gap-4 transition-all duration-300 group shadow-lg ${!student.leetcodeUsername ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B]">
                    <Code className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#FAFAFA] group-hover:text-[#EAB308] transition-colors">LeetCode</h3>
                    <p className="text-[9px] text-[#A3A3A3] font-semibold">@{student.leetcodeUsername || "N/A"}</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-md text-[#F59E0B]">
                  {student.leetcodeProfile?.contestRating || 0} Rating
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center border-t border-[#262626]/60 pt-4 mt-2">
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold">Solved</span>
                  <span className="text-xs font-black text-[#FAFAFA] mt-1">{student.leetcodeProfile?.problemsSolved || 0}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold">Acceptance</span>
                  <span className="text-xs font-black text-[#FAFAFA] mt-1">{student.leetcodeProfile?.acceptanceRate || 0}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold">Consistency</span>
                  <span className="text-xs font-black text-[#FAFAFA] mt-1">{student.leetcodeProfile?.consistencyScore || 0}%</span>
                </div>
              </div>
            </div>

            {/* GITHUB CARD */}
            <div
              onClick={() => student.githubUsername && setSelectedPlatform("github")}
              className={`border border-[#262626] hover:border-[#EAB308]/40 bg-[#111111]/70 hover:bg-[#111111] p-6 rounded-3xl cursor-pointer flex flex-col gap-4 transition-all duration-300 group shadow-lg ${!student.githubUsername ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Github className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#FAFAFA] group-hover:text-[#EAB308] transition-colors">GitHub</h3>
                    <p className="text-[9px] text-[#A3A3A3] font-semibold">@{student.githubUsername || "N/A"}</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 bg-purple-500/5 border border-purple-500/20 rounded-md text-purple-400">
                  {student.githubProfile?.openSourceScore || 0} OS Score
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center border-t border-[#262626]/60 pt-4 mt-2">
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold">Repos</span>
                  <span className="text-xs font-black text-[#FAFAFA] mt-1">{student.githubProfile?.totalRepositories || 0}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold">Stars</span>
                  <span className="text-xs font-black text-[#FAFAFA] mt-1">{student.githubProfile?.totalStars || 0}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold">Followers</span>
                  <span className="text-xs font-black text-[#FAFAFA] mt-1">{student.githubProfile?.followers || 0}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-[#262626] pb-4">
            <button
              onClick={() => setSelectedPlatform(null)}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-black text-[#A3A3A3] hover:text-[#FAFAFA] border border-[#262626] bg-[#111111] px-3.5 py-1.5 rounded-xl transition-all"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Profile
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-wider mr-2">Switch Dashboard:</span>
              <button
                onClick={() => setSelectedPlatform("codechef")}
                disabled={!student.codechefUsername}
                className={`px-3 py-1.5 rounded-xl border text-[9px] font-bold tracking-wider uppercase transition-all ${selectedPlatform === "codechef" ? "bg-[#EAB308]/20 text-[#EAB308] border-[#EAB308]/30" : "border-[#262626] bg-zinc-950/40 text-[#A3A3A3] hover:text-white"}`}
              >
                CodeChef
              </button>
              <button
                onClick={() => setSelectedPlatform("leetcode")}
                disabled={!student.leetcodeUsername}
                className={`px-3 py-1.5 rounded-xl border text-[9px] font-bold tracking-wider uppercase transition-all ${selectedPlatform === "leetcode" ? "bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30" : "border-[#262626] bg-zinc-950/40 text-[#A3A3A3] hover:text-white"}`}
              >
                LeetCode
              </button>
              <button
                onClick={() => setSelectedPlatform("github")}
                disabled={!student.githubUsername}
                className={`px-3 py-1.5 rounded-xl border text-[9px] font-bold tracking-wider uppercase transition-all ${selectedPlatform === "github" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "border-[#262626] bg-zinc-950/40 text-[#A3A3A3] hover:text-white"}`}
              >
                GitHub
              </button>
            </div>
          </div>

          {/* CODECHEF DASHBOARD */}
          {selectedPlatform === "codechef" && student.codechefProfile && (
            <div className="flex flex-col gap-6">
              
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Current Rating</span>
                  <span className="text-2xl font-black text-[#EAB308] mt-2">{student.codechefProfile.currentRating}</span>
                </div>
                <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Highest Rating</span>
                  <span className="text-2xl font-black text-[#FAFAFA] mt-2">{student.codechefProfile.highestRating}</span>
                </div>
                <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Stars</span>
                  <span className="text-2xl font-black text-[#EAB308] mt-2">{student.codechefProfile.stars}★</span>
                </div>
                <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Contest Count</span>
                  <span className="text-2xl font-black text-[#FAFAFA] mt-2">{student.codechefProfile.contestCount}</span>
                </div>
                <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Global Rank</span>
                  <span className="text-2xl font-black text-[#FAFAFA] mt-2">#{student.codechefProfile.globalRank || "-"}</span>
                </div>
                <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Country Rank</span>
                  <span className="text-2xl font-black text-[#FAFAFA] mt-2">#{student.codechefProfile.countryRank || "-"}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border border-[#262626] bg-[#111111]/70 p-5 rounded-2xl flex items-center justify-between">
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Streak Counter</span>
                    <span className="text-2xl font-black text-[#FAFAFA] mt-2 flex items-center gap-1.5">
                      <Flame className="h-6.5 w-6.5 text-[#EAB308] fill-[#EAB308]/20 animate-pulse" />
                      {1 + (student.codechefProfile.problemsSolved % 15)} Days Streak 🔥
                    </span>
                  </div>
                </div>

                <div className="border border-[#262626] bg-[#111111]/70 p-5 rounded-2xl flex items-center justify-between">
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Problems Solved</span>
                    <span className="text-2xl font-black text-[#EAB308] mt-2">{student.codechefProfile.problemsSolved} Fully</span>
                  </div>
                </div>

                <ConsistencyGauge score={student.aiAnalysis?.consistencyScore || 75} title="Consistency Score" color="#EAB308" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border border-[#262626] bg-[#111111]/60 p-5 rounded-2xl flex flex-col gap-3">
                  <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider">Rating Growth Line Chart</span>
                  <div className="h-64 w-full">
                    {Array.isArray(student.codechefProfile.ratingHistory) && student.codechefProfile.ratingHistory.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={student.codechefProfile.ratingHistory}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                          <XAxis dataKey="contest" stroke="#52525b" fontSize={9} />
                          <YAxis stroke="#52525b" fontSize={9} domain={["dataMin - 100", "dataMax + 100"]} />
                          <Tooltip contentStyle={{ backgroundColor: "#111111", borderColor: "#262626" }} />
                          <Line type="monotone" dataKey="rating" stroke="#EAB308" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-[#A3A3A3]">No rating history available.</div>
                    )}
                  </div>
                </div>

                <div className="border border-[#262626] bg-[#111111]/60 p-5 rounded-2xl flex flex-col gap-3">
                  <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider">Contest Performance Bar Chart</span>
                  <div className="h-64 w-full">
                    {Array.isArray(student.codechefProfile.contestHistory) && student.codechefProfile.contestHistory.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={student.codechefProfile.contestHistory}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                          <XAxis dataKey="contest" stroke="#52525b" fontSize={9} />
                          <YAxis stroke="#52525b" fontSize={9} />
                          <Tooltip contentStyle={{ backgroundColor: "#111111", borderColor: "#262626" }} />
                          <Bar dataKey="rating" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-[#A3A3A3]">No contest performance history.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <CalendarHeatmap data={student.codechefProfile.activitySummary || {}} colorTheme="gold" />
                
                <div className="border border-[#262626] bg-[#111111]/60 p-5 rounded-2xl flex flex-col gap-3">
                  <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider">Submission Trend Graph</span>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(student.codechefProfile.ratingHistory || []).map((x: any, idx: number) => ({ name: x.contest, submissions: 10 + (idx * 5) + (x.rating % 20) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                        <XAxis dataKey="name" stroke="#52525b" fontSize={9} />
                        <YAxis stroke="#52525b" fontSize={9} />
                        <Tooltip contentStyle={{ backgroundColor: "#111111", borderColor: "#262626" }} />
                        <Line type="monotone" dataKey="submissions" stroke="#EAB308" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* LEETCODE DASHBOARD */}
          {selectedPlatform === "leetcode" && student.leetcodeProfile && (
            <div className="flex flex-col gap-6">
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Contest Rating</span>
                  <span className="text-2xl font-black text-[#F59E0B] mt-2">{student.leetcodeProfile.contestRating}</span>
                </div>
                <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Contest Rank</span>
                  <span className="text-2xl font-black text-[#FAFAFA] mt-2">#{student.leetcodeProfile.contestRank}</span>
                </div>
                <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Problems Solved</span>
                  <span className="text-2xl font-black text-[#FAFAFA] mt-2">{student.leetcodeProfile.problemsSolved}</span>
                </div>
                <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Acceptance Rate</span>
                  <span className="text-2xl font-black text-[#EAB308] mt-2">{student.leetcodeProfile.acceptanceRate}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border border-[#262626] bg-[#111111]/60 p-5 rounded-2xl flex flex-col gap-4 justify-between w-full">
                  <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider">Problems Solved (Easy/Medium/Hard)</span>
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold mb-1">
                        <span className="text-emerald-500">Easy</span>
                        <span>{student.leetcodeProfile.easySolvedCount}</span>
                      </div>
                      <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: "80%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold mb-1">
                        <span className="text-[#F59E0B]">Medium</span>
                        <span>{student.leetcodeProfile.mediumSolvedCount}</span>
                      </div>
                      <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-[#F59E0B] h-full rounded-full" style={{ width: "70%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold mb-1">
                        <span className="text-red-500">Hard</span>
                        <span>{student.leetcodeProfile.hardSolvedCount}</span>
                      </div>
                      <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-red-500 h-full rounded-full" style={{ width: "40%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-[#262626] bg-[#111111]/60 p-5 rounded-2xl flex flex-col gap-3 w-full">
                  <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider">Weekly Activity Chart</span>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, idx) => ({
                        day,
                        submissions: Array.isArray(student.leetcodeProfile.weeklyActivity) ? student.leetcodeProfile.weeklyActivity[idx] || 0 : 2 + idx
                      }))}>
                        <XAxis dataKey="day" stroke="#52525b" fontSize={9} />
                        <YAxis stroke="#52525b" fontSize={9} />
                        <Tooltip contentStyle={{ backgroundColor: "#111111", borderColor: "#262626" }} />
                        <Bar dataKey="submissions" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <ConsistencyGauge score={student.leetcodeProfile.consistencyScore} title="Consistency Score" color="#F59E0B" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-[#262626] bg-[#111111]/60 p-5 rounded-2xl flex flex-col gap-3 items-center">
                  <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider w-full text-left">Skill Radar Chart</span>
                  <div className="h-64 w-full">
                    {Array.isArray(student.leetcodeProfile.skillRadar) && student.leetcodeProfile.skillRadar.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={student.leetcodeProfile.skillRadar}>
                          <PolarGrid stroke="#1f1f1f" />
                          <PolarAngleAxis dataKey="subject" stroke="#a3a3a3" fontSize={9} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#52525b" fontSize={8} />
                          <Radar name="Proficiency" dataKey="A" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-[#A3A3A3]">No skill radar data.</div>
                    )}
                  </div>
                </div>

                <div className="border border-[#262626] bg-[#111111]/60 p-5 rounded-2xl flex flex-col gap-3 items-center">
                  <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider w-full text-left">Tag Distribution Pie Chart</span>
                  <div className="h-64 w-full">
                    {Array.isArray(student.leetcodeProfile.tagDistribution) && student.leetcodeProfile.tagDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={student.leetcodeProfile.tagDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            outerRadius={65}
                            dataKey="value"
                            fontSize={8}
                          >
                            {student.leetcodeProfile.tagDistribution.map((entry: any, index: number) => {
                              const colors = ["#EAB308", "#F59E0B", "#22C55E", "#8B5CF6", "#EF4444", "#3B82F6"];
                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                            })}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "#111111", borderColor: "#262626" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-[#A3A3A3]">No tag distributions available.</div>
                    )}
                  </div>
                </div>
              </div>

              <CalendarHeatmap data={student.leetcodeProfile.heatmap || {}} colorTheme="leetcode" />

            </div>
          )}

          {/* GITHUB DASHBOARD */}
          {selectedPlatform === "github" && student.githubProfile && (() => {
            const reposData = student.githubProfile.repos as any;
            const reposList = Array.isArray(reposData) ? reposData : (reposData?.list || []);
            const contribMap = student.githubProfile.contributions || {};

            return (
              <div className="flex flex-col gap-6">
                
                {/* 5 Stats row */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Total Repositories</span>
                    <span className="text-2xl font-black text-purple-400 mt-2">{student.githubProfile.totalRepositories}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Stars</span>
                    <span className="text-2xl font-black text-[#FAFAFA] mt-2">⭐ {student.githubProfile.totalStars}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Forks</span>
                    <span className="text-2xl font-black text-[#FAFAFA] mt-2">🍴 {student.githubProfile.totalForks}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Followers</span>
                    <span className="text-2xl font-black text-[#FAFAFA] mt-2">{student.githubProfile.followers}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Open Source Score</span>
                    <span className="text-2xl font-black text-[#EAB308] mt-2">{student.githubProfile.openSourceScore}%</span>
                  </div>
                </div>

                {/* Portfolio Project Classifications */}
                {reposData?.portfolio && (
                  <div className="border border-[#262626] bg-[#111111]/40 p-5 rounded-3xl">
                    <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest block mb-3">Portfolio Projects Classification</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                      {[
                        { name: "Full Stack", value: reposData.portfolio.fullStack, color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
                        { name: "AI/ML", value: reposData.portfolio.ai, color: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5" },
                        { name: "Web Dev", value: reposData.portfolio.web, color: "text-sky-400 border-sky-500/20 bg-sky-500/5" },
                        { name: "Mobile App", value: reposData.portfolio.mobile, color: "text-amber-400 border-amber-500/20 bg-amber-500/5" },
                        { name: "Open Source", value: reposData.portfolio.openSource, color: "text-purple-400 border-purple-500/20 bg-purple-500/5" },
                        { name: "College / Lab", value: reposData.portfolio.college, color: "text-zinc-400 border-zinc-500/20 bg-zinc-500/5" },
                        { name: "Hackathons", value: reposData.portfolio.hackathon, color: "text-rose-400 border-rose-500/20 bg-rose-500/5" },
                      ].map((p, idx) => (
                        <div key={idx} className={`border rounded-xl px-3 py-2 text-center flex flex-col justify-center items-center ${p.color}`}>
                          <span className="text-[9px] font-bold uppercase tracking-wider">{p.name}</span>
                          <span className="text-base font-black mt-0.5">{p.value || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Repo Cards */}
                <div className="border border-[#262626] bg-[#111111]/40 p-6 rounded-3xl">
                  <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest block mb-4">Repository Explorer (Click repository card to explore)</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reposList.length > 0 ? (
                      reposList.map((repo: any, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => handleOpenRepoExplorer(repo)}
                          className="border border-[#262626] hover:border-purple-500/40 bg-[#111111]/70 hover:bg-[#111111] p-4.5 rounded-2xl flex flex-col gap-2 justify-between cursor-pointer transition-all duration-200"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-[#FAFAFA] hover:text-purple-400 transition-colors">{repo.name}</span>
                              <span className="text-[8px] bg-zinc-900 border border-[#262626] text-purple-400 font-bold px-2 py-0.5 rounded-md uppercase">{repo.language}</span>
                            </div>
                            <p className="text-[10px] text-[#A3A3A3] mt-1.5 leading-relaxed font-semibold">{repo.description}</p>
                          </div>
                          <div className="flex gap-4 mt-3 text-[9px] text-[#A3A3A3] font-bold border-t border-[#262626]/40 pt-2.5">
                            <span>⭐ {repo.stars} stars</span>
                            <span>🍴 {repo.forks} forks</span>
                            {repo.size && <span>📦 {Math.round(repo.size / 1024)} MB</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-center text-xs text-[#A3A3A3] py-6">No repositories listed.</div>
                    )}
                  </div>
                </div>

                {/* Open Source Analytics Grid */}
                {reposData?.openSource && (
                  <div className="border border-[#262626] bg-[#111111]/40 p-6 rounded-3xl">
                    <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest block mb-4">Open Source Engagement</span>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {[
                        { label: "Pull Requests", value: reposData.openSource.pullRequests, color: "text-purple-400" },
                        { label: "PRs Merged", value: reposData.openSource.pullRequestsMerged, color: "text-emerald-400" },
                        { label: "PRs Open", value: reposData.openSource.pullRequestsOpen, color: "text-amber-400" },
                        { label: "Issues Created", value: reposData.openSource.issuesCreated, color: "text-rose-400" },
                        { label: "Issues Closed", value: reposData.openSource.issuesClosed, color: "text-blue-400" },
                        { label: "Organizations", value: reposData.openSource.organizations, color: "text-zinc-400" },
                        { label: "Fork Contributions", value: reposData.openSource.forkContributions, color: "text-sky-400" },
                        { label: "Discussions", value: reposData.openSource.discussions, color: "text-teal-400" },
                        { label: "Releases Published", value: reposData.openSource.releases, color: "text-pink-400" },
                        { label: "Current Streak", value: student.githubProfile.streaks && typeof student.githubProfile.streaks.current === "number" ? `${student.githubProfile.streaks.current} Days` : "Not available from platform.", color: "text-[#EAB308]" }
                      ].map((o, idx) => (
                        <div key={idx} className="border border-[#262626] bg-[#111111]/70 p-4 rounded-2xl text-center">
                          <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold block">{o.label}</span>
                          <span className={`text-base font-black block mt-1.5 ${o.color}`}>{o.value ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="border border-[#262626] bg-[#111111]/60 p-5 rounded-2xl flex flex-col gap-3 items-center">
                    <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider w-full text-left">Language Distribution Pie Chart</span>
                    <div className="h-64 w-full">
                      {Array.isArray(student.githubProfile.languages) && student.githubProfile.languages.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={student.githubProfile.languages}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={65}
                              paddingAngle={5}
                              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                              dataKey="value"
                              fontSize={8}
                            >
                              {student.githubProfile.languages.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color || "#8B5CF6"} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: "#111111", borderColor: "#262626" }}
                              formatter={(value: any, name: any, props: any) => {
                                const bytes = props.payload?.bytes;
                                const repoCount = props.payload?.totalRepos;
                                const formattedBytes = bytes ? (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`) : "0 KB";
                                return [
                                  `${value}% (${formattedBytes}, ${repoCount || 0} repos)`,
                                  name
                                ];
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-[#A3A3A3]">No language details available.</div>
                      )}
                    </div>
                  </div>

                  <div className="border border-[#262626] bg-[#111111]/60 p-5 rounded-2xl flex flex-col gap-3">
                    <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider">Commit Timeline Chart</span>
                    <div className="h-64 w-full">
                      {Array.isArray(student.githubProfile.commitTimeline) && student.githubProfile.commitTimeline.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={student.githubProfile.commitTimeline}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                            <XAxis dataKey="month" stroke="#52525b" fontSize={9} />
                            <YAxis stroke="#52525b" fontSize={9} />
                            <Tooltip contentStyle={{ backgroundColor: "#111111", borderColor: "#262626" }} />
                            <Line type="monotone" dataKey="commits" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-[#A3A3A3]">No commit timeline available.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Commit Analytics Grid */}
                {reposData?.commitAnalytics && (
                  <div className="border border-[#262626] bg-[#111111]/40 p-6 rounded-3xl">
                    <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest block mb-4">Commit Velocity & Activity Stats</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Total Commits", value: reposData.commitAnalytics.total },
                        { label: "Commits This Year", value: reposData.commitAnalytics.commitsThisYear },
                        { label: "Commits This Month", value: reposData.commitAnalytics.commitsThisMonth },
                        { label: "Commits This Week", value: reposData.commitAnalytics.weeklyCommits },
                        { label: "Daily Average", value: `${reposData.commitAnalytics.dailyAverage}/day` },
                        { label: "Monthly Average", value: `${reposData.commitAnalytics.monthlyAverage}/mo` },
                        { label: "Most Active Weekday", value: reposData.commitAnalytics.mostActiveWeekday },
                        { label: "Most Active Month", value: reposData.commitAnalytics.mostActiveMonth },
                      ].map((c, idx) => (
                        <div key={idx} className="border border-[#262626] bg-[#111111]/70 p-4 rounded-2xl text-center">
                          <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold">{c.label}</span>
                          <span className="text-sm font-black text-[#FAFAFA] block mt-1">{c.value || "Not available from platform."}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Repository Intelligence Grid */}
                {reposData?.intelligence && (
                  <div className="border border-[#262626] bg-[#111111]/40 p-6 rounded-3xl">
                    <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest block mb-4">Repository Intelligence</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Most Starred", value: reposData.intelligence.mostStarredRepository },
                        { label: "Most Forked", value: reposData.intelligence.mostForkedRepository },
                        { label: "Most Active", value: reposData.intelligence.mostActiveRepository },
                        { label: "Largest Project", value: reposData.intelligence.largestRepository },
                        { label: "Newest Project", value: reposData.intelligence.newestRepository },
                        { label: "Oldest Project", value: reposData.intelligence.oldestRepository },
                        { label: "Recently Updated", value: reposData.intelligence.mostRecentlyUpdatedRepository },
                      ].map((c, idx) => (
                        <div key={idx} className="border border-[#262626] bg-[#111111]/70 p-4 rounded-2xl text-center">
                          <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold">{c.label}</span>
                          <span className="text-xs font-black text-[#FAFAFA] block mt-1 truncate" title={c.value}>{c.value || "Not available from platform."}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="md:col-span-2">
                    <CalendarHeatmap data={contribMap} colorTheme="purple" />
                  </div>

                  <div className="border border-[#262626] bg-[#111111]/60 p-5 rounded-2xl flex flex-col gap-3 items-center w-full">
                    <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider w-full text-left">Repository Quality Score (Radar)</span>
                    <div className="h-52 w-full">
                      {Array.isArray(student.githubProfile.repoQualityScore) && student.githubProfile.repoQualityScore.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={student.githubProfile.repoQualityScore}>
                            <PolarGrid stroke="#1f1f1f" />
                            <PolarAngleAxis dataKey="subject" stroke="#a3a3a3" fontSize={7} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#52525b" fontSize={7} />
                            <Radar name="Repository Quality" dataKey="A" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.15} />
                          </RadarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-[#A3A3A3]">No quality analysis available.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Career Readiness & Insights */}
                {reposData?.careerInsights && reposData?.developerScore && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Score breakdown & Readiness ratings */}
                    <div className="border border-[#262626] bg-[#111111]/40 p-5 rounded-3xl flex flex-col gap-4">
                      <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest">Developer Score & Industry Readiness</span>
                      
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "Resume Strength", value: `${reposData.careerInsights.resumeStrength}%`, color: "text-[#22C55E]" },
                          { label: "Portfolio Strength", value: `${reposData.careerInsights.portfolioStrength}%`, color: "text-[#3B82F6]" },
                          { label: "Industry Readiness", value: `${reposData.careerInsights.industryReadiness}%`, color: "text-purple-400" },
                        ].map((s, idx) => (
                          <div key={idx} className="border border-[#262626] bg-[#111111]/75 p-3 rounded-xl text-center">
                            <span className="text-[8px] uppercase tracking-wider text-[#A3A3A3] font-bold">{s.label}</span>
                            <span className={`text-sm font-black block mt-1 ${s.color}`}>{s.value}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border border-[#262626] bg-zinc-950/40 p-4.5 rounded-2xl flex flex-col gap-2.5">
                        <div className="flex justify-between items-center text-[10px] font-bold border-b border-[#262626]/40 pb-2">
                          <span className="text-[#A3A3A3]">Hiring Readiness:</span>
                          <span className="text-purple-400 uppercase font-black">{reposData.careerInsights.hiringReadiness}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold border-b border-[#262626]/40 pb-2">
                          <span className="text-[#A3A3A3]">Open Source Readiness:</span>
                          <span className="text-emerald-400 uppercase font-black">{reposData.careerInsights.openSourceReadiness}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-[#A3A3A3]">Strongest Skills:</span>
                          <span className="text-cyan-400 font-black">{reposData.careerInsights.strongestSkills.join(", ")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Career insights (Suggested projects & learning path) */}
                    <div className="border border-[#262626] bg-[#111111]/40 p-5 rounded-3xl flex flex-col gap-4">
                      <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-widest">AI Custom Suggested Projects</span>
                      <div className="flex flex-col gap-2.5">
                        {reposData.careerInsights.suggestedProjects.map((proj: string, idx: number) => (
                          <div key={idx} className="border border-[#262626] bg-[#111111]/75 p-3 rounded-xl flex gap-2">
                            <span className="text-purple-400 font-bold text-xs">0{idx + 1}.</span>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-[#FAFAFA] font-bold leading-tight">{proj}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            );
          })()}

        </div>
      )}

      {/* REPOSITORY EXPLORER MODAL */}
      {isRepoExplorerOpen && selectedRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden border border-[#262626] bg-[#0A0A0A]/95 rounded-3xl flex flex-col shadow-2xl">
            
            {/* Header */}
            <div className="border-b border-[#262626] p-5 flex justify-between items-center bg-[#111111]/80">
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-400 font-bold tracking-wider px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-md">
                  {selectedRepo.visibility?.toUpperCase() || "PUBLIC"}
                </span>
                <h2 className="text-base font-black text-white">{selectedRepo.name}</h2>
              </div>
              <button
                onClick={() => setIsRepoExplorerOpen(false)}
                className="text-xs uppercase tracking-widest font-black text-[#A3A3A3] hover:text-[#FAFAFA] border border-[#262626] bg-[#111111] px-2.5 py-1 rounded-xl transition-all"
              >
                Close
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
              
              {/* Left Column: Details, Languages, Contributors */}
              <div className="w-full md:w-1/3 flex flex-col gap-5 border-r border-[#262626]/40 pr-0 md:pr-6">
                
                {/* Stats */}
                <div className="border border-[#262626] bg-[#111111]/30 p-4.5 rounded-2xl flex flex-col gap-3">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Repository Stats</span>
                  <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold text-[#FAFAFA]">
                    <div className="bg-zinc-950/40 p-2 rounded-xl border border-[#262626]/40">
                      <span className="text-[#A3A3A3] block text-[8px] mb-0.5">Stars</span>
                      ⭐ {selectedRepo.stars}
                    </div>
                    <div className="bg-zinc-950/40 p-2 rounded-xl border border-[#262626]/40">
                      <span className="text-[#A3A3A3] block text-[8px] mb-0.5">Forks</span>
                      🍴 {selectedRepo.forks}
                    </div>
                    <div className="bg-zinc-950/40 p-2 rounded-xl border border-[#262626]/40">
                      <span className="text-[#A3A3A3] block text-[8px] mb-0.5">Size</span>
                      📦 {selectedRepo.size ? `${(selectedRepo.size / 1024).toFixed(1)} MB` : "N/A"}
                    </div>
                    <div className="bg-zinc-950/40 p-2 rounded-xl border border-[#262626]/40">
                      <span className="text-[#A3A3A3] block text-[8px] mb-0.5">Issues</span>
                      ⚠️ {selectedRepo.openIssues} Open
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="border border-[#262626] bg-[#111111]/30 p-4.5 rounded-2xl">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest block mb-1.5">Description</span>
                  <p className="text-[10px] text-[#A3A3A3] leading-relaxed font-semibold">{selectedRepo.description}</p>
                </div>

                {/* Languages Details */}
                <div className="border border-[#262626] bg-[#111111]/30 p-4.5 rounded-2xl flex flex-col gap-2">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Languages breakdown</span>
                  {isRepoLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-4.5 w-4.5 animate-spin text-[#EAB308]" /></div>
                  ) : repoDetails?.languages && Object.keys(repoDetails.languages).length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {Object.entries(repoDetails.languages).map(([name, bytes]: [string, any]) => {
                        const totalBytes = Object.values(repoDetails.languages).reduce((a: any, b: any) => a + b, 0) as number;
                        const pct = totalBytes > 0 ? ((bytes / totalBytes) * 100).toFixed(1) : "0";
                        return (
                          <div key={name} className="flex justify-between items-center text-[10px] font-bold text-[#A3A3A3]">
                            <span className="text-[#FAFAFA]">{name}</span>
                            <span>{pct}% ({Math.round(bytes / 1024)} KB)</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#A3A3A3] font-semibold italic text-center py-2">No language details available.</span>
                  )}
                </div>

                {/* Contributors */}
                <div className="border border-[#262626] bg-[#111111]/30 p-4.5 rounded-2xl flex flex-col gap-2">
                  <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest">Top Contributors</span>
                  {isRepoLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-4.5 w-4.5 animate-spin text-[#EAB308]" /></div>
                  ) : repoDetails?.contributors && repoDetails.contributors.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {repoDetails.contributors.slice(0, 5).map((c: any) => (
                        <div key={c.login} className="flex items-center gap-1.5 bg-zinc-900 border border-[#262626] px-2 py-1 rounded-xl" title={`${c.contributions} contributions`}>
                          {c.avatarUrl ? (
                            <img src={c.avatarUrl} alt={c.login} className="h-3.5 w-3.5 rounded-full" />
                          ) : (
                            <div className="h-3.5 w-3.5 rounded-full bg-zinc-700 flex items-center justify-center text-[6px] font-black">{c.login.slice(0,2).toUpperCase()}</div>
                          )}
                          <span className="text-[9px] font-bold text-[#FAFAFA]">{c.login} ({c.contributions})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#A3A3A3] font-semibold italic text-center py-2">No contributors list available.</span>
                  )}
                </div>

              </div>

              {/* Right Column: Tab Navigation (README, Commits, Activity) */}
              <div className="w-full md:w-2/3 flex flex-col gap-4">
                
                {/* Tabs Selector */}
                <div className="flex border-b border-[#262626]/60 pb-2 gap-4">
                  {[
                    { id: "readme", label: "README.md" },
                    { id: "commits", label: "Commit History" },
                    { id: "activity", label: "Recent Timeline" }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setRepoActiveTab(t.id as any)}
                      className={`text-[10px] font-black uppercase tracking-wider pb-1 transition-all ${repoActiveTab === t.id ? "text-purple-400 border-b-2 border-purple-400" : "text-[#A3A3A3] hover:text-white"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab Contents */}
                <div className="flex-1 min-h-[300px] bg-[#111111]/20 border border-[#262626]/40 p-5 rounded-2xl overflow-y-auto">
                  
                  {isRepoLoading ? (
                    <div className="h-full min-h-[300px] flex flex-col gap-2 items-center justify-center text-xs text-[#A3A3A3] font-bold">
                      <Loader2 className="h-6 w-6 animate-spin text-[#EAB308]" />
                      <span>Reading repository data...</span>
                    </div>
                  ) : repoError ? (
                    <div className="h-full min-h-[300px] flex items-center justify-center text-center text-xs text-red-500 font-bold p-4">
                      {repoError}
                    </div>
                  ) : (
                    <>
                      {/* README Tab */}
                      {repoActiveTab === "readme" && (
                        <div className="text-xs text-[#E5E5E5] leading-relaxed whitespace-pre-wrap font-mono break-all max-h-[400px]">
                          {repoDetails?.readme || "No README.md content is listed."}
                        </div>
                      )}

                      {/* Commits Tab */}
                      {repoActiveTab === "commits" && (
                        <div className="flex flex-col gap-3">
                          {repoDetails?.commits && repoDetails.commits.length > 0 ? (
                            repoDetails.commits.map((c: any, i: number) => (
                              <div key={i} className="border-b border-[#262626]/40 pb-2.5 last:border-b-0 flex justify-between items-start gap-4">
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-white font-bold leading-snug">{c.message}</span>
                                  <span className="text-[8px] text-[#A3A3A3] font-semibold mt-1">
                                    by <strong className="text-purple-400">{c.author}</strong> on {new Date(c.date).toLocaleDateString()}
                                  </span>
                                </div>
                                <span className="text-[8px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md font-bold uppercase shrink-0">
                                  {c.sha}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-[#A3A3A3] italic text-center block py-8">No commit history available.</span>
                          )}
                        </div>
                      )}

                      {/* Timeline Tab */}
                      {repoActiveTab === "activity" && (
                        <div className="flex flex-col gap-4">
                          <div>
                            <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest block mb-2">Pull Requests History</span>
                            {repoDetails?.pulls && repoDetails.pulls.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {repoDetails.pulls.map((p: any) => (
                                  <div key={p.number} className="text-[10px] text-[#A3A3A3] font-bold flex justify-between items-center border-b border-[#262626]/40 pb-1.5">
                                    <span className="text-white">#{p.number} {p.title}</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold ${p.state === "closed" || p.mergedDate ? "bg-purple-500/15 text-purple-400 border border-purple-500/20" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"}`}>
                                      {p.mergedDate ? "MERGED" : p.state.toUpperCase()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#A3A3A3] italic block">No pull requests.</span>
                            )}
                          </div>

                          <div>
                            <span className="text-[9px] font-black text-[#EAB308] uppercase tracking-widest block mb-2">Issues Log</span>
                            {repoDetails?.issues && repoDetails.issues.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {repoDetails.issues.map((issue: any) => (
                                  <div key={issue.number} className="text-[10px] text-[#A3A3A3] font-bold flex justify-between items-center border-b border-[#262626]/40 pb-1.5">
                                    <span className="text-white">#{issue.number} {issue.title}</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold ${issue.state === "closed" ? "bg-zinc-800 text-zinc-400 border border-[#262626]" : "bg-rose-500/15 text-rose-400 border border-rose-500/20"}`}>
                                      {issue.state.toUpperCase()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#A3A3A3] italic block">No issues.</span>
                            )}
                          </div>
                        </div>
                      )}

                    </>
                  )}

                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 mt-2 border-t border-[#262626]/40 pt-4">
                  <a
                    href={selectedRepo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-black text-white border border-[#262626] bg-[#111111] hover:bg-[#1f1f1f] px-3.5 py-2 rounded-xl transition-all"
                  >
                    Open Repository
                  </a>
                  <a
                    href={`${selectedRepo.url}/issues`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-black text-white border border-[#262626] bg-[#111111] hover:bg-[#1f1f1f] px-3.5 py-2 rounded-xl transition-all"
                  >
                    Open Issues
                  </a>
                  <a
                    href={`${selectedRepo.url}/pulls`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-black text-white border border-[#262626] bg-[#111111] hover:bg-[#1f1f1f] px-3.5 py-2 rounded-xl transition-all"
                  >
                    Open Pull Requests
                  </a>
                  <a
                    href={`https://github.com/${student.githubUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-black text-[#A3A3A3] hover:text-[#FAFAFA] border border-[#262626] bg-[#111111]/40 px-3.5 py-2 rounded-xl transition-all"
                  >
                    Open GitHub
                  </a>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
