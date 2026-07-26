"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { UserRole, AccountStatus } from "@prisma/client";
import {
  User,
  Shield,
  UserPlus,
  Users,
  KeyRound,
  History,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  Mail,
  Lock,
  LogOut,
  Building,
  GraduationCap,
  ShieldAlert,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
  ShieldCheck,
} from "lucide-react";

interface AdminControlCenterClientProps {
  currentAdminId: string;
  currentAdminEmail: string;
}

export default function AdminControlCenterClient({
  currentAdminId,
  currentAdminEmail,
}: AdminControlCenterClientProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "create" | "directory" | "security" | "audit" | "sync" | "approvals">("sync");

  return (
    <div className="space-y-8">
      {/* Navigation Tabs Header */}
      <div className="border-b border-brand-border bg-brand-card/50 p-2 rounded-xl backdrop-blur-md">
        <nav className="flex flex-wrap gap-2 sm:gap-3" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("sync")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === "sync"
                ? "bg-[#EAB308] text-[#0A0A0A] shadow-md shadow-[#EAB308]/20"
                : "text-brand-muted hover:bg-brand-bg hover:text-brand-text"
            }`}
          >
            <RefreshCw className="h-4 w-4" />
            Platform Verification & Sync
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === "profile"
                ? "bg-[#EAB308] text-[#0A0A0A] shadow-md shadow-[#EAB308]/20"
                : "text-brand-muted hover:bg-brand-bg hover:text-brand-text"
            }`}
          >
            <User className="h-4 w-4" />
            My Profile
          </button>

          <button
            onClick={() => setActiveTab("create")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === "create"
                ? "bg-[#EAB308] text-[#0A0A0A] shadow-md shadow-[#EAB308]/20"
                : "text-brand-muted hover:bg-brand-bg hover:text-brand-text"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Create Account
          </button>

          <button
            onClick={() => setActiveTab("directory")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === "directory"
                ? "bg-[#EAB308] text-[#0A0A0A] shadow-md shadow-[#EAB308]/20"
                : "text-brand-muted hover:bg-brand-bg hover:text-brand-text"
            }`}
          >
            <Users className="h-4 w-4" />
            Account Directory
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === "security"
                ? "bg-[#EAB308] text-[#0A0A0A] shadow-md shadow-[#EAB308]/20"
                : "text-brand-muted hover:bg-brand-bg hover:text-brand-text"
            }`}
          >
            <Shield className="h-4 w-4" />
            Security
          </button>

          <button
            onClick={() => setActiveTab("approvals")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === "approvals"
                ? "bg-[#EAB308] text-[#0A0A0A] shadow-md shadow-[#EAB308]/20"
                : "text-brand-muted hover:bg-brand-bg hover:text-brand-text"
            }`}
          >
            <Check className="h-4 w-4" />
            Student Approvals
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === "audit"
                ? "bg-[#EAB308] text-[#0A0A0A] shadow-md shadow-[#EAB308]/20"
                : "text-brand-muted hover:bg-brand-bg hover:text-brand-text"
            }`}
          >
            <History className="h-4 w-4" />
            Audit Activity
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === "sync" && <PlatformSyncTab />}
      {activeTab === "profile" && <MyProfileTab currentAdminEmail={currentAdminEmail} />}
      {activeTab === "create" && <CreateAccountTab onAccountCreated={() => setActiveTab("directory")} />}
      {activeTab === "directory" && <AccountDirectoryTab currentAdminId={currentAdminId} />}
      {activeTab === "security" && <SecurityTab currentAdminEmail={currentAdminEmail} />}
      {activeTab === "audit" && <AuditActivityTab />}
      {activeTab === "approvals" && <StudentApprovalsTab />}
    </div>
  );
}

