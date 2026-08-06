"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Archive,
  Check,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Building2,
  Network,
  X,
  RefreshCw
} from "lucide-react";

interface AcademicRegistryClientProps {
  userRole?: string | null;
  userDeptId?: string | null;
}

type TabType = "cohorts" | "departments" | "sections";

export default function AcademicRegistryClient({ userRole, userDeptId }: AcademicRegistryClientProps) {
  const isAdmin = userRole === "ADMIN";
  const isHod = userRole === "HOD";

  const [activeTab, setActiveTab] = useState<TabType>("cohorts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Lists and Pagination state
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  
  // Selection helpers for ClassSections dropdowns
  const [activeCohorts, setActiveCohorts] = useState<any[]>([]);
  const [activeDepartments, setActiveDepartments] = useState<any[]>([]);

  // Search & Filtering & Pagination State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState(""); // Cohorts
  const [filterActive, setFilterActive] = useState("");  // Depts/Sections
  const [filterCohortId, setFilterCohortId] = useState(""); // Sections
  const [filterDeptId, setFilterDeptId] = useState("");     // Sections
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Form values state
  const [formValues, setFormValues] = useState<any>({});
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Fetch list data based on active tab and filter states
  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      let url = "";
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        search: searchQuery
      });

      if (activeTab === "cohorts") {
        url = "/api/admin/academic/cohorts";
        if (filterStatus) params.append("status", filterStatus);
      } else if (activeTab === "departments") {
        url = "/api/admin/academic/departments";
        if (filterActive) params.append("isActive", filterActive);
      } else {
        url = "/api/admin/academic/sections";
        if (filterActive) params.append("isActive", filterActive);
        if (filterCohortId) params.append("cohortId", filterCohortId);
        if (filterDeptId) params.append("departmentId", filterDeptId);
      }

      const res = await fetch(`${url}?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load data.");
      }

      if (activeTab === "cohorts") {
        setCohorts(data.cohorts);
      } else if (activeTab === "departments") {
        setDepartments(data.departments);
      } else {
        setSections(data.sections);
      }

      setTotalCount(data.pagination?.total || 0);
      setTotalPages(data.pagination?.pages || 1);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while loading data.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to load items for Select dropdowns
  const fetchDropdownReferences = async () => {
    try {
      // 1. Fetch non-archived cohorts
      const resC = await fetch("/api/admin/academic/cohorts?limit=100");
      const dataC = await resC.json();
      if (dataC.success) {
        setActiveCohorts(dataC.cohorts.filter((c: any) => c.status !== "ARCHIVED"));
      }

      // 2. Fetch active departments
      const resD = await fetch("/api/admin/academic/departments?limit=100&isActive=true");
      const dataD = await resD.json();
      if (dataD.success) {
        setActiveDepartments(dataD.departments);
      }
    } catch (err) {
      console.error("Failed to load reference dropdown lists", err);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchData();
    if (activeTab === "sections") {
      fetchDropdownReferences();
    }
  }, [activeTab, searchQuery, filterStatus, filterActive, filterCohortId, filterDeptId]);

  useEffect(() => {
    fetchData();
  }, [currentPage]);

  // Flash messages helper
  const showToast = (msg: string, isSuccess = true) => {
    if (isSuccess) {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(""), 4000);
    } else {
      setError(msg);
      setTimeout(() => setError(""), 5000);
    }
  };

  // Open modals & setup initial values
  const handleOpenCreateModal = () => {
    setFormError("");
    setFormLoading(false);
    if (activeTab === "cohorts") {
      setFormValues({ code: "", startYear: "", endYear: "", status: "ACTIVE" });
    } else if (activeTab === "departments") {
      setFormValues({ code: "", name: "", isActive: true });
    } else {
      // For HOD, force assigned department
      const initialDept = isHod ? (activeDepartments.find((d: any) => d.code === userDeptId || d.id === userDeptId)?.id || "") : "";
      setFormValues({ cohortId: "", departmentId: initialDept, name: "", capacity: "", isActive: true });
    }
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (item: any) => {
    setFormError("");
    setFormLoading(false);
    setEditingItem(item);
    if (activeTab === "cohorts") {
      setFormValues({
        code: item.code,
        startYear: item.startYear.toString(),
        endYear: item.endYear.toString(),
        status: item.status
      });
    } else if (activeTab === "departments") {
      setFormValues({
        code: item.code,
        name: item.name,
        isActive: item.isActive
      });
    } else {
      setFormValues({
        cohortId: item.cohortId,
        departmentId: item.departmentId,
        name: item.name,
        capacity: item.capacity ? item.capacity.toString() : "",
        isActive: item.isActive
      });
    }
    setShowEditModal(true);
  };

  // Form submission handler
  const handleFormSubmit = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      let url = "";
      let method = "POST";
      
      if (activeTab === "cohorts") {
        url = isEdit ? `/api/admin/academic/cohorts/${editingItem.id}` : "/api/admin/academic/cohorts";
      } else if (activeTab === "departments") {
        url = isEdit ? `/api/admin/academic/departments/${editingItem.id}` : "/api/admin/academic/departments";
      } else {
        url = isEdit ? `/api/admin/academic/sections/${editingItem.id}` : "/api/admin/academic/sections";
      }

      if (isEdit) {
        method = "PATCH";
      }

      // Pre-submit validations on Client
      if (activeTab === "cohorts") {
        const start = parseInt(formValues.startYear, 10);
        const end = parseInt(formValues.endYear, 10);
        if (!formValues.code.trim()) {
          throw new Error("Cohort code is required.");
        }
        if (isNaN(start) || isNaN(end)) {
          throw new Error("Start and End years must be integers.");
        }
        if (start >= end) {
          throw new Error("Start year must be earlier than End year.");
        }
      } else if (activeTab === "departments") {
        if (!formValues.code.trim()) {
          throw new Error("Department code is required.");
        }
        if (!formValues.name.trim()) {
          throw new Error("Department name is required.");
        }
      } else {
        if (!formValues.cohortId) {
          throw new Error("Cohort selection is required.");
        }
        if (!formValues.departmentId) {
          throw new Error("Department selection is required.");
        }
        if (!formValues.name.trim()) {
          throw new Error("Section name is required.");
        }
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Request failed.");
      }

      showToast(`${activeTab === "cohorts" ? "Cohort" : activeTab === "departments" ? "Department" : "Section"} successfully ${isEdit ? "updated" : "created"}.`);
      setShowCreateModal(false);
      setShowEditModal(false);
      fetchData();

    } catch (err: any) {
      setFormError(err.message || "Something went wrong.");
    } finally {
      setFormLoading(false);
    }
  };

  // Quick Archive / Toggle status handler
  const handleToggleArchive = async (item: any) => {
    if (!isAdmin) return;
    setError("");
    const confirmAction = confirm(`Are you sure you want to toggle status/archive state for this item?`);
    if (!confirmAction) return;

    try {
      let url = "";
      let payload = {};

      if (activeTab === "cohorts") {
        url = `/api/admin/academic/cohorts/${item.id}`;
        payload = { status: item.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED" };
      } else if (activeTab === "departments") {
        url = `/api/admin/academic/departments/${item.id}`;
        payload = { isActive: !item.isActive };
      } else {
        url = `/api/admin/academic/sections/${item.id}`;
        payload = { isActive: !item.isActive };
      }

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Action failed.");
      }

      showToast("Status successfully updated.");
      fetchData();

    } catch (err: any) {
      showToast(err.message || "Failed to update item status.", false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-green-500/20 bg-green-500/10 text-green-500">
          <Check className="h-5 w-5 shrink-0" />
          <span className="text-sm font-bold">{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 animate-pulse">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-bold">{error}</span>
        </div>
      )}

      {/* Primary Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-brand-border pb-px gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("cohorts")}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "cohorts"
                ? "border-[#EAB308] text-[#EAB308]"
                : "border-transparent text-brand-muted hover:text-brand-text"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            Cohorts
          </button>
          <button
            onClick={() => setActiveTab("departments")}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "departments"
                ? "border-[#EAB308] text-[#EAB308]"
                : "border-transparent text-brand-muted hover:text-brand-text"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Departments
          </button>
          <button
            onClick={() => setActiveTab("sections")}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "sections"
                ? "border-[#EAB308] text-[#EAB308]"
                : "border-transparent text-brand-muted hover:text-brand-text"
            }`}
          >
            <Network className="h-4 w-4" />
            Class Sections
          </button>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider bg-[#EAB308] text-[#0A0A0A] hover:bg-[#FACC15] transition-all cursor-pointer shadow-[0_2px_10px_rgba(234,179,8,0.2)]"
          >
            <Plus className="h-4 w-4" />
            Create {activeTab === "cohorts" ? "Cohort" : activeTab === "departments" ? "Department" : "Section"}
          </button>
        )}
      </div>

      {/* Search and Filters Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-brand-card/40 p-4 border border-brand-border/60 rounded-xl backdrop-blur-md">
        {/* Search */}
        <div className="relative sm:col-span-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted" />
          <input
            type="text"
            placeholder={`Search ${activeTab === "cohorts" ? "codes" : activeTab === "departments" ? "codes or names" : "sections, cohorts or departments"}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-brand-bg/50 border border-brand-border/80 rounded-lg text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308] focus:border-[#EAB308]"
          />
        </div>

        {/* Tab specific filter dropdowns */}
        <div className="sm:col-span-6 flex gap-2 justify-end w-full">
          {activeTab === "cohorts" && (
            <div className="relative w-full max-w-[180px]">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-muted pointer-events-none" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-brand-bg/50 border border-brand-border/80 rounded-lg text-xs text-brand-text focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="GRADUATED">Graduated</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          )}

          {activeTab === "departments" && (
            <div className="relative w-full max-w-[180px]">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-muted pointer-events-none" />
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-brand-bg/50 border border-brand-border/80 rounded-lg text-xs text-brand-text focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
              >
                <option value="">All States</option>
                <option value="true">Active Only</option>
                <option value="false">Inactive/Archived</option>
              </select>
            </div>
          )}

          {activeTab === "sections" && (
            <>
              {/* Cohort filter */}
              <select
                value={filterCohortId}
                onChange={(e) => setFilterCohortId(e.target.value)}
                className="pl-3 pr-4 py-2 bg-brand-bg/50 border border-brand-border/80 rounded-lg text-xs text-brand-text focus:outline-none focus:ring-1 focus:ring-[#EAB308] w-full max-w-[140px]"
              >
                <option value="">All Cohorts</option>
                {activeCohorts.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.code}</option>
                ))}
              </select>

              {/* Department filter (disabled for HOD since they are pre-filtered) */}
              <select
                value={filterDeptId}
                onChange={(e) => setFilterDeptId(e.target.value)}
                disabled={isHod}
                className="pl-3 pr-4 py-2 bg-brand-bg/50 border border-brand-border/80 rounded-lg text-xs text-brand-text focus:outline-none focus:ring-1 focus:ring-[#EAB308] w-full max-w-[140px] disabled:opacity-50"
              >
                <option value="">All Depts</option>
                {activeDepartments.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.code}</option>
                ))}
              </select>

              {/* Active state filter */}
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="pl-3 pr-4 py-2 bg-brand-bg/50 border border-brand-border/80 rounded-lg text-xs text-brand-text focus:outline-none focus:ring-1 focus:ring-[#EAB308] w-full max-w-[110px]"
              >
                <option value="">All States</option>
                <option value="true">Active Only</option>
                <option value="false">Inactive</option>
              </select>
            </>
          )}

          <button
            onClick={() => {
              setSearchQuery("");
              setFilterStatus("");
              setFilterActive("");
              setFilterCohortId("");
              setFilterDeptId("");
              setCurrentPage(1);
            }}
            className="p-2 rounded-lg border border-brand-border/80 bg-brand-bg/50 hover:bg-brand-muted/10 text-brand-muted hover:text-brand-text"
            title="Reset Filters"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Lists Display */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-brand-card/20 border border-brand-border/50 rounded-2xl">
          <Loader2 className="h-8 w-8 text-[#EAB308] animate-spin mb-4" />
          <span className="text-xs text-brand-muted font-medium uppercase tracking-wider">Fetching Academic Records...</span>
        </div>
      ) : totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 bg-brand-card/25 border border-brand-border/50 rounded-2xl text-center space-y-4">
          <div className="p-4 rounded-full bg-brand-muted/10 text-brand-muted">
            {activeTab === "cohorts" ? <GraduationCap className="h-10 w-10" /> : activeTab === "departments" ? <Building2 className="h-10 w-10" /> : <Network className="h-10 w-10" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-brand-text uppercase tracking-wider">No Records Found</h3>
            <p className="text-xs text-brand-muted max-w-sm">No academic {activeTab} matched your active search queries or status filters.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-card/30">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-brand-border bg-brand-card/55 text-brand-muted font-bold uppercase tracking-wider select-none">
                  {activeTab === "cohorts" && (
                    <>
                      <th className="p-4">Code</th>
                      <th className="p-4">Start Year</th>
                      <th className="p-4">End Year</th>
                      <th className="p-4">Status</th>
                      {isAdmin && <th className="p-4 text-right">Actions</th>}
                    </>
                  )}

                  {activeTab === "departments" && (
                    <>
                      <th className="p-4">Code</th>
                      <th className="p-4">Name</th>
                      <th className="p-4">State</th>
                      {isAdmin && <th className="p-4 text-right">Actions</th>}
                    </>
                  )}

                  {activeTab === "sections" && (
                    <>
                      <th className="p-4">Name</th>
                      <th className="p-4">Cohort</th>
                      <th className="p-4">Department</th>
                      <th className="p-4">Capacity</th>
                      <th className="p-4">State</th>
                      {isAdmin && <th className="p-4 text-right">Actions</th>}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {activeTab === "cohorts" && cohorts.map((c: any) => (
                  <tr key={c.id} className="border-b border-brand-border/60 hover:bg-brand-card/25 transition-all">
                    <td className="p-4 font-bold text-brand-text">{c.code}</td>
                    <td className="p-4 text-brand-muted">{c.startYear}</td>
                    <td className="p-4 text-brand-muted">{c.endYear}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        c.status === "ACTIVE" ? "bg-green-500/10 text-green-500 border border-green-500/20" :
                        c.status === "UPCOMING" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                        c.status === "GRADUATED" ? "bg-yellow-500/10 text-[#EAB308] border border-[#EAB308]/20" :
                        "bg-red-500/10 text-red-500 border border-red-500/20"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 rounded-lg border border-brand-border bg-brand-bg hover:text-[#EAB308] transition-colors cursor-pointer"
                            title="Edit Cohort"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleArchive(c)}
                            className="p-1.5 rounded-lg border border-brand-border bg-brand-bg hover:text-red-500 transition-colors cursor-pointer"
                            title={c.status === "ARCHIVED" ? "Activate Cohort" : "Archive Cohort"}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

                {activeTab === "departments" && departments.map((d: any) => (
                  <tr key={d.id} className="border-b border-brand-border/60 hover:bg-brand-card/25 transition-all">
                    <td className="p-4 font-bold text-brand-text">{d.code}</td>
                    <td className="p-4 text-brand-muted">{d.name}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        d.isActive ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                      }`}>
                        {d.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => handleOpenEditModal(d)}
                            className="p-1.5 rounded-lg border border-brand-border bg-brand-bg hover:text-[#EAB308] transition-colors cursor-pointer"
                            title="Edit Department"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleArchive(d)}
                            className="p-1.5 rounded-lg border border-brand-border bg-brand-bg hover:text-red-500 transition-colors cursor-pointer"
                            title={d.isActive ? "Archive Department" : "Activate Department"}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

                {activeTab === "sections" && sections.map((s: any) => (
                  <tr key={s.id} className="border-b border-brand-border/60 hover:bg-brand-card/25 transition-all">
                    <td className="p-4 font-bold text-brand-text">{s.name}</td>
                    <td className="p-4 text-brand-muted">{s.cohort?.code}</td>
                    <td className="p-4 text-brand-muted">{s.department?.name} ({s.department?.code})</td>
                    <td className="p-4 text-brand-muted">{s.capacity || "N/A"}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        s.isActive ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                      }`}>
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => handleOpenEditModal(s)}
                            className="p-1.5 rounded-lg border border-brand-border bg-brand-bg hover:text-[#EAB308] transition-colors cursor-pointer"
                            title="Edit Section"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleArchive(s)}
                            className="p-1.5 rounded-lg border border-brand-border bg-brand-bg hover:text-red-500 transition-colors cursor-pointer"
                            title={s.isActive ? "Deactivate Section" : "Activate Section"}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 bg-brand-card/10 border border-brand-border/60 rounded-xl select-none text-xs text-brand-muted font-semibold">
              <span>Showing Page {currentPage} of {totalPages} ({totalCount} total entries)</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 py-1.5 px-3 rounded-lg border border-brand-border bg-brand-bg hover:text-brand-text disabled:opacity-50 disabled:hover:text-brand-muted cursor-pointer transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 py-1.5 px-3 rounded-lg border border-brand-border bg-brand-bg hover:text-brand-text disabled:opacity-50 disabled:hover:text-brand-muted cursor-pointer transition-colors"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-brand-card border border-brand-border rounded-2xl shadow-2xl p-6 relative flex flex-col space-y-4">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-brand-muted hover:text-brand-text"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-black uppercase tracking-wider text-brand-text border-b border-brand-border pb-3">
              Create New {activeTab === "cohorts" ? "Cohort" : activeTab === "departments" ? "Department" : "Class Section"}
            </h3>

            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-bold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={(e) => handleFormSubmit(e, false)} className="space-y-4 text-xs font-semibold">
              {activeTab === "cohorts" && (
                <>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Cohort Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 2022-2026"
                      value={formValues.code || ""}
                      onChange={(e) => setFormValues({ ...formValues, code: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-brand-muted mb-1.5">Start Year</label>
                      <input
                        type="number"
                        placeholder="e.g. 2022"
                        value={formValues.startYear || ""}
                        onChange={(e) => setFormValues({ ...formValues, startYear: e.target.value })}
                        className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                      />
                    </div>
                    <div>
                      <label className="block text-brand-muted mb-1.5">End Year</label>
                      <input
                        type="number"
                        placeholder="e.g. 2026"
                        value={formValues.endYear || ""}
                        onChange={(e) => setFormValues({ ...formValues, endYear: e.target.value })}
                        className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Status</label>
                    <select
                      value={formValues.status || "ACTIVE"}
                      onChange={(e) => setFormValues({ ...formValues, status: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="UPCOMING">Upcoming</option>
                      <option value="GRADUATED">Graduated</option>
                    </select>
                  </div>
                </>
              )}

              {activeTab === "departments" && (
                <>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Department Code</label>
                    <input
                      type="text"
                      placeholder="e.g. CSE"
                      value={formValues.code || ""}
                      onChange={(e) => setFormValues({ ...formValues, code: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    />
                  </div>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Department Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Computer Science & Engineering"
                      value={formValues.name || ""}
                      onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    />
                  </div>
                </>
              )}

              {activeTab === "sections" && (
                <>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Cohort</label>
                    <select
                      value={formValues.cohortId || ""}
                      onChange={(e) => setFormValues({ ...formValues, cohortId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    >
                      <option value="">Select Cohort</option>
                      {activeCohorts.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Department</label>
                    <select
                      value={formValues.departmentId || ""}
                      onChange={(e) => setFormValues({ ...formValues, departmentId: e.target.value })}
                      disabled={isHod}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-1 focus:ring-[#EAB308] disabled:opacity-60"
                    >
                      <option value="">Select Department</option>
                      {activeDepartments.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Section Name</label>
                    <input
                      type="text"
                      placeholder="e.g. CSE-A"
                      value={formValues.name || ""}
                      onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    />
                  </div>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Capacity (Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 60"
                      value={formValues.capacity || ""}
                      onChange={(e) => setFormValues({ ...formValues, capacity: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 border-t border-brand-border pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-brand-border hover:bg-brand-muted/10 text-brand-text font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#EAB308] text-[#0A0A0A] hover:bg-[#FACC15] font-black uppercase tracking-wider disabled:opacity-50 cursor-pointer shadow-[0_2px_10px_rgba(234,179,8,0.2)]"
                >
                  {formLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Editing Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-brand-card border border-brand-border rounded-2xl shadow-2xl p-6 relative flex flex-col space-y-4">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-brand-muted hover:text-brand-text"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-black uppercase tracking-wider text-brand-text border-b border-brand-border pb-3">
              Edit {activeTab === "cohorts" ? "Cohort" : activeTab === "departments" ? "Department" : "Class Section"}
            </h3>

            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-bold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={(e) => handleFormSubmit(e, true)} className="space-y-4 text-xs font-semibold">
              {activeTab === "cohorts" && (
                <>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Cohort Code</label>
                    <input
                      type="text"
                      value={formValues.code || ""}
                      onChange={(e) => setFormValues({ ...formValues, code: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-brand-muted mb-1.5">Start Year</label>
                      <input
                        type="number"
                        value={formValues.startYear || ""}
                        onChange={(e) => setFormValues({ ...formValues, startYear: e.target.value })}
                        className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                      />
                    </div>
                    <div>
                      <label className="block text-brand-muted mb-1.5">End Year</label>
                      <input
                        type="number"
                        value={formValues.endYear || ""}
                        onChange={(e) => setFormValues({ ...formValues, endYear: e.target.value })}
                        className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Status</label>
                    <select
                      value={formValues.status || ""}
                      onChange={(e) => setFormValues({ ...formValues, status: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="UPCOMING">Upcoming</option>
                      <option value="GRADUATED">Graduated</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>
                </>
              )}

              {activeTab === "departments" && (
                <>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Department Code</label>
                    <input
                      type="text"
                      value={formValues.code || ""}
                      onChange={(e) => setFormValues({ ...formValues, code: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    />
                  </div>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Department Name</label>
                    <input
                      type="text"
                      value={formValues.name || ""}
                      onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    />
                  </div>
                </>
              )}

              {activeTab === "sections" && (
                <>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Cohort</label>
                    <select
                      value={formValues.cohortId || ""}
                      onChange={(e) => setFormValues({ ...formValues, cohortId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    >
                      {activeCohorts.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Department</label>
                    <select
                      value={formValues.departmentId || ""}
                      onChange={(e) => setFormValues({ ...formValues, departmentId: e.target.value })}
                      disabled={isHod}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none focus:ring-1 focus:ring-[#EAB308] disabled:opacity-60"
                    >
                      {activeDepartments.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Section Name</label>
                    <input
                      type="text"
                      value={formValues.name || ""}
                      onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    />
                  </div>
                  <div>
                    <label className="block text-brand-muted mb-1.5">Capacity (Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 60"
                      value={formValues.capacity || ""}
                      onChange={(e) => setFormValues({ ...formValues, capacity: e.target.value })}
                      className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-text placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-[#EAB308]"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 border-t border-brand-border pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-lg border border-brand-border hover:bg-brand-muted/10 text-brand-text font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#EAB308] text-[#0A0A0A] hover:bg-[#FACC15] font-black uppercase tracking-wider disabled:opacity-50 cursor-pointer shadow-[0_2px_10px_rgba(234,179,8,0.2)]"
                >
                  {formLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
