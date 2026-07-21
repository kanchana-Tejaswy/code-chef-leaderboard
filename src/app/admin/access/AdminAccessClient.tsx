"use client";

import { useState, useEffect, FormEvent } from "react";
import { UserRole, AccountStatus } from "@prisma/client";

export default function AdminAccessClient() {
  const [activeTab, setActiveTab] = useState("accounts");
  
  return (
    <div className="space-y-6">
      <div className="flex space-x-4 border-b">
        <button className={`py-2 px-4 ${activeTab === "accounts" ? "border-b-2 border-blue-500 font-bold" : ""}`} onClick={() => setActiveTab("accounts")}>Accounts</button>
        <button className={`py-2 px-4 ${activeTab === "staff" ? "border-b-2 border-blue-500 font-bold" : ""}`} onClick={() => setActiveTab("staff")}>Provision Staff</button>
        <button className={`py-2 px-4 ${activeTab === "students" ? "border-b-2 border-blue-500 font-bold" : ""}`} onClick={() => setActiveTab("students")}>Provision Students</button>
        <button className={`py-2 px-4 ${activeTab === "audit" ? "border-b-2 border-blue-500 font-bold" : ""}`} onClick={() => setActiveTab("audit")}>Audit Logs</button>
      </div>

      {activeTab === "accounts" && <AccountsTab />}
      {activeTab === "staff" && <StaffProvisionTab />}
      {activeTab === "students" && <StudentProvisionTab />}
      {activeTab === "audit" && <AuditLogTab />}
    </div>
  );
}

function AccountsTab() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/access/accounts");
      const data = await res.json();
      if (data.success) setAccounts(data.data.items);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;
    try {
      const res = await fetch(`/api/admin/access/accounts/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        alert("Status updated");
        fetchAccounts();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert("An error occurred");
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Account Overview</h2>
      {loading ? <p>Loading...</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id} className="border-b">
                  <td className="px-4 py-2">{acc.email}</td>
                  <td className="px-4 py-2">{acc.role}</td>
                  <td className="px-4 py-2">{acc.status}</td>
                  <td className="px-4 py-2 space-x-2">
                    {acc.status === "ACTIVE" || acc.status === "PENDING" ? (
                      <button onClick={() => handleStatusChange(acc.id, "SUSPENDED")} className="text-yellow-600">Suspend</button>
                    ) : null}
                    {acc.status !== "DISABLED" ? (
                      <button onClick={() => handleStatusChange(acc.id, "DISABLED")} className="text-red-600">Disable</button>
                    ) : null}
                    {acc.status === "SUSPENDED" || acc.status === "DISABLED" ? (
                      <button onClick={() => handleStatusChange(acc.id, "RESTORE")} className="text-green-600">Restore</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StaffProvisionTab() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("GK_SIR");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirm(`Provision staff account for ${email} as ${role}?`)) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/admin/access/staff/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role })
      });
      const data = await res.json();
      if (data.success) {
        alert("Success: " + data.message);
        setEmail("");
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Internal error");
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Provision Staff Account</h2>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Role</label>
          <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="mt-1 block w-full border border-gray-300 rounded p-2">
            <option value="GK_SIR">GK_SIR</option>
            <option value="HOD">HOD</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Provisioning..." : "Provision Account"}
        </button>
      </form>
    </div>
  );
}

function StudentProvisionTab() {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/access/students/preview", { method: "POST" });
      const data = await res.json();
      if (data.success) setPreview(data.data);
      else alert("Error: " + data.error);
    } catch (e) {
      alert("An error occurred");
    }
    setLoading(false);
  };

  const handleBatchProvision = async () => {
    const confirmation = prompt("Type 'PROVISION_STUDENT_ACCOUNTS' to confirm batch provision.");
    if (confirmation !== "PROVISION_STUDENT_ACCOUNTS") return;
    
    setProvisioning(true);
    try {
      const res = await fetch("/api/admin/access/students/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, studentProfileIds: ["ALL_ELIGIBLE"] })
      });
      const data = await res.json();
      if (data.success) {
        alert("Success: " + data.message);
        setPreview(null);
      } else {
        alert("Error: " + data.error);
      }
    } catch (e) {
      alert("An error occurred");
    }
    setProvisioning(false);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Student Provisioning</h2>
      <div className="space-x-4 mb-4">
        <button onClick={fetchPreview} disabled={loading || provisioning} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50">
          {loading ? "Loading Preview..." : "Preview Eligible Students"}
        </button>
      </div>

      {preview && (
        <div className="bg-gray-50 p-4 border rounded mb-4">
          <h3 className="font-bold mb-2">Preview Summary</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Total Profiles: {preview.summary.total}</li>
            <li>Eligible: {preview.summary.eligible}</li>
            <li>Already Provisioned: {preview.summary.alreadyProvisioned}</li>
            <li>Conflicts: {preview.summary.emailConflict + preview.summary.loginIdConflict}</li>
          </ul>
          
          {preview.summary.eligible > 0 && (
            <button onClick={handleBatchProvision} disabled={provisioning} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
              {provisioning ? "Provisioning..." : `Provision ${preview.summary.eligible} Students`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AuditLogTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/admin/access/audit");
        const data = await res.json();
        if (data.success) setLogs(data.data.items);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchLogs();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Audit Logs</h2>
      {loading ? <p>Loading...</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Target</th>
                <th className="px-4 py-2 text-left">Actor ID</th>
                <th className="px-4 py-2 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b">
                  <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-2 text-xs">{log.targetType} {log.targetId ? `(${log.targetId})` : ""}</td>
                  <td className="px-4 py-2 text-xs">{log.actorUserId || "System"}</td>
                  <td className="px-4 py-2 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
