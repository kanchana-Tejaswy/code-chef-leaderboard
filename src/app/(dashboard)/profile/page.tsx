"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useAuth } from "@/app/providers";
import { useSearchParams } from "next/navigation";
import { 
  User, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Save, 
  Loader2, 
  Sparkles, 
  Camera, 
  Trash2 
} from "lucide-react";

function ProfileContent() {
  const { user, profile, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const isSetupMode = searchParams.get("setup") === "true";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [department, setDepartment] = useState("CSE");
  const [year, setYear] = useState(3);
  const [codechefUsername, setCodechefUsername] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Get Supabase browser client
  const { refreshProfile: _, signOut: __, ...authContext } = useAuth();
  // We can initialize browser client directly or fetch from useAuth context if exposed,
  // but providers.tsx exports createBrowserClient inside. Let's create it locally like page did before.
  const { createBrowserClient } = require("@/lib/supabase/client");
  const [supabase] = useState(() => createBrowserClient());

  // Initialize fields once profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setRollNumber(profile.rollNumber || "");
      setDepartment(profile.department || "CSE");
      setYear(profile.year || 1);
      setCodechefUsername(profile.codechefUsername || "");
      setProfilePictureUrl(profile.profilePictureUrl || null);
    }
  }, [profile]);

  const parseCodechefUsername = (input: string): string => {
    if (!input) return "";
    const trimmed = input.trim();
    // Matches patterns like:
    // https://www.codechef.com/users/username
    // http://codechef.com/users/username
    // codechef.com/users/username
    const urlMatch = trimmed.match(/(?:codechef\.com\/users\/)([a-zA-Z0-9_]+)/i);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    return trimmed;
  };

  const handleCodechefBlur = () => {
    const parsed = parseCodechefUsername(codechefUsername);
    setCodechefUsername(parsed);
  };

  const getInitials = (fullName: string) => {
    if (!fullName) return "ST";
    const parts = fullName.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    // File validation limits
    if (!file.type.startsWith("image/")) {
      setUploadError("File must be an image (PNG, JPG, WEBP, GIF).");
      return;
    }

    const maxSizeInBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSizeInBytes) {
      setUploadError("Image size must be smaller than 2MB.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setMessage(null);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user?.id}/avatar-${Date.now()}.${fileExt}`;

      // Upload file to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true
        });

      if (uploadErr) {
        throw uploadErr;
      }

      // Get public URL
      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setProfilePictureUrl(data.publicUrl);
    } catch (err: any) {
      console.error("Error uploading image:", err);
      setUploadError(
        "Could not upload image. Please verify that the 'avatars' storage bucket is created and set to public in Supabase."
      );
    } finally {
      setIsUploading(false);
      // Reset input value to allow uploading same file again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePicture = () => {
    setProfilePictureUrl(null);
    setUploadError(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setMessage(null);

    // Roll number validation matching API format
    const rollPattern = /^[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{4}$/i;
    if (!rollPattern.test(rollNumber)) {
      setMessage({
        type: "error",
        text: "Roll number must match college format (e.g. 23AG1A0501).",
      });
      setIsSaving(false);
      return;
    }

    const parsedUsername = parseCodechefUsername(codechefUsername);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          name,
          rollNumber: rollNumber.toUpperCase(),
          department,
          year,
          codechefUsername: parsedUsername || null,
          profilePictureUrl: profilePictureUrl || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save profile.");
      }

      setMessage({ type: "success", text: "Profile details saved successfully!" });
      await refreshProfile();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncCodechef = async () => {
    if (!user || !profile?.codechefUsername) return;
    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: user.id }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to sync CodeChef data.");
      }

      setSyncMessage({ type: "success", text: "CodeChef profile sync completed successfully!" });
      await refreshProfile();
    } catch (err: any) {
      setSyncMessage({ type: "error", text: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#030303]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-xl">
          <User className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Student Profile</h1>
          <p className="text-sm text-zinc-400 mt-1">Complete your profile to join the college leaderboard</p>
        </div>
      </div>

      {/* Onboarding Activation Prompt */}
      {isSetupMode && !profile && (
        <div className="mb-8 p-5 rounded-2xl border border-primary/20 bg-primary/5 text-xs text-primary/80 font-semibold leading-relaxed flex items-start gap-3.5 relative overflow-hidden animate-fade-in shadow-[0_1px_15px_rgba(234,179,8,0.05)]">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Onboarding Activation Required</h3>
            <p className="text-zinc-400 leading-relaxed">
              Welcome to ACE Talent! Please fill in your profile details and link your CodeChef handle below. 
              Once saved, you will be registered on the college leaderboard and unlock your analytics dashboard.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Form Column */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 sm:p-8 relative">
          
          {/* Circular Image Upload Section */}
          <div className="flex flex-col items-center mb-8 border-b border-white/5 pb-6">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider self-start mb-4">
              Profile Photo
            </h3>
            
            <div className="relative group h-28 w-28 rounded-full cursor-pointer overflow-hidden border-2 border-zinc-800 hover:border-primary/50 transition-all duration-300 flex items-center justify-center bg-zinc-950 shadow-[0_2px_15px_rgba(0,0,0,0.5)]">
              {profilePictureUrl ? (
                <img 
                  src={profilePictureUrl} 
                  alt="Profile Avatar" 
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <div className="h-full w-full rounded-full bg-primary/10 text-primary font-extrabold text-3xl flex items-center justify-center">
                  {getInitials(name || user.email || "ST")}
                </div>
              )}

              {/* Hover Overlay */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1 text-white select-none"
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <>
                    <Camera className="h-5 w-5 text-zinc-300" />
                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Update</span>
                  </>
                )}
              </div>
            </div>

            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden" 
            />

            {/* Action buttons */}
            <div className="flex items-center gap-4 mt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-primary hover:text-primary-hover transition-colors"
              >
                Upload Photo
              </button>
              {profilePictureUrl && (
                <button
                  type="button"
                  onClick={handleRemovePicture}
                  className="text-xs font-bold text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>

            {uploadError && (
              <p className="text-[10px] text-red-400 font-semibold mt-3 text-center leading-relaxed max-w-xs">
                {uploadError}
              </p>
            )}
          </div>

          <h2 className="text-lg font-bold text-white mb-6">Profile Details</h2>

          {message && (
            <div
              className={`mb-6 p-4 rounded-xl border flex items-start gap-2.5 text-xs font-semibold leading-relaxed ${
                message.type === "success"
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                  : "border-red-500/20 bg-red-500/5 text-red-400"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950/40 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Roll Number
                </label>
                <input
                  type="text"
                  required
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="23AG1A0501"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950/40 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950/40 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                >
                  <option value="CSE">CSE - Computer Science & Eng</option>
                  <option value="IT">IT - Information Technology</option>
                  <option value="CSM">CSM - AI & Machine Learning</option>
                  <option value="CSD">CSD - Data Science</option>
                  <option value="ECE">ECE - Electronics & Comm</option>
                  <option value="EEE">EEE - Electrical & Electronics</option>
                  <option value="ME">ME - Mechanical Eng</option>
                  <option value="CE">CE - Civil Eng</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Academic Year
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950/40 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                >
                  <option value={1}>1st Year (Freshman)</option>
                  <option value={2}>2nd Year (Sophomore)</option>
                  <option value={3}>3rd Year (Junior)</option>
                  <option value={4}>4th Year (Senior)</option>
                </select>
              </div>
            </div>

            <div className="border-t border-white/5 pt-6">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                CodeChef Username or Profile URL
              </label>
              <input
                type="text"
                value={codechefUsername}
                onChange={(e) => setCodechefUsername(e.target.value)}
                onBlur={handleCodechefBlur}
                placeholder="e.g. tourist or https://www.codechef.com/users/tourist"
                className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950/40 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
              />
              <p className="text-[10px] text-zinc-500 mt-2">
                Provide your exact handle or paste your profile URL. The system will automatically resolve it.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:bg-primary/50 disabled:cursor-not-allowed text-sm font-bold text-[#0A0A0A] py-3.5 rounded-xl transition-all shadow-[0_1px_15px_rgba(234,179,8,0.2)]"
            >
              {isSaving ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Save className="h-4.5 w-4.5" />}
              Save Profile Settings
            </button>
          </form>
        </div>

        {/* Right Sync Card Column */}
        <div className="flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0" />
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-emerald-400 animate-pulse" />
              CodeChef Integration
            </h2>

            {syncMessage && (
              <div
                className={`mb-4 p-3.5 rounded-xl border text-[11px] font-semibold leading-relaxed flex items-start gap-2 ${
                  syncMessage.type === "success"
                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                    : "border-red-500/20 bg-red-500/5 text-red-400"
                }`}
              >
                {syncMessage.type === "success" ? (
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span>{syncMessage.text}</span>
              </div>
            )}

            {profile?.codechefUsername ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    Linked Profile
                  </span>
                  <span className="text-sm font-extrabold text-white">
                    {profile.codechefUsername}
                  </span>
                </div>

                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Profile stats are refreshed automatically every night. If you recently solved problems or completed a contest, trigger a manual sync below.
                </p>

                <button
                  onClick={handleSyncCodechef}
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2 border border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold py-3.5 rounded-xl transition-all"
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sync CodeChef Now
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Link your CodeChef handle on the left to verify your performance and appear on the college leaderboard.
                </p>
              </div>
            )}
          </div>

          {/* Sync Rules Card */}
          <div className="glass-card rounded-2xl p-6 border-white/5 bg-zinc-950/20">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest mb-3">Sync Limits</h3>
            <ul className="space-y-2.5 text-[11px] text-zinc-400">
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                <span>Manual syncs are rate-limited to once every 6 hours.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                <span>Automatic background syncs run nightly at 2:00 AM.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                <span>Only problems flagged as solved on your public profile will increment solved metrics.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center p-12 bg-[#030303]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
