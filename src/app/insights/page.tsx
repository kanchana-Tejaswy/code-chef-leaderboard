"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Award,
  Zap,
  TrendingUp,
  Brain,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  Loader2,
  Bookmark
} from "lucide-react";

interface StudentGrowth {
  id: string;
  name: string;
  rollNumber: string;
  department: string;
  year: number;
  currentRating: number;
  stars: number;
  growthPercent: number;
  growthPoints: number;
}

interface Recommendation {
  title: string;
  description: string;
  priority: string;
  impact: string;
}

interface Prediction {
  target: string;
  currentCount: number;
  predictedCount: number;
  confidence: string;
  timeframe: string;
}

interface DiscoveryReport {
  title: string;
  details: string;
}

interface InsightsData {
  topImproving: StudentGrowth[];
  placementReady: StudentGrowth[];
  recommendations: Recommendation[];
  predictions: Prediction[];
  discoveryReports: DiscoveryReport[];
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await fetch("/api/insights");
        if (!response.ok) {
          throw new Error("Failed to load AI insights.");
        }
        const json = await response.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "An error occurred.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchInsights();
  }, []);

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "bg-red-500/10 border-red-500/30 text-red-400";
      case "MEDIUM":
        return "bg-amber-500/10 border-amber-500/30 text-amber-400";
      default:
        return "bg-zinc-800/50 border-zinc-700/30 text-zinc-400";
    }
  };

  const getStarBadgeStyle = (stars: number) => {
    if (stars >= 5) return "text-amber-500 border-amber-500/20 bg-amber-500/5";
    if (stars >= 4) return "text-primary border-primary/20 bg-primary/5";
    if (stars >= 3) return "text-secondary border-secondary/20 bg-secondary/5";
    return "text-zinc-500 border-zinc-500/20 bg-zinc-500/5";
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 min-h-[calc(100vh-4rem)] bg-[#0A0A0A]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-[#EAB308]" />
          <span className="text-xs text-[#A3A3A3] font-bold tracking-wider uppercase">
            Running Neural Placement Predictive Models...
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0A0A0A] text-center">
        <div className="glass-card max-w-md p-8 rounded-2xl border border-red-500/10">
          <Brain className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Insights Generation Failed</h2>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            {error || "An error occurred while compiling AI-driven recommendations."}
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
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">AI Insights</h1>
            <p className="text-sm text-[#A3A3A3] mt-1">
              Neural intelligence scoring, career mapping, and placement projections for ACE
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column (2/3 width) - Recommendations & Discovery */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* AI Recommendations */}
          <div className="flex flex-col gap-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lightbulb className="h-4.5 w-4.5 text-[#EAB308]" />
              AI Generated Recommendations
            </h2>
            <div className="flex flex-col gap-4">
              {data.recommendations.map((rec) => (
                <div
                  key={rec.title}
                  className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-4 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-sm font-bold text-white">{rec.title}</h3>
                    <div className="flex gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${getPriorityStyle(rec.priority)}`}>
                        {rec.priority} Priority
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black border border-emerald-500/25 bg-emerald-500/5 text-emerald-400 uppercase">
                        {rec.impact}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                    {rec.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Talent Discovery Reports */}
          <div className="flex flex-col gap-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bookmark className="h-4.5 w-4.5 text-[#F59E0B]" />
              Talent Discovery Reports
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.discoveryReports.map((report) => (
                <div
                  key={report.title}
                  className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col gap-3"
                >
                  <h3 className="text-xs font-bold text-[#EAB308] uppercase tracking-wider">
                    {report.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {report.details}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Top Improving Students */}
          <div className="flex flex-col gap-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
              Top Improving Students
            </h2>
            <div className="glass-card rounded-3xl overflow-hidden border border-white/5 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#262626] bg-zinc-950/40 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      <th className="py-3 px-5">Student</th>
                      <th className="py-3 px-4 text-center">Current Rating</th>
                      <th className="py-3 px-4 text-center">Stars</th>
                      <th className="py-3 px-5 text-center">Rating Growth</th>
                      <th className="py-3 px-5 text-center">Dashboard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262626]/50">
                    {data.topImproving.map((s) => (
                      <tr key={s.id} className="hover:bg-white/[0.01] transition-all group">
                        <td className="py-3 px-5">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white group-hover:text-[#EAB308] transition-colors">
                              {s.name}
                            </span>
                            <span className="text-[9px] text-[#A3A3A3] font-semibold mt-0.5">
                              {s.rollNumber} • {s.department} • {s.year} Yr
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-xs text-white">
                          {s.currentRating}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border text-[9px] font-bold ${getStarBadgeStyle(s.stars)}`}>
                            <span>{s.stars}</span>
                            <span>★</span>
                          </span>
                        </td>
                        <td className="py-3 px-5 text-center font-bold text-xs text-emerald-400">
                          +{s.growthPercent}% <span className="text-zinc-500 font-semibold">(+{s.growthPoints} pts)</span>
                        </td>
                        <td className="py-3 px-5 text-center">
                          <Link
                            href={`/dashboard?userId=${s.id}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#262626] hover:border-[#EAB308]/30 text-[#A3A3A3] hover:text-white transition-all text-xs"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (1/3 width) - Predictions & Placement Ready */}
        <div className="flex flex-col gap-8">
          
          {/* AI Growth Predictions */}
          <div className="glass-card rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col gap-6">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="h-4.5 w-4.5 text-[#EAB308] animate-pulse" />
              AI Growth Projections
            </h2>
            <div className="flex flex-col gap-5">
              {data.predictions.map((p) => {
                const diff = p.predictedCount - p.currentCount;
                return (
                  <div key={p.target} className="flex flex-col gap-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-white">{p.target}</span>
                      <span className="text-emerald-400">+{diff} candidates</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                      <span>Currently: {p.currentCount}</span>
                      <span>Predicted: {p.predictedCount}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-[#EAB308] rounded-full" style={{ width: `${(p.currentCount / (p.predictedCount || 1)) * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-zinc-500 font-semibold mt-1">
                      <span>Confidence index: <strong className="text-white">{p.confidence}</strong></span>
                      <span>Horizon: <strong className="text-white">{p.timeframe}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Placement Ready Candidates */}
          <div className="glass-card rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col gap-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-[#22C55E]" />
              Placement Ready Cohort ({data.placementReady.length})
            </h2>
            <p className="text-xs text-zinc-400">List of students who passed the benchmark 3-Star (1400+ rating) threshold</p>
            
            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
              {data.placementReady.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500 font-semibold">
                  No placement ready candidates found.
                </div>
              ) : (
                data.placementReady.map((s) => (
                  <Link
                    key={s.id}
                    href={`/dashboard?userId=${s.id}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-zinc-900 bg-zinc-950/40 hover:border-[#22C55E]/30 transition-all group"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white group-hover:text-[#EAB308] transition-colors">{s.name}</span>
                      <span className="text-[9px] text-[#A3A3A3] font-semibold mt-0.5">{s.rollNumber} • {s.department}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-[#22C55E]">{s.currentRating}</span>
                      <ArrowRight className="h-3 w-3 text-zinc-650 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
