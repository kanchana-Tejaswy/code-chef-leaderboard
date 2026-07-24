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
} from "lucide-react";

interface AdminControlCenterClientProps {
  currentAdminId: string;
  currentAdminEmail: string;
}

export default function AdminControlCenterClient({
  currentAdminId,
  currentAdminEmail,
}: AdminControlCenterClientProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "create" | "directory" | "security" | "audit">("directory");

  return (
    <div className="space-y-8">
      {/* Navigation Tabs Header */}
      <div className="border-b border-brand-border bg-brand-card/50 p-2 rounded-xl backdrop-blur-md">
        <nav className="flex flex-wrap gap-2 sm:gap-3" aria-label="Tabs">
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
      {activeTab === "profile" && <MyProfileTab currentAdminEmail={currentAdminEmail} />}
      {activeTab === "create" && <CreateAccountTab onAccountCreated={() => setActiveTab("directory")} />}
      {activeTab === "directory" && <AccountDirectoryTab currentAdminId={currentAdminId} />}
      {activeTab === "security" && <SecurityTab currentAdminEmail={currentAdminEmail} />}
      {activeTab === "audit" && <AuditActivityTab />}
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
