"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { 
  Trophy, 
  Search, 
  Download, 
  Filter, 
  Star, 
  Eye, 
  Loader2, 
  Crown, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  Edit2,
  Check,
  X,
  RefreshCw,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import ContestPlatformCard from "../../components/leaderboard/ContestPlatformCard";
import { getDisplayRank } from "@/utils/ranking";
import { useAuth } from "@/app/providers";

interface LeaderboardEntry {
  id: string;
  rank: number;
  rating: number;
  stars: number;
  talentScore: number;
  overallScore: number;
  codechefScore: number;
  leetcodeScore: number;
  githubScore: number;
  trendDirection?: string;
  updatedAt: string;
  student: {
    id: string;
    name: string;
    rollNumber: string;
    department: string;
    year: number;
    codechefUsername: string;
    profilePictureUrl: string | null;
    verificationStatus?: string;
  };
}

type PlatformKey = "overall" | "codechef" | "leetcode";
type SortOrder = "asc" | "desc";

interface PlatformLeaderboardState {
  search: string;
  selectedDepts: string[];
  selectedYears: number[];
  selectedStars: number[];
  ccRatingMin: string;
  ccRatingMax: string;
  ccContestsMin: string;
  lcRatingMin: string;
  lcRatingMax: string;
  lcEasyMin: string;
  lcMediumMin: string;
  lcHardMin: string;
  ghFollowersMin: string;
  ghStarsMin: string;
  ghReposMin: string;
  page: number;
  sortBy: string;
  sortOrder: SortOrder;
}

const createPlatformState = (sortBy: string, sortOrder: SortOrder = "desc"): PlatformLeaderboardState => ({
  search: "",
  selectedDepts: [],
  selectedYears: [],
  selectedStars: [],
  ccRatingMin: "",
  ccRatingMax: "",
  ccContestsMin: "",
  lcRatingMin: "",
  lcRatingMax: "",
  lcEasyMin: "",
  lcMediumMin: "",
  lcHardMin: "",
  ghFollowersMin: "",
  ghStarsMin: "",
  ghReposMin: "",
  page: 1,
  sortBy,
  sortOrder,
});

const platformStateDefaults: Record<PlatformKey, PlatformLeaderboardState> = {
  overall: createPlatformState("overallScore"),
  codechef: createPlatformState("ccRating"),
  leetcode: createPlatformState("lcSolved", "desc"),
};

const platformTabs: { name: string; value: PlatformKey }[] = [
  { name: "Overall", value: "overall" },
  { name: "CodeChef", value: "codechef" },
  { name: "LeetCode", value: "leetcode" },

];

const notLinkedLabel = "Not Linked";

