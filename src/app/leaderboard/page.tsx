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
  ChevronRight 
} from "lucide-react";

interface LeaderboardEntry {
  id: string;
  rank: number;
  rating: number;
  stars: number;
  talentScore: number;
  updatedAt: string;
  student: {
    id: string;
    name: string;
    rollNumber: string;
    department: string;
    year: number;
    codechefUsername: string;
    profilePictureUrl: string | null;
  };
}

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
    <div className="flex flex-col items-center justify-center pt-4 pb-10 w-full select-none">
      <div className="flex items-end justify-center gap-4 sm:gap-10 max-w-3xl w-full px-4">
        
        {/* 2nd Place Podium Stand */}
        <div className="flex flex-col items-center flex-1 max-w-[12rem] transition-all duration-300 hover:-translate-y-1">
          <div className="relative mb-3 flex flex-col items-center">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-zinc-400/30 bg-zinc-950/60 shadow-[0_4px_20px_rgba(161,161,170,0.15)] flex items-center justify-center overflow-hidden">
              {second.student.profilePictureUrl ? (
                <img src={second.student.profilePictureUrl} alt={second.student.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-zinc-400 font-extrabold text-lg sm:text-xl">{getInitials(second.student.name)}</span>
              )}
            </div>
            <span className="absolute -bottom-2 bg-zinc-800 text-zinc-200 border border-zinc-700/20 px-2 py-0.5 rounded-full text-[8px] font-black tracking-wider uppercase">
              2nd Place
            </span>
          </div>
          <Link href={`/?userId=${second.student.id}`} className="text-xs sm:text-sm font-bold text-white hover:text-[#EAB308] transition-colors text-center truncate max-w-full mb-0.5">
            {second.student.name}
          </Link>
          <span className="text-[9px] text-[#A3A3A3] font-bold mb-3">{second.student.rollNumber}</span>
          
          {/* Pedestal Stand */}
          <div className="w-full h-24 sm:h-28 bg-gradient-to-t from-zinc-950/80 to-zinc-900/30 border-t border-x border-zinc-800/40 rounded-t-2xl flex flex-col justify-center items-center shadow-[0_-4px_30px_rgba(0,0,0,0.4)]">
            <span className="text-3xl font-black text-zinc-650 mb-1">2</span>
            <div className="flex flex-col items-center">
              <span className="text-xs font-extrabold text-zinc-300">{second.rating}</span>
              <span className="text-[8px] text-zinc-550 uppercase tracking-widest font-bold">Rating</span>
            </div>
          </div>
        </div>

        {/* 1st Place Podium Stand */}
        <div className="flex flex-col items-center flex-1 max-w-[14rem] relative -top-3 sm:-top-5 transition-all duration-300 hover:-translate-y-1">
          <div className="relative mb-3 flex flex-col items-center">
            <Crown className="h-6 w-6 text-[#EAB308] fill-[#EAB308]/20 animate-pulse mb-1" />
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full border-2 border-[#EAB308]/40 bg-zinc-950/60 shadow-[0_4px_30px_rgba(234,179,8,0.2)] flex items-center justify-center overflow-hidden">
              {first.student.profilePictureUrl ? (
                <img src={first.student.profilePictureUrl} alt={first.student.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[#EAB308] font-extrabold text-xl sm:text-2xl">{getInitials(first.student.name)}</span>
              )}
            </div>
            <span className="absolute bottom-1 bg-[#EAB308]/10 text-[#EAB308] border border-[#EAB308]/25 px-2 py-0.5 rounded-full text-[8px] font-black tracking-wider uppercase">
              1st Place
            </span>
          </div>
          <Link href={`/?userId=${first.student.id}`} className="text-xs sm:text-sm font-black text-white hover:text-[#EAB308] transition-colors text-center truncate max-w-full mb-0.5">
            {first.student.name}
          </Link>
          <span className="text-[9px] text-[#A3A3A3] font-bold mb-3">{first.student.rollNumber}</span>

          {/* Pedestal Stand */}
          <div className="w-full h-32 sm:h-36 bg-gradient-to-t from-zinc-950/90 to-zinc-900/50 border-t border-x border-[#EAB308]/15 rounded-t-2xl flex flex-col justify-center items-center shadow-[0_-4px_35px_rgba(234,179,8,0.1)] relative">
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-amber-500/0 via-[#EAB308]/40 to-amber-500/0" />
            <span className="text-4xl font-black text-[#EAB308]/70 mb-1">1</span>
            <div className="flex flex-col items-center">
              <span className="text-sm font-black text-white">{first.rating}</span>
              <span className="text-[8px] text-[#EAB308]/60 uppercase tracking-widest font-bold">Rating</span>
            </div>
          </div>
        </div>

        {/* 3rd Place Podium Stand */}
        <div className="flex flex-col items-center flex-1 max-w-[12rem] transition-all duration-300 hover:-translate-y-1">
          <div className="relative mb-3 flex flex-col items-center">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-amber-700/30 bg-zinc-950/60 shadow-[0_4px_20px_rgba(180,83,9,0.15)] flex items-center justify-center overflow-hidden">
              {third.student.profilePictureUrl ? (
                <img src={third.student.profilePictureUrl} alt={third.student.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-amber-605 font-extrabold text-lg sm:text-xl">{getInitials(third.student.name)}</span>
              )}
            </div>
            <span className="absolute -bottom-2 bg-amber-955/20 text-amber-600 border border-amber-850/20 px-2 py-0.5 rounded-full text-[8px] font-black tracking-wider uppercase">
              3rd Place
            </span>
          </div>
          <Link href={`/?userId=${third.student.id}`} className="text-xs sm:text-sm font-bold text-white hover:text-[#EAB308] transition-colors text-center truncate max-w-full mb-0.5">
            {third.student.name}
          </Link>
          <span className="text-[9px] text-[#A3A3A3] font-bold mb-3">{third.student.rollNumber}</span>

          {/* Pedestal Stand */}
          <div className="w-full h-20 sm:h-24 bg-gradient-to-t from-zinc-950/80 to-zinc-900/30 border-t border-x border-zinc-800/40 rounded-t-2xl flex flex-col justify-center items-center shadow-[0_-4px_30px_rgba(0,0,0,0.4)]">
            <span className="text-3xl font-black text-amber-700/60 mb-1">3</span>
            <div className="flex flex-col items-center">
              <span className="text-xs font-extrabold text-zinc-300">{third.rating}</span>
              <span className="text-[8px] text-zinc-550 uppercase tracking-widest font-bold">Rating</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function LeaderboardContent() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedStars, setSelectedStars] = useState<number[]>([]);

  // Pagination & Sorting State
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("rank");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const departments = ["CSE", "IT", "CSM", "CSD", "ECE", "EEE", "ME", "CE"];
  const years = [1, 2, 3, 4];
  const starsList = [1, 2, 3, 4, 5, 6, 7];

  const fetchStandings = async () => {
    setIsLoading(true);
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

      const response = await fetch(`/api/leaderboard?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (e) {
      console.error("Failed to load standings:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchStandings();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [search, selectedDepts, selectedYears, selectedStars, page, sortBy, sortOrder]);

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
      <ChevronUp className="ml-1 h-3.5 w-3.5 inline text-[#EAB308]" />
    ) : (
      <ChevronDown className="ml-1 h-3.5 w-3.5 inline text-[#EAB308]" />
    );
  };

  const getExportUrl = () => {
    const params = new URLSearchParams();
    params.set("export", "true");
    if (search) params.set("search", search);
    if (selectedDepts.length > 0) params.set("departments", selectedDepts.join(","));
    if (selectedYears.length > 0) params.set("years", selectedYears.join(","));
    if (selectedStars.length > 0) params.set("stars", selectedStars.join(","));
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

  // Custom Rank Badge Renderer
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

  // Obtain Top 3 from paginated list if on page 1 of default ranking
  const podiumEntries = page === 1 && sortBy === "rank" && sortOrder === "asc" && entries.length >= 3 && !search && selectedDepts.length === 0 && selectedYears.length === 0 && selectedStars.length === 0
    ? entries.slice(0, 3) 
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 animate-fade-in flex flex-col gap-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262626] pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#EAB308]/10 border border-[#EAB308]/20 text-[#EAB308] rounded-xl">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">ACE Leaderboard</h1>
            <p className="text-sm text-[#A3A3A3] mt-1">Real-time student rankings based on verified CodeChef performance</p>
          </div>
        </div>

        <a
          href={getExportUrl()}
          download
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-[#262626] hover:border-[#EAB308]/30 text-sm font-bold text-zinc-300 hover:text-white transition-all shadow-[0_1px_10px_rgba(0,0,0,0.4)]"
        >
          <Download className="h-4 w-4" />
          Export Standings
        </a>
      </div>

      {/* Podium Component */}
      {podiumEntries.length >= 3 && <Podium top3={podiumEntries} />}

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        {/* Filters Sidebar */}
        <div className="glass-card rounded-2xl p-6 flex flex-col gap-6 sticky top-20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#EAB308]" />
              Filters
            </span>
            <button
              onClick={clearFilters}
              className="text-[10px] font-bold text-zinc-500 hover:text-[#EAB308] tracking-wider uppercase transition-colors"
            >
              Clear All
            </button>
          </div>

          {/* Department Filter */}
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      active
                        ? "bg-[#EAB308]/20 text-[#EAB308] border-[#EAB308]/30"
                        : "bg-zinc-950/40 border-zinc-900 text-zinc-455 hover:text-zinc-200"
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Year Filter */}
          <div>
            <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
              Academic Year
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {years.map((year) => {
                const active = selectedYears.includes(year);
                return (
                  <button
                    key={year}
                    onClick={() => toggleYear(year)}
                    className={`py-1 rounded-lg text-xs font-semibold border text-center transition-all ${
                      active
                        ? "bg-[#EAB308]/20 text-[#EAB308] border-[#EAB308]/30"
                        : "bg-zinc-950/40 border-zinc-900 text-[#A3A3A3] hover:text-zinc-200"
                    }`}
                  >
                    {year}Y
                  </button>
                );
              })}
            </div>
          </div>

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
                        ? "bg-[#EAB308]/20 text-[#EAB308] border-[#EAB308]/30"
                        : "bg-zinc-950/40 border-zinc-900 text-[#A3A3A3] hover:text-zinc-200"
                    }`}
                  >
                    <span>{star}</span>
                    <Star className="h-3 w-3 fill-current text-amber-500" />
                  </button>
                );
              })}
            </div>
          </div>
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
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-[#262626] bg-[#0A0A0A]/50 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#EAB308]/50 focus:ring-1 focus:ring-[#EAB308]/20 transition-all duration-200"
            />
          </div>

          {/* Standings Table Card */}
          <div className="glass-card rounded-3xl overflow-hidden border border-[#262626] shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#262626] bg-zinc-950/40 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    <th 
                      onClick={() => handleSort("rank")} 
                      className="py-4.5 px-6 text-center w-16 cursor-pointer select-none hover:text-white transition-colors"
                    >
                      Rank {renderSortIcon("rank")}
                    </th>
                    <th className="py-4.5 px-4 select-none">Student</th>
                    <th className="py-4.5 px-4 select-none">Department & Year</th>
                    <th 
                      onClick={() => handleSort("rating")} 
                      className="py-4.5 px-4 text-center cursor-pointer select-none hover:text-white transition-colors"
                    >
                      Rating {renderSortIcon("rating")}
                    </th>
                    <th 
                      onClick={() => handleSort("stars")} 
                      className="py-4.5 px-4 text-center cursor-pointer select-none hover:text-white transition-colors"
                    >
                      Stars {renderSortIcon("stars")}
                    </th>
                    <th 
                      onClick={() => handleSort("talentScore")} 
                      className="py-4.5 px-4 text-center cursor-pointer select-none hover:text-white transition-colors"
                    >
                      Talent Score {renderSortIcon("talentScore")}
                    </th>
                    <th className="py-4.5 px-6 text-center w-24 select-none">Dashboard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626]/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
                          <span className="text-xs text-[#A3A3A3] font-semibold">Loading standings...</span>
                        </div>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Trophy className="h-8 w-8 text-zinc-650" />
                          <span className="text-sm text-[#A3A3A3] font-bold">No students found.</span>
                          <span className="text-xs text-zinc-600">Try adjusting your filters or search terms.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-white/[0.01] transition-all group"
                      >
                        {/* Rank */}
                        <td className="py-4 px-6 text-center font-extrabold text-sm text-[#A3A3A3]">
                          {getRankBadge(entry.rank)}
                        </td>

                        {/* Student Info */}
                        <td className="py-4 px-4">
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
                              <span className="text-sm font-bold text-white group-hover:text-[#EAB308] transition-colors">
                                {entry.student.name}
                              </span>
                              <span className="text-[10px] text-[#A3A3A3] font-semibold tracking-wider mt-0.5">
                                {entry.student.rollNumber}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Dept & Year */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-300">
                              {entry.student.department}
                            </span>
                            <span className="text-[10px] font-bold text-[#A3A3A3] border border-[#262626] bg-zinc-900/60 px-1.5 py-0.5 rounded-full uppercase">
                              {entry.student.year} Yr
                            </span>
                          </div>
                        </td>

                        {/* Rating */}
                        <td className="py-4 px-4 text-center font-extrabold text-sm text-white">
                          {entry.rating}
                        </td>

                        {/* Stars */}
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStarColorClass(entry.stars)}`}>
                            <span>{entry.stars}</span>
                            <Star className="h-3 w-3 fill-current" />
                          </span>
                        </td>

                        {/* Talent Score */}
                        <td className="py-4 px-4 text-center">
                          <span className="text-sm font-black text-[#EAB308]">
                            {Math.round(entry.talentScore)}
                          </span>
                        </td>

                        {/* View Action */}
                        <td className="py-4 px-6 text-center">
                          <Link
                            href={`/?userId=${entry.student.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#262626] bg-[#0A0A0A] text-[#A3A3A3] hover:text-[#FAFAFA] hover:border-zinc-700 hover:bg-zinc-900 transition-all"
                            title="View Student Portfolio"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {!isLoading && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#262626] bg-zinc-950/20 px-6 py-4.5">
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 font-semibold">
                      Showing <span className="text-zinc-300 font-bold">{Math.min(total, (page - 1) * limit + 1)}</span> to{" "}
                      <span className="text-zinc-300 font-bold">{Math.min(total, page * limit)}</span> of{" "}
                      <span className="text-zinc-300 font-bold">{total}</span> entries
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-xl -space-x-px shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-3 py-2 rounded-l-xl border border-[#262626] bg-[#0A0A0A] text-xs font-semibold text-[#A3A3A3] hover:text-white hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                                : "border-[#262626] bg-[#0A0A0A] text-[#A3A3A3] hover:text-white hover:bg-zinc-900"
                            }`}
                          >
                            {pNum}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center px-3 py-2 rounded-r-xl border border-[#262626] bg-[#0A0A0A] text-xs font-semibold text-[#A3A3A3] hover:text-white hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
      <div className="flex-1 flex items-center justify-center p-12 bg-[#0A0A0A]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#EAB308]" />
          <span className="text-xs text-[#A3A3A3] font-semibold">Loading standings...</span>
        </div>
      </div>
    }>
      <LeaderboardContent />
    </Suspense>
  );
}
