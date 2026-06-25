"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/app/providers";
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  UserCheck,
  Loader2,
  Users,
  Award,
  TrendingUp,
  BarChart3,
  Download,
  Filter,
  Star,
  BookOpen
} from "lucide-react";

interface AdminStudent {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  year: number;
  codechefUsername: string | null;
  codechefProfile: {
    currentRating: number;
    stars: number;
    lastFetchedAt: string;
  } | null;
  aiAnalysis: {
    talentScore: number;
  } | null;
}

interface AdminSyncLog {
  id: string;
  studentId: string;
  status: "SUCCESS" | "FAILURE";
  errorMessage: string | null;
  initiatedBy: "SYSTEM_CRON" | "USER_MANUAL" | "ADMIN_FORCE";
  durationMs: number;
  createdAt: string;
  student: {
    name: string;
    rollNumber: string;
  };
}

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [logs, setLogs] = useState<AdminSyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Tabs & Filter states
  const [activeTab, setActiveTab] = useState<"students" | "analytics" | "logs">("students");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Batch sync states
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [stuRes, logsRes] = await Promise.all([
        fetch("/api/admin/students"),
        fetch("/api/admin/logs"),
      ]);

      if (stuRes.ok && logsRes.ok) {
        const stuData = await stuRes.json();
        const logsData = await logsRes.json();
        setStudents(stuData.students || []);
        setLogs(logsData.logs || []);
      }
    } catch (e) {
      console.error("Failed to load admin data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleSingleSync = async (studentId: string) => {
    setSyncingId(studentId);
    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Sync failed.");
      }

      // Reload lists
      const [stuRes, logsRes] = await Promise.all([
        fetch("/api/admin/students"),
        fetch("/api/admin/logs"),
      ]);
      if (stuRes.ok && logsRes.ok) {
        setStudents((await stuRes.json()).students || []);
        setLogs((await logsRes.json()).logs || []);
      }
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    } finally {
      setSyncingId(null);
    }
  };

  const handleBatchSync = async () => {
    const activeStudents = students.filter((s) => s.codechefUsername);
    if (activeStudents.length === 0) return;

    if (!confirm(`Are you sure you want to sync all ${activeStudents.length} active students? This takes time.`)) {
      return;
    }

    setIsBatchSyncing(true);
    setBatchProgress({ current: 0, total: activeStudents.length });

    for (let i = 0; i < activeStudents.length; i++) {
      const student = activeStudents[i];
      setBatchProgress((prev) => ({ ...prev, current: i + 1 }));
      setSyncingId(student.id);

      try {
        await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: student.id }),
        });
      } catch (e) {
        console.error(`Batch sync failed for ${student.name}`, e);
      }

      // 1.5 seconds delay to prevent rate limits
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    setSyncingId(null);
    setIsBatchSyncing(false);
    loadAdminData();
  };

  const filteredStudents = students.filter((s) => {
    // Search check
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(search.toLowerCase()) ||
      (s.codechefUsername && s.codechefUsername.toLowerCase().includes(search.toLowerCase()));

    // Department check
    const matchesDept = selectedDept === "ALL" || s.department === selectedDept;

    // Academic Year check
    const matchesYear = selectedYear === "ALL" || s.year.toString() === selectedYear;

    // Link Status check
    const matchesStatus =
      selectedStatus === "ALL" ||
      (selectedStatus === "LINKED" && s.codechefUsername) ||
      (selectedStatus === "UNLINKED" && !s.codechefUsername);

    return matchesSearch && matchesDept && matchesYear && matchesStatus;
  });

  // Dynamic Analytics Hub Calculations
  const totalRegistered = students.length;
  const totalLinked = students.filter((s) => s.codechefUsername).length;
  const totalUnlinked = totalRegistered - totalLinked;
  
  const activeProfiles = students.filter((s) => s.codechefProfile);
  const averageRating = activeProfiles.length > 0
    ? Math.round(activeProfiles.reduce((acc, curr) => acc + (curr.codechefProfile?.currentRating || 0), 0) / activeProfiles.length)
    : 0;

  const topPerformers = [...activeProfiles]
    .sort((a, b) => (b.codechefProfile?.currentRating || 0) - (a.codechefProfile?.currentRating || 0))
    .slice(0, 5);

  const depts = ["CSE", "IT", "CSM", "CSD", "ECE", "EEE", "ME", "CE"];
  const departmentRankings = depts.map((dept) => {
    const deptStudents = students.filter((s) => s.department === dept);
    const deptActive = deptStudents.filter((s) => s.codechefProfile);
    const avgRating = deptActive.length > 0
      ? Math.round(deptActive.reduce((acc, curr) => acc + (curr.codechefProfile?.currentRating || 0), 0) / deptActive.length)
      : 0;
    return {
      name: dept,
      totalStudents: deptStudents.length,
      activeStudents: deptActive.length,
      averageRating: avgRating,
    };
  }).sort((a, b) => b.averageRating - a.averageRating);

  const bestPerformingDept = departmentRankings.length > 0 && departmentRankings[0].averageRating > 0
    ? departmentRankings[0]
    : null;

  // Sync success rate calculation
  const totalLogs = logs.length;
  const successLogs = logs.filter((l) => l.status === "SUCCESS").length;
  const syncSuccessRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 100;

  const getExportUrl = () => {
    const params = new URLSearchParams();
    params.set("export", "true");
    if (search) params.set("search", search);
    if (selectedDept !== "ALL") params.set("departments", selectedDept);
    if (selectedYear !== "ALL") params.set("years", selectedYear);
    return `/api/leaderboard?${params.toString()}`;
  };

  const getStarColorClass = (starCount: number) => {
    if (starCount >= 7) return "text-red-500 border-red-500/20 bg-red-500/5";
    if (starCount >= 6) return "text-orange-500 border-orange-500/20 bg-orange-500/5";
    if (starCount >= 5) return "text-amber-500 border-amber-500/20 bg-amber-500/5";
    if (starCount >= 4) return "text-primary border-primary/20 bg-primary/5";
    if (starCount >= 3) return "text-secondary border-secondary/20 bg-secondary/5";
    if (starCount >= 2) return "text-emerald-500 border-emerald-500/20 bg-emerald-500/5";
    return "text-zinc-500 border-zinc-500/20 bg-zinc-500/5";
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-zinc-500 font-semibold">Loading administration panel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 animate-fade-in flex flex-col gap-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 border border-primary/20 text-primary rounded-xl">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin Console</h1>
            <p className="text-sm text-zinc-400 mt-1">Manage student profiles, trigger scrapers, and review audit logs</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Dynamic Export Leaderboard */}
          <a
            href={getExportUrl()}
            download
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-300 hover:text-white transition-all shadow-md shrink-0"
          >
            <Download className="h-4 w-4" />
            Export Leaderboard
          </a>

          {students.length > 0 && (
            <button
              onClick={handleBatchSync}
              disabled={isBatchSyncing}
              className="inline-flex items-center justify-center gap-2 px-4.5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-xs font-bold text-[#0A0A0A] transition-all shadow-[0_1px_15px_rgba(234,179,8,0.25)] shrink-0"
            >
              {isBatchSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Sync All ({students.filter((s) => s.codechefUsername).length} Active)
            </button>
          )}
        </div>
      </div>

      {/* Batch Sync Progress Overlay */}
      {isBatchSyncing && (
        <div className="glass-panel p-5 rounded-2xl border border-primary/20 glow-gold flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="text-left">
              <span className="text-sm font-bold text-white">Batch Syncing Running...</span>
              <p className="text-[10px] text-zinc-400">Please do not close this window to avoid losing request tracking.</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-extrabold text-white">
              {batchProgress.current} / {batchProgress.total}
            </span>
            <span className="text-[10px] text-zinc-500 font-bold block">Students Scraped</span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/5 pb-px select-none">
        <button
          onClick={() => setActiveTab("students")}
          className={`pb-4 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "students"
              ? "border-primary text-primary"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Users className="h-4 w-4" />
          Student Directory
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`pb-4 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "analytics"
              ? "border-primary text-primary"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Analytics Hub
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`pb-4 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "logs"
              ? "border-primary text-primary"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Clock className="h-4 w-4" />
          Sync Audit Trail
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "students" && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Filters and Search Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500">
                <Search className="h-4.5 w-4.5" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter students by name, roll, or handle..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950/30 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50 transition-all h-11"
              />
            </div>

            {/* Department Filter */}
            <div className="relative">
              <span className="absolute left-3 top-0 -translate-y-1/2 bg-zinc-950 px-1 text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                Department
              </span>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/30 text-xs text-white focus:outline-none focus:border-primary/50 h-11 cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                {depts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div className="relative">
              <span className="absolute left-3 top-0 -translate-y-1/2 bg-zinc-950 px-1 text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                Academic Year
              </span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/30 text-xs text-white focus:outline-none focus:border-primary/50 h-11 cursor-pointer"
              >
                <option value="ALL">All Years</option>
                <option value="1">1st Year (1Y)</option>
                <option value="2">2nd Year (2Y)</option>
                <option value="3">3rd Year (3Y)</option>
                <option value="4">4th Year (4Y)</option>
              </select>
            </div>

            {/* Linked Status Filter */}
            <div className="relative md:col-start-4">
              <span className="absolute left-3 top-0 -translate-y-1/2 bg-zinc-950 px-1 text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                Link Status
              </span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/30 text-xs text-white focus:outline-none focus:border-primary/50 h-11 cursor-pointer"
              >
                <option value="ALL">All Link Status</option>
                <option value="LINKED">Linked Only</option>
                <option value="UNLINKED">Unlinked Only</option>
              </select>
            </div>
          </div>

          {/* Student Table */}
          <div className="glass-card rounded-3xl overflow-hidden shadow-xl border border-white/5">
            <div className="px-6 py-5 border-b border-white/5 bg-zinc-950/20 flex justify-between items-center">
              <h2 className="text-sm font-bold text-white">Registered Student Base</h2>
              <span className="text-[10px] text-zinc-500 font-bold bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
                {filteredStudents.length} entries shown
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/5 bg-zinc-950/40 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                    <th className="py-3.5 px-6">Roll & Name</th>
                    <th className="py-3.5 px-4 text-center">Year/Dept</th>
                    <th className="py-3.5 px-4">Handle</th>
                    <th className="py-3.5 px-4 text-center">Score</th>
                    <th className="py-3.5 px-4 text-center">Last Sync</th>
                    <th className="py-3.5 px-6 text-center w-28">Trigger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-xs text-zinc-500 font-semibold">
                        No students found matching current directory filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-white/[0.005]">
                        {/* Roll & Name */}
                        <td className="py-3.5 px-6">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{student.name}</span>
                            <span className="text-[10px] text-zinc-500 font-semibold tracking-wider mt-0.5">
                              {student.rollNumber}
                            </span>
                          </div>
                        </td>

                        {/* Class */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-zinc-800 bg-zinc-900 rounded-md text-[10px] font-bold text-zinc-400">
                            <span>{student.department}</span>
                            <span className="text-zinc-600">•</span>
                            <span>{student.year}Y</span>
                          </div>
                        </td>

                        {/* Handle */}
                        <td className="py-3.5 px-4 font-semibold text-xs text-primary">
                          {student.codechefUsername || <span className="text-zinc-600 font-normal text-[10px]">Unlinked</span>}
                        </td>

                        {/* Talent Score */}
                        <td className="py-3.5 px-4 text-center font-extrabold text-xs text-white">
                          {student.aiAnalysis ? Math.round(student.aiAnalysis.talentScore) : "—"}
                        </td>

                        {/* Last Sync */}
                        <td className="py-3.5 px-4 text-center text-[10px] text-zinc-500 font-semibold">
                          {student.codechefProfile?.lastFetchedAt ? (
                            new Date(student.codechefProfile.lastFetchedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          ) : (
                            <span className="text-zinc-700">Never</span>
                          )}
                        </td>

                        {/* Single Trigger */}
                        <td className="py-3.5 px-6 text-center">
                          {student.codechefUsername ? (
                            <button
                              onClick={() => handleSingleSync(student.id)}
                              disabled={syncingId === student.id || isBatchSyncing}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-bold text-zinc-400 hover:text-white transition-all animate-fade-in"
                            >
                              {syncingId === student.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                              Sync Single
                            </button>
                          ) : (
                            <span className="text-[10px] text-zinc-600 font-medium">No handle</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Hub Tab */}
      {activeTab === "analytics" && (
        <div className="flex flex-col gap-8 animate-fade-in">
          {/* Visual Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Students Card */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Total Students
                </span>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-4">
                <span className="text-2xl sm:text-3xl font-extrabold text-white block">
                  {totalRegistered}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium">
                  {totalLinked} linked ({Math.round((totalLinked / (totalRegistered || 1)) * 100)}%)
                </span>
              </div>
            </div>

            {/* Average Rating Card */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Average Rating
                </span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-4">
                <span className="text-2xl sm:text-3xl font-extrabold text-white block">
                  {averageRating}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium">
                  Across active users
                </span>
              </div>
            </div>

            {/* Best Performing Department Card */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Top Department
                </span>
                <Award className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-4">
                <span className="text-2xl sm:text-3xl font-extrabold text-white block">
                  {bestPerformingDept ? bestPerformingDept.name : "N/A"}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium">
                  Rating: {bestPerformingDept ? bestPerformingDept.averageRating : 0} avg
                </span>
              </div>
            </div>

            {/* Scraper Success Health Card */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Scraper Success Health
                </span>
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-4">
                <span className="text-2xl sm:text-3xl font-extrabold text-white block">
                  {syncSuccessRate}%
                </span>
                <span className="text-[10px] text-zinc-400 font-medium">
                  Based on recent audit logs
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Lists Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Performers (Left) */}
            <div className="glass-card rounded-3xl p-6 border border-white/5 flex flex-col gap-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                <Award className="h-4 w-4 text-amber-500" />
                Top Performers (Highest Rated Coders)
              </h3>
              <div className="space-y-4">
                {topPerformers.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-12 text-center">No active student profiles found.</p>
                ) : (
                  topPerformers.map((s, idx) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-zinc-950/20"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-zinc-500 w-5">#{idx + 1}</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">{s.name}</span>
                          <span className="text-[10px] text-zinc-500 font-semibold">{s.rollNumber} • {s.department}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-[9px] font-bold ${getStarColorClass(s.codechefProfile?.stars || 1)}`}>
                          <span>{s.codechefProfile?.stars}</span>
                          <Star className="h-2.5 w-2.5 fill-current" />
                        </span>
                        <span className="text-xs font-black text-primary">
                          {s.codechefProfile?.currentRating}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Department Rankings (Right) */}
            <div className="glass-card rounded-3xl p-6 border border-white/5 flex flex-col gap-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                Department Performance Standings
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-zinc-950/40 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      <th className="py-2.5 px-4">Department</th>
                      <th className="py-2.5 px-4 text-center">Active Coders</th>
                      <th className="py-2.5 px-4 text-right">Avg Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {departmentRankings.map((dept, idx) => (
                      <tr key={dept.name} className="hover:bg-white/[0.005]">
                        <td className="py-3 px-4 text-xs font-bold text-white flex items-center gap-2">
                          <span className="text-zinc-500 text-[10px]">#{idx + 1}</span>
                          {dept.name}
                        </td>
                        <td className="py-3 px-4 text-center text-xs text-zinc-400 font-semibold">
                          {dept.activeStudents} / {dept.totalStudents}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-xs font-black text-primary">
                            {dept.averageRating || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Audit Trail Tab */}
      {activeTab === "logs" && (
        <div className="glass-card rounded-3xl p-6 flex flex-col gap-5 border border-white/5 shadow-xl animate-fade-in max-w-4xl mx-auto w-full">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <Clock className="h-4.5 w-4.5 text-primary" />
            Live Sync Audit Logs
          </h2>

          <div className="space-y-4 max-h-[35rem] overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <p className="text-xs text-zinc-500 py-12 text-center font-semibold">No sync logs recorded yet.</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl border border-white/5 bg-zinc-950/20 text-left flex gap-3 hover:border-white/10 transition-colors"
                >
                  <div className="shrink-0 mt-0.5">
                    {log.status === "SUCCESS" ? (
                      <CheckCircle className="h-4.5 w-4.5 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4.5 w-4.5 text-red-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {log.student.name}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                        {log.initiatedBy.replace("_", " ")}
                      </span>
                    </div>

                    <p className="text-[10px] text-zinc-500 font-medium mt-1">
                      {log.student.rollNumber} • {log.durationMs}ms
                    </p>

                    {log.status === "FAILURE" && log.errorMessage && (
                      <p className="text-[10px] text-red-400/90 bg-red-500/5 border border-red-500/10 rounded-lg p-2.5 mt-2 leading-relaxed font-semibold">
                        {log.errorMessage}
                      </p>
                    )}

                    <span className="text-[9px] text-zinc-600 block mt-2 text-right">
                      {new Date(log.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