function Podium({ top3 }: { top3: LeaderboardEntry[] }) {
  if (top3.length < 3) return null;
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  const getInitials = (name: string) => {
    if (!name) return "ST";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  return (
    <div className="w-full select-none pb-8 pt-4 sm:pb-10">
      <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 px-3 min-[350px]:grid-cols-2 sm:gap-4 sm:px-4">
        <div className="col-span-1 flex w-full flex-col items-center min-[350px]:col-span-2">
          <div className="relative mb-3 flex flex-col items-center">
            <Crown className="mb-1 h-6 w-6 text-[#EAB308] fill-[#EAB308]/20 animate-pulse" />
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-[#EAB308]/40 bg-zinc-950/60 shadow-[0_4px_30px_rgba(234,179,8,0.2)] sm:h-24 sm:w-24">
              {first.student.profilePictureUrl ? (
                <img src={first.student.profilePictureUrl} alt={first.student.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-extrabold text-[#EAB308] sm:text-2xl">{getInitials(first.student.name)}</span>
              )}
            </div>
            <span className="absolute bottom-1 rounded-full border border-[#EAB308]/25 bg-[#EAB308]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#EAB308]">
              1st Place
            </span>
          </div>
          <Link href={`/student/${first.student.id}`} className="mb-0.5 max-w-full text-center text-xs font-black text-white transition-colors hover:text-[#EAB308] sm:text-sm">
            {first.student.name}
          </Link>
          <span className="mb-3 text-[9px] font-bold text-brand-muted">{first.student.rollNumber}</span>
          <div className="flex h-28 w-full max-w-[14rem] flex-col items-center justify-center rounded-t-2xl border border-[#EAB308]/15 bg-gradient-to-t from-zinc-950/90 to-zinc-900/50 shadow-[0_-4px_35px_rgba(234,179,8,0.1)] sm:h-36">
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-amber-500/0 via-[#EAB308]/40 to-amber-500/0" />
            <span className="mb-1 text-4xl font-black text-[#EAB308]/70">1</span>
            <div className="flex flex-col items-center">
              <span className="text-sm font-black text-white">{first.overallScore}</span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-[#EAB308]/60">Score</span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col items-center">
          <div className="relative mb-3 flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-400/30 bg-zinc-950/60 shadow-[0_4px_20px_rgba(161,161,170,0.15)] sm:h-20 sm:w-20">
              {second.student.profilePictureUrl ? (
                <img src={second.student.profilePictureUrl} alt={second.student.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-extrabold text-zinc-400 sm:text-xl">{getInitials(second.student.name)}</span>
              )}
            </div>
            <span className="absolute -bottom-2 rounded-full border border-zinc-700/20 bg-zinc-800 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-zinc-200">
              2nd Place
            </span>
          </div>
          <Link href={`/student/${second.student.id}`} className="mb-0.5 max-w-full text-center text-xs font-bold text-white transition-colors hover:text-[#EAB308] sm:text-sm">
            {second.student.name}
          </Link>
          <span className="mb-3 text-[9px] font-bold text-brand-muted">{second.student.rollNumber}</span>
          <div className="flex h-24 w-full max-w-[12rem] flex-col items-center justify-center rounded-t-2xl border border-zinc-800/40 bg-gradient-to-t from-zinc-950/80 to-zinc-900/30 shadow-[0_-4px_30px_rgba(0,0,0,0.4)] sm:h-28">
            <span className="mb-1 text-3xl font-black text-zinc-500">2</span>
            <div className="flex flex-col items-center">
              <span className="text-xs font-extrabold text-zinc-300">{second.overallScore}</span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Score</span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col items-center">
          <div className="relative mb-3 flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-amber-700/30 bg-zinc-950/60 shadow-[0_4px_20px_rgba(180,83,9,0.15)] sm:h-20 sm:w-20">
              {third.student.profilePictureUrl ? (
                <img src={third.student.profilePictureUrl} alt={third.student.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-extrabold text-amber-600 sm:text-xl">{getInitials(third.student.name)}</span>
              )}
            </div>
            <span className="absolute -bottom-2 rounded-full border border-amber-700/20 bg-amber-950/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-600">
              3rd Place
            </span>
          </div>
          <Link href={`/student/${third.student.id}`} className="mb-0.5 max-w-full text-center text-xs font-bold text-white transition-colors hover:text-[#EAB308] sm:text-sm">
            {third.student.name}
          </Link>
          <span className="mb-3 text-[9px] font-bold text-brand-muted">{third.student.rollNumber}</span>
          <div className="flex h-20 w-full max-w-[12rem] flex-col items-center justify-center rounded-t-2xl border border-zinc-800/40 bg-gradient-to-t from-zinc-950/80 to-zinc-900/30 shadow-[0_-4px_30px_rgba(0,0,0,0.4)] sm:h-24">
            <span className="mb-1 text-3xl font-black text-amber-700/60">3</span>
            <div className="flex flex-col items-center">
              <span className="text-xs font-extrabold text-zinc-300">{third.overallScore}</span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Score</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaderboardContent() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PlatformKey>("overall");

  // Bulk Refresh States
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [bulkJobProgress, setBulkJobProgress] = useState<any>(null);

  // Poll bulk refresh status
  useEffect(() => {
    if (!bulkJobId) return;
    const interval = setInterval(async () => {
      try {
        const adminSecret = localStorage.getItem("ADMIN_SECRET") || process.env.NEXT_PUBLIC_ADMIN_SECRET || "";
        const res = await fetch(`/api/admin/refresh/status/${bulkJobId}`, {
          headers: { Authorization: `Bearer ${adminSecret}` }
        });
        if (res.ok) {
          const data = await res.json();
          setBulkJobProgress(data.job);
          if (data.job?.status !== 'RUNNING' && data.job?.status !== 'PENDING') {
            clearInterval(interval);
            setBulkJobId(null);
            setTimeout(() => { setBulkJobProgress(null); fetchStandings(); }, 5000);
          }
        } else if (res.status === 404 || res.status === 401) {
          clearInterval(interval);
          setBulkJobId(null);
        }
      } catch (e) {
        console.error("Failed to poll bulk job status", e);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [bulkJobId]);

  const triggerBulkRefresh = async (mode: "STALE_ONLY" | "ALL") => {
    try {
      const adminSecret = localStorage.getItem("ADMIN_SECRET") || process.env.NEXT_PUBLIC_ADMIN_SECRET || "";
      const res = await fetch("/api/admin/refresh/all", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminSecret}` },
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        const data = await res.json();
        setBulkJobId(data.jobId);
        setBulkJobProgress({ status: 'PENDING', totalStudents: 1, processedStudents: 0 });
      } else {
        const data = await res.json();
        alert(data.error || "Failed to start bulk refresh.");
      }
    } catch (e) {
      alert("Error starting bulk refresh");
    }
  };

  // Editing Student Name State
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  const handleSaveName = async (id: string) => {
    if (!editingName.trim()) return;
    setIsSavingName(true);
    try {
      const response = await fetch("/api/admin/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editingName }),
      });
      if (response.ok) {
        setEntries((prev) =>
          prev.map((e) =>
            e.student.id === id
              ? { ...e, student: { ...e.student, name: editingName.trim() } }
              : e
          )
        );
        setEditingStudentId(null);
      } else {
        alert("Failed to update student name.");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating student name.");
    } finally {
      setIsSavingName(false);
    }
  };

  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  const handleRefreshStudent = async (studentId: string) => {
    setRefreshingIds((prev) => new Set(prev).add(studentId));
    try {
      const adminSecret = localStorage.getItem("ADMIN_SECRET") || process.env.NEXT_PUBLIC_ADMIN_SECRET || "";
      const res = await fetch("/api/admin/refresh/student", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminSecret}` },
        body: JSON.stringify({ studentProfileId: studentId }),
      });
      if (res.ok) {
        await fetchStandings();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Failed to synchronize profile.");
      }
    } catch (e) {
      console.error("Error refreshing student:", e);
      alert("Failed to refresh profile due to a network error.");
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  };

  const [platformStates, setPlatformStates] = useState<Record<PlatformKey, PlatformLeaderboardState>>(platformStateDefaults);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const currentState = platformStates[activeTab];
  const {
    search,
    selectedDepts,
    selectedYears,
    selectedStars,
    ccRatingMin,
    ccRatingMax,
    ccContestsMin,
    lcRatingMin,
    lcRatingMax,
    lcEasyMin,
    lcMediumMin,
    lcHardMin,
    ghFollowersMin,
    ghStarsMin,
    ghReposMin,
    page,
    sortBy,
    sortOrder,
  } = currentState;

  const departments = ["CSE", "IT", "CSM", "CSD", "ECE", "EEE", "ME", "CE"];
  const years = [1, 2, 3, 4];
  const starsList = [0, 1, 2, 3, 4, 5, 6, 7];

  const updatePlatformState = (patch: Partial<PlatformLeaderboardState>) => {
    setPlatformStates((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        ...patch,
      },
    }));
  };

  const setSearch = (value: string) => updatePlatformState({ search: value, page: 1 });
  const setCcRatingMin = (value: string) => updatePlatformState({ ccRatingMin: value, page: 1 });
  const setCcRatingMax = (value: string) => updatePlatformState({ ccRatingMax: value, page: 1 });
  const setCcContestsMin = (value: string) => updatePlatformState({ ccContestsMin: value, page: 1 });
  const setLcRatingMin = (value: string) => updatePlatformState({ lcRatingMin: value, page: 1 });
  const setLcRatingMax = (value: string) => updatePlatformState({ lcRatingMax: value, page: 1 });
  const setLcEasyMin = (value: string) => updatePlatformState({ lcEasyMin: value, page: 1 });
  const setLcMediumMin = (value: string) => updatePlatformState({ lcMediumMin: value, page: 1 });
  const setLcHardMin = (value: string) => updatePlatformState({ lcHardMin: value, page: 1 });
  const setGhFollowersMin = (value: string) => updatePlatformState({ ghFollowersMin: value, page: 1 });
  const setGhStarsMin = (value: string) => updatePlatformState({ ghStarsMin: value, page: 1 });
  const setGhReposMin = (value: string) => updatePlatformState({ ghReposMin: value, page: 1 });
  const setPage = (value: React.SetStateAction<number>) => {
    setPlatformStates((prev) => {
      const activeState = prev[activeTab];
      const nextPage = typeof value === "function" ? value(activeState.page) : value;
      return {
        ...prev,
        [activeTab]: {
          ...activeState,
          page: nextPage,
        },
      };
    });
  };

  const fetchStandings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("platform", activeTab);
      if (search) params.set("search", search);
      if (selectedDepts.length > 0) params.set("departments", selectedDepts.join(","));
      if (selectedYears.length > 0) params.set("years", selectedYears.join(","));
      if (activeTab === "codechef" && selectedStars.length > 0) params.set("stars", selectedStars.join(","));

      if (activeTab === "codechef") {
        if (ccRatingMin) params.set("ccRatingMin", ccRatingMin);
        if (ccRatingMax) params.set("ccRatingMax", ccRatingMax);
        if (ccContestsMin) params.set("ccContestsMin", ccContestsMin);
      }

      if (activeTab === "leetcode") {
        if (lcRatingMin) params.set("lcRatingMin", lcRatingMin);
        if (lcRatingMax) params.set("lcRatingMax", lcRatingMax);
        if (lcEasyMin) params.set("lcEasyMin", lcEasyMin);
        if (lcMediumMin) params.set("lcMediumMin", lcMediumMin);
        if (lcHardMin) params.set("lcHardMin", lcHardMin);
      }

      params.set("page", page.toString());
      params.set("limit", limit.toString());
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const response = await fetch(`/api/dashboard/leaderboard-cache?${params.toString()}`, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        if (response.status === 401) {
          setError("Your session has expired. Please sign in again.");
        } else if (response.status === 403) {
          setError("You do not have permission to view this leaderboard.");
        } else {
          setError("Unable to load leaderboard data. Please try again.");
        }
      }
    } catch (e) {
      console.error("Failed to load standings:", e);
      setError("Unable to load leaderboard data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchStandings();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [
    activeTab,
    currentState,
  ]);

  const toggleDept = (dept: string) => {
    updatePlatformState({
      selectedDepts: selectedDepts.includes(dept) ? selectedDepts.filter((d) => d !== dept) : [...selectedDepts, dept],
      page: 1,
    });
  };

  const toggleYear = (year: number) => {
    updatePlatformState({
      selectedYears: selectedYears.includes(year) ? selectedYears.filter((y) => y !== year) : [...selectedYears, year],
      page: 1,
    });
  };

  const toggleStars = (star: number) => {
    updatePlatformState({
      selectedStars: selectedStars.includes(star) ? selectedStars.filter((s) => s !== star) : [...selectedStars, star],
      page: 1,
    });
  };

  const clearFilters = () => {
    setPlatformStates((prev) => ({
      ...prev,
      [activeTab]: platformStateDefaults[activeTab],
    }));
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      updatePlatformState({ sortOrder: sortOrder === "asc" ? "desc" : "asc", page: 1 });
    } else {
      updatePlatformState({ sortBy: field, sortOrder: field === "lcRank" ? "asc" : "desc", page: 1 });
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="ml-1 h-3.5 w-3.5 inline text-[#EAB308]" />
    ) : (
      <ChevronDown className="ml-1 h-3.5 w-3.5 inline text-[#EAB308]" />
    );
  };

  const displayMetric = (value: unknown): string | number => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "number" || typeof value === "string") return value;
    return String(value);
  };

  const displayPercent = (value: unknown): string => {
    if (typeof value !== "number") return "—";
    return `${Math.round(value)}%`;
  };

  const displayDate = (value: unknown): string => {
    if (!value) return "—";
    return new Date(value as string).toLocaleDateString();
  };

  const getJsonArrayLength = (value: unknown) => Array.isArray(value) ? value.length : null;

  const getExportUrl = () => {
    const params = new URLSearchParams();
    params.set("export", "true");
    params.set("platform", activeTab);
    if (search) params.set("search", search);
    if (selectedDepts.length > 0) params.set("departments", selectedDepts.join(","));
    if (selectedYears.length > 0) params.set("years", selectedYears.join(","));
    if (activeTab === "codechef" && selectedStars.length > 0) params.set("stars", selectedStars.join(","));
    if (activeTab === "codechef" && ccRatingMin) params.set("ccRatingMin", ccRatingMin);
    if (activeTab === "codechef" && ccRatingMax) params.set("ccRatingMax", ccRatingMax);
    if (activeTab === "codechef" && ccContestsMin) params.set("ccContestsMin", ccContestsMin);
    if (activeTab === "leetcode" && lcRatingMin) params.set("lcRatingMin", lcRatingMin);
    if (activeTab === "leetcode" && lcRatingMax) params.set("lcRatingMax", lcRatingMax);
    if (activeTab === "leetcode" && lcEasyMin) params.set("lcEasyMin", lcEasyMin);
    if (activeTab === "leetcode" && lcMediumMin) params.set("lcMediumMin", lcMediumMin);
    if (activeTab === "leetcode" && lcHardMin) params.set("lcHardMin", lcHardMin);

    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    return `/api/dashboard/leaderboard-cache?${params.toString()}`;
  };

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
    return <span className="text-xs font-bold text-brand-muted">#{pos}</span>;
  };

  const podiumEntries = page === 1 && sortBy === "overallScore" && sortOrder === "desc" && entries.length >= 3 && !search && selectedDepts.length === 0 && selectedYears.length === 0 && selectedStars.length === 0
    ? entries.slice(0, 3) 
    : [];

  const getColSpan = () => {
    if (activeTab === "overall") return 6;
    if (activeTab === "codechef") return 12;
    if (activeTab === "leetcode") return 13;

    return 7;
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-6 animate-fade-in sm:gap-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-brand-border pb-5 sm:pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-[#EAB308]/20 bg-[#EAB308]/10 p-2.5 text-[#EAB308]">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">ACE Leaderboard</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-brand-muted">Real-time student placement readiness rankings across CodeChef and LeetCode</p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {bulkJobProgress ? (
              <div className="flex items-center gap-3 rounded-xl border border-[#EAB308]/30 bg-[#EAB308]/10 px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#EAB308]" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#EAB308]">
                    {bulkJobProgress.status === 'RUNNING' ? 'Refreshing live data...' :
                     bulkJobProgress.status === 'SUCCESS' ? 'Refresh Complete!' :
                     bulkJobProgress.status === 'PARTIAL_SUCCESS' ? 'Refresh Complete with some errors.' : 'Refresh Failed.'}
                  </span>
                  {bulkJobProgress.status === 'RUNNING' && (
                    <span className="text-[10px] text-[#EAB308]/80">
                      {bulkJobProgress.processedStudents} of {bulkJobProgress.totalStudents} students processed
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => triggerBulkRefresh("ALL")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#EAB308] bg-[#EAB308] px-4 py-2.5 text-xs font-black uppercase tracking-widest text-[#111111] shadow-[0_0_15px_rgba(234,179,8,0.2)] transition-all hover:border-[#FACC15] hover:bg-[#FACC15] sm:w-auto"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh All Students
              </button>
            )}
          </div>
        </div>

        {/* Contest Center */}
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
          <ContestPlatformCard
            title="CodeChef Contests"
            icon={<Trophy className="h-6 w-6" />}
            description="Recent • Upcoming"
            href="/codechef-contests"
            gradientFrom="#6B46C1"
            gradientTo="#9F7AEA"
          />
          <ContestPlatformCard
            title="LeetCode Contests"
            icon={<Star className="h-6 w-6" />}
            description="Weekly • Biweekly"
            href="/leetcode-contests"
            gradientFrom="#F59E0B"
            gradientTo="#EF4444"
          />
        </div>

        <a
          href={getExportUrl()}
          download
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-[0_1px_10px_rgba(0,0,0,0.05)] transition-all hover:border-amber-500/30 hover:text-amber-600 dark:border-brand-border dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[0_1px_10px_rgba(0,0,0,0.4)] dark:hover:text-white sm:w-auto"
        >
          <Download className="h-4 w-4" />
          Export Standings
        </a>
      </div>

      {/* Podium Component */}
      {podiumEntries.length >= 3 && <Podium top3={podiumEntries} />}

      {/* Segmented Platform Filters */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-slate-100/80 p-1 dark:border-brand-border dark:bg-[#111111]/45">
        <div className="grid grid-cols-3 gap-1">
          {platformTabs.map((tab) => {
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setActiveTab(tab.value);
                }}
                className={`min-h-[44px] rounded-xl px-2 py-2 text-center text-[10px] font-black uppercase tracking-wider transition-all sm:text-xs ${
                  active
                    ? "bg-[#EAB308] text-slate-950 shadow-sm border border-[#EAB308] dark:border-[#EAB308]/30 dark:bg-[#EAB308]/20 dark:text-[#EAB308]"
                    : "border border-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-200/50 dark:text-brand-muted dark:hover:text-brand-text dark:hover:bg-transparent"
                }`}
              >
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4 lg:gap-8">
        
        {/* Filters Sidebar */}
        <div className="bg-white border border-slate-200 shadow-sm dark:glass-card dark:border-none flex flex-col gap-4 rounded-2xl p-4 sm:p-6 lg:sticky lg:top-20">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Filter className="h-4 w-4 text-[#EAB308]" />
              Filters
            </span>
            <button
              onClick={clearFilters}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:text-amber-600 dark:border-brand-border dark:bg-transparent dark:text-zinc-400 dark:hover:text-[#EAB308]"
            >
              Clear All
            </button>
          </div>

          {/* Department Filter (Always shown) */}
          <div>
            <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
              Department
            </span>
            <div className="flex flex-wrap gap-1.5">
              {departments.map((dept) => {
                const active = selectedDepts.includes(dept);
                return (
                  <button
                    key={dept}
                    onClick={() => toggleDept(dept)}
                    className={`min-h-[40px] rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                      active
                        ? "bg-[#EAB308] text-slate-950 border-[#EAB308] font-bold dark:border-[#EAB308]/30 dark:bg-[#EAB308]/20 dark:text-[#EAB308]"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-900 dark:bg-zinc-950/40 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Year Filter (Always shown) */}
          <div>
            <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
              Academic Year
            </span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {years.map((year) => {
                const active = selectedYears.includes(year);
                return (
                  <button
                    key={year}
                    onClick={() => toggleYear(year)}
                    className={`min-h-[40px] rounded-lg border py-1 text-center text-xs font-semibold transition-all ${
                      active
                        ? "bg-[#EAB308] text-slate-950 border-[#EAB308] font-bold dark:border-[#EAB308]/30 dark:bg-[#EAB308]/20 dark:text-[#EAB308]"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-900 dark:bg-zinc-950/40 dark:text-brand-muted dark:hover:text-zinc-200"
                    }`}
                  >
                    {year}Y
                  </button>
                );
              })}
            </div>
          </div>

          {/* CodeChef Specific Filters */}
          {activeTab === "codechef" && (
            <div className="flex flex-col gap-5 border-t border-brand-border/40 pt-5 animate-fade-in">
              {/* Stars Filter */}
              <div>
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                  CodeChef Stars
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {starsList.map((star) => {
                    const active = selectedStars.includes(star);
                    return (
                      <button
                        key={star}
                        onClick={() => toggleStars(star)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-all ${
                          active
                            ? "bg-[#EAB308] text-slate-950 border-[#EAB308] font-bold dark:bg-[#EAB308]/20 dark:text-[#EAB308] dark:border-[#EAB308]/30"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:bg-zinc-950/40 dark:border-zinc-900 dark:text-brand-muted dark:hover:text-zinc-200"
                        }`}
                      >
                        <span>{star}</span>
                        <Star className="h-3 w-3 fill-current text-amber-500" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rating Range Filter */}
              <div>
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                  Rating Range
                </span>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={ccRatingMin}
                    onChange={(e) => { setCcRatingMin(e.target.value); setPage(1); }}
                    placeholder="Min"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500/50 dark:border-brand-border dark:bg-zinc-950/40 dark:text-white dark:placeholder-zinc-500 dark:focus:border-[#EAB308]/50"
                  />
                  <span className="text-zinc-600 text-xs">-</span>
                  <input
                    type="number"
                    value={ccRatingMax}
                    onChange={(e) => { setCcRatingMax(e.target.value); setPage(1); }}
                    placeholder="Max"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500/50 dark:border-brand-border dark:bg-zinc-950/40 dark:text-white dark:placeholder-zinc-500 dark:focus:border-[#EAB308]/50"
                  />
                </div>
              </div>

              {/* Contests Min Filter */}
              <div>
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                  Min Contests
                </span>
                <input
                  type="number"
                  value={ccContestsMin}
                  onChange={(e) => { setCcContestsMin(e.target.value); setPage(1); }}
                  placeholder="Min contests"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500/50 dark:border-brand-border dark:bg-zinc-950/40 dark:text-white dark:placeholder-zinc-500 dark:focus:border-[#EAB308]/50"
                />
              </div>
            </div>
          )}

          {/* LeetCode Specific Filters */}
          {activeTab === "leetcode" && (
            <div className="flex flex-col gap-5 border-t border-brand-border/40 pt-5 animate-fade-in">
              {/* Rating Range Filter */}
              <div>
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                  LeetCode Rating
                </span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="number"
                    value={lcRatingMin}
                    onChange={(e) => { setLcRatingMin(e.target.value); setPage(1); }}
                    placeholder="Min"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500/50 dark:border-brand-border dark:bg-zinc-950/40 dark:text-white dark:placeholder-zinc-500 dark:focus:border-[#EAB308]/50"
                  />
                  <span className="hidden text-xs text-slate-400 dark:text-zinc-500 sm:block">-</span>
                  <input
                    type="number"
                    value={lcRatingMax}
                    onChange={(e) => { setLcRatingMax(e.target.value); setPage(1); }}
                    placeholder="Max"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500/50 dark:border-brand-border dark:bg-zinc-950/40 dark:text-white dark:placeholder-zinc-500 dark:focus:border-[#EAB308]/50"
                  />
                </div>
              </div>

              {/* Difficulty Breakdown (Min Solved) */}
              <div>
                <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                  Min Problems Solved
                </span>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">Easy</span>
                    <input
                      type="number"
                      value={lcEasyMin}
                      onChange={(e) => { setLcEasyMin(e.target.value); setPage(1); }}
                      placeholder="0"
                      className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-xs text-slate-900 focus:outline-none focus:border-emerald-500/50 dark:border-brand-border dark:bg-zinc-950/40 dark:text-white dark:focus:border-emerald-400/50"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-500">Medium</span>
                    <input
                      type="number"
                      value={lcMediumMin}
                      onChange={(e) => { setLcMediumMin(e.target.value); setPage(1); }}
                      placeholder="0"
                      className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-xs text-slate-900 focus:outline-none focus:border-amber-500/50 dark:border-brand-border dark:bg-zinc-950/40 dark:text-white dark:focus:border-amber-500/50"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-extrabold uppercase text-red-600 dark:text-red-500">Hard</span>
                    <input
                      type="number"
                      value={lcHardMin}
                      onChange={(e) => { setLcHardMin(e.target.value); setPage(1); }}
                      placeholder="0"
                      className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-xs text-slate-900 focus:outline-none focus:border-red-500/50 dark:border-brand-border dark:bg-zinc-950/40 dark:text-white dark:focus:border-red-500/50"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Standings Grid Column */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          
          {/* Search box */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500">
              <Search className="h-4.5 w-4.5" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by student name or roll number..."
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 dark:border-brand-border dark:bg-brand-bg/50 dark:text-white dark:placeholder-zinc-500 dark:focus:border-[#EAB308]/50 dark:focus:ring-[#EAB308]/20 transition-all duration-200"
            />
          </div>

          {/* Standings Table Card */}
          <div className="bg-white border border-slate-200 shadow-xl dark:glass-card dark:border-brand-border overflow-hidden rounded-3xl">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full border-collapse text-left sm:min-w-0">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:border-brand-border dark:bg-zinc-950/40 dark:text-zinc-500">
                    <th className="py-4.5 px-4 text-center w-20 select-none font-black">
                      {activeTab === "overall" ? "Overall Rank" : activeTab === "codechef" ? "CodeChef Rank" : "LeetCode Rank"}
                    </th>
                    <th className="py-4.5 px-4 select-none">{activeTab === "leetcode" ? "Student Name" : "Student"}</th>
                    {activeTab === "overall" && (
                      <>
                        <th className="py-4.5 px-4 select-none">Department & Year</th>
                        <th onClick={() => handleSort("overallScore")} className="py-4.5 px-4 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          Overall Score {renderSortIcon("overallScore")}
                        </th>
                        <th onClick={() => handleSort("talentScore")} className="py-4.5 px-4 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          AI Unified Score {renderSortIcon("talentScore")}
                        </th>
                      </>
                    )}
                    {activeTab === "codechef" && (
                      <>
                        <th onClick={() => handleSort("ccRating")} className="py-4.5 px-3 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          Current Rating {renderSortIcon("ccRating")}
                        </th>
                        <th onClick={() => handleSort("ccHighestRating")} className="py-4.5 px-3 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          Highest Rating {renderSortIcon("ccHighestRating")}
                        </th>
                        <th onClick={() => handleSort("stars")} className="py-4.5 px-3 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          Stars {renderSortIcon("stars")}
                        </th>
                        <th onClick={() => handleSort("ccGlobalRank")} className="py-4.5 px-3 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          Global Rank {renderSortIcon("ccGlobalRank")}
                        </th>
                        <th className="py-4.5 px-3 text-center select-none">Country Rank</th>
                        <th onClick={() => handleSort("ccContests")} className="py-4.5 px-3 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          Contests {renderSortIcon("ccContests")}
                        </th>
                        <th onClick={() => handleSort("ccRatingGrowth")} className="py-4.5 px-3 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          Growth {renderSortIcon("ccRatingGrowth")}
                        </th>
                        <th onClick={() => handleSort("codechefScore")} className="py-4.5 px-3 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          Competitive Score {renderSortIcon("codechefScore")}
                        </th>
                        <th className="py-4.5 px-3 text-center select-none">Last Active</th>
                      </>
                    )}
                    {activeTab === "leetcode" && (
                      <>
                        <th onClick={() => handleSort("lcSolved")} className="py-4.5 px-3 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          Total Solved {renderSortIcon("lcSolved")}
                        </th>
                        <th className="py-4.5 px-3 text-center select-none">Easy</th>
                        <th className="py-4.5 px-3 text-center select-none">Medium</th>
                        <th className="py-4.5 px-3 text-center select-none">Hard</th>
                        <th onClick={() => handleSort("lcRating")} className="py-4.5 px-3 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          Contest Rating {renderSortIcon("lcRating")}
                        </th>
                        <th onClick={() => handleSort("lcRank")} className="py-4.5 px-3 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          Contest Rank {renderSortIcon("lcRank")}
                        </th>
                        <th onClick={() => handleSort("leetcodeScore")} className="py-4.5 px-3 text-center cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors">
                          LeetCode Score {renderSortIcon("leetcodeScore")}
                        </th>
                        <th className="py-4.5 px-3 text-center select-none">Trend</th>
                      </>
                    )}
                    <th className="py-4.5 px-6 text-center w-24 select-none">{activeTab === "leetcode" ? "View Profile" : "Portfolio"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-[#262626]/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={getColSpan()} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
                          <span className="text-xs text-brand-muted font-semibold">Loading standings...</span>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={getColSpan()} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <X className="h-8 w-8 text-red-500/80" />
                          <span className="text-sm text-red-400 font-bold">{error}</span>
                          {error !== "Your session has expired. Please sign in again." && error !== "You do not have permission to view this leaderboard." && (
                            <span className="text-xs text-zinc-650">Please verify your database connection or try again later.</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={getColSpan()} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Trophy className="h-8 w-8 text-zinc-650" />
                          <span className="text-sm text-brand-muted font-bold">No students found.</span>
                          <span className="text-xs text-zinc-600">Try adjusting your filters or search terms.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry, index) => {
                      const isFiltered =
                        activeTab !== "overall" ||
                        search.trim() !== "" ||
                        selectedDepts.length > 0 ||
                        selectedYears.length > 0 ||
                        selectedStars.length > 0 ||
                        ccRatingMin !== "" ||
                        ccRatingMax !== "" ||
                        ccContestsMin !== "" ||
                        lcRatingMin !== "" ||
                        lcRatingMax !== "" ||
                        lcEasyMin !== "" ||
                        lcMediumMin !== "" ||
                        lcHardMin !== "" ||
                        !!(sortBy && sortBy !== "overallScore" && sortBy !== "rank");

                      const displayRank = getDisplayRank(entry.rank, index, page, limit, isFiltered);

                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-all group"
                        >
                          {/* Rank */}
                          <td className="py-4 px-6 text-center font-extrabold text-sm text-brand-muted">
                            {getRankBadge(displayRank)}
                          </td>

                        {/* Student Info */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 dark:border-brand-border dark:bg-zinc-950">
                              {entry.student.profilePictureUrl ? (
                                <img src={entry.student.profilePictureUrl} alt={entry.student.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full bg-[#EAB308]/10 text-[#EAB308] text-[10px] font-extrabold flex items-center justify-center">
                                  {entry.student.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col">
                              {editingStudentId === entry.student.id ? (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    className="px-2 py-0.5 rounded border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500/50 dark:border-brand-border dark:bg-zinc-950 dark:text-white dark:focus:border-[#EAB308]/50 w-36"
                                    autoFocus
                                    disabled={isSavingName}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveName(entry.student.id);
                                      if (e.key === "Escape") setEditingStudentId(null);
                                    }}
                                  />
                                  <button
                                    onClick={() => handleSaveName(entry.student.id)}
                                    disabled={isSavingName}
                                    className="p-1 text-emerald-450 hover:text-emerald-400 disabled:opacity-40"
                                    title="Save"
                                  >
                                    {isSavingName ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setEditingStudentId(null)}
                                    disabled={isSavingName}
                                    className="p-1 text-red-400 hover:text-red-300 disabled:opacity-40"
                                    title="Cancel"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 group/name">
                                  <span className="text-sm font-bold text-slate-900 group-hover:text-amber-600 dark:text-white dark:group-hover:text-[#EAB308] transition-colors">
                                    {entry.student.name}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setEditingStudentId(entry.student.id);
                                      setEditingName(entry.student.name);
                                    }}
                                    className="opacity-0 group-hover/name:opacity-100 p-0.5 text-zinc-550 hover:text-[#EAB308] transition-all"
                                    title="Edit student name"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-slate-500 dark:text-brand-muted font-semibold tracking-wider">
                                  {entry.student.rollNumber}
                                </span>
                                {entry.student.verificationStatus === "PARTIAL" && (
                                  <span className="text-[8px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 dark:text-yellow-400 font-bold px-1 rounded">
                                    Partial
                                  </span>
                                )}
                                {entry.student.verificationStatus === "UNABLE_TO_VERIFY" && (
                                  <span className="text-[8px] bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 font-bold px-1 rounded animate-pulse">
                                    Profile Pending
                                  </span>
                                )}
                                {entry.student.verificationStatus !== "UNABLE_TO_VERIFY" && entry.rank === 0 && (
                                  <span className="text-[8px] bg-zinc-500/10 border border-zinc-500/20 text-zinc-500 dark:text-zinc-400 font-bold px-1 rounded">
                                    Sync Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Platform Dynamic Cells */}
                        {activeTab === "overall" && (
                          <>
                            {/* Dept & Year */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-800 dark:text-zinc-300">
                                  {entry.student.department}
                                </span>
                                <span className="text-[10px] font-bold text-brand-muted border border-brand-border bg-zinc-900/60 px-1.5 py-0.5 rounded-full uppercase hidden dark:inline-block">
                                  {entry.student.year} Yr
                                </span>
                                <span className="text-[10px] font-bold text-slate-700 border border-slate-200 bg-slate-100 px-1.5 py-0.5 rounded-full uppercase inline-block dark:hidden">
                                  {entry.student.year}YR
                                </span>
                              </div>
                            </td>

                            <td className="py-4 px-4 text-center font-extrabold text-sm text-[#EAB308]">
                              {entry.overallScore}
                            </td>

                            <td className="py-4 px-4 text-center font-extrabold text-sm text-slate-700 dark:text-zinc-300">
                              {entry.talentScore}
                            </td>
                          </>
                        )}

                        {activeTab === "codechef" && (() => {
                          const cc = (entry.student as any).codechefProfile;
                          const ratingGrowth = cc?.highestRating != null && cc?.currentRating != null
                            ? cc.highestRating - cc.currentRating
                            : null;
                          return (
                            <>
                              <td className="py-4 px-3 text-center text-xs font-bold text-slate-800 dark:text-white">
                                {cc ? displayMetric(cc.currentRating) : notLinkedLabel}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-bold text-slate-800 dark:text-white">
                                {cc ? displayMetric(cc.highestRating) : notLinkedLabel}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-bold text-[#EAB308]">
                                {cc && cc.stars != null ? `${cc.stars}★` : notLinkedLabel}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-bold text-slate-800 dark:text-white">
                                {cc && cc.globalRank != null ? `#${cc.globalRank}` : notLinkedLabel}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-bold text-slate-800 dark:text-white">
                                {cc && cc.countryRank != null ? `#${cc.countryRank}` : notLinkedLabel}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-bold text-slate-800 dark:text-white">
                                {cc ? displayMetric(cc.contestCount) : notLinkedLabel}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-bold text-slate-800 dark:text-white">
                                {ratingGrowth != null ? `+${ratingGrowth}` : notLinkedLabel}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-black text-purple-650 dark:text-purple-400">
                                {cc ? displayMetric(entry.codechefScore) : notLinkedLabel}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-bold text-slate-800 dark:text-white">
                                {cc ? displayDate(cc.lastActive) : notLinkedLabel}
                              </td>
                            </>
                          );
                        })()}

                        {activeTab === "leetcode" && (() => {
                          const lc = (entry.student as any).leetcodeProfile;
                          const contestCount = getJsonArrayLength(lc?.contestHistory);
                          return (
                            <>
                              <td className="py-4 px-3 text-center text-xs font-bold text-slate-800 dark:text-white">
                                {lc ? displayMetric(lc.problemsSolved) : "—"}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-semibold text-slate-500 dark:text-zinc-400">
                                {lc ? displayMetric(lc.easySolvedCount) : "—"}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-semibold text-slate-500 dark:text-zinc-400">
                                {lc ? displayMetric(lc.mediumSolvedCount) : "—"}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-semibold text-slate-500 dark:text-zinc-400">
                                {lc ? displayMetric(lc.hardSolvedCount) : "—"}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-bold text-slate-800 dark:text-white">
                                {lc && lc.contestRating != null ? Math.round(lc.contestRating) : "—"}
                              </td>
                               <td className="py-4 px-3 text-center text-xs font-bold text-slate-800 dark:text-white">
                                {lc && lc.contestRank != null ? `#${lc.contestRank}` : "—"}
                              </td>
                              <td className="py-4 px-3 text-center text-xs font-black text-purple-650 dark:text-purple-400">
                                {lc ? displayMetric(entry.leetcodeScore) : "—"}
                              </td>
                              <td className="py-4 px-3 text-center">
                                {(() => {
                                  if (entry.trendDirection === "UP") return <TrendingUp className="h-4 w-4 mx-auto text-emerald-500" />;
                                  if (entry.trendDirection === "DOWN") return <TrendingDown className="h-4 w-4 mx-auto text-red-500" />;
                                  return <span className="text-zinc-500 text-lg mx-auto">—</span>;
                                })()}
                              </td>
                            </>
                          );
                        })()}

                        {/* View Action */}
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {profile?.role === "ADMIN" && (
                              <button
                                onClick={() => handleRefreshStudent(entry.student.id)}
                                disabled={refreshingIds.has(entry.student.id)}
                                title="Refresh metrics"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-green-500/30 hover:bg-slate-50 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-border dark:bg-brand-bg dark:text-brand-muted dark:hover:border-[#22C55E]/30 dark:hover:bg-zinc-900 dark:hover:text-[#22C55E]"
                              >
                                {refreshingIds.has(entry.student.id) ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                            <Link
                              href={`/student/${entry.student.id}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-amber-500/30 hover:bg-slate-50 hover:text-amber-600 dark:border-brand-border dark:bg-brand-bg dark:text-brand-muted dark:hover:border-[#EAB308]/30 dark:hover:bg-zinc-900 dark:hover:text-[#EAB308]"
                              title="View Student Portfolio"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {!isLoading && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4.5 dark:border-brand-border dark:bg-zinc-950/20">
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 font-semibold">
                      Showing <span className="text-slate-800 dark:text-zinc-300 font-bold">{Math.min(total, (page - 1) * limit + 1)}</span> to{" "}
                      <span className="text-slate-800 dark:text-zinc-300 font-bold">{Math.min(total, page * limit)}</span> of{" "}
                      <span className="text-slate-800 dark:text-zinc-300 font-bold">{total}</span> entries
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-xl -space-x-px shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-3 py-2 rounded-l-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all dark:border-brand-border dark:bg-brand-bg dark:text-brand-muted dark:hover:text-white dark:hover:bg-zinc-900"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      
                      {Array.from({ length: totalPages }).map((_, idx) => {
                        const pNum = idx + 1;
                        const active = pNum === page;
                        return (
                          <button
                            key={pNum}
                            onClick={() => setPage(pNum)}
                            className={`relative inline-flex items-center px-4.5 py-2 border text-xs font-bold transition-all ${
                              active
                                ? "z-10 bg-[#EAB308] border-[#EAB308] text-[#0A0A0A] shadow-[0_1px_10px_rgba(234,179,8,0.25)]"
                                : "border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:border-brand-border dark:bg-brand-bg dark:text-brand-muted dark:hover:text-white dark:hover:bg-zinc-900"
                            }`}
                          >
                            {pNum}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center px-3 py-2 rounded-r-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all dark:border-brand-border dark:bg-brand-bg dark:text-brand-muted dark:hover:text-white dark:hover:bg-zinc-900"
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

      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center p-12 bg-brand-bg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
          <span className="text-xs text-brand-muted font-semibold">Loading standings...</span>
        </div>
      </div>
    }>
      <LeaderboardContent />
    </Suspense>
  );
}