// =============================================================================
// TAB 1: MY PROFILE TAB
// =============================================================================
function MyProfileTab({ currentAdminEmail }: { currentAdminEmail: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [resetSending, setResetSending] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/profile");
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setFullName(data.data.fullName || "");
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Profile updated successfully." });
        fetchProfile();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update profile." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network error occurred." });
    }
    setSaving(false);
  };

  const handleSendResetEmail = async () => {
    if (!profile?.id) return;
    setResetSending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/accounts/${profile.id}/password-reset`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Password reset email sent successfully." });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to send password reset email." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "An error occurred." });
    }
    setResetSending(false);
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-brand-border bg-brand-card p-6">
        <RefreshCw className="h-6 w-6 animate-spin text-[#EAB308]" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Profile Overview Card */}
      <div className="md:col-span-2 rounded-xl border border-brand-border bg-brand-card p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-brand-border pb-4">
          <div>
            <h2 className="text-xl font-bold text-brand-text">Admin Profile</h2>
            <p className="text-xs text-brand-muted">View and update your personal administrator information.</p>
          </div>
          <span className="rounded-full bg-[#EAB308]/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#EAB308] border border-[#EAB308]/20">
            {profile?.role || "ADMIN"}
          </span>
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg border text-xs font-medium ${
              message.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-brand-muted mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-sm text-brand-text focus:border-[#EAB308] focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-brand-muted mb-1">Registered Email (Read Only)</label>
              <input
                type="email"
                value={profile?.email || currentAdminEmail}
                disabled
                className="w-full rounded-lg border border-brand-border/60 bg-brand-bg/50 px-4 py-2.5 text-sm text-brand-muted cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-brand-muted mb-1">Account Status (Read Only)</label>
              <input
                type="text"
                value={profile?.status || "ACTIVE"}
                disabled
                className="w-full rounded-lg border border-brand-border/60 bg-brand-bg/50 px-4 py-2.5 text-sm text-brand-muted cursor-not-allowed font-mono uppercase"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#EAB308] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0A0A0A] hover:bg-[#F59E0B] disabled:opacity-50 cursor-pointer shadow-md shadow-[#EAB308]/10"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* Account Details & Security Actions */}
      <div className="space-y-6">
        <div className="rounded-xl border border-brand-border bg-brand-card p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-brand-text border-b border-brand-border pb-3">
            Account Timestamps
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-brand-muted block">Created Date:</span>
              <span className="font-semibold text-brand-text">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleString() : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-brand-muted block">Last Login:</span>
              <span className="font-semibold text-brand-text">
                {profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : "Never"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-brand-border bg-brand-card p-6 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-brand-text border-b border-brand-border pb-3">
            Quick Actions
          </h3>

          <button
            onClick={handleSendResetEmail}
            disabled={resetSending}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-text hover:border-[#EAB308]/40 hover:text-[#EAB308] disabled:opacity-50 cursor-pointer"
          >
            <Mail className="h-4 w-4" />
            {resetSending ? "Sending..." : "Send Password Reset Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 2: CREATE ACCOUNT TAB
// =============================================================================
function CreateAccountTab({ onAccountCreated }: { onAccountCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.GK_SIR);
  const [departmentId, setDepartmentId] = useState("CSE");
  const [rollNumber, setRollNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<AccountStatus>(AccountStatus.ACTIVE);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Admin Confirmation Modal state
  const [showAdminConfirmModal, setShowAdminConfirmModal] = useState(false);
  const [adminConfirmText, setAdminConfirmText] = useState("");

  const departments = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "DATA_SCIENCE"];

  const generateStrongPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=";
    let pwd = "";
    // Guaranteed uppercase, lowercase, digit, symbol
    pwd += "ABC"[Math.floor(Math.random() * 3)];
    pwd += "xyz"[Math.floor(Math.random() * 3)];
    pwd += "789"[Math.floor(Math.random() * 3)];
    pwd += "!@#"[Math.floor(Math.random() * 3)];

    for (let i = 4; i < 16; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Shuffle
    pwd = pwd.split("").sort(() => 0.5 - Math.random()).join("");
    setPassword(pwd);
    setConfirmPassword(pwd);
  };

  const handleCopyPassword = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (role === UserRole.ADMIN) {
      setShowAdminConfirmModal(true);
    } else {
      executeProvisioning();
    }
  };

  const executeProvisioning = async (adminConfirmationText?: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/accounts/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          role,
          departmentId: role === UserRole.HOD ? departmentId : undefined,
          rollNumber: role === UserRole.STUDENT ? rollNumber : undefined,
          password,
          confirmPassword,
          status,
          adminConfirmation: adminConfirmationText,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Account successfully created for ${email}.`);
        // Immediate password cleanup
        setPassword("");
        setConfirmPassword("");
        setFullName("");
        setEmail("");
        setRollNumber("");
        setShowAdminConfirmModal(false);
        setAdminConfirmText("");
      } else {
        setError(data.error || "Failed to create account.");
      }
    } catch (err) {
      setError("An error occurred during account creation.");
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-brand-border bg-brand-card p-6 md:p-8 space-y-6">
      <div className="border-b border-brand-border pb-4">
        <h2 className="text-xl font-bold text-brand-text">Create New Account</h2>
        <p className="text-xs text-brand-muted">
          Provision authenticated access for Administrators, GK_SIR, Department HODs, or Students.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-400 flex items-center justify-between">
          <span>{success}</span>
          <button
            onClick={onAccountCreated}
            className="rounded bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
          >
            View Directory
          </button>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase text-brand-muted mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Dr. Mohammed Younus"
              className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-sm text-brand-text focus:border-[#EAB308] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-brand-muted mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mohammedyounusshariff@aceec.ac.in"
              className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-sm text-brand-text focus:border-[#EAB308] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-bold uppercase text-brand-muted mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-sm text-brand-text focus:border-[#EAB308] focus:outline-none cursor-pointer"
            >
              <option value="GK_SIR">GK_SIR (Institution Leader)</option>
              <option value="HOD">HOD (Department Head)</option>
              <option value="ADMIN">ADMIN (Full Control)</option>
              <option value="STUDENT">STUDENT (Student Access)</option>
            </select>
          </div>

          {role === UserRole.HOD && (
            <div>
              <label className="block text-xs font-bold uppercase text-brand-muted mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-sm text-brand-text focus:border-[#EAB308] focus:outline-none cursor-pointer"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {role === UserRole.STUDENT && (
            <div>
              <label className="block text-xs font-bold uppercase text-brand-muted mb-1">Roll Number</label>
              <input
                type="text"
                required
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="21241A0501"
                className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-sm text-brand-text uppercase focus:border-[#EAB308] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-brand-muted mb-1">Account Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AccountStatus)}
              className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-sm text-brand-text focus:border-[#EAB308] focus:outline-none cursor-pointer"
            >
              <option value="ACTIVE">ACTIVE (Immediate Access)</option>
              <option value="PENDING">PENDING (Requires Activation)</option>
            </select>
          </div>
        </div>

        {/* Temporary Password Section */}
        <div className="rounded-xl border border-brand-border bg-brand-bg/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase text-brand-muted">Temporary Password Setup</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={generateStrongPassword}
                className="text-xs font-bold text-[#EAB308] hover:underline cursor-pointer flex items-center gap-1"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Generate Strong
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Temporary Password (min 12 chars)"
                className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 pr-10 text-sm text-brand-text focus:border-[#EAB308] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-brand-muted hover:text-brand-text cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Temporary Password"
                className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-sm text-brand-text focus:border-[#EAB308] focus:outline-none"
              />
            </div>
          </div>

          {password && (
            <div className="flex items-center justify-between pt-2 border-t border-brand-border/40 text-xs">
              <span className="text-brand-muted">
                Requirements: 12+ chars, uppercase, lowercase, digit, symbol.
              </span>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="flex items-center gap-1 font-bold text-[#EAB308] hover:underline cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy Password"}
              </button>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-brand-border flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#EAB308] px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#0A0A0A] hover:bg-[#F59E0B] disabled:opacity-50 cursor-pointer shadow-lg shadow-[#EAB308]/20"
          >
            {loading ? "Provisioning..." : `Create ${role} Account`}
          </button>
        </div>
      </form>

      {/* Admin Confirmation Modal */}
      {showAdminConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-brand-card p-6 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-rose-500">
              <ShieldAlert className="h-7 w-7" />
              <h3 className="text-lg font-bold text-brand-text">Confirm Admin Elevation</h3>
            </div>

            <p className="text-xs text-brand-muted leading-relaxed">
              You are granting full administrative access to this account. Admin users have total control over all platform records, security settings, and permissions.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase text-brand-muted mb-2">
                Type <span className="text-rose-400 font-mono">GRANT ADMIN ACCESS</span> to confirm:
              </label>
              <input
                type="text"
                value={adminConfirmText}
                onChange={(e) => setAdminConfirmText(e.target.value)}
                placeholder="GRANT ADMIN ACCESS"
                className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-sm font-mono text-brand-text focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAdminConfirmModal(false);
                  setAdminConfirmText("");
                }}
                className="rounded-lg border border-brand-border px-4 py-2 text-xs font-bold uppercase text-brand-muted hover:text-brand-text cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adminConfirmText !== "GRANT ADMIN ACCESS" || loading}
                onClick={() => executeProvisioning("GRANT ADMIN ACCESS")}
                className="rounded-lg bg-rose-600 px-5 py-2 text-xs font-bold uppercase text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-lg shadow-rose-600/20"
              >
                Confirm & Create Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TAB 3: ACCOUNT DIRECTORY TAB
// =============================================================================
function AccountDirectoryTab({ currentAdminId }: { currentAdminId: string }) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [viewAccount, setViewAccount] = useState<any | null>(null);
  const [changeRoleAccount, setChangeRoleAccount] = useState<any | null>(null);
  const [newRole, setNewRole] = useState<UserRole>(UserRole.GK_SIR);
  const [adminRoleConfirmText, setAdminRoleConfirmText] = useState("");

  const [auditLogAccount, setAuditLogAccount] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const departments = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "DATA_SCIENCE"];

  useEffect(() => {
    fetchAccounts();
  }, [page, limit, search, roleFilter, statusFilter, deptFilter]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.append("search", search);
      if (roleFilter) params.append("role", roleFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (deptFilter) params.append("departmentId", deptFilter);

      const res = await fetch(`/api/admin/access/accounts?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data.items);
        setTotalPages(data.data.totalPages);
        setTotalCount(data.data.total);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleStatusChange = async (account: any, newStatus: string) => {
    if (account.id === currentAdminId) {
      setActionMessage({ type: "error", text: "You cannot suspend or disable your own account." });
      return;
    }

    const actionText = newStatus === "DISABLED" ? "disable" : newStatus === "SUSPENDED" ? "suspend" : "restore";
    if (!confirm(`Are you sure you want to ${actionText} access for ${account.email}?`)) return;

    try {
      const res = await fetch(`/api/admin/access/accounts/${account.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: "success", text: `Account status updated for ${account.email}.` });
        fetchAccounts();
      } else {
        setActionMessage({ type: "error", text: data.error || "Failed to update status." });
      }
    } catch (err) {
      setActionMessage({ type: "error", text: "An error occurred." });
    }
  };

  const handleSendResetEmail = async (account: any) => {
    if (!confirm(`Send password reset email to ${account.email}?`)) return;
    try {
      const res = await fetch(`/api/admin/accounts/${account.id}/password-reset`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: "success", text: `Password reset email sent to ${account.email}.` });
      } else {
        setActionMessage({ type: "error", text: data.error || "Failed to send password reset email." });
      }
    } catch (err) {
      setActionMessage({ type: "error", text: "Network error occurred." });
    }
  };

  const handleRepairLink = async (account: any) => {
    if (!confirm(`Repair account link for ${account.email}?`)) return;
    try {
      const res = await fetch(`/api/admin/accounts/${account.id}/repair`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: "success", text: `Account link repaired for ${account.email}.` });
        fetchAccounts();
      } else {
        setActionMessage({ type: "error", text: data.error || "Failed to repair link." });
      }
    } catch (err) {
      setActionMessage({ type: "error", text: "An error occurred." });
    }
  };

  const handleChangeRoleSubmit = async () => {
    if (!changeRoleAccount) return;
    try {
      const res = await fetch(`/api/admin/accounts/${changeRoleAccount.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: newRole,
          adminConfirmation: adminRoleConfirmText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: "success", text: `Role updated for ${changeRoleAccount.email}.` });
        setChangeRoleAccount(null);
        setAdminRoleConfirmText("");
        fetchAccounts();
      } else {
        setActionMessage({ type: "error", text: data.error || "Failed to change role." });
      }
    } catch (err) {
      setActionMessage({ type: "error", text: "An error occurred." });
    }
  };

  const handleViewAuditHistory = async (account: any) => {
    setAuditLogAccount(account);
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/admin/accounts/${account.id}/audit`);
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.data.items);
      }
    } catch (err) {
      console.error(err);
    }
    setAuditLoading(false);
  };

  return (
    <div className="space-y-6">
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
            actionMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-brand-muted hover:text-brand-text">
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="rounded-xl border border-brand-border bg-brand-card p-4 space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-brand-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Name, Email, or Roll Number..."
              className="w-full rounded-lg border border-brand-border bg-brand-bg pl-10 pr-4 py-2 text-xs text-brand-text focus:border-[#EAB308] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-xs text-brand-text focus:border-[#EAB308] focus:outline-none cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="GK_SIR">GK_SIR</option>
              <option value="HOD">HOD</option>
              <option value="STUDENT">STUDENT</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-xs text-brand-text focus:border-[#EAB308] focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="DISABLED">DISABLED</option>
            </select>

            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-xs text-brand-text focus:border-[#EAB308] focus:outline-none cursor-pointer"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="rounded-xl border border-brand-border bg-brand-card overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-[#EAB308]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-brand-border bg-brand-bg/80 text-brand-muted uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Full Name & Email</th>
                  <th className="px-4 py-3">Login ID</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Dept / Roll No</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-brand-muted">
                      No matching accounts found.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-brand-bg/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-brand-text">{acc.fullName}</div>
                        <div className="text-[11px] text-brand-muted">{acc.email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-brand-muted">{acc.loginId}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-md px-2.5 py-1 text-[10px] font-bold uppercase border ${
                            acc.role === "ADMIN"
                              ? "bg-[#EAB308]/10 text-[#EAB308] border-[#EAB308]/30"
                              : acc.role === "GK_SIR"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                              : acc.role === "HOD"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {acc.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-md px-2.5 py-1 text-[10px] font-bold uppercase border ${
                            acc.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : acc.status === "PENDING"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : acc.status === "SUSPENDED"
                              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {acc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        {acc.rollNumber || acc.department || "—"}
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        {acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => setViewAccount(acc)}
                          className="rounded p-1.5 text-brand-muted hover:text-brand-text hover:bg-brand-bg cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {acc.id !== currentAdminId && (
                          <>
                            {acc.status === "ACTIVE" || acc.status === "PENDING" ? (
                              <button
                                onClick={() => handleStatusChange(acc, "SUSPENDED")}
                                className="rounded px-2 py-1 text-[10px] font-bold text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 cursor-pointer"
                              >
                                Suspend
                              </button>
                            ) : null}

                            {acc.status !== "DISABLED" ? (
                              <button
                                onClick={() => handleStatusChange(acc, "DISABLED")}
                                className="rounded px-2 py-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 cursor-pointer"
                              >
                                Disable
                              </button>
                            ) : null}

                            {acc.status === "SUSPENDED" || acc.status === "DISABLED" ? (
                              <button
                                onClick={() => handleStatusChange(acc, "RESTORE")}
                                className="rounded px-2 py-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer"
                              >
                                Activate
                              </button>
                            ) : null}
                          </>
                        )}

                        <button
                          onClick={() => handleSendResetEmail(acc)}
                          className="rounded p-1.5 text-brand-muted hover:text-[#EAB308] hover:bg-brand-bg cursor-pointer"
                          title="Send Password Reset Email"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setChangeRoleAccount(acc);
                            setNewRole(acc.role);
                          }}
                          className="rounded p-1.5 text-brand-muted hover:text-[#EAB308] hover:bg-brand-bg cursor-pointer"
                          title="Change Role"
                        >
                          <Shield className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleViewAuditHistory(acc)}
                          className="rounded p-1.5 text-brand-muted hover:text-brand-text hover:bg-brand-bg cursor-pointer"
                          title="Audit History"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-brand-border bg-brand-bg/50 px-4 py-3 text-xs">
          <span className="text-brand-muted">
            Showing {accounts.length} of {totalCount} records
          </span>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded border border-brand-border p-1 text-brand-muted hover:text-brand-text disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-brand-text font-bold">
              {page} / {totalPages || 1}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded border border-brand-border p-1 text-brand-muted hover:text-brand-text disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      {viewAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-brand-border bg-brand-card p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h3 className="text-lg font-bold text-brand-text">Account Details</h3>
              <button onClick={() => setViewAccount(null)} className="text-brand-muted hover:text-brand-text">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-brand-muted block">Full Name:</span>
                  <span className="font-bold text-brand-text text-sm">{viewAccount.fullName}</span>
                </div>
                <div>
                  <span className="text-brand-muted block">Role:</span>
                  <span className="font-bold text-[#EAB308]">{viewAccount.role}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-brand-muted block">Registered Email:</span>
                  <span className="font-mono text-brand-text">{viewAccount.email}</span>
                </div>
                <div>
                  <span className="text-brand-muted block">Login ID:</span>
                  <span className="font-mono text-brand-text">{viewAccount.loginId}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-brand-muted block">Account Status:</span>
                  <span className="font-bold uppercase text-emerald-400">{viewAccount.status}</span>
                </div>
                <div>
                  <span className="text-brand-muted block">Department / Roll:</span>
                  <span className="font-semibold text-brand-text">{viewAccount.rollNumber || viewAccount.department || "N/A"}</span>
                </div>
              </div>

              <div className="border-t border-brand-border pt-3 space-y-2">
                <div>
                  <span className="text-brand-muted block">Supabase Auth User ID:</span>
                  <span className="font-mono text-[11px] text-brand-muted">{viewAccount.authUserId || "NOT_LINKED"}</span>
                </div>
                <div>
                  <span className="text-brand-muted block">Created At:</span>
                  <span className="text-brand-text">{new Date(viewAccount.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewAccount(null)}
                className="rounded-lg bg-[#EAB308] px-5 py-2 text-xs font-bold uppercase text-[#0A0A0A] hover:bg-[#F59E0B] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {changeRoleAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-card p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h3 className="text-lg font-bold text-brand-text">Change User Role</h3>
              <button onClick={() => setChangeRoleAccount(null)} className="text-brand-muted hover:text-brand-text">
                ✕
              </button>
            </div>

            <p className="text-xs text-brand-muted">
              Updating authorization role for <strong className="text-brand-text">{changeRoleAccount.email}</strong>. Current role: <span className="text-[#EAB308]">{changeRoleAccount.role}</span>.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase text-brand-muted mb-2">Select New Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-2.5 text-xs text-brand-text focus:border-[#EAB308] focus:outline-none cursor-pointer"
              >
                <option value="GK_SIR">GK_SIR</option>
                <option value="HOD">HOD</option>
                <option value="ADMIN">ADMIN</option>
                <option value="STUDENT">STUDENT</option>
              </select>
            </div>

            {newRole === UserRole.ADMIN && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 space-y-2">
                <p className="text-xs font-bold text-rose-400">
                  Elevating to ADMIN grants total administrative power.
                </p>
                <label className="block text-[11px] uppercase font-bold text-brand-muted">
                  Type <span className="text-rose-400 font-mono">GRANT ADMIN ACCESS</span>:
                </label>
                <input
                  type="text"
                  value={adminRoleConfirmText}
                  onChange={(e) => setAdminRoleConfirmText(e.target.value)}
                  placeholder="GRANT ADMIN ACCESS"
                  className="w-full rounded border border-brand-border bg-brand-bg px-3 py-2 text-xs font-mono text-brand-text focus:border-rose-500 focus:outline-none"
                />
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setChangeRoleAccount(null)}
                className="rounded-lg border border-brand-border px-4 py-2 text-xs font-bold uppercase text-brand-muted hover:text-brand-text cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={newRole === UserRole.ADMIN && adminRoleConfirmText !== "GRANT ADMIN ACCESS"}
                onClick={handleChangeRoleSubmit}
                className="rounded-lg bg-[#EAB308] px-5 py-2 text-xs font-bold uppercase text-[#0A0A0A] hover:bg-[#F59E0B] disabled:opacity-50 cursor-pointer"
              >
                Save New Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit History Modal */}
      {auditLogAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-brand-border bg-brand-card p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h3 className="text-lg font-bold text-brand-text">
                Audit History: {auditLogAccount.email}
              </h3>
              <button onClick={() => setAuditLogAccount(null)} className="text-brand-muted hover:text-brand-text">
                ✕
              </button>
            </div>

            {auditLoading ? (
              <div className="flex h-32 items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-[#EAB308]" />
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-3 pr-2 text-xs">
                {auditLogs.length === 0 ? (
                  <p className="text-center text-brand-muted py-6">No audit records found for this account.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-brand-border bg-brand-bg/60 p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#EAB308] text-[11px]">{log.action}</span>
                        <span className="text-[10px] text-brand-muted">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-brand-muted text-[11px]">Actor: {log.actorUserId || "System"}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAuditLogAccount(null)}
                className="rounded-lg bg-[#EAB308] px-5 py-2 text-xs font-bold uppercase text-[#0A0A0A] hover:bg-[#F59E0B] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TAB 4: SECURITY TAB
// =============================================================================
function SecurityTab({ currentAdminEmail }: { currentAdminEmail: string }) {
  const [resetSent, setResetSent] = useState(false);

  const handleSelfPasswordReset = async () => {
    try {
      const res = await fetch("/api/admin/profile");
      const data = await res.json();
      if (data.success && data.data.id) {
        await fetch(`/api/admin/accounts/${data.data.id}/password-reset`, { method: "POST" });
        setResetSent(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Password Security Rules */}
        <div className="rounded-xl border border-brand-border bg-brand-card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-brand-border pb-3">
            <Lock className="h-5 w-5 text-[#EAB308]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-text">
              Platform Password Policy
            </h3>
          </div>

          <ul className="space-y-2 text-xs text-brand-muted">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" /> Minimum 12 characters required
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" /> At least one uppercase letter (A-Z)
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" /> At least one lowercase letter (a-z)
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" /> At least one numeric digit (0-9)
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" /> At least one special symbol (!@#$%^&*)
            </li>
          </ul>
        </div>

        {/* Security Actions */}
        <div className="rounded-xl border border-brand-border bg-brand-card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-brand-border pb-3">
            <Shield className="h-5 w-5 text-[#EAB308]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-text">
              Account Security Controls
            </h3>
          </div>

          <p className="text-xs text-brand-muted">
            Logged in as <strong className="text-brand-text">{currentAdminEmail}</strong>. You can trigger a password recovery link sent directly to your registered address.
          </p>

          {resetSent ? (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-400 font-medium">
              Password reset link has been dispatched to your email.
            </div>
          ) : (
            <button
              onClick={handleSelfPasswordReset}
              className="rounded-lg bg-[#EAB308] px-5 py-2.5 text-xs font-bold uppercase text-[#0A0A0A] hover:bg-[#F59E0B] cursor-pointer"
            >
              Reset My Password
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 5: AUDIT ACTIVITY TAB
// =============================================================================
function AuditActivityTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/access/audit");
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.items);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="rounded-xl border border-brand-border bg-brand-card p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-brand-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-brand-text">System Audit Activity</h2>
          <p className="text-xs text-brand-muted">Comprehensive log of administrative and access events.</p>
        </div>

        <button
          onClick={fetchAuditLogs}
          disabled={loading}
          className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-xs font-bold uppercase text-brand-text hover:border-[#EAB308]/40 hover:text-[#EAB308] cursor-pointer flex items-center gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-[#EAB308]" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-brand-border bg-brand-bg/80 text-brand-muted uppercase font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3">Event Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Actor ID</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-brand-muted">
                    No audit records recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-brand-bg/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#EAB308] text-[11px]">{log.action}</td>
                    <td className="px-4 py-3 font-mono text-brand-muted text-[11px]">
                      {log.targetType || "System"} {log.targetId ? `(${log.targetId})` : ""}
                    </td>
                    <td className="px-4 py-3 font-mono text-brand-muted text-[11px]">{log.actorUserId || "System"}</td>
                    <td className="px-4 py-3 text-brand-muted">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-brand-muted max-w-xs truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TAB 6: PLATFORM VERIFICATION & SYNC TAB
// =============================================================================
function PlatformSyncTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showQueueWarning, setShowQueueWarning] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newlyQueuedCount, setNewlyQueuedCount] = useState<number | null>(null);
  const [failedProfiles, setFailedProfiles] = useState<any[]>([]);
  const [showFailedModal, setShowFailedModal] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bulk-sync");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setFailedProfiles(data.failedProfiles || []);
      }
    } catch (e) {
      console.error("Failed to fetch queue stats:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleAction = async (action: string, payload: any = {}) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/bulk-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: "success", text: data.message });
        setStats(data.stats);
        setFailedProfiles(data.failedProfiles || []);
        if (action === "queue-all-pending" && data.result) {
          setNewlyQueuedCount(data.result.newlyQueued);
        }
      } else {
        setMessage({ type: "error", text: data.error || "Action failed." });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Network error occurred." });
    } finally {
      setActionLoading(false);
      setShowQueueWarning(false);
    }
  };

  const openFailedModal = async () => {
    setActionLoading(true);
    await fetchStats();
    setActionLoading(false);
    setShowFailedModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Warning Modal */}
      {showQueueWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-brand-card border border-brand-border rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-bold text-brand-text">Confirm Bulk Queue</h3>
            </div>
            <p className="text-xs text-brand-muted leading-relaxed">
              This will queue all students with both CodeChef and LeetCode profiles. Verification will run in controlled batches with a maximum concurrency of 2.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowQueueWarning(false)}
                className="px-4 py-2 rounded-lg border border-brand-border text-xs font-bold uppercase text-brand-muted hover:text-brand-text cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction("queue-all-pending")}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-[#EAB308] text-black text-xs font-bold uppercase hover:bg-amber-400 transition-colors cursor-pointer"
              >
                {actionLoading ? "Queueing..." : "Confirm Queue All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Failed Profiles Modal */}
      {showFailedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-brand-card border border-brand-border rounded-xl p-6 max-w-4xl w-full space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <div className="flex items-center gap-3 text-rose-400">
                <AlertTriangle className="h-6 w-6 shrink-0" />
                <h3 className="text-lg font-bold text-brand-text">Failed Profiles ({failedProfiles.length})</h3>
              </div>
              <button 
                onClick={() => setShowFailedModal(false)}
                className="text-brand-muted hover:text-brand-text text-sm cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-1">
              {failedProfiles.length === 0 ? (
                <div className="text-center py-8 text-brand-muted text-xs">
                  No failed profiles found. All processed profiles are verified or currently retrying.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-brand-border bg-brand-bg/80 text-brand-muted uppercase font-bold tracking-wider sticky top-0">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Roll Number</th>
                      <th className="px-4 py-2">Department</th>
                      <th className="px-4 py-2">CodeChef</th>
                      <th className="px-4 py-2">LeetCode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {failedProfiles.map((student) => (
                      <tr key={student.id} className="hover:bg-brand-bg/40 transition-colors">
                        <td className="px-4 py-3 font-semibold text-brand-text">{student.name}</td>
                        <td className="px-4 py-3 font-mono text-brand-muted">{student.rollNumber || "—"}</td>
                        <td className="px-4 py-3 text-brand-muted">{student.department || "—"}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">{student.codechefUsername || "—"}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">{student.leetcodeUsername || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="flex justify-end pt-3 border-t border-brand-border">
              <button
                onClick={() => setShowFailedModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-bold uppercase text-zinc-200 hover:bg-zinc-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Status Banner */}
      <div className="rounded-xl border border-brand-border bg-brand-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-4">
          <div>
            <h2 className="text-xl font-bold text-brand-text">Platform Verification & Sync</h2>
            <p className="text-xs text-brand-muted">
              Durable background queue for CodeChef & LeetCode verification of CSV-imported profiles.
            </p>
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-xs font-bold uppercase text-brand-text hover:border-[#EAB308]/40 hover:text-[#EAB308] cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Queue Stats
          </button>
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              message.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Processing Safely Banner */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg text-xs font-medium">
          Processing continues safely in the background. You may close this page.
        </div>

        {/* Queue Progress Bar */}
        {stats && (
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs font-bold text-brand-muted uppercase">
              <span>Verification Progress</span>
              <span className="text-[#EAB308]">{stats.percentageCompleted}% Completed</span>
            </div>
            <div className="w-full bg-brand-bg h-3 rounded-full overflow-hidden border border-brand-border">
              <div
                className="bg-gradient-to-r from-amber-500 to-[#EAB308] h-full transition-all duration-500"
                style={{ width: `${stats.percentageCompleted}%` }}
              />
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
          <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border">
            <div className="text-[10px] text-brand-muted font-bold uppercase">Total Profiles</div>
            <div className="text-lg font-bold text-brand-text mt-1">{stats?.totalProfiles ?? "—"}</div>
          </div>
          <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border">
            <div className="text-[10px] text-brand-muted font-bold uppercase">Eligible Profiles</div>
            <div className="text-lg font-bold text-amber-400 mt-1">{stats?.eligibleProfiles ?? stats?.eligibleForQueue ?? "—"}</div>
          </div>
          <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border">
            <div className="text-[10px] text-brand-muted font-bold uppercase">Newly Queued</div>
            <div className="text-lg font-bold text-[#EAB308] mt-1">{newlyQueuedCount !== null ? newlyQueuedCount : "—"}</div>
          </div>
          <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border">
            <div className="text-[10px] text-brand-muted font-bold uppercase">Queued</div>
            <div className="text-lg font-bold text-sky-400 mt-1">{stats?.queued ?? 0}</div>
          </div>
          <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border">
            <div className="text-[10px] text-brand-muted font-bold uppercase">Processing</div>
            <div className="text-lg font-bold text-indigo-400 mt-1">{stats?.processing ?? 0}</div>
          </div>
          <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border">
            <div className="text-[10px] text-brand-muted font-bold uppercase">Verified</div>
            <div className="text-lg font-bold text-emerald-400 mt-1">{stats?.verified ?? "—"}</div>
          </div>
          <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border">
            <div className="text-[10px] text-brand-muted font-bold uppercase">Incomplete</div>
            <div className="text-lg font-bold text-amber-500 mt-1">{stats?.incomplete ?? "—"}</div>
          </div>
          <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border">
            <div className="text-[10px] text-brand-muted font-bold uppercase">Failed</div>
            <div className="text-lg font-bold text-rose-500 mt-1">{stats?.failed ?? "—"}</div>
          </div>
          <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border">
            <div className="text-[10px] text-brand-muted font-bold uppercase">Retry Pending</div>
            <div className="text-lg font-bold text-[#EAB308] mt-1">{stats?.retryPending ?? 0}</div>
          </div>
          <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border">
            <div className="text-[10px] text-brand-muted font-bold uppercase">Remaining</div>
            <div className="text-lg font-bold text-zinc-400 mt-1">{stats?.remaining ?? "—"}</div>
          </div>
          <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border col-span-2 sm:col-span-1">
            <div className="text-[10px] text-brand-muted font-bold uppercase">Completion</div>
            <div className="text-lg font-bold text-yellow-400 mt-1">{stats?.percentageCompleted ?? 0}%</div>
          </div>
          <div className="bg-brand-bg/60 p-3 rounded-lg border border-brand-border col-span-2 sm:col-span-1">
            <div className="text-[10px] text-brand-muted font-bold uppercase">Last Processed Time</div>
            <div className="text-xs font-bold text-zinc-300 mt-2 truncate">
              {stats?.lastProcessingTime ? new Date(stats.lastProcessingTime).toLocaleString() : "—"}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-brand-border">
          <button
            onClick={() => setShowQueueWarning(true)}
            disabled={actionLoading}
            className="px-4 py-2.5 rounded-lg bg-[#EAB308] text-black text-xs font-bold uppercase hover:bg-amber-400 transition-all cursor-pointer shadow-md shadow-[#EAB308]/20 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Queue All Eligible Students
          </button>

          <button
            onClick={() => handleAction("retry-failed")}
            disabled={actionLoading}
            className="px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold uppercase hover:bg-zinc-700 transition-all cursor-pointer"
          >
            Retry Failed
          </button>

          {stats?.isPaused ? (
            <button
              onClick={() => handleAction("resume")}
              disabled={actionLoading}
              className="px-4 py-2.5 rounded-lg bg-amber-600/30 border border-amber-500/50 text-amber-300 text-xs font-bold uppercase hover:bg-amber-600/40 transition-all cursor-pointer"
            >
              Resume Processing
            </button>
          ) : (
            <button
              onClick={() => handleAction("pause")}
              disabled={actionLoading}
              className="px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold uppercase hover:bg-zinc-700 transition-all cursor-pointer"
            >
              Pause Processing
            </button>
          )}

          <button
            onClick={openFailedModal}
            disabled={actionLoading}
            className="px-4 py-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-200 text-xs font-bold uppercase hover:bg-rose-950/60 transition-all cursor-pointer"
          >
            View Failed Profiles
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TAB 7: STUDENT APPROVALS TAB
// =============================================================================
function StudentApprovalsTab() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Search & Filters State
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [adminApprovalStatus, setAdminApprovalStatus] = useState("");
  const [codechefStatus, setCodechefStatus] = useState("");
  const [leetcodeStatus, setLeetcodeStatus] = useState("");
  const [leaderboardEligible, setLeaderboardEligible] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Aggregated Stats
  const [stats, setStats] = useState<any>(null);

  // Modals state
  const [viewingStudent, setViewingStudent] = useState<any | null>(null);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [noteState, setNoteState] = useState<{ id: string; action: "approve" | "reject" | "revoke"; note: string } | null>(null);

  // Form edit fields
  const [editForm, setEditForm] = useState({
    name: "",
    year: "1",
    branch: "CSE",
    cgpa: "",
    contactNumber: "",
    codechefUsername: "",
    leetcodeUsername: "",
    githubUsername: "",
    codeforcesUsername: "",
    linkedinUrl: ""
  });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const branches = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "DATA_SCIENCE"];

  useEffect(() => {
    fetchData();
  }, [page, search, branch, year, profileStatus, adminApprovalStatus, codechefStatus, leetcodeStatus, leaderboardEligible]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.append("search", search);
      if (branch) params.append("branch", branch);
      if (year) params.append("year", year);
      if (profileStatus) params.append("profileStatus", profileStatus);
      if (adminApprovalStatus) params.append("adminApprovalStatus", adminApprovalStatus);
      if (codechefStatus) params.append("codechefStatus", codechefStatus);
      if (leetcodeStatus) params.append("leetcodeStatus", leetcodeStatus);
      if (leaderboardEligible) params.append("leaderboardEligible", leaderboardEligible);

      const res = await fetch(`/api/admin/student-approvals?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch approvals:", err);
    }
    setLoading(false);
  };

  const handleSingleAction = async (id: string, action: "approve" | "reject" | "revoke", note: string = "") => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/student-approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || `Failed to perform ${action}.`);
      }
    } catch (err) {
      console.error(err);
      alert("Network error occurred.");
    }
    setActionLoading(null);
    setNoteState(null);
  };

  const handleSyncStudent = async (id: string) => {
    setActionLoading(id + "-sync");
    try {
      const res = await fetch(`/api/admin/student-approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" })
      });
      const data = await res.json();
      if (data.success) {
        alert("Verification completed successfully for student.");
        fetchData();
      } else {
        alert(data.error || "Sync execution failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error occurred.");
    }
    setActionLoading(null);
  };

  const handleBulkApprove = async () => {
    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/student-approvals/bulk-approve", {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || "Bulk approval completed.");
        setShowBulkConfirm(false);
        fetchData();
      } else {
        alert(data.error || "Bulk approval failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error occurred.");
    }
    setBulkLoading(false);
  };

  const openEditModal = (student: any) => {
    setEditingStudent(student);
    setEditError("");
    setEditForm({
      name: student.name || "",
      year: student.year?.toString() || "1",
      branch: student.branch || "CSE",
      cgpa: student.cgpa?.toString() || "",
      contactNumber: student.contactNumber || "",
      codechefUsername: student.codechefUsername || "",
      leetcodeUsername: student.leetcodeUsername || "",
      githubUsername: student.githubUsername || "",
      codeforcesUsername: student.codeforcesUsername || "",
      linkedinUrl: student.linkedinUrl || ""
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/admin/students/${editingStudent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          year: parseInt(editForm.year, 10),
          cgpa: editForm.cgpa ? parseFloat(editForm.cgpa) : null
        })
      });
      const data = await res.json();
      if (data.success) {
        setEditingStudent(null);
        fetchData();
      } else {
        setEditError(data.error || "Failed to save student details.");
      }
    } catch (err) {
      setEditError("Network error occurred.");
    }
    setEditSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Aggregates */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-brand-text">Student Approvals Board</h2>
          <p className="text-xs text-brand-muted">Approve, reject, or revoke leaderboard access and view verified student metrics.</p>
        </div>
        <button
          onClick={() => setShowBulkConfirm(true)}
          disabled={!stats?.eligibleForApproval}
          className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-green-600/20"
        >
          Approve All Verified Students
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-brand-border bg-brand-card p-4 rounded-xl">
            <span className="text-[10px] font-black text-brand-muted uppercase tracking-wider block">Eligible for Approval</span>
            <span className="text-xl font-black text-green-400 mt-1 block">{stats.eligibleForApproval}</span>
          </div>
          <div className="border border-brand-border bg-brand-card p-4 rounded-xl">
            <span className="text-[10px] font-black text-brand-muted uppercase tracking-wider block">Approved Students</span>
            <span className="text-xl font-black text-[#22C55E] mt-1 block">{stats.alreadyApproved}</span>
          </div>
          <div className="border border-brand-border bg-brand-card p-4 rounded-xl">
            <span className="text-[10px] font-black text-brand-muted uppercase tracking-wider block">Awaiting Verification</span>
            <span className="text-xl font-black text-amber-500 mt-1 block">{stats.pendingVerification}</span>
          </div>
          <div className="border border-brand-border bg-brand-card p-4 rounded-xl">
            <span className="text-[10px] font-black text-brand-muted uppercase tracking-wider block">Incomplete Profiles</span>
            <span className="text-xl font-black text-zinc-400 mt-1 block">{stats.stillIncomplete}</span>
          </div>
        </div>
      )}

      {/* 2. Advanced Search & Filters */}
      <div className="border border-brand-border bg-brand-card/50 p-4 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-brand-muted">
          <Filter className="h-4 w-4 text-[#EAB308]" />
          <span className="text-xs font-bold uppercase tracking-wider">Search & Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search field */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-brand-muted" />
            <input
              type="text"
              placeholder="Search Student/Roll..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-brand-bg border border-brand-border rounded-xl text-xs text-brand-text focus:outline-none focus:border-[#EAB308]"
            />
          </div>

          {/* Branch filter */}
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-xl text-xs text-brand-text focus:outline-none focus:border-[#EAB308]"
          >
            <option value="">All Branches</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          {/* Year filter */}
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-xl text-xs text-brand-text focus:outline-none focus:border-[#EAB308]"
          >
            <option value="">All Years</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>

          {/* Profile Status filter */}
          <select
            value={profileStatus}
            onChange={(e) => setProfileStatus(e.target.value)}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-xl text-xs text-brand-text focus:outline-none focus:border-[#EAB308]"
          >
            <option value="">All Profile Statuses</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="INCOMPLETE">Incomplete</option>
            <option value="INVALID">Failed / Invalid</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Approval Status filter */}
          <select
            value={adminApprovalStatus}
            onChange={(e) => setAdminApprovalStatus(e.target.value)}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-xl text-xs text-brand-text focus:outline-none focus:border-[#EAB308]"
          >
            <option value="">All Approval Statuses</option>
            <option value="PENDING">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="REVOKED">Revoked Approval</option>
          </select>

          {/* CodeChef verified filter */}
          <select
            value={codechefStatus}
            onChange={(e) => setCodechefStatus(e.target.value)}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-xl text-xs text-brand-text focus:outline-none focus:border-[#EAB308]"
          >
            <option value="">CodeChef Status: Any</option>
            <option value="Verified">Verified Only</option>
            <option value="Pending">Sync Pending</option>
            <option value="Missing">No Username</option>
            <option value="Failed">Failed Only</option>
          </select>

          {/* LeetCode verified filter */}
          <select
            value={leetcodeStatus}
            onChange={(e) => setLeetcodeStatus(e.target.value)}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-xl text-xs text-brand-text focus:outline-none focus:border-[#EAB308]"
          >
            <option value="">LeetCode Status: Any</option>
            <option value="Verified">Verified Only</option>
            <option value="Pending">Sync Pending</option>
            <option value="Missing">No Username</option>
            <option value="Failed">Failed Only</option>
          </select>
        </div>
      </div>

      {/* 3. Students Approvals Table */}
      <div className="border border-brand-border bg-brand-card rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-brand-border bg-brand-bg/50">
                <th className="p-4 text-[10px] font-black text-brand-muted uppercase tracking-wider">Student & Email</th>
                <th className="p-4 text-[10px] font-black text-brand-muted uppercase tracking-wider">Roll Number</th>
                <th className="p-4 text-[10px] font-black text-brand-muted uppercase tracking-wider">Branch/Year</th>
                <th className="p-4 text-[10px] font-black text-brand-muted uppercase tracking-wider">Platforms</th>
                <th className="p-4 text-[10px] font-black text-brand-muted uppercase tracking-wider text-center">Profile Status</th>
                <th className="p-4 text-[10px] font-black text-brand-muted uppercase tracking-wider text-center">Approval</th>
                <th className="p-4 text-[10px] font-black text-brand-muted uppercase tracking-wider text-center font-bold">Eligibility</th>
                <th className="p-4 text-[10px] font-black text-brand-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="h-7 w-7 text-[#EAB308] animate-spin" />
                      <span className="text-xs text-brand-muted uppercase font-bold tracking-widest">Loading student approvals...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-xs text-brand-muted font-bold uppercase tracking-wider">
                    No student profiles matched the filter criteria.
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const verified = student.codechefStatus === "Verified" && student.leetcodeStatus === "Verified";
                  return (
                    <tr key={student.id} className="border-b border-brand-border/60 hover:bg-brand-bg/25 transition-all">
                      <td className="p-4">
                        <div className="font-bold text-sm text-brand-text leading-tight">{student.name}</div>
                        <div className="text-[10px] text-brand-muted mt-0.5">{student.email}</div>
                      </td>
                      <td className="p-4 text-xs font-mono font-bold text-brand-text">{student.rollNumber}</td>
                      <td className="p-4 text-xs text-brand-muted uppercase font-bold">
                        {student.branch} / Y{student.year}
                      </td>
                      <td className="p-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="w-16 font-bold text-brand-muted uppercase tracking-wider text-[8px]">CodeChef:</span>
                          <span className={`px-1.5 py-0.5 rounded-full font-black text-[8px] uppercase tracking-wider ${
                            student.codechefStatus === "Verified" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                            student.codechefStatus === "Pending" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" :
                            student.codechefStatus === "Failed" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                            "bg-zinc-800 text-zinc-500 border border-zinc-700"
                          }`}>{student.codechefStatus}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="w-16 font-bold text-brand-muted uppercase tracking-wider text-[8px]">LeetCode:</span>
                          <span className={`px-1.5 py-0.5 rounded-full font-black text-[8px] uppercase tracking-wider ${
                            student.leetcodeStatus === "Verified" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                            student.leetcodeStatus === "Pending" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" :
                            student.leetcodeStatus === "Failed" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                            "bg-zinc-800 text-zinc-500 border border-zinc-700"
                          }`}>{student.leetcodeStatus}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest ${
                          student.profileStatus === "VERIFIED" ? "bg-green-600/20 text-green-400 border border-green-600/30" :
                          student.profileStatus === "PENDING_VERIFICATION" ? "bg-amber-600/20 text-amber-400 border border-amber-600/30" :
                          student.profileStatus === "INCOMPLETE" ? "bg-zinc-800 text-zinc-400 border border-zinc-700" :
                          "bg-rose-950/30 text-rose-400 border border-rose-900/30"
                        }`}>{student.profileStatus}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest ${
                          student.adminApprovalStatus === "APPROVED" ? "bg-green-500 text-black shadow-md shadow-green-500/10" :
                          student.adminApprovalStatus === "REJECTED" ? "bg-red-900/40 text-red-400 border border-red-800/40" :
                          student.adminApprovalStatus === "REVOKED" ? "bg-amber-950/40 text-amber-400 border border-amber-900/40" :
                          "bg-zinc-800 text-zinc-400 border border-zinc-700"
                        }`}>{student.adminApprovalStatus || "PENDING"}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-center">
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] font-bold text-brand-muted uppercase">LBoard:</span>
                            <span className={`text-[9px] font-black ${student.leaderboardEligible ? "text-green-400" : "text-zinc-500"}`}>
                              {student.leaderboardEligible ? "YES" : "NO"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] font-bold text-brand-muted uppercase">Dash:</span>
                            <span className={`text-[9px] font-black ${student.dashboardEligible ? "text-green-400" : "text-zinc-500"}`}>
                              {student.dashboardEligible ? "YES" : "NO"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => setViewingStudent(student)}
                            className="p-1.5 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text hover:bg-brand-bg transition-all cursor-pointer"
                            title="View Profile"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          
                          <button
                            onClick={() => openEditModal(student)}
                            className="px-2 py-1.5 rounded-lg border border-brand-border text-xs font-bold text-brand-muted hover:text-[#EAB308] hover:bg-brand-bg transition-all cursor-pointer"
                            title="Edit Details"
                          >
                            Edit
                          </button>

                          <button
                            disabled={actionLoading === student.id + "-sync" || actionLoading === student.id}
                            onClick={() => handleSyncStudent(student.id)}
                            className="px-2 py-1.5 rounded-lg border border-brand-border text-xs font-bold text-brand-muted hover:text-blue-400 hover:bg-brand-bg transition-all cursor-pointer disabled:opacity-50"
                            title="Verify/Sync"
                          >
                            {actionLoading === student.id + "-sync" ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : "Sync"}
                          </button>

                          {student.adminApprovalStatus === "APPROVED" ? (
                            <button
                              disabled={!!actionLoading}
                              onClick={() => setNoteState({ id: student.id, action: "revoke", note: "" })}
                              className="px-2 py-1.5 bg-amber-600 hover:bg-amber-700 text-black text-xs font-black uppercase rounded-lg transition-all cursor-pointer disabled:opacity-50"
                              title="Revoke Approval"
                            >
                              Revoke
                            </button>
                          ) : (
                            <>
                              <button
                                disabled={!verified || !!actionLoading}
                                onClick={() => setNoteState({ id: student.id, action: "approve", note: "" })}
                                className="px-2 py-1.5 bg-[#22C55E] hover:bg-green-600 disabled:bg-zinc-800 disabled:text-zinc-600 border border-transparent disabled:border-zinc-700 text-black text-xs font-black uppercase rounded-lg transition-all cursor-pointer disabled:opacity-50"
                                title={!verified ? "Both CodeChef and LeetCode profiles must be verified before approval." : "Approve student"}
                              >
                                Approve
                              </button>

                              <button
                                disabled={!!actionLoading}
                                onClick={() => setNoteState({ id: student.id, action: "reject", note: "" })}
                                className="px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase rounded-lg transition-all cursor-pointer disabled:opacity-50"
                                title="Reject student"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-brand-border bg-brand-bg/30 flex items-center justify-between">
            <span className="text-xs text-brand-muted">
              Showing page <strong className="text-brand-text">{page}</strong> of <strong className="text-brand-text">{totalPages}</strong> ({totalCount} students)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-2 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-2 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: VIEW STUDENT PROFILE DETAILS */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-brand-border bg-brand-card p-6 shadow-2xl space-y-6 relative">
            <button
              onClick={() => setViewingStudent(null)}
              className="absolute right-4 top-4 text-brand-muted hover:text-brand-text cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <div>
              <h3 className="text-lg font-black text-brand-text">{viewingStudent.name}</h3>
              <p className="text-xs text-brand-muted font-mono">{viewingStudent.rollNumber}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="block text-[9px] uppercase font-bold text-brand-muted">Email Address</span>
                <span className="text-brand-text font-medium">{viewingStudent.email}</span>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-brand-muted">Branch / Year</span>
                <span className="text-brand-text font-bold uppercase">{viewingStudent.branch} / Year {viewingStudent.year}</span>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-brand-muted">CodeChef Handle</span>
                <span className="text-brand-text font-mono">{viewingStudent.codechefUsername || "Not configured"}</span>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-brand-muted">LeetCode Handle</span>
                <span className="text-brand-text font-mono">{viewingStudent.leetcodeUsername || "Not configured"}</span>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-brand-muted">Profile Status</span>
                <span className="text-brand-text font-bold uppercase text-[#EAB308]">{viewingStudent.profileStatus}</span>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-brand-muted">Approval Status</span>
                <span className="text-brand-text font-bold uppercase text-[#22C55E]">{viewingStudent.adminApprovalStatus || "PENDING"}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-brand-border flex justify-end">
              <button
                onClick={() => setViewingStudent(null)}
                className="px-4 py-2 border border-brand-border rounded-lg text-xs font-bold uppercase tracking-wider text-brand-muted hover:text-brand-text cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT STUDENT PROFILE DETAILS */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-brand-border bg-brand-card p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h3 className="text-base font-black text-brand-text">Edit Student Profile Details</h3>
              <button onClick={() => setEditingStudent(null)} className="text-brand-muted hover:text-brand-text cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-red-950/40 border border-red-800/40 text-red-200 text-xs font-bold uppercase rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">Student Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">CGPA (0 to 10)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={editForm.cgpa}
                    onChange={(e) => setEditForm(prev => ({ ...prev, cgpa: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">Branch *</label>
                  <select
                    value={editForm.branch}
                    onChange={(e) => setEditForm(prev => ({ ...prev, branch: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none"
                  >
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">Year of Study *</label>
                  <select
                    value={editForm.year}
                    onChange={(e) => setEditForm(prev => ({ ...prev, year: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none"
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">CodeChef Handle or URL</label>
                  <input
                    type="text"
                    value={editForm.codechefUsername}
                    onChange={(e) => setEditForm(prev => ({ ...prev, codechefUsername: e.target.value }))}
                    placeholder="https://www.codechef.com/users/username"
                    className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">LeetCode Handle or URL</label>
                  <input
                    type="text"
                    value={editForm.leetcodeUsername}
                    onChange={(e) => setEditForm(prev => ({ ...prev, leetcodeUsername: e.target.value }))}
                    placeholder="https://leetcode.com/username"
                    className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">GitHub Handle or URL</label>
                  <input
                    type="text"
                    value={editForm.githubUsername}
                    onChange={(e) => setEditForm(prev => ({ ...prev, githubUsername: e.target.value }))}
                    placeholder="username"
                    className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">Codeforces Username</label>
                  <input
                    type="text"
                    value={editForm.codeforcesUsername}
                    onChange={(e) => setEditForm(prev => ({ ...prev, codeforcesUsername: e.target.value }))}
                    placeholder="username"
                    className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold text-brand-muted mb-1">LinkedIn URL</label>
                  <input
                    type="text"
                    value={editForm.linkedinUrl}
                    onChange={(e) => setEditForm(prev => ({ ...prev, linkedinUrl: e.target.value }))}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-brand-border flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 border border-brand-border rounded-lg text-xs font-bold uppercase text-brand-muted hover:text-brand-text cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 py-2 bg-[#EAB308] text-black text-xs font-bold uppercase rounded-lg hover:bg-amber-400 transition-all cursor-pointer disabled:opacity-50"
                >
                  {editSaving ? "Saving..." : "Save Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADMIN ACTION NOTE DIALOG (APPROVE / REJECT / REVOKE) */}
      {noteState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-brand-border">
              <h3 className="text-sm font-black text-brand-text uppercase tracking-wider">
                Confirm Approval Action: {noteState.action}
              </h3>
              <button onClick={() => setNoteState(null)} className="text-brand-muted hover:text-brand-text cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-xs text-brand-muted">
              Add any optional notes or reasons for this administrative change.
            </p>

            <textarea
              value={noteState.note}
              onChange={(e) => setNoteState(prev => prev ? { ...prev, note: e.target.value } : null)}
              placeholder="e.g. Profile verified, student cleared."
              rows={3}
              className="w-full p-3 bg-brand-bg border border-brand-border rounded-xl text-xs text-brand-text focus:outline-none focus:border-[#EAB308]"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setNoteState(null)}
                className="px-4 py-2 border border-brand-border rounded-lg text-xs font-bold uppercase text-brand-muted hover:text-brand-text cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSingleAction(noteState.id, noteState.action, noteState.note)}
                className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-black transition-all cursor-pointer ${
                  noteState.action === "approve" ? "bg-green-500 hover:bg-green-600" :
                  noteState.action === "reject" ? "bg-red-600 hover:bg-red-700 text-white" :
                  "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: BULK APPROVAL CONFIRMATION DIALOG */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-card p-6 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-green-500">
              <ShieldCheck className="h-7 w-7" />
              <h3 className="text-lg font-black text-brand-text">Confirm Bulk Approval</h3>
            </div>

            <p className="text-xs text-brand-muted leading-relaxed">
              You are about to bulk-approve all fully verified student profiles for leaderboard and dashboard participation. This will update their status to APPROVED, generate leaderboard entries, and recalculate ranks.
            </p>

            {stats && (
              <div className="grid grid-cols-2 gap-3 text-xs border-y border-brand-border py-4">
                <div>
                  <span className="block text-[8px] uppercase font-bold text-brand-muted">Eligible for Approval</span>
                  <span className="text-sm font-black text-green-400">{stats.eligibleForApproval} Students</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase font-bold text-brand-muted">Already Approved</span>
                  <span className="text-sm font-black text-[#22C55E]">{stats.alreadyApproved} Students</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase font-bold text-brand-muted">Still Incomplete</span>
                  <span className="text-sm font-black text-zinc-400">{stats.stillIncomplete} Profiles</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase font-bold text-brand-muted">Pending Verification</span>
                  <span className="text-sm font-black text-amber-500">{stats.pendingVerification} Students</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                disabled={bulkLoading}
                onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2 border border-brand-border rounded-lg text-xs font-bold uppercase text-brand-muted hover:text-brand-text cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkLoading}
                onClick={handleBulkApprove}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold uppercase rounded-lg transition-all cursor-pointer shadow-lg shadow-green-600/20"
              >
                {bulkLoading ? "Approving..." : "Confirm & Approve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
