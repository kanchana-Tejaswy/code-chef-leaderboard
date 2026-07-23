"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Code,
  ArrowLeft,
  Loader2,
  TrendingUp,
  Target,
  Sparkles,
  GitBranch,
  Star,
  Users,
  Edit2,
  Check,
  X,
  Shield,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/app/providers";

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
  linkedinUrl?: string | null;
  verificationStatus?: string;
  codechefProfile?: any;
  leetcodeProfile?: any;
  githubProfile?: any;
  aiAnalysis?: any;
  leaderboardEntry?: any;
  updatedAt?: string;
}



export default function StudentProfileDashboard() {
  const { profile } = useAuth();
  const params = useParams();
  const studentId = params?.id as string;

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<"codechef" | "leetcode" | "github" | null>(null);
  const [mounted, setMounted] = useState(false);

  // Editing Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const publicDemoWriteMode = profile?.role === "ADMIN";

  const handleSaveName = async () => {
    if (!editingName.trim()) return;
    setIsSavingName(true);
    try {
      const response = await fetch("/api/admin/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: studentId, name: editingName }),
      });
      if (response.ok) {
        setStudent((prev) => prev ? { ...prev, name: editingName.trim() } : null);
        setIsEditingName(false);
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

  // Edit Details Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    rollNumber: "",
    department: "",
    year: "",
    branch: "",
    section: "",
    codechefUsername: "",
    leetcodeUsername: "",
    githubUsername: "",
    linkedinUrl: "",
  });
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [saveDetailsError, setSaveDetailsError] = useState<string | null>(null);

  const handleOpenEditModal = () => {
    if (student) {
      setEditFormData({
        name: student.name || "",
        rollNumber: student.rollNumber || "",
        department: student.department || "",
        year: student.year?.toString() || "",
        branch: student.branch || "",
        section: student.section || "",
        codechefUsername: student.codechefUsername || "",
        leetcodeUsername: student.leetcodeUsername || "",
        githubUsername: student.githubUsername || "",
        linkedinUrl: student.linkedinUrl || "",
      });
      setSaveDetailsError(null);
      setIsEditModalOpen(true);
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDetails(true);
    setSaveDetailsError(null);
    try {
      const response = await fetch(`/api/admin/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setStudent(data.student);
        setIsEditModalOpen(false);
      } else {
        setSaveDetailsError(data.error || "Failed to update details.");
      }
    } catch (e: any) {
      console.error(e);
      setSaveDetailsError("Error updating student details.");
    } finally {
      setIsSavingDetails(false);
    }
  };

  const [isSyncingLeetCode, setIsSyncingLeetCode] = useState(false);
  const [syncLeetCodeError, setSyncLeetCodeError] = useState<string | null>(null);

  const handleSyncLeetCode = async () => {
    if (!student?.id || !student.leetcodeUsername) return;
    setIsSyncingLeetCode(true);
    setSyncLeetCodeError(null);
    try {
      const response = await fetch(`/api/admin/students/${student.id}/leetcode/sync`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        setSyncLeetCodeError(data.error || "Failed to synchronize LeetCode profile.");
      } else {
        window.location.reload();
      }
    } catch (e: any) {
      setSyncLeetCodeError("Error starting synchronization.");
    } finally {
      setIsSyncingLeetCode(false);
    }
  };

  const [isSyncingCodeChef, setIsSyncingCodeChef] = useState(false);
  const [syncCodeChefError, setSyncCodeChefError] = useState<string | null>(null);

  const handleSyncCodeChef = async () => {
    if (!student?.id || !student.codechefUsername) return;
    setIsSyncingCodeChef(true);
    setSyncCodeChefError(null);
    try {
      const response = await fetch(`/api/admin/students/${student.id}/codechef/sync`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        setSyncCodeChefError(data.error || "Failed to synchronize CodeChef profile.");
      } else {
        window.location.reload();
      }
    } catch (e: any) {
      setSyncCodeChefError("Error starting synchronization.");
    } finally {
      setIsSyncingCodeChef(false);
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



  const formatVal = (val: any, suffix: string = "") => {
    if (val === null || val === undefined) return "Unavailable";
    return `${val}${suffix}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">✅ Verified</span>;
      case "PARTIAL":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">✅ Verified Profiles</span>;
      case "UNABLE_TO_VERIFY":
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">❌ Unable to Verify</span>;
    }
  };

  const VerifiedBadge = () => (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[7px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
      Verified
    </span>
  );

  const CalculatedBadge = ({ formula }: { formula?: string }) => (
    <span 
      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[7px] font-black uppercase tracking-wider bg-sky-500/10 border border-[#262626] text-sky-400 cursor-help"
      title={formula ? `Formula: ${formula}` : "Derived mathematical calculation"}
    >
      Calculated
    </span>
  );

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
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenEditModal}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase bg-[#EAB308]/10 text-[#EAB308] border border-[#EAB308]/30 px-3 py-1 rounded-xl hover:bg-[#EAB308]/20 transition-all"
          >
            <Edit2 className="h-3 w-3" />
            Edit Details
          </button>
          <span className="text-[10px] text-[#A3A3A3] font-bold tracking-widest uppercase bg-[#111111] px-3 py-1 border border-[#262626] rounded-xl">
            ID: {student.rollNumber}
          </span>
        </div>
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
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="px-3 py-1 rounded-xl border border-brand-border bg-zinc-950 text-base font-bold text-white focus:outline-none focus:border-[#EAB308]/50 w-48"
                  autoFocus
                  disabled={isSavingName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") setIsEditingName(false);
                  }}
                />
                <button
                  onClick={handleSaveName}
                  disabled={isSavingName}
                  className="p-1.5 text-emerald-400 hover:text-emerald-300 border border-[#262626] bg-[#111111]/40 rounded-lg transition-all"
                  title="Save"
                >
                  {isSavingName ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  disabled={isSavingName}
                  className="p-1.5 text-red-400 hover:text-red-300 border border-[#262626] bg-[#111111]/40 rounded-lg transition-all"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#FAFAFA] flex items-center gap-2 group/title">
                <span>{student.name}</span>
                <button
                  onClick={() => {
                    setIsEditingName(true);
                    setEditingName(student.name);
                  }}
                  className="opacity-0 group-hover/title:opacity-100 p-1 text-zinc-500 hover:text-[#EAB308] transition-all"
                  title="Edit name"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider">
                {student.department} • {student.year} Year • Sec {student.section}
              </span>
              <span className={`inline-flex px-2 py-0.5 border rounded-lg text-[8px] font-bold tracking-wider uppercase leading-none ${readinessColor}`}>
                {readinessLabel}
              </span>
              {getStatusBadge(student.verificationStatus || "UNABLE_TO_VERIFY")}
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

      {(!student.codechefProfile && !student.leetcodeProfile && !student.githubProfile) && (
        <div className="p-4 rounded-2xl border border-[#EAB308]/20 bg-[#EAB308]/5 text-[#EAB308] text-xs font-bold text-center shadow-md">
          No verified platform data is available yet.
        </div>
      )}

      {selectedPlatform === null ? (
        <div className="flex flex-col gap-6">
          <div className="text-xs text-[#A3A3A3] uppercase tracking-widest font-black text-center mb-2">
            Select a Platform Card below to view detailed analytics
          </div>

          {/* 4 BIG CLICKABLE CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
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
                  <span className="text-xs font-black text-[#FAFAFA] mt-1">{student.codechefProfile?.stars === 0 || !student.codechefProfile?.currentRating ? "Unrated" : `${student.codechefProfile?.stars}★`}</span>
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
            {student.githubUsername ? (
              <a
                href={`https://github.com/${student.githubUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-[#262626] hover:border-[#EAB308]/40 bg-[#111111]/70 hover:bg-[#111111] p-6 rounded-3xl cursor-pointer flex flex-col justify-center items-center gap-4 transition-all duration-300 group shadow-lg"
              >
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                  <Github className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#FAFAFA] group-hover:text-[#EAB308] transition-colors">GitHub</h3>
                  <p className="text-[9px] text-[#A3A3A3] font-semibold mt-1">View Profile</p>
                </div>
              </a>
            ) : (
              <div className="border border-[#262626] bg-[#111111]/40 p-6 rounded-3xl flex flex-col justify-center items-center gap-4 opacity-50">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Github className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#A3A3A3]">GitHub</h3>
                  <p className="text-[9px] text-[#A3A3A3] font-semibold mt-1">Not connected</p>
                </div>
              </div>
            )}

            {/* LINKEDIN CARD */}
            {student.linkedinUrl ? (
              <a
                href={student.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-[#262626] hover:border-[#EAB308]/40 bg-[#111111]/70 hover:bg-[#111111] p-6 rounded-3xl cursor-pointer flex flex-col justify-center items-center gap-4 transition-all duration-300 group shadow-lg"
              >
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#FAFAFA] group-hover:text-[#EAB308] transition-colors">LinkedIn</h3>
                  <p className="text-[9px] text-[#A3A3A3] font-semibold mt-1">View Profile</p>
                </div>
              </a>
            ) : (
              <div className="border border-[#262626] bg-[#111111]/40 p-6 rounded-3xl flex flex-col justify-center items-center gap-4 opacity-50">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#A3A3A3]">LinkedIn</h3>
                  <p className="text-[9px] text-[#A3A3A3] font-semibold mt-1">Not connected</p>
                </div>
              </div>
            )}

          </div>

          {/* VERIFICATION PANEL */}
          <div className="border border-[#262626] bg-[#111111]/40 rounded-3xl p-6 shadow-xl flex flex-col gap-5 text-left">
            <div className="flex items-center gap-2 border-b border-[#262626]/60 pb-3">
              <Shield className="h-5 w-5 text-emerald-400" />
              <h2 className="text-sm font-black uppercase tracking-wider text-[#FAFAFA]">Verification Status & Data Completeness</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Verification Checklist */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-wider">Platform Integration</span>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs border border-[#262626] bg-[#111111]/60 px-3.5 py-2 rounded-xl">
                    <span className="font-bold text-zinc-300">CodeChef Verified</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${student.codechefProfile ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
                      {student.codechefProfile ? "✓ Active" : "✗ Missing"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs border border-[#262626] bg-[#111111]/60 px-3.5 py-2 rounded-xl">
                    <span className="font-bold text-zinc-300">LeetCode Verified</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${student.leetcodeProfile ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
                      {student.leetcodeProfile ? "✓ Active" : "✗ Missing"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs border border-[#262626] bg-[#111111]/60 px-3.5 py-2 rounded-xl">
                    <span className="font-bold text-zinc-300">GitHub Connected</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${student.githubUsername ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
                      {student.githubUsername ? "✓ Linked" : "✗ Missing"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs border border-[#262626] bg-[#111111]/60 px-3.5 py-2 rounded-xl">
                    <span className="font-bold text-zinc-300">LinkedIn Connected</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${student.linkedinUrl ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
                      {student.linkedinUrl ? "✓ Linked" : "✗ Missing"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Sync & Completeness Gauges */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-wider">Sync Metadata</span>
                <div className="border border-[#262626] bg-[#111111]/60 p-4 rounded-xl flex flex-col gap-3 h-full justify-between">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-zinc-400">Last Synced:</span>
                    <span className="font-black text-white">{student.updatedAt ? new Date(student.updatedAt).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) : "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-zinc-400">Data Completeness:</span>
                    <span className="font-black text-emerald-400 text-sm">
                      {(() => {
                        const totalPossibleFields = 14;
                        let populatedFields = 0;
                        if (student.codechefProfile) {
                          if (student.codechefProfile.currentRating !== null) populatedFields++;
                          if (student.codechefProfile.highestRating !== null) populatedFields++;
                          if (student.codechefProfile.stars !== null) populatedFields++;
                          if (student.codechefProfile.contestCount !== null) populatedFields++;
                          if (student.codechefProfile.globalRank !== null) populatedFields++;
                          if (student.codechefProfile.countryRank !== null) populatedFields++;
                          if (student.codechefProfile.division !== null) populatedFields++;
                        }
                        if (student.leetcodeProfile) {
                          if (student.leetcodeProfile.problemsSolved !== null) populatedFields++;
                          if (student.leetcodeProfile.easySolvedCount !== null) populatedFields++;
                          if (student.leetcodeProfile.mediumSolvedCount !== null) populatedFields++;
                          if (student.leetcodeProfile.hardSolvedCount !== null) populatedFields++;
                          if (student.leetcodeProfile.contestRating !== null) populatedFields++;
                          if (student.leetcodeProfile.contestRank !== null && student.leetcodeProfile.contestRank > 0) populatedFields++;
                          if (student.leetcodeProfile.acceptanceRate !== null) populatedFields++;
                        }
                        return Math.round((populatedFields / totalPossibleFields) * 100);
                      })()}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Missing Fields list */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-wider">Missing API Fields</span>
                <div className="border border-[#262626] bg-[#111111]/60 p-4 rounded-xl flex flex-wrap gap-1.5 h-full content-start overflow-y-auto max-h-[110px]">
                  {(() => {
                    const missingList: string[] = [];
                    if (!student.codechefProfile) {
                      missingList.push("CodeChef Data");
                    } else {
                      if (student.codechefProfile.currentRating === null) missingList.push("CodeChef Rating");
                      if (student.codechefProfile.stars === null) missingList.push("CodeChef Stars");
                      if (student.codechefProfile.globalRank === null) missingList.push("CodeChef Rank");
                    }
                    if (!student.leetcodeProfile) {
                      missingList.push("LeetCode Data");
                    } else {
                      if (student.leetcodeProfile.problemsSolved === null) missingList.push("LeetCode Solved");
                      if (student.leetcodeProfile.contestRating === null) missingList.push("LeetCode Rating");
                      if (student.leetcodeProfile.contestRank === null || student.leetcodeProfile.contestRank === 0) missingList.push("LeetCode Rank");
                      if (student.leetcodeProfile.acceptanceRate === null) missingList.push("Acceptance Rate");
                    }
                    if (missingList.length === 0) {
                      return <span className="text-xs text-emerald-400 font-bold">✓ 100% complete payload</span>;
                    }
                    return missingList.map((f, idx) => (
                      <span key={idx} className="text-[8px] font-bold bg-red-500/5 border border-red-500/15 text-red-400 px-2 py-0.5 rounded-lg uppercase">
                        {f}
                      </span>
                    ));
                  })()}
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
            </div>
          </div>

          {/* CODECHEF DASHBOARD */}
          {selectedPlatform === "codechef" && student.codechefProfile && (() => {
            const ccStatus = student.verificationStatus === "VERIFIED" ? "VERIFIED" : "PARTIAL";

            return (
              <div className="flex flex-col gap-6">
                
                {/* Error message if sync fails */}
                {syncCodeChefError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex justify-between items-center">
                    <span>{syncCodeChefError}</span>
                    <button onClick={() => setSyncCodeChefError(null)} className="text-red-400 hover:text-red-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Metadata info block */}
                <div className="border border-[#262626] bg-[#111111]/40 px-5 py-3 rounded-2xl flex flex-wrap justify-between items-center gap-4 text-[10px] font-bold text-[#A3A3A3]">
                  <div className="flex items-center gap-1.5">
                    <span>Data Source:</span>
                    <span className="text-white">CodeChef Profile Scraper</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Verification Status:</span>
                    {getStatusBadge(ccStatus)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Last Updated:</span>
                    <span className="text-white">{student.codechefProfile.lastFetchedAt ? new Date(student.codechefProfile.lastFetchedAt).toLocaleString() : "N/A"}</span>
                  </div>
                  {/* Admin Sync Button */}
                  {(publicDemoWriteMode) && (
                    <button
                      onClick={handleSyncCodeChef}
                      disabled={isSyncingCodeChef}
                      className="ml-auto flex items-center gap-1.5 bg-[#EAB308]/10 hover:bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSyncingCodeChef ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Syncing...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Sync CodeChef Now</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center gap-1.5">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center justify-center gap-1">
                      Current Rating <VerifiedBadge />
                    </span>
                    <span className="text-2xl font-black text-[#EAB308] mt-1">{formatVal(student.codechefProfile.currentRating)}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center gap-1.5">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center justify-center gap-1">
                      Highest Rating <VerifiedBadge />
                    </span>
                    <span className="text-2xl font-black text-[#FAFAFA] mt-1">{formatVal(student.codechefProfile.highestRating)}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center gap-1.5">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center justify-center gap-1">
                      Stars <VerifiedBadge />
                    </span>
                    <span className="text-2xl font-black text-[#EAB308] mt-1">{student.codechefProfile.stars !== null && student.codechefProfile.stars !== undefined ? `${student.codechefProfile.stars}★` : "Unavailable"}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center gap-1.5">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center justify-center gap-1">
                      Contests <VerifiedBadge />
                    </span>
                    <span className="text-2xl font-black text-[#FAFAFA] mt-1">{formatVal(student.codechefProfile.contestCount)}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center gap-1.5">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center justify-center gap-1">
                      Global Rank <VerifiedBadge />
                    </span>
                    <span className="text-2xl font-black text-[#FAFAFA] mt-1">{student.codechefProfile.globalRank ? `#${student.codechefProfile.globalRank}` : "Unavailable"}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center gap-1.5">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center justify-center gap-1">
                      Country Rank <VerifiedBadge />
                    </span>
                    <span className="text-2xl font-black text-[#FAFAFA] mt-1">{student.codechefProfile.countryRank ? `#${student.codechefProfile.countryRank}` : "Unavailable"}</span>
                  </div>
                </div>

                {/* Derived Analytics Section */}
                <div className="flex flex-col gap-3 text-left">
                  <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider">Derived Analytics</span>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {(() => {
                      const ratingHistory = (student.codechefProfile.ratingHistory || []) as any[];
                      const contestHistory = (student.codechefProfile.contestHistory || []) as any[];
                      
                      const ratingGrowth = ratingHistory.length > 1
                        ? (ratingHistory[ratingHistory.length - 1]?.rating || 0) - (ratingHistory[0]?.rating || 0)
                        : 0;

                      const avgContestRank = contestHistory.length > 0
                        ? Math.round(contestHistory.reduce((sum, c) => sum + (Number(c.rank) || 0), 0) / contestHistory.length)
                        : 0;

                      const ratings = ratingHistory.map(r => r.rating || 0);
                      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
                      const variance = ratings.length > 0 ? ratings.reduce((sum, r) => sum + Math.pow(r - avgRating, 2), 0) / ratings.length : 0;
                      const stdDev = Math.sqrt(variance);
                      const consistency = Math.max(0, Math.round(100 - stdDev));

                      return (
                        <>
                          <div className="border border-[#262626] bg-[#111111]/40 p-4 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                              Rating Growth <CalculatedBadge formula="Current - Initial" />
                            </span>
                            <span className="text-lg font-black text-white mt-2">{ratingGrowth >= 0 ? "+" : ""}{ratingGrowth}</span>
                          </div>
                          <div className="border border-[#262626] bg-[#111111]/40 p-4 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                              Contest Freq <CalculatedBadge formula="ContestCount / Total" />
                            </span>
                            <span className="text-lg font-black text-white mt-2">{student.codechefProfile.contestCount || 0} active</span>
                          </div>
                          <div className="border border-[#262626] bg-[#111111]/40 p-4 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                              Avg Contest Rank <CalculatedBadge formula="SUM(Rank) / Contests" />
                            </span>
                            <span className="text-lg font-black text-white mt-2">#{avgContestRank || "N/A"}</span>
                          </div>
                          <div className="border border-[#262626] bg-[#111111]/40 p-4 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                              Consistency <CalculatedBadge formula="100 - StdDev(Ratings)" />
                            </span>
                            <span className="text-lg font-black text-white mt-2">{consistency}%</span>
                          </div>
                          <div className="border border-[#262626] bg-[#111111]/40 p-4 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                              CP Score <CalculatedBadge formula="Weighted platform score" />
                            </span>
                            <span className="text-lg font-black text-[#EAB308] mt-2">{student.leaderboardEntry?.codechefScore || 0}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
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



              </div>
            );
          })()}

          {/* LEETCODE DASHBOARD */}
          {selectedPlatform === "leetcode" && student.leetcodeProfile && (() => {
            const lcStatus = student.verificationStatus === "VERIFIED" ? "VERIFIED" : "PARTIAL";

            return (
              <div className="flex flex-col gap-6">
                
                {/* Error message if sync fails */}
                {syncLeetCodeError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex justify-between items-center">
                    <span>{syncLeetCodeError}</span>
                    <button onClick={() => setSyncLeetCodeError(null)} className="text-red-400 hover:text-red-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Metadata info block */}
                <div className="border border-[#262626] bg-[#111111]/40 px-5 py-3 rounded-2xl flex flex-wrap justify-between items-center gap-4 text-[10px] font-bold text-[#A3A3A3]">
                  <div className="flex items-center gap-1.5">
                    <span>Data Source:</span>
                    <span className="text-white">LeetCode GraphQL API</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Verification Status:</span>
                    {getStatusBadge(lcStatus)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Last Updated:</span>
                    <span className="text-white">{student.leetcodeProfile.lastFetchedAt ? new Date(student.leetcodeProfile.lastFetchedAt).toLocaleString() : "N/A"}</span>
                  </div>
                  {/* Admin Sync Button */}
                  {(publicDemoWriteMode) && (
                    <button
                      onClick={handleSyncLeetCode}
                      disabled={isSyncingLeetCode}
                      className="ml-auto flex items-center gap-1.5 bg-[#EAB308]/10 hover:bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSyncingLeetCode ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Syncing...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Sync LeetCode Now</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center gap-1.5">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center justify-center gap-1">
                      Contest Rating <VerifiedBadge />
                    </span>
                    <span className="text-2xl font-black text-[#F59E0B] mt-1">{formatVal(student.leetcodeProfile.contestRating)}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center gap-1.5">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center justify-center gap-1">
                      Contest Rank <VerifiedBadge />
                    </span>
                    <span className="text-2xl font-black text-[#FAFAFA] mt-1">{student.leetcodeProfile.contestRank ? `#${student.leetcodeProfile.contestRank}` : "Unavailable"}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center gap-1.5">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center justify-center gap-1">
                      Contests Attended <VerifiedBadge />
                    </span>
                    <span className="text-2xl font-black text-[#FAFAFA] mt-1">{formatVal((student.leetcodeProfile.verificationMetadata as any)?.contestsAttended?.value)}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center gap-1.5">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center justify-center gap-1">
                      Profile Ranking <VerifiedBadge />
                    </span>
                    <span className="text-2xl font-black text-[#FAFAFA] mt-1">{(student.leetcodeProfile.verificationMetadata as any)?.profileRanking?.value ? `#${(student.leetcodeProfile.verificationMetadata as any).profileRanking.value}` : "Unavailable"}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center gap-1.5">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center justify-center gap-1">
                      Problems Solved <VerifiedBadge />
                    </span>
                    <span className="text-2xl font-black text-[#FAFAFA] mt-1">{formatVal(student.leetcodeProfile.problemsSolved)}</span>
                  </div>
                  <div className="border border-[#262626] bg-[#111111]/70 p-4.5 rounded-2xl flex flex-col justify-center text-center gap-1.5">
                    <span className="text-[9px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center justify-center gap-1">
                      Acceptance Rate <VerifiedBadge />
                    </span>
                    <span className="text-2xl font-black text-[#EAB308] mt-1">{formatVal(student.leetcodeProfile.acceptanceRate, "%")}</span>
                  </div>
                </div>

                {/* LeetCode Derived Analytics */}
                <div className="flex flex-col gap-3 text-left">
                  <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider">Derived Analytics</span>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {(() => {
                      const easy = student.leetcodeProfile.easySolvedCount || 0;
                      const medium = student.leetcodeProfile.mediumSolvedCount || 0;
                      const hard = student.leetcodeProfile.hardSolvedCount || 0;
                      const total = student.leetcodeProfile.problemsSolved || 1;
                      const learningProgress = Math.min(100, Math.round((total / 1000) * 100));
                      const interviewReadiness = Math.min(100, Math.round(((easy * 0.2 + medium * 0.6 + hard * 1.0) / Math.max(1, easy + medium + hard)) * 100));
                      const contestConsistency = student.leetcodeProfile.contestRating ? Math.min(100, Math.max(10, Math.round(student.leetcodeProfile.contestRating / 25))) : 0;

                      return (
                        <>
                          <div className="border border-[#262626] bg-[#111111]/40 p-4 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                              Problem Solving Score <CalculatedBadge formula="Weighted solve score" />
                            </span>
                            <span className="text-lg font-black text-[#EAB308] mt-2">{student.leaderboardEntry?.leetcodeScore || 0}</span>
                          </div>
                          <div className="border border-[#262626] bg-[#111111]/40 p-4 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                              Contest Consistency <CalculatedBadge formula="Rating stabilization percent" />
                            </span>
                            <span className="text-lg font-black text-white mt-2">{contestConsistency}%</span>
                          </div>
                          <div className="border border-[#262626] bg-[#111111]/40 p-4 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                              Learning Progress <CalculatedBadge formula="Solved / 1000 milestone" />
                            </span>
                            <span className="text-lg font-black text-white mt-2">{learningProgress}%</span>
                          </div>
                          <div className="border border-[#262626] bg-[#111111]/40 p-4 rounded-xl flex flex-col justify-between">
                            <span className="text-[8px] font-black text-[#A3A3A3] uppercase tracking-widest flex items-center gap-1.5">
                              Interview Readiness <CalculatedBadge formula="Difficulty-weighted solve index" />
                            </span>
                            <span className="text-lg font-black text-emerald-400 mt-2">{interviewReadiness}%</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div className="border border-[#262626] bg-[#111111]/60 p-5 rounded-2xl flex flex-col gap-4 justify-between w-full">
                    <span className="text-[10px] font-black text-[#A3A3A3] uppercase tracking-wider">Problems Solved (Easy/Medium/Hard)</span>
                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span className="text-emerald-500">Easy</span>
                          <span>{formatVal(student.leetcodeProfile.easySolvedCount)}</span>
                        </div>
                        <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: student.leetcodeProfile.easySolvedCount && student.leetcodeProfile.problemsSolved ? `${(student.leetcodeProfile.easySolvedCount / student.leetcodeProfile.problemsSolved) * 100}%` : "0%" }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span className="text-[#F59E0B]">Medium</span>
                          <span>{formatVal(student.leetcodeProfile.mediumSolvedCount)}</span>
                        </div>
                        <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-[#F59E0B] h-full rounded-full" style={{ width: student.leetcodeProfile.mediumSolvedCount && student.leetcodeProfile.problemsSolved ? `${(student.leetcodeProfile.mediumSolvedCount / student.leetcodeProfile.problemsSolved) * 100}%` : "0%" }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span className="text-red-500">Hard</span>
                          <span>{formatVal(student.leetcodeProfile.hardSolvedCount)}</span>
                        </div>
                        <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-red-500 h-full rounded-full" style={{ width: student.leetcodeProfile.hardSolvedCount && student.leetcodeProfile.problemsSolved ? `${(student.leetcodeProfile.hardSolvedCount / student.leetcodeProfile.problemsSolved) * 100}%` : "0%" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>




              </div>
            );
          })()}

        </div>
      )}


      {/* Edit Details Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0A0A0A] border border-[#262626] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626] bg-[#111111]">
              <h2 className="text-sm font-black text-[#FAFAFA] tracking-wider uppercase">Edit Student Details</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDetails} className="flex flex-col p-6 gap-6 max-h-[75vh] overflow-y-auto">
              {saveDetailsError && (
                <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-bold">
                  {saveDetailsError}
                </div>
              )}

              {/* Basic Details */}
              <div className="flex flex-col gap-4">
                <h3 className="text-[10px] font-black text-[#EAB308] tracking-widest uppercase">Basic Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-wider">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="bg-[#111111] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EAB308]/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-wider">Roll Number</label>
                    <input
                      type="text"
                      value={editFormData.rollNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, rollNumber: e.target.value })}
                      className="bg-[#111111] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EAB308]/50"
                    />
                  </div>
                </div>
              </div>

              {/* Academic Info */}
              <div className="flex flex-col gap-4">
                <h3 className="text-[10px] font-black text-[#EAB308] tracking-widest uppercase">Academic Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-wider">Department</label>
                    <input
                      type="text"
                      value={editFormData.department}
                      onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                      className="bg-[#111111] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EAB308]/50"
                      placeholder="e.g. CSE"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-wider">Year</label>
                    <input
                      type="number"
                      value={editFormData.year}
                      onChange={(e) => setEditFormData({ ...editFormData, year: e.target.value })}
                      className="bg-[#111111] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EAB308]/50"
                      placeholder="1, 2, 3, 4"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-wider">Branch</label>
                    <input
                      type="text"
                      value={editFormData.branch}
                      onChange={(e) => setEditFormData({ ...editFormData, branch: e.target.value })}
                      className="bg-[#111111] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EAB308]/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-wider">Section</label>
                    <input
                      type="text"
                      value={editFormData.section}
                      onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value })}
                      className="bg-[#111111] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EAB308]/50"
                    />
                  </div>
                </div>
              </div>

              {/* Platform Profiles */}
              <div className="flex flex-col gap-4">
                <h3 className="text-[10px] font-black text-[#EAB308] tracking-widest uppercase">Platform Usernames</h3>
                <p className="text-[10px] text-zinc-500 mb-1 leading-snug">
                  Warning: Changing a platform username will trigger an automatic background sync. The student's scores and ranks will be recalculated. This may take up to 30 seconds.
                </p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-[#EAB308]/10 text-[#EAB308] flex items-center justify-center shrink-0 border border-[#EAB308]/20">
                      <Trophy className="h-4 w-4" />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-wider">CodeChef Username</label>
                      <input
                        type="text"
                        value={editFormData.codechefUsername}
                        onChange={(e) => setEditFormData({ ...editFormData, codechefUsername: e.target.value })}
                        className="bg-[#111111] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EAB308]/50"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center shrink-0 border border-[#F59E0B]/20">
                      <Code className="h-4 w-4" />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-wider">LeetCode Username</label>
                      <input
                        type="text"
                        value={editFormData.leetcodeUsername}
                        onChange={(e) => setEditFormData({ ...editFormData, leetcodeUsername: e.target.value })}
                        className="bg-[#111111] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EAB308]/50"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                      <Github className="h-4 w-4" />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-wider">GitHub Profile URL</label>
                      <input
                        type="text"
                        value={editFormData.githubUsername}
                        onChange={(e) => setEditFormData({ ...editFormData, githubUsername: e.target.value })}
                        className="bg-[#111111] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EAB308]/50"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                      </svg>
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[9px] font-bold text-[#A3A3A3] uppercase tracking-wider">LinkedIn Profile URL</label>
                      <input
                        type="text"
                        value={editFormData.linkedinUrl}
                        onChange={(e) => setEditFormData({ ...editFormData, linkedinUrl: e.target.value })}
                        className="bg-[#111111] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EAB308]/50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSavingDetails}
                  className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-[#A3A3A3] hover:text-white border border-[#262626] bg-[#111111] hover:bg-[#1a1a1a] transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDetails}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-950 bg-[#EAB308] hover:bg-[#FDE047] transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingDetails ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Details"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
