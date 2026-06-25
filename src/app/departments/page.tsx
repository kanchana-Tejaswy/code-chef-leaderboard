"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Users,
  Trophy,
  TrendingUp,
  ArrowUpRight,
  Loader2,
  ChevronRight,
  Award,
  Zap,
  Building
} from "lucide-react";

interface Performer {
  id: string;
  name: string;
  rating: number;
}

interface DeptStanding {
  rank: number;
  department: string;
  studentCount: number;
  activeCount: number;
  averageRating: number;
  topPerformer: Performer;
  growth: number;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DeptStanding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await fetch("/api/departments");
        if (!response.ok) {
          throw new Error("Failed to load department standings.");
        }
        const json = await response.json();
        setDepartments(json.departments || []);
      } catch (err: any) {
        setError(err.message || "An error occurred.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDepartments();
  }, []);

  const getRankBadge = (pos: number) => {
    if (pos === 1) {
      return (
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-black bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/30 shadow-[0_0_12px_rgba(255,215,0,0.2)]">
          1
        </span>
      );
    }
    if (pos === 2) {
      return (
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-black bg-[#C0C0C0]/10 text-[#C0C0C0] border border-[#C0C0C0]/30">
          2
        </span>
      );
    }
    if (pos === 3) {
      return (
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-black bg-[#CD7F32]/10 text-[#CD7F32] border border-[#CD7F32]/30">
          3
        </span>
      );
    }
    return <span className="text-sm font-extrabold text-[#A3A3A3]">#{pos}</span>;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 min-h-[calc(100vh-4rem)] bg-[#0A0A0A]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-[#EAB308]" />
          <span className="text-xs text-[#A3A3A3] font-bold tracking-wider uppercase">
            Aggregating Academic Department Standings...
          </span>
        </div>
      </div>
    );
  }

  if (error || departments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0A0A0A] text-center">
        <div className="glass-card max-w-md p-8 rounded-2xl border border-red-500/10">
          <GraduationCap className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Departments Standings Failed</h2>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            {error || "An error occurred while compiling department ratings."}
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 animate-fade-in flex flex-col gap-8 bg-[#0A0A0A] min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262626] pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#EAB308]/10 border border-[#EAB308]/20 text-[#EAB308] rounded-xl">
            <Building className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Department Standings</h1>
            <p className="text-sm text-[#A3A3A3] mt-1">
              Comparative analysis and standings across ACE engineering departments
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Department Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {departments.slice(0, 4).map((d) => (
          <div
            key={d.department}
            className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden flex flex-col justify-between hover:border-[#EAB308]/30 transition-all duration-300 group"
          >
            {/* Top row */}
            <div className="flex justify-between items-start">
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                {d.department}
              </span>
              <span>{getRankBadge(d.rank)}</span>
            </div>

            {/* Average Rating Centerpiece */}
            <div className="my-6">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">
                Avg CodeChef Rating
              </span>
              <span className="text-3xl font-black text-white mt-1 block">
                {d.averageRating}
              </span>
            </div>

            {/* Bottom info */}
            <div className="border-t border-[#262626]/50 pt-4 flex flex-col gap-3">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 font-semibold">Active profiles:</span>
                <span className="text-white font-bold">{d.activeCount} / {d.studentCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 font-semibold">Term growth:</span>
                <span className="text-emerald-400 font-bold">+{d.growth}%</span>
              </div>
              
              {/* Top Performer Tag */}
              {d.topPerformer.name !== "None" && (
                <Link
                  href={`/dashboard?userId=${d.topPerformer.id}`}
                  className="flex items-center justify-between mt-1 p-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-[#EAB308]/30 text-xs transition-all"
                >
                  <div className="flex flex-col">
                    <span className="text-[9px] text-[#EAB308] font-bold uppercase tracking-wider">Top Performer</span>
                    <span className="text-white font-bold truncate max-w-[120px]">{d.topPerformer.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-primary">
                    <span className="font-extrabold">{d.topPerformer.rating}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Directory Table of Rankings */}
      <div className="glass-card rounded-3xl overflow-hidden border border-[#262626] shadow-xl mt-4">
        <div className="px-6 py-5 border-b border-[#262626] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider">Complete Department Standings</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Ranked standings table of all academic branches</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#262626] bg-zinc-950/40 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <th className="py-4 px-6 text-center w-16">Rank</th>
                <th className="py-4 px-6">Department</th>
                <th className="py-4 px-6 text-center">Student Count</th>
                <th className="py-4 px-6 text-center">Active Profiles</th>
                <th className="py-4 px-6 text-center">Average Rating</th>
                <th className="py-4 px-6">Top Performer</th>
                <th className="py-4 px-6 text-center">Branch Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]/50">
              {departments.map((d) => (
                <tr key={d.department} className="hover:bg-white/[0.01] transition-all">
                  <td className="py-4 px-6 text-center font-extrabold text-xs text-zinc-400">
                    {getRankBadge(d.rank)}
                  </td>
                  <td className="py-4 px-6 font-bold text-sm text-white">
                    {d.department}
                  </td>
                  <td className="py-4 px-6 text-center font-semibold text-xs text-zinc-400">
                    {d.studentCount}
                  </td>
                  <td className="py-4 px-6 text-center font-semibold text-xs text-zinc-400">
                    {d.activeCount}
                  </td>
                  <td className="py-4 px-6 text-center font-extrabold text-sm text-white">
                    {d.averageRating}
                  </td>
                  <td className="py-4 px-6 text-xs">
                    {d.topPerformer.name !== "None" ? (
                      <Link
                        href={`/dashboard?userId=${d.topPerformer.id}`}
                        className="inline-flex items-center gap-1.5 font-bold text-primary hover:text-white transition-colors"
                      >
                        <Trophy className="h-3.5 w-3.5" />
                        {d.topPerformer.name}
                        <span className="text-zinc-500 font-semibold">({d.topPerformer.rating})</span>
                      </Link>
                    ) : (
                      <span className="text-zinc-650 font-bold">N/A</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center text-xs font-bold text-emerald-400">
                    +{d.growth}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
