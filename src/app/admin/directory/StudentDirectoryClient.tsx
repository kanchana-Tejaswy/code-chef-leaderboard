"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  GraduationCap,
  Building2,
  Network,
  Users,
  Search,
  Plus,
  Edit,
  Archive,
  RefreshCw,
  Trash2,
  Lock,
  ArrowLeft,
  X,
  FileText,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
  Loader2,
  ShieldCheck
} from "lucide-react";
import { useToast } from "@/components/shared/toast";
import { UserRole } from "@prisma/client";

interface StudentDirectoryClientProps {
  userRole: UserRole;
  userDepartmentId: string | null;
  canDelete: boolean;
}

export function StudentDirectoryClient({ userRole, userDepartmentId, canDelete }: StudentDirectoryClientProps) {
  const { showToast } = useToast();
  const isAdmin = userRole === "ADMIN";
  const isHod = userRole === "HOD";
  const isGkSir = userRole === "GK_SIR";
  const isReadOnly = isGkSir; // GK_SIR is read-only; ADMIN has full write; HOD is scoped to department.

  // Navigation State
  const [level, setLevel] = useState<"cohorts" | "departments" | "sections" | "students">("cohorts");
  const [selectedCohort, setSelectedCohort] = useState<any>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
  const [selectedSection, setSelectedSection] = useState<any>(null);

  // Data Lists
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);

  // Reference lists for dropdowns in modals
  const [refCohorts, setRefCohorts] = useState<any[]>([]);
  const [refDepartments, setRefDepartments] = useState<any[]>([]);
  const [refSections, setRefSections] = useState<any[]>([]);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

  // Modals Visibility
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingStudent, setEditingStudent] = useState<any>(null);

  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<any>(null);

  // Roster Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "summary">("upload");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [previewSummary, setPreviewSummary] = useState<any>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewFilter, setPreviewFilter] = useState<"all" | "new" | "existing" | "invalid">("all");
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [finalSummary, setFinalSummary] = useState<any>(null);

  // Student Form State
  const [studentForm, setStudentForm] = useState({
    name: "",
    rollNumber: "",
    email: "",
    contactNumber: "",
    year: "1",
    cgpa: "",
    cohortId: "",
    departmentId: "",
    classSectionId: "",
    codechefUsername: "",
    leetcodeUsername: "",
    codeforcesUsername: "",
    githubUsername: "",
    linkedinUrl: "",
    hackerrankUsername: "",
    hackerearthUsername: ""
  });

  // Section Form State
  const [sectionForm, setSectionForm] = useState({
    name: "",
    capacity: ""
  });

  // Delete Student Form State
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState("Incorrect Roll Number");
  const [deleteNotes, setDeleteNotes] = useState("");

  // Fetch directory hierarchy/data
  const fetchDirectoryData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCohort) params.append("cohortId", selectedCohort.id);
      if (selectedDepartment) params.append("departmentId", selectedDepartment.id);
      if (selectedSection) {
        params.append("sectionId", selectedSection.id);
        params.append("page", currentPage.toString());
        params.append("search", searchQuery);
        params.append("status", statusFilter);
      }

      const res = await fetch(`/api/admin/directory?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load directory data.");
      }

      setLevel(data.level);
      if (data.level === "cohorts") {
        setCohorts(data.cohorts);
      } else if (data.level === "departments") {
        setDepartments(data.departments);
      } else if (data.level === "sections") {
        setSections(data.sections);
        setUnassignedCount(data.unassignedCount || 0);
      } else if (data.level === "students") {
        setStudents(data.students || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalStudents(data.pagination?.total || 0);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "An error occurred while loading directory.", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedCohort, selectedDepartment, selectedSection, currentPage, searchQuery, statusFilter, showToast]);

  // Load references for modals
  const loadModalReferences = async () => {
    try {
      const [resC, resD] = await Promise.all([
        fetch("/api/admin/academic/cohorts?limit=100"),
        fetch("/api/admin/academic/departments?limit=100&isActive=true")
      ]);
      const dataC = await resC.json();
      const dataD = await resD.json();

      if (dataC.success) {
        setRefCohorts(dataC.cohorts.filter((c: any) => c.status !== "ARCHIVED"));
      }
      if (dataD.success) {
        // For HOD, restrict selectable departments to their own department code/ID
        if (isHod && userDepartmentId) {
          setRefDepartments(dataD.departments.filter((d: any) => d.code === userDepartmentId || d.id === userDepartmentId));
        } else {
          setRefDepartments(dataD.departments);
        }
      }
    } catch (err) {
      console.error("Failed to load reference lists", err);
    }
  };

  // Load sections dynamically when cohort/department changes in student form
  const loadRefSections = async (cId: string, dId: string) => {
    if (!cId || !dId) {
      setRefSections([]);
      return;
    }
    try {
      const resS = await fetch(`/api/admin/academic/sections?limit=100&cohortId=${cId}&departmentId=${dId}&isActive=true`);
      const dataS = await resS.json();
      if (dataS.success) {
        setRefSections(dataS.sections);
      }
    } catch (err) {
      console.error("Failed to load sections", err);
    }
  };

  useEffect(() => {
    fetchDirectoryData();
  }, [fetchDirectoryData]);

  // Handle Breadcrumb Back Navigation
  const navigateToLevel = (target: "cohorts" | "departments" | "sections") => {
    setCurrentPage(1);
    setSearchQuery("");
    if (target === "cohorts") {
      setSelectedCohort(null);
      setSelectedDepartment(null);
      setSelectedSection(null);
    } else if (target === "departments") {
      setSelectedDepartment(null);
      setSelectedSection(null);
    } else if (target === "sections") {
      setSelectedSection(null);
    }
  };

  // Handle Add Section Submission
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCohort || !selectedDepartment) return;
    if (!sectionForm.name.trim()) {
      showToast("Section name is required.", "error");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/academic/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId: selectedCohort.id,
          departmentId: selectedDepartment.id,
          name: sectionForm.name.trim(),
          capacity: sectionForm.capacity ? parseInt(sectionForm.capacity, 10) : null
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create section.");
      }

      showToast(`Section ${sectionForm.name} created successfully.`, "success");
      setShowSectionModal(false);
      setSectionForm({ name: "", capacity: "" });
      fetchDirectoryData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Create/Edit Student Modal
  const handleOpenStudentModal = async (mode: "create" | "edit", student?: any) => {
    await loadModalReferences();
    setModalMode(mode);

    if (mode === "create") {
      const initialCohort = selectedCohort?.id || "";
      const initialDept = selectedDepartment?.id || "";
      const initialSect = selectedSection?.id && selectedSection.id !== "unassigned" ? selectedSection.id : "";

      setStudentForm({
        name: "",
        rollNumber: "",
        email: "",
        contactNumber: "",
        year: "1",
        cgpa: "",
        cohortId: initialCohort,
        departmentId: initialDept,
        classSectionId: initialSect,
        codechefUsername: "",
        leetcodeUsername: "",
        codeforcesUsername: "",
        githubUsername: "",
        linkedinUrl: "",
        hackerrankUsername: "",
        hackerearthUsername: ""
      });

      if (initialCohort && initialDept) {
        await loadRefSections(initialCohort, initialDept);
      } else {
        setRefSections([]);
      }
      setEditingStudent(null);
    } else if (mode === "edit" && student) {
      // Find current active enrollment details to pre-populate dropdowns
      setEditingStudent(student);
      
      // Load current student details from db to get current enrollment
      try {
        const studentRes = await fetch(`/api/admin/students/${student.id}`);
        const sData = await studentRes.json();
        if (sData.success && sData.student) {
          setEditingStudent(sData.student);
          const currentE = sData.student.studentEnrollments?.find((e: any) => e.isCurrent);
          const cId = currentE?.cohortId || "";
          const dId = currentE?.departmentId || "";
          const sId = currentE?.classSectionId || "";

          const hrAccount = sData.student.platformAccounts?.find((p: any) => p.platform === "HACKERRANK");
          const heAccount = sData.student.platformAccounts?.find((p: any) => p.platform === "HACKEREARTH");

          setStudentForm({
            name: student.name || "",
            rollNumber: student.rollNumber || "",
            email: student.email || "",
            contactNumber: student.contactNumber || "",
            year: String(student.year || "1"),
            cgpa: student.cgpa !== null && student.cgpa !== undefined ? String(student.cgpa) : "",
            cohortId: cId,
            departmentId: dId,
            classSectionId: sId,
            codechefUsername: student.codechefUsername || "",
            leetcodeUsername: student.leetcodeUsername || "",
            codeforcesUsername: student.codeforcesUsername || "",
            githubUsername: student.githubUsername || "",
            linkedinUrl: student.linkedinUrl || "",
            hackerrankUsername: hrAccount?.normalizedHandle || "",
            hackerearthUsername: heAccount?.normalizedHandle || ""
          });

          if (cId && dId) {
            await loadRefSections(cId, dId);
          }
        }
      } catch (err) {
        console.error("Failed to load detailed student profile", err);
      }
    }
    setShowStudentModal(true);
  };

  // Handle Student Form Save (Create or Edit)
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) {
      showToast("Student name is required.", "error");
      return;
    }
    if (!studentForm.rollNumber.trim()) {
      showToast("Roll number is required.", "error");
      return;
    }

    setActionLoading(true);
    try {
      const url = modalMode === "create" ? "/api/admin/students" : `/api/admin/students/${editingStudent.id}`;
      const method = modalMode === "create" ? "POST" : "PATCH";

      const payload = {
        name: studentForm.name.trim(),
        rollNumber: studentForm.rollNumber.trim().toUpperCase(),
        email: studentForm.email.trim() || null,
        contactNumber: studentForm.contactNumber.trim() || null,
        year: parseInt(studentForm.year, 10),
        cgpa: studentForm.cgpa ? parseFloat(studentForm.cgpa) : null,
        cohortId: studentForm.cohortId || null,
        departmentId: studentForm.departmentId || null,
        classSectionId: studentForm.classSectionId || null, // null maps to sectionless
        codechefUsername: studentForm.codechefUsername.trim() || null,
        leetcodeUsername: studentForm.leetcodeUsername.trim() || null,
        codeforcesUsername: studentForm.codeforcesUsername.trim() || null,
        githubUsername: studentForm.githubUsername.trim() || null,
        linkedinUrl: studentForm.linkedinUrl.trim() || null,
        hackerrankUsername: studentForm.hackerrankUsername.trim() || null,
        hackerearthUsername: studentForm.hackerearthUsername.trim() || null
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.status === 409) {
        showToast("Conflict: A student with this roll number already exists.", "error");
        // Open option to edit or view
        if (data.existingId) {
          showToast(`Click View profile to check details of ${payload.rollNumber}`, "info");
        }
        setActionLoading(false);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save student profile.");
      }

      showToast(`Student ${studentForm.name} saved successfully.`, "success");
      setShowStudentModal(false);
      fetchDirectoryData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Archive / Restore Student
  const handleToggleArchive = async (student: any) => {
    const isArchived = !!student.archivedAt;
    const url = `/api/admin/students/${student.id}/${isArchived ? "restore" : "archive"}`;
    setActionLoading(true);
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to ${isArchived ? "restore" : "archive"} student.`);
      }

      showToast(`Student ${student.name} was successfully ${isArchived ? "restored" : "archived"}.`, "success");
      fetchDirectoryData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Permanent Delete Dialog
  const handleOpenDeleteDialog = (student: any) => {
    setStudentToDelete(student);
    setDeleteConfirmText("");
    setDeleteReason("Incorrect Roll Number");
    setDeleteNotes("");
    setShowDeleteModal(true);
  };

  // Confirm Permanent Deletion
  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentToDelete) return;
    if (deleteConfirmText !== "DELETE") {
      showToast("Please type 'DELETE' to confirm deletion.", "error");
      return;
    }
    if (deleteReason === "Other" && !deleteNotes.trim()) {
      showToast("Notes are required for reason 'Other'.", "error");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/students/${studentToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: deleteConfirmText,
          reason: deleteReason,
          notes: deleteReason === "Other" ? deleteNotes.trim() : ""
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to permanently delete student.");
      }

      showToast(`Student profile permanently deleted.`, "success");
      setShowDeleteModal(false);
      setStudentToDelete(null);
      fetchDirectoryData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Client-side CSV parser
  const parseCSV = (text: string): any[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
    const results: any[] = [];

    const headerMapping: { [key: string]: string } = {
      name: "name",
      studentname: "name",
      "student name": "name",
      rollnumber: "rollNumber",
      roll_number: "rollNumber",
      "roll no": "rollNumber",
      "roll number": "rollNumber",
      email: "email",
      emailid: "email",
      "email id": "email",
      contactnumber: "contactNumber",
      contact_number: "contactNumber",
      phone: "contactNumber",
      phonenumber: "contactNumber",
      year: "year",
      yearofstudy: "year",
      "year of study": "year",
      branch: "branch",
      department: "department",
      section: "section",
      cgpa: "cgpa",
      gpa: "cgpa",
      codechef: "codechefUsername",
      codechefusername: "codechefUsername",
      codechef_username: "codechefUsername",
      leetcode: "leetcodeUsername",
      leetcodeusername: "leetcodeUsername",
      leetcode_username: "leetcodeUsername",
      codeforces: "codeforcesUsername",
      codeforcesusername: "codeforcesUsername",
      codeforces_username: "codeforcesUsername",
      github: "githubUsername",
      githubusername: "githubUsername",
      github_username: "githubUsername",
      linkedin: "linkedinUrl",
      linkedinurl: "linkedinUrl",
      linkedin_url: "linkedinUrl",
      hackerrank: "hackerrankUsername",
      hackerrankusername: "hackerrankUsername",
      hackerearth: "hackerearthUsername",
      hackerearthusername: "hackerearthUsername",
    };

    const headers = rawHeaders.map(h => headerMapping[h.toLowerCase()] || h);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const matches: string[] = [];
      let currentField = "";
      let inQuotes = false;
      
      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          matches.push(currentField.trim());
          currentField = "";
        } else {
          currentField += char;
        }
      }
      matches.push(currentField.trim());

      const row: any = {};
      headers.forEach((header, index) => {
        let val = matches[index] ? matches[index].trim() : "";
        val = val.replace(/^["']|["']$/g, "");
        row[header] = val;
      });
      results.push(row);
    }
    return results;
  };

  const handleCSVPreview = async (file: File) => {
    setImportError(null);
    setActionLoading(true);
    try {
      const text = await file.text();
      const parsedRows = parseCSV(text);

      if (parsedRows.length === 0) {
        throw new Error("The CSV file is empty or has no rows.");
      }

      if (parsedRows.length > 500) {
        throw new Error("Maximum of 500 rows allowed per API preview/import batch.");
      }

      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", rows: parsedRows })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to parse preview from CSV.");
      }

      setPreviewSummary(data.summary);
      setPreviewRows(data.rows);
      setImportStep("preview");
    } catch (err: any) {
      setImportError(err.message || "Failed to preview file.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCSVImport = async () => {
    if (previewRows.length === 0) return;
    setIsProcessingImport(true);
    setImportError(null);

    try {
      const chunkSize = 100;
      const totalRows = previewRows.map(r => ({
        name: r.name,
        rollNumber: r.rollNumber,
        email: r.email,
        contactNumber: r.contactNumber,
        year: r.year,
        branch: r.branch,
        department: r.department,
        section: r.section,
        cgpa: r.cgpa,
        codechefUsername: r.codechefUsername,
        leetcodeUsername: r.leetcodeUsername,
        codeforcesUsername: r.codeforcesUsername,
        githubUsername: r.githubUsername,
        linkedinUrl: r.linkedinUrl,
        hackerrankUsername: r.hackerrankUsername,
        hackerearthUsername: r.hackerearthUsername,
      }));

      const finalMetrics = {
        totalRows: totalRows.length,
        actuallyCreated: 0,
        actuallyUpdated: 0,
        unchanged: 0,
        incompleteCreated: 0,
        duplicateRollSkipped: 0,
        duplicateEmailSkipped: 0,
        invalidIdentitySkipped: 0,
        duplicateHandlesCleared: 0,
        databaseFailures: 0,
      };

      const failedDetails: any[] = [];
      const importedIds: string[] = [];

      const totalChunks = Math.ceil(totalRows.length / chunkSize);

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, totalRows.length);
        const chunk = totalRows.slice(start, end);

        const res = await fetch("/api/students/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "import",
            rows: chunk,
            batchIndex: chunkIndex,
            totalBatches: totalChunks
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Batch ingestion failed.");
        }

        finalMetrics.actuallyCreated += data.summary.actuallyCreated || 0;
        finalMetrics.actuallyUpdated += data.summary.actuallyUpdated || 0;
        finalMetrics.unchanged += data.summary.unchanged || 0;
        finalMetrics.incompleteCreated += data.summary.incompleteCreated || 0;
        finalMetrics.duplicateRollSkipped += data.summary.duplicateRollSkipped || 0;
        finalMetrics.duplicateEmailSkipped += data.summary.duplicateEmailSkipped || 0;
        finalMetrics.invalidIdentitySkipped += data.summary.invalidIdentitySkipped || 0;
        finalMetrics.duplicateHandlesCleared += data.summary.duplicateHandlesCleared || 0;
        finalMetrics.databaseFailures += data.summary.databaseFailures || 0;

        if (data.failedRows) {
          failedDetails.push(...data.failedRows);
        }
        if (data.importedIds) {
          importedIds.push(...data.importedIds);
        }
      }

      setFinalSummary({
        metrics: finalMetrics,
        failedRows: failedDetails,
        importedIds
      });

      showToast(`Bulk roster ingestion completed successfully.`, "success");
      setImportStep("summary");
      fetchDirectoryData();
    } catch (err: any) {
      setImportError(err.message || "Bulk import processing failed.");
    } finally {
      setIsProcessingImport(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-background text-brand-text p-6 md:p-8 space-y-6">
      
      {/* Header and Add Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-brand-border/60 pb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-brand-text uppercase tracking-widest flex items-center gap-3">
            <Users className="h-6 w-6 text-brand-accent" /> Student Directory
          </h1>
          <p className="text-xs text-brand-muted mt-1 font-bold uppercase tracking-wider">
            Academic placements and profile administration
          </p>
        </div>

        {/* Global Staff Mode Tags / Admin buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-brand-card/50 border border-brand-border/40 text-[10px] font-black uppercase tracking-wider text-brand-muted select-none">
            Role: <span className="text-brand-accent ml-1.5">{userRole}</span>
          </div>

          {!isReadOnly && isAdmin && (
            <div className="flex items-center gap-2">
              {level === "sections" && (
                <button
                  onClick={() => setShowSectionModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-brand-card hover:bg-brand-card/75 border border-brand-border text-brand-text transition-all cursor-pointer hover:border-brand-accent/50"
                >
                  <Plus className="h-4 w-4 text-brand-accent" /> Add Section
                </button>
              )}
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-brand-card hover:bg-brand-card/75 border border-brand-border text-brand-text transition-all cursor-pointer hover:border-brand-accent/50"
              >
                <FileText className="h-4 w-4 text-brand-accent" /> Import Roster
              </button>
              <button
                onClick={() => handleOpenStudentModal("create")}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-brand-accent hover:bg-brand-accent/80 text-black font-black transition-all cursor-pointer shadow-lg shadow-brand-accent/10"
              >
                <Plus className="h-4 w-4" /> Add Student
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Breadcrumbs Explorer Navigation */}
      <div className="flex items-center flex-wrap gap-2 text-xs text-brand-muted select-none font-bold uppercase tracking-wider">
        <button
          onClick={() => navigateToLevel("cohorts")}
          className={`hover:text-brand-text transition-colors ${level === "cohorts" ? "text-brand-accent font-black" : ""}`}
        >
          College
        </button>
        
        {selectedCohort && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <button
              onClick={() => navigateToLevel("departments")}
              className={`hover:text-brand-text transition-colors ${level === "departments" ? "text-brand-accent font-black" : ""}`}
            >
              {selectedCohort.code}
            </button>
          </>
        )}

        {selectedDepartment && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <button
              onClick={() => navigateToLevel("sections")}
              className={`hover:text-brand-text transition-colors ${level === "sections" ? "text-brand-accent font-black" : ""}`}
            >
              {selectedDepartment.code}
            </button>
          </>
        )}

        {selectedSection && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-brand-accent font-black">
              {selectedSection.id === "unassigned" ? "Unassigned Students" : `Section ${selectedSection.name}`}
            </span>
          </>
        )}
      </div>

      {/* Main Directory Display Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="h-10 w-10 text-brand-accent animate-spin" />
          <p className="text-xs text-brand-muted font-bold uppercase tracking-widest animate-pulse">Loading directory contents...</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* LEVEL 1: Cohorts Grid */}
          {level === "cohorts" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cohorts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCohort({ id: c.id, code: c.code });
                    setCurrentPage(1);
                  }}
                  className="group flex flex-col p-6 rounded-2xl bg-brand-card/35 hover:bg-brand-card/65 border border-brand-border/60 hover:border-brand-accent/40 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-black/25"
                >
                  <div className="flex items-start justify-between">
                    <div className="p-3.5 rounded-xl bg-brand-muted/10 text-brand-muted group-hover:text-brand-accent group-hover:bg-brand-accent/10 transition-colors">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                      c.status === "ACTIVE" ? "bg-green-500/10 text-green-500 border border-green-500/25" :
                      c.status === "ARCHIVED" ? "bg-red-500/10 text-red-500 border border-red-500/25" :
                      "bg-brand-muted/20 text-brand-muted border border-brand-border"
                    }`}>
                      {c.status}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-brand-text uppercase tracking-wider mt-4 group-hover:text-brand-accent transition-colors">
                    Cohort {c.code}
                  </h3>
                  <p className="text-[10px] text-brand-muted uppercase font-bold tracking-wider mt-0.5">
                    Batch Period: {c.startYear} – {c.endYear}
                  </p>

                  <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-brand-border/30 text-center">
                    <div>
                      <p className="text-lg font-black text-brand-text group-hover:text-brand-accent transition-colors">{c.studentCount}</p>
                      <p className="text-[8px] text-brand-muted uppercase tracking-wider font-bold">Students</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-brand-text">{c.departmentCount}</p>
                      <p className="text-[8px] text-brand-muted uppercase tracking-wider font-bold">Departments</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-brand-text">{c.sectionCount}</p>
                      <p className="text-[8px] text-brand-muted uppercase tracking-wider font-bold">Sections</p>
                    </div>
                  </div>
                </div>
              ))}
              {cohorts.length === 0 && <EmptyState text="No active cohorts registered in system." />}
            </div>
          )}

          {/* LEVEL 2: Departments Grid (inside Cohort) */}
          {level === "departments" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => navigateToLevel("cohorts")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-card border border-brand-border/60 hover:text-brand-accent hover:border-brand-accent/40 transition-all font-bold uppercase tracking-wider cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to cohorts
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {departments.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => {
                      setSelectedDepartment({ id: d.id, code: d.code, name: d.name });
                      setCurrentPage(1);
                    }}
                    className="group flex flex-col p-6 rounded-2xl bg-brand-card/35 hover:bg-brand-card/65 border border-brand-border/60 hover:border-brand-accent/40 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-black/25"
                  >
                    <div className="p-3.5 rounded-xl bg-brand-muted/10 text-brand-muted group-hover:text-brand-accent group-hover:bg-brand-accent/10 transition-colors w-fit">
                      <Building2 className="h-6 w-6" />
                    </div>

                    <h3 className="text-base font-black text-brand-text uppercase tracking-wider mt-4 group-hover:text-brand-accent transition-colors">
                      {d.code}
                    </h3>
                    <p className="text-[10px] text-brand-muted uppercase font-bold tracking-wider mt-0.5 line-clamp-1">
                      {d.name}
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-6 pt-4 border-t border-brand-border/30 text-center">
                      <div>
                        <p className="text-base font-black text-brand-text group-hover:text-brand-accent transition-colors">{d.studentCount}</p>
                        <p className="text-[8px] text-brand-muted uppercase tracking-wider font-bold">Students</p>
                      </div>
                      <div>
                        <p className="text-base font-black text-brand-text">{d.sectionCount}</p>
                        <p className="text-[8px] text-brand-muted uppercase tracking-wider font-bold">Class Sections</p>
                      </div>
                    </div>
                  </div>
                ))}
                {departments.length === 0 && <EmptyState text="No active departments found inside cohort." />}
              </div>
            </div>
          )}

          {/* LEVEL 3: Sections & Unassigned Grid */}
          {level === "sections" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => navigateToLevel("departments")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-card border border-brand-border/60 hover:text-brand-accent hover:border-brand-accent/40 transition-all font-bold uppercase tracking-wider cursor-pointer"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to departments
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Regular Sections */}
                {sections.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSection({ id: s.id, name: s.name });
                      setCurrentPage(1);
                    }}
                    className="group flex flex-col p-6 rounded-2xl bg-brand-card/35 hover:bg-brand-card/65 border border-brand-border/60 hover:border-brand-accent/40 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-black/25"
                  >
                    <div className="p-3.5 rounded-xl bg-brand-muted/10 text-brand-muted group-hover:text-brand-accent group-hover:bg-brand-accent/10 transition-colors w-fit">
                      <Network className="h-6 w-6" />
                    </div>

                    <h3 className="text-base font-black text-brand-text uppercase tracking-wider mt-4 group-hover:text-brand-accent transition-colors">
                      Section {s.name}
                    </h3>
                    <p className="text-[10px] text-brand-muted uppercase font-bold tracking-wider mt-0.5">
                      Academic Class Section
                    </p>

                    <div className="mt-6 pt-4 border-t border-brand-border/30 text-center">
                      <p className="text-lg font-black text-brand-text group-hover:text-brand-accent transition-colors">{s.studentCount}</p>
                      <p className="text-[8px] text-brand-muted uppercase tracking-wider font-bold">Enrolled Students</p>
                    </div>
                  </div>
                ))}

                {/* Special "Unassigned" Bucket Card */}
                <div
                  onClick={() => {
                    setSelectedSection({ id: "unassigned", name: "Unassigned" });
                    setCurrentPage(1);
                  }}
                  className="group flex flex-col p-6 rounded-2xl bg-[#EAB308]/5 hover:bg-[#EAB308]/10 border border-[#EAB308]/20 hover:border-[#EAB308]/50 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-black/25"
                >
                  <div className="p-3.5 rounded-xl bg-[#EAB308]/10 text-[#EAB308] group-hover:bg-[#EAB308]/20 transition-colors w-fit">
                    <AlertTriangle className="h-6 w-6" />
                  </div>

                  <h3 className="text-base font-black text-[#EAB308] uppercase tracking-wider mt-4">
                    Unassigned Students
                  </h3>
                  <p className="text-[10px] text-brand-muted uppercase font-bold tracking-wider mt-0.5">
                    No section/registry allocation
                  </p>

                  <div className="mt-6 pt-4 border-t border-[#EAB308]/15 text-center">
                    <p className="text-lg font-black text-[#EAB308]">{unassignedCount}</p>
                    <p className="text-[8px] text-brand-muted uppercase tracking-wider font-bold">Enrolled Students</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LEVEL 4: Student Table List View */}
          {level === "students" && selectedSection && (
            <div className="space-y-6">
              
              {/* Back controls and table parameters */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigateToLevel("sections")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-card border border-brand-border/60 hover:text-brand-accent hover:border-brand-accent/40 transition-all font-bold uppercase tracking-wider cursor-pointer text-xs"
                  >
                    <ArrowLeft className="h-3 w-3" /> Back to sections
                  </button>
                </div>

                {/* Filter and search bar */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                  {/* Status Toggle buttons */}
                  <div className="inline-flex rounded-xl p-1 bg-brand-card/45 border border-brand-border/60 w-full sm:w-auto">
                    {(["active", "archived", "all"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status);
                          setCurrentPage(1);
                        }}
                        className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          statusFilter === status
                            ? "bg-brand-accent text-black font-black"
                            : "text-brand-muted hover:text-brand-text"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  {/* Search input field */}
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Search name or roll number..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full bg-brand-card/45 border border-brand-border/60 rounded-xl px-4 py-2 pl-9 text-xs text-brand-text placeholder-brand-muted/75 focus:outline-none focus:border-brand-accent/60 transition-all"
                    />
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-brand-muted/70" />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setCurrentPage(1);
                        }}
                        className="absolute right-3 top-2.5 text-brand-muted hover:text-brand-text"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Responsive Table */}
              <div className="overflow-x-auto rounded-2xl border border-brand-border/70 bg-brand-card/15 shadow-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-brand-border/75 bg-brand-card/45 text-brand-muted font-black uppercase tracking-wider select-none text-[10px]">
                      <th className="p-4">Student & Identity</th>
                      <th className="p-4">Contact Info</th>
                      <th className="p-4">Academic Details</th>
                      <th className="p-4">Profiles & Ratings</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr
                        key={student.id}
                        className={`border-b border-brand-border/40 hover:bg-brand-card/20 transition-all ${
                          student.archivedAt ? "opacity-65 bg-brand-card/5" : ""
                        }`}
                      >
                        {/* Name & Roll */}
                        <td className="p-4">
                          <div className="font-bold text-brand-text text-sm leading-tight">
                            {student.name}
                          </div>
                          <div className="text-[10px] text-brand-accent font-black tracking-widest uppercase mt-0.5">
                            {student.rollNumber}
                          </div>
                        </td>

                        {/* Email & Contact */}
                        <td className="p-4 space-y-0.5">
                          <div className="text-brand-text/90 font-medium">{student.email || "N/A"}</div>
                          <div className="text-brand-muted text-[10px]">{student.contactNumber || "N/A"}</div>
                        </td>

                        {/* Academics */}
                        <td className="p-4 space-y-0.5">
                          <div className="text-brand-text">Year of Study: <span className="font-bold">{student.year}</span></div>
                          <div className="text-brand-muted text-[10px]">CGPA: <span className="font-bold text-brand-text">{student.cgpa !== null ? student.cgpa.toFixed(2) : "N/A"}</span></div>
                        </td>

                        {/* Ratings */}
                        <td className="p-4 space-y-0.5">
                          <div className="flex items-center gap-1.5 text-brand-text">
                            <span className="text-[9px] uppercase tracking-wider font-black text-brand-muted w-14">CodeChef:</span>
                            <span className="font-bold text-brand-accent">{student.codechefRating !== null ? student.codechefRating : "—"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-brand-text">
                            <span className="text-[9px] uppercase tracking-wider font-black text-brand-muted w-14">LeetCode:</span>
                            <span className="font-bold text-brand-accent">{student.leetcodeSolved !== null ? student.leetcodeSolved : "—"}</span>
                          </div>
                        </td>

                        {/* Status flags */}
                        <td className="p-4">
                          {student.archivedAt ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-wider">
                              Archived
                            </span>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              student.profileStatus === "VERIFIED" ? "bg-green-500/10 text-green-500 border border-green-500/20" :
                              student.profileStatus === "PENDING_VERIFICATION" ? "bg-[#EAB308]/10 text-[#EAB308] border border-[#EAB308]/20" :
                              "bg-brand-muted/20 text-brand-muted border border-brand-border"
                            }`}>
                              {student.profileStatus}
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="p-4 text-right">
                          <div className="inline-flex gap-1.5">
                            {/* View Profile */}
                            <a
                              href={`/student/${student.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-xl border border-brand-border bg-brand-card hover:text-brand-accent hover:border-brand-accent/50 transition-colors cursor-pointer"
                              title="View Student details"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>

                            {!isReadOnly && (
                              <>
                                {/* Edit Student */}
                                <button
                                  onClick={() => handleOpenStudentModal("edit", student)}
                                  className="p-2 rounded-xl border border-brand-border bg-brand-card hover:text-[#EAB308] hover:border-[#EAB308]/50 transition-colors cursor-pointer"
                                  title="Edit profile & academic placement"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>

                                {/* Toggle Archive status */}
                                <button
                                  onClick={() => handleToggleArchive(student)}
                                  className={`p-2 rounded-xl border border-brand-border bg-brand-card transition-colors cursor-pointer ${
                                    student.archivedAt
                                      ? "hover:text-green-500 hover:border-green-500/50"
                                      : "hover:text-[#EAB308] hover:border-[#EAB308]/50"
                                  }`}
                                  title={student.archivedAt ? "Restore Student" : "Archive Student"}
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </button>

                                {/* Permanent Deletion */}
                                {isAdmin && canDelete && (
                                  <button
                                    onClick={() => handleOpenDeleteDialog(student)}
                                    className="p-2 rounded-xl border border-brand-border bg-brand-card hover:text-red-500 hover:border-red-500/50 transition-colors cursor-pointer"
                                    title="Permanently Delete student record"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-brand-muted uppercase font-bold text-xs">
                          No students enrolled in this section match filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-xs font-bold uppercase tracking-wider text-brand-muted">
                  <div>
                    Showing page {currentPage} of {totalPages} ({totalStudents} students total)
                  </div>
                  <div className="inline-flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-xl border border-brand-border/60 bg-brand-card hover:text-brand-text disabled:opacity-40 disabled:hover:text-brand-muted cursor-pointer transition-all"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-xl border border-brand-border/60 bg-brand-card hover:text-brand-text disabled:opacity-40 disabled:hover:text-brand-muted cursor-pointer transition-all"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* CREATE SECTION MODAL */}
      {showSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-brand-border bg-brand-card/95 p-6 shadow-2xl space-y-6">
            <button
              onClick={() => setShowSectionModal(false)}
              className="absolute right-4 top-4 text-brand-muted hover:text-brand-text"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-base font-black text-brand-text uppercase tracking-widest flex items-center gap-2">
                <Network className="h-5 w-5 text-brand-accent" /> Create Class Section
              </h2>
              <p className="text-[10px] text-brand-muted uppercase font-bold tracking-wider mt-1">
                Creating under {selectedCohort?.code} — {selectedDepartment?.code}
              </p>
            </div>

            <form onSubmit={handleAddSection} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-brand-muted">Section Name (Required)</label>
                <input
                  type="text"
                  placeholder="e.g. A, B, Section 1"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2.5 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent/60"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-brand-muted">Student Capacity (Optional)</label>
                <input
                  type="number"
                  placeholder="e.g. 60"
                  value={sectionForm.capacity}
                  onChange={(e) => setSectionForm((f) => ({ ...f, capacity: e.target.value }))}
                  className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2.5 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent/60"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-brand-border/40">
                <button
                  type="button"
                  onClick={() => setShowSectionModal(false)}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-brand-background border border-brand-border text-brand-muted hover:text-brand-text cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-brand-accent hover:bg-brand-accent/95 text-black font-black disabled:opacity-50 cursor-pointer transition-all"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD/EDIT STUDENT MODAL */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-brand-border bg-brand-card/95 p-6 shadow-2xl space-y-6 my-8">
            <button
              onClick={() => setShowStudentModal(false)}
              className="absolute right-4 top-4 text-brand-muted hover:text-brand-text"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-base font-black text-brand-text uppercase tracking-widest flex items-center gap-2">
                {modalMode === "create" ? <Plus className="h-5 w-5 text-brand-accent" /> : <Edit className="h-5 w-5 text-[#EAB308]" />}
                {modalMode === "create" ? "Add Student Profile" : "Edit Student Placement"}
              </h2>
              <p className="text-[10px] text-brand-muted uppercase font-bold tracking-wider mt-1">
                {modalMode === "create" ? "Provision a new student record manually" : `Modifying student details of ${editingStudent?.rollNumber}`}
              </p>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-6">
              
              {/* Profile Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">Name (Required)</label>
                  <input
                    type="text"
                    required
                    value={studentForm.name}
                    onChange={(e) => setStudentForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent/60"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">Roll Number (Required & Immutable)</label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === "edit"}
                    value={studentForm.rollNumber}
                    onChange={(e) => setStudentForm((f) => ({ ...f, rollNumber: e.target.value.toUpperCase() }))}
                    className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text disabled:opacity-50 focus:outline-none focus:border-brand-accent/60"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">Email (Immutable once set)</label>
                  <input
                    type="email"
                    disabled={modalMode === "edit" && !!editingStudent?.email}
                    value={studentForm.email}
                    onChange={(e) => setStudentForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text disabled:opacity-50 focus:outline-none focus:border-brand-accent/60"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">Contact Number</label>
                  <input
                    type="text"
                    value={studentForm.contactNumber}
                    onChange={(e) => setStudentForm((f) => ({ ...f, contactNumber: e.target.value }))}
                    className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">Year of Study (1-4)</label>
                  <select
                    value={studentForm.year}
                    onChange={(e) => setStudentForm((f) => ({ ...f, year: e.target.value }))}
                    className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">CGPA (0 to 10)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    placeholder="e.g. 8.50"
                    value={studentForm.cgpa}
                    onChange={(e) => setStudentForm((f) => ({ ...f, cgpa: e.target.value }))}
                    className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                  />
                </div>
              </div>

              {/* Academic Placement registry details */}
              <div className="border-t border-brand-border/40 pt-4 space-y-4">
                <h3 className="text-xs font-black text-brand-text uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4 text-brand-accent" /> Academic Registry Placement
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Cohort select */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">Cohort (Required)</label>
                    <select
                      required
                      value={studentForm.cohortId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStudentForm((f) => ({ ...f, cohortId: val, classSectionId: "" }));
                        loadRefSections(val, studentForm.departmentId);
                      }}
                      className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                    >
                      <option value="">Select Cohort</option>
                      {refCohorts.map((c) => (
                        <option key={c.id} value={c.id}>
                          Cohort {c.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Department select */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">Department (Required)</label>
                    <select
                      required
                      value={studentForm.departmentId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStudentForm((f) => ({ ...f, departmentId: val, classSectionId: "" }));
                        loadRefSections(studentForm.cohortId, val);
                      }}
                      className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                    >
                      <option value="">Select Department</option>
                      {refDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ClassSection select */}
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">Class Section (Optional)</label>
                    <select
                      value={studentForm.classSectionId}
                      onChange={(e) => setStudentForm((f) => ({ ...f, classSectionId: e.target.value }))}
                      className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                    >
                      <option value="">Unassigned (Null)</option>
                      {refSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          Section {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Profiles & Handles */}
              <div className="border-t border-brand-border/40 pt-4 space-y-4">
                <h3 className="text-xs font-black text-brand-text uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-brand-accent" /> Platform Usernames / Profile URLs
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">CodeChef Username / URL</label>
                    <input
                      type="text"
                      placeholder="e.g. tejaswy_k"
                      value={studentForm.codechefUsername}
                      onChange={(e) => setStudentForm((f) => ({ ...f, codechefUsername: e.target.value }))}
                      className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent/60"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">LeetCode Username / URL</label>
                    <input
                      type="text"
                      placeholder="e.g. tejaswy_k"
                      value={studentForm.leetcodeUsername}
                      onChange={(e) => setStudentForm((f) => ({ ...f, leetcodeUsername: e.target.value }))}
                      className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text placeholder-brand-muted focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">Codeforces Username</label>
                    <input
                      type="text"
                      placeholder="e.g. tejaswy_k"
                      value={studentForm.codeforcesUsername}
                      onChange={(e) => setStudentForm((f) => ({ ...f, codeforcesUsername: e.target.value }))}
                      className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">GitHub Username</label>
                    <input
                      type="text"
                      placeholder="e.g. tejaswy"
                      value={studentForm.githubUsername}
                      onChange={(e) => setStudentForm((f) => ({ ...f, githubUsername: e.target.value }))}
                      className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">HackerRank Username / URL</label>
                    <input
                      type="text"
                      placeholder="e.g. tejaswy_k"
                      value={studentForm.hackerrankUsername}
                      onChange={(e) => setStudentForm((f) => ({ ...f, hackerrankUsername: e.target.value }))}
                      className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">HackerEarth Username / URL</label>
                    <input
                      type="text"
                      placeholder="e.g. tejaswy_k"
                      value={studentForm.hackerearthUsername}
                      onChange={(e) => setStudentForm((f) => ({ ...f, hackerearthUsername: e.target.value }))}
                      className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[9px] uppercase font-black tracking-wider text-brand-muted">LinkedIn Profile URL</label>
                    <input
                      type="url"
                      placeholder="e.g. https://linkedin.com/in/tejaswy-kanchana"
                      value={studentForm.linkedinUrl}
                      onChange={(e) => setStudentForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
                      className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Leaderboard Eligibility Checklist (Only in Edit Mode) */}
              {modalMode === "edit" && editingStudent && (
                <div className="border-t border-brand-border/40 pt-4 space-y-3">
                  <h3 className="text-xs font-black text-brand-text uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-brand-accent" /> Leaderboard Eligibility Checklist
                  </h3>

                  <div className="bg-brand-background/40 border border-brand-border/60 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* CodeChef Configured */}
                      <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-brand-card/10 border border-brand-border/30">
                        <span className="text-brand-muted font-bold uppercase tracking-wider">CodeChef Configured</span>
                        {!!editingStudent.codechefUsername ? (
                          <span className="text-green-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">✓ Yes</span>
                        ) : (
                          <span className="text-red-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">✗ Missing</span>
                        )}
                      </div>

                      {/* CodeChef Verified */}
                      <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-brand-card/10 border border-brand-border/30">
                        <span className="text-brand-muted font-bold uppercase tracking-wider">CodeChef Verified</span>
                        {editingStudent.platformAccounts?.find((p: any) => p.platform === "CODECHEF")?.verificationStatus === "VERIFIED" ? (
                          <span className="text-green-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">✓ Verified</span>
                        ) : (
                          <span className="text-red-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">✗ {editingStudent.platformAccounts?.find((p: any) => p.platform === "CODECHEF")?.verificationStatus || "NOT_CONFIGURED"}</span>
                        )}
                      </div>

                      {/* LeetCode Configured */}
                      <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-brand-card/10 border border-brand-border/30">
                        <span className="text-brand-muted font-bold uppercase tracking-wider">LeetCode Configured</span>
                        {!!editingStudent.leetcodeUsername ? (
                          <span className="text-green-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">✓ Yes</span>
                        ) : (
                          <span className="text-red-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">✗ Missing</span>
                        )}
                      </div>

                      {/* LeetCode Verified */}
                      <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-brand-card/10 border border-brand-border/30">
                        <span className="text-brand-muted font-bold uppercase tracking-wider">LeetCode Verified</span>
                        {editingStudent.platformAccounts?.find((p: any) => p.platform === "LEETCODE")?.verificationStatus === "VERIFIED" ? (
                          <span className="text-green-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">✓ Verified</span>
                        ) : (
                          <span className="text-red-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">✗ {editingStudent.platformAccounts?.find((p: any) => p.platform === "LEETCODE")?.verificationStatus || "NOT_CONFIGURED"}</span>
                        )}
                      </div>

                      {/* Admin Approval Status */}
                      <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-brand-card/10 border border-brand-border/30 md:col-span-2">
                        <span className="text-brand-muted font-bold uppercase tracking-wider">Admin Approval Status</span>
                        {editingStudent.adminApprovalStatus === "APPROVED" ? (
                          <span className="text-green-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">✓ APPROVED</span>
                        ) : (
                          <span className="text-yellow-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">⚠ {editingStudent.adminApprovalStatus || "PENDING"}</span>
                        )}
                      </div>
                    </div>

                    {/* Overall Status banner */}
                    <div className={`p-3 rounded-lg border text-xs font-black uppercase tracking-widest text-center ${editingStudent.leaderboardEligible ? "bg-green-950/20 border-green-500/30 text-green-400" : "bg-red-950/20 border-red-500/30 text-red-400"}`}>
                      {editingStudent.leaderboardEligible ? "✓ Eligible for Leaderboard & Dashboard" : "✗ Not Eligible (Fails Checklist)"}
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-brand-border/40">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-brand-background border border-brand-border text-brand-muted hover:text-brand-text cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-brand-accent hover:bg-brand-accent/95 text-black font-black disabled:opacity-50 cursor-pointer transition-all"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save Student
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE DIALOG */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-brand-card/95 p-6 shadow-2xl space-y-6">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute right-4 top-4 text-brand-muted hover:text-brand-text"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <h2 className="text-base font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                <Trash2 className="h-5 w-5" /> Delete Student Profile
              </h2>
              <p className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">
                Permanent destructive operation. Cannot be undone.
              </p>
            </div>

            <form onSubmit={handleConfirmDelete} className="space-y-4">
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl space-y-1 text-xs text-red-400">
                <p className="font-bold">Target Student: {studentToDelete?.name} ({studentToDelete?.rollNumber})</p>
                <p className="text-[10px] text-brand-muted leading-relaxed">
                  This deletes their StudentProfile, current StudentEnrollment, platform profiles (CodeChef, LeetCode, GitHub), and disables their access record.
                </p>
              </div>

              {/* Reason select */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-brand-muted">Deletion Reason (Required)</label>
                <select
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                >
                  <option value="Incorrect Roll Number">Incorrect Roll Number</option>
                  <option value="Duplicate Entry">Duplicate Entry</option>
                  <option value="Graduated">Graduated / Alumni Cleanup</option>
                  <option value="Other">Other (Require Notes)</option>
                </select>
              </div>

              {/* Notes for other */}
              {deleteReason === "Other" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black tracking-wider text-brand-muted">Notes / Explanation</label>
                  <textarea
                    rows={3}
                    placeholder="Enter details here..."
                    required
                    value={deleteNotes}
                    onChange={(e) => setDeleteNotes(e.target.value)}
                    className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text focus:outline-none"
                  />
                </div>
              )}

              {/* Typing confirmation */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-brand-muted flex flex-wrap gap-1">
                  Type <span className="text-red-500 font-bold select-none">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  placeholder="Type DELETE"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  required
                  className="w-full bg-brand-background border border-brand-border rounded-xl px-4 py-2 text-xs text-brand-text placeholder-brand-muted focus:outline-none focus:border-red-500/60"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-brand-border/40">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-brand-background border border-brand-border text-brand-muted hover:text-brand-text cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || deleteConfirmText !== "DELETE"}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-red-600 hover:bg-red-500 text-white font-black disabled:opacity-40 cursor-pointer transition-all"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Permanently Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK ROSTER IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl border border-brand-border bg-brand-card/95 p-6 shadow-2xl space-y-6 my-8">
            <button
              onClick={() => {
                setShowImportModal(false);
                setImportStep("upload");
                setImportFile(null);
                setPreviewRows([]);
                setPreviewSummary(null);
                setFinalSummary(null);
                setImportError(null);
              }}
              className="absolute right-4 top-4 text-brand-muted hover:text-brand-text cursor-pointer transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-base font-black text-brand-text uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-accent" /> Bulk Student Roster Ingestion
              </h2>
              <p className="text-[10px] text-brand-muted uppercase font-bold tracking-wider mt-1">
                Upload CSV student roster with academic placements and coding handles
              </p>
            </div>

            {/* Stepper indicators */}
            <div className="flex items-center gap-4 text-xs font-black uppercase tracking-wider text-brand-muted border-b border-brand-border/40 pb-4">
              <span className={`flex items-center gap-1.5 ${importStep === "upload" ? "text-brand-accent" : ""}`}>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${importStep === "upload" ? "bg-brand-accent text-black" : "bg-brand-border"}`}>1</span>
                Upload
              </span>
              <ChevronRight className="h-4 w-4 text-brand-border" />
              <span className={`flex items-center gap-1.5 ${importStep === "preview" ? "text-brand-accent" : ""}`}>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${importStep === "preview" ? "bg-brand-accent text-black" : "bg-brand-border"}`}>2</span>
                Preview
              </span>
              <ChevronRight className="h-4 w-4 text-brand-border" />
              <span className={`flex items-center gap-1.5 ${importStep === "summary" ? "text-brand-accent" : ""}`}>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${importStep === "summary" ? "bg-brand-accent text-black" : "bg-brand-border"}`}>3</span>
                Summary
              </span>
            </div>

            {/* STEP 1: UPLOAD STEP */}
            {importStep === "upload" && (
              <div className="space-y-6">
                <div 
                  className="flex flex-col items-center justify-center border-2 border-dashed border-brand-border hover:border-brand-accent/50 rounded-2xl p-12 text-center bg-brand-background/40 hover:bg-brand-background/60 transition-all cursor-pointer group"
                  onClick={() => document.getElementById("csv-file-input")?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) {
                      const file = e.dataTransfer.files[0];
                      if (file.name.endsWith(".csv")) {
                        setImportFile(file);
                        handleCSVPreview(file);
                      } else {
                        setImportError("Invalid file type. Please upload a .csv file.");
                      }
                    }
                  }}
                >
                  <FileText className="h-12 w-12 text-brand-muted group-hover:text-brand-accent transition-colors mb-4" />
                  <p className="text-xs text-brand-text font-bold uppercase tracking-wider">Drag & drop your CSV file here</p>
                  <p className="text-[10px] text-brand-muted mt-1 uppercase">or click to browse from your computer</p>
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        const file = e.target.files[0];
                        setImportFile(file);
                        handleCSVPreview(file);
                      }
                    }}
                  />
                </div>

                {importError && (
                  <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-400 font-bold uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> {importError}
                  </div>
                )}

                <div className="flex justify-between items-center bg-brand-background/30 border border-brand-border/40 p-4 rounded-xl text-[10px] uppercase font-black tracking-wider text-brand-muted">
                  <span>Template requires: name, rollNumber, email, year, department, section, cgpa, codechef, leetcode</span>
                  <a
                    href="data:text/csv;charset=utf-8,name,rollNumber,email,contactNumber,year,branch,department,section,cgpa,codechef,leetcode,codeforces,github,linkedin,hackerrank,hackerearth%0ASmith,22BCE0001,smith@student.com,9876543210,3,CSE,CSE,A,8.5,cc_smith,lc_smith,cf_smith,gh_smith,https://linkedin.com/in/smith,hr_smith,he_smith"
                    download="roster_template.csv"
                    className="text-brand-accent hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Download CSV Template <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {/* STEP 2: PREVIEW STEP */}
            {importStep === "preview" && (
              <div className="space-y-6">
                {/* Search & Filter Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 bg-brand-background border border-brand-border rounded-xl px-3 py-1.5 w-full md:max-w-xs">
                    <Search className="h-4 w-4 text-brand-muted" />
                    <input
                      type="text"
                      placeholder="Search preview rows..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      className="bg-transparent border-none text-xs text-brand-text placeholder-brand-muted focus:outline-none w-full"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-brand-muted">
                    <span>Filter:</span>
                    <select
                      value={previewFilter}
                      onChange={(e: any) => setPreviewFilter(e.target.value)}
                      className="bg-brand-background border border-brand-border rounded-xl px-3 py-1.5 text-xs text-brand-text focus:outline-none"
                    >
                      <option value="all">All Rows ({previewRows.length})</option>
                      <option value="new">New Creations ({previewSummary?.newStudents || 0})</option>
                      <option value="existing">Idempotent Updates ({previewSummary?.existingStudents || 0})</option>
                      <option value="invalid">Validation Failures ({previewSummary?.invalid || 0})</option>
                    </select>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="border border-brand-border/60 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-brand-background/60 text-[9px] uppercase font-black tracking-wider text-brand-muted border-b border-brand-border/60">
                        <th className="p-3 w-12 text-center">Row</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Student Info</th>
                        <th className="p-3">Academic Placement</th>
                        <th className="p-3">Coding Handles</th>
                        <th className="p-3">Notes / Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows
                        .filter(r => {
                          const matchesSearch = r.name.toLowerCase().includes(previewSearch.toLowerCase()) || r.rollNumber.toLowerCase().includes(previewSearch.toLowerCase());
                          if (!matchesSearch) return false;
                          if (previewFilter === "new") return !r.isUpdate;
                          if (previewFilter === "existing") return r.isUpdate;
                          if (previewFilter === "invalid") return r.classification !== "READY" && r.classification !== "INCOMPLETE";
                          return true;
                        })
                        .map((r, i) => {
                          const isInvalid = r.classification !== "READY" && r.classification !== "INCOMPLETE";
                          return (
                            <tr key={i} className="border-b border-brand-border/40 hover:bg-brand-card/20 text-xs">
                              <td className="p-3 text-center text-brand-muted font-bold">{r.rowNumber}</td>
                              <td className="p-3">
                                {isInvalid ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-950/40 border border-red-500/30 text-red-400">
                                    Invalid
                                  </span>
                                ) : r.isUpdate ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-yellow-950/40 border border-yellow-500/30 text-yellow-400">
                                    Update
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-green-950/40 border border-green-500/30 text-green-400">
                                    New
                                  </span>
                                )}
                              </td>
                              <td className="p-3 space-y-0.5">
                                <p className="font-black text-brand-text">{r.name}</p>
                                <p className="text-[10px] text-brand-muted font-bold">{r.rollNumber} {r.email ? `• ${r.email}` : ""}</p>
                              </td>
                              <td className="p-3 space-y-0.5">
                                <p className="font-bold text-brand-text">{r.department} - Year {r.year}</p>
                                <p className="text-[10px] text-brand-muted">Section: {r.section || "Unassigned"}</p>
                              </td>
                              <td className="p-3 text-[10px] text-brand-muted space-y-0.5">
                                <p>CodeChef: <span className="text-brand-text font-bold">{r.codechefUsername || "N/A"}</span></p>
                                <p>LeetCode: <span className="text-brand-text font-bold">{r.leetcodeUsername || "N/A"}</span></p>
                              </td>
                              <td className="p-3 text-[10px] max-w-xs truncate">
                                {isInvalid ? (
                                  <span className="text-red-400 font-bold block">{r.reasons.join(", ")}</span>
                                ) : r.isUpdate ? (
                                  <div className="space-y-0.5">
                                    <span className="text-yellow-400 font-bold block">Delta Changes:</span>
                                    {r.changedFields.length > 0 ? (
                                      r.changedFields.map((f: string, fi: number) => (
                                        <span key={fi} className="text-brand-muted block font-semibold">{f}</span>
                                      ))
                                    ) : (
                                      <span className="text-brand-muted block italic">No changes (unchanged)</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-green-400 block font-semibold">New student profile registry</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {importError && (
                  <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-400 font-bold uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> {importError}
                  </div>
                )}

                <div className="flex justify-between items-center pt-4 border-t border-brand-border/40">
                  <button
                    onClick={() => setImportStep("upload")}
                    className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-brand-background border border-brand-border text-brand-muted hover:text-brand-text cursor-pointer transition-all"
                  >
                    Back to Upload
                  </button>
                  <button
                    onClick={handleCSVImport}
                    disabled={isProcessingImport || previewSummary?.invalid === previewRows.length}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl bg-brand-accent hover:bg-brand-accent/95 text-black font-black disabled:opacity-40 cursor-pointer transition-all shadow-lg shadow-brand-accent/15"
                  >
                    {isProcessingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Confirm Roster Import ({previewRows.length - (previewSummary?.invalid || 0)} Valid Rows)
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SUMMARY STEP */}
            {importStep === "summary" && finalSummary && (
              <div className="space-y-6">
                {/* Stats Summary Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-brand-background border border-brand-border/60 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[9px] uppercase font-black tracking-wider text-brand-muted">Total Rows</span>
                    <p className="text-xl font-black text-brand-text">{finalSummary.metrics.totalRows}</p>
                  </div>
                  <div className="bg-green-950/20 border border-green-500/20 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[9px] uppercase font-black tracking-wider text-green-400">Created</span>
                    <p className="text-xl font-black text-green-400">{finalSummary.metrics.actuallyCreated}</p>
                  </div>
                  <div className="bg-yellow-950/20 border border-yellow-500/20 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[9px] uppercase font-black tracking-wider text-yellow-400">Updated</span>
                    <p className="text-xl font-black text-yellow-400">{finalSummary.metrics.actuallyUpdated}</p>
                  </div>
                  <div className="bg-brand-card/40 border border-brand-border/40 p-4 rounded-xl text-center space-y-1">
                    <span className="text-[9px] uppercase font-black tracking-wider text-brand-muted">Unchanged</span>
                    <p className="text-xl font-black text-brand-muted">{finalSummary.metrics.unchanged}</p>
                  </div>
                  <div className="bg-red-950/20 border border-red-500/20 p-4 rounded-xl text-center space-y-1 col-span-2 md:col-span-1">
                    <span className="text-[9px] uppercase font-black tracking-wider text-red-400">Failed</span>
                    <p className="text-xl font-black text-red-400">{finalSummary.metrics.databaseFailures}</p>
                  </div>
                </div>

                {/* Deletion details or Failure logs if present */}
                {finalSummary.failedRows.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase text-red-400 tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" /> Failed / Skipped Rows details ({finalSummary.failedRows.length})
                    </h3>
                    <div className="border border-red-500/20 rounded-xl overflow-hidden max-h-[150px] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead className="bg-red-950/15 border-b border-red-500/20 text-red-400">
                          <tr>
                            <th className="p-2 w-12 text-center">Row</th>
                            <th className="p-2">Roll Number</th>
                            <th className="p-2">Error Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {finalSummary.failedRows.map((f: any, fi: number) => (
                            <tr key={fi} className="border-b border-brand-border/40 hover:bg-brand-card/10">
                              <td className="p-2 text-center text-brand-muted font-bold">{f.rowNumber}</td>
                              <td className="p-2 font-bold text-brand-text">{f.maskedRollNumber}</td>
                              <td className="p-2 text-red-300 font-semibold">{f.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-brand-border/40">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportStep("upload");
                      setImportFile(null);
                      setPreviewRows([]);
                      setPreviewSummary(null);
                      setFinalSummary(null);
                    }}
                    className="px-6 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl bg-brand-accent hover:bg-brand-accent/80 text-black font-black cursor-pointer transition-all"
                  >
                    Finish & Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// Sub-component helper for empty state
function EmptyState({ text }: { text: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 bg-brand-card/10 border border-brand-border/40 rounded-2xl text-center space-y-4">
      <div className="p-4 rounded-full bg-brand-muted/10 text-brand-muted">
        <Folder className="h-10 w-10" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-brand-text uppercase tracking-wider">Directory Empty</h3>
        <p className="text-xs text-brand-muted max-w-sm">{text}</p>
      </div>
    </div>
  );
}
