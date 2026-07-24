"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  X,
  Loader2,
  Filter,
  Check,
  Info,
} from "lucide-react";
import { parseSpreadsheetBuffer, exportSkippedRowsCSV } from "@/utils/csvParser";

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CsvImportModal({ isOpen, onClose, onSuccess }: CsvImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [autoSync, setAutoSync] = useState(false);

  const [previewData, setPreviewData] = useState<{
    summary: {
      total: number;
      ready: number;
      incomplete: number;
      duplicateRollNumber: number;
      duplicateEmail: number;
      duplicatePlatformUsername: number;
      invalid: number;
    };
    rows: any[];
  } | null>(null);

  const [importReport, setImportReport] = useState<{
    summary: {
      totalRows: number;
      createdCount: number;
      readyCount: number;
      incompleteCount: number;
      skippedDuplicateRollCount: number;
      skippedDuplicateEmailCount: number;
      skippedDuplicatePlatformCount: number;
      skippedInvalidCount: number;
      failedCount: number;
    };
    rowDetails: any[];
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile: File) => {
    setErrorMsg(null);
    setPreviewData(null);
    setImportReport(null);

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
      setErrorMsg("Invalid file type. Please upload a .csv, .xlsx, or .xls file.");
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const rows = parseSpreadsheetBuffer(buffer);
        if (rows.length === 0) {
          setErrorMsg("No valid rows could be parsed from the file. Please check column headers.");
          setFile(null);
          setIsParsing(false);
          return;
        }
        setParsedRows(rows);
        await generatePreview(rows);
      } catch (err) {
        console.error("Parse error:", err);
        setErrorMsg("Failed to read spreadsheet file.");
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const generatePreview = async (rows: any[]) => {
    setIsPreviewLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", rows }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPreviewData(data);
      } else {
        setErrorMsg(data.error || "Failed to generate preview.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Network error generated while previewing CSV.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const executeImport = async () => {
    if (!parsedRows || parsedRows.length === 0) return;
    setIsImporting(true);
    setErrorMsg(null);

    const BATCH_SIZE = 25;
    const totalBatches = Math.ceil(parsedRows.length / BATCH_SIZE);

    let aggregatedSummary = {
      totalRows: parsedRows.length,
      actuallyCreated: 0,
      incompleteCreated: 0,
      duplicateRollSkipped: 0,
      duplicateEmailSkipped: 0,
      invalidIdentitySkipped: 0,
      duplicateHandlesCleared: 0,
      databaseFailures: 0,
    };
    let aggregatedFailedRows: any[] = [];
    let allImportedIds: string[] = [];

    try {
      for (let b = 0; b < totalBatches; b++) {
        setImportProgress({ current: b + 1, total: totalBatches });
        const chunk = parsedRows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

        const res = await fetch("/api/students/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "import_batch",
            rows: chunk,
            autoSync: autoSync && (b === totalBatches - 1),
            batchIndex: b + 1,
            totalBatches,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || `Batch ${b + 1} of ${totalBatches} failed.`);
        }

        const s = data.summary;
        aggregatedSummary.actuallyCreated += s.actuallyCreated || 0;
        aggregatedSummary.incompleteCreated += s.incompleteCreated || 0;
        aggregatedSummary.duplicateRollSkipped += s.duplicateRollSkipped || 0;
        aggregatedSummary.duplicateEmailSkipped += s.duplicateEmailSkipped || 0;
        aggregatedSummary.invalidIdentitySkipped += s.invalidIdentitySkipped || 0;
        aggregatedSummary.duplicateHandlesCleared += s.duplicateHandlesCleared || 0;
        aggregatedSummary.databaseFailures += s.databaseFailures || 0;

        if (Array.isArray(data.failedRows)) {
          aggregatedFailedRows = aggregatedFailedRows.concat(data.failedRows);
        }
        if (Array.isArray(data.importedIds)) {
          allImportedIds = allImportedIds.concat(data.importedIds);
        }
      }

      const totalSkipped = aggregatedSummary.duplicateRollSkipped + aggregatedSummary.duplicateEmailSkipped + aggregatedSummary.invalidIdentitySkipped;

      setImportReport({
        summary: {
          totalRows: aggregatedSummary.totalRows,
          createdCount: aggregatedSummary.actuallyCreated,
          readyCount: aggregatedSummary.actuallyCreated - aggregatedSummary.incompleteCreated,
          incompleteCount: aggregatedSummary.incompleteCreated,
          skippedDuplicateRollCount: aggregatedSummary.duplicateRollSkipped,
          skippedDuplicateEmailCount: aggregatedSummary.duplicateEmailSkipped,
          skippedDuplicatePlatformCount: aggregatedSummary.duplicateHandlesCleared,
          skippedInvalidCount: aggregatedSummary.invalidIdentitySkipped,
          failedCount: aggregatedSummary.databaseFailures,
        },
        rowDetails: aggregatedFailedRows.map((f) => ({
          rowNumber: f.rowNumber,
          name: "Student Profile",
          rollNumber: f.maskedRollNumber,
          email: "masked@student",
          status: f.status,
          reason: f.reason,
        })),
        displayText: `${aggregatedSummary.actuallyCreated} profiles created, ${totalSkipped} skipped, ${aggregatedSummary.databaseFailures} failed.`,
      } as any);

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Network error occurred during batch bulk import.");
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const handleDownloadSkippedRows = () => {
    if (!importReport) return;
    const skippedOrErrorRows = importReport.rowDetails.filter((r) => r.status !== "READY" && r.status !== "INCOMPLETE");
    if (skippedOrErrorRows.length === 0) return;

    const csvContent = exportSkippedRowsCSV(skippedOrErrorRows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `skipped_students_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "READY":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">READY</span>;
      case "INCOMPLETE":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">INCOMPLETE</span>;
      case "DUPLICATE_ROLL_NUMBER":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">DUPLICATE ROLL</span>;
      case "DUPLICATE_EMAIL":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">DUPLICATE EMAIL</span>;
      case "DUPLICATE_PLATFORM_USERNAME":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">DUPLICATE HANDLE</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">{status}</span>;
    }
  };

  const filteredPreviewRows = previewData?.rows.filter((r) => {
    if (filterStatus === "ALL") return true;
    if (filterStatus === "CREATEABLE") return r.classification === "READY" || r.classification === "INCOMPLETE";
    if (filterStatus === "SKIPPED") return r.classification !== "READY" && r.classification !== "INCOMPLETE";
    return r.classification === filterStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <FileSpreadsheet className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">Student CSV / Excel Bulk Import</h3>
              <p className="text-xs text-zinc-400">Upload cohort spreadsheets to register students without overwriting existing data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Upload Area */}
          {!file && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelect(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-zinc-800 hover:border-amber-500/50 rounded-2xl p-10 text-center transition-all bg-zinc-900/20 hover:bg-zinc-900/40 cursor-pointer flex flex-col items-center justify-center gap-3"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <Upload className="h-8 w-8 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Click or drag & drop spreadsheet file</p>
                <p className="text-xs text-zinc-400 mt-1">Supports official 12-column .CSV, .XLSX, or .XLS files</p>
              </div>
              <button
                type="button"
                className="mt-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-xl transition-all"
              >
                Browse File
              </button>
            </div>
          )}

          {/* File Selection Bar */}
          {file && (
            <div className="flex items-center justify-between p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-xl">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-xs font-bold text-white">{file.name}</p>
                  <p className="text-[11px] text-zinc-400">
                    {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} parsed rows
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setParsedRows([]);
                  setPreviewData(null);
                  setImportReport(null);
                }}
                className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Change File
              </button>
            </div>
          )}

          {/* Loading State */}
          {(isParsing || isPreviewLoading) && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
              <p className="text-xs font-semibold text-zinc-300">Revalidating columns and duplicate constraints...</p>
            </div>
          )}

          {/* Preview Phase */}
          {previewData && !importReport && !isPreviewLoading && (
            <div className="space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2.5">
                <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl text-center">
                  <p className="text-[10px] text-zinc-400 font-medium">TOTAL</p>
                  <p className="text-lg font-bold text-white">{previewData.summary.total}</p>
                </div>
                <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl text-center">
                  <p className="text-[10px] text-amber-400 font-medium">READY</p>
                  <p className="text-lg font-bold text-amber-400">{previewData.summary.ready}</p>
                </div>
                <div className="p-3 bg-yellow-950/20 border border-yellow-500/30 rounded-xl text-center">
                  <p className="text-[10px] text-yellow-300 font-medium">INCOMPLETE</p>
                  <p className="text-lg font-bold text-yellow-300">{previewData.summary.incomplete}</p>
                </div>
                <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl text-center">
                  <p className="text-[10px] text-purple-400 font-medium">DUP HANDLE</p>
                  <p className="text-lg font-bold text-purple-400">{previewData.summary.duplicatePlatformUsername}</p>
                </div>
                <div className="p-3 bg-orange-950/20 border border-orange-500/30 rounded-xl text-center">
                  <p className="text-[10px] text-orange-400 font-medium">DUP ROLL</p>
                  <p className="text-lg font-bold text-orange-400">{previewData.summary.duplicateRollNumber}</p>
                </div>
                <div className="p-3 bg-orange-950/20 border border-orange-500/30 rounded-xl text-center">
                  <p className="text-[10px] text-orange-400 font-medium">DUP EMAIL</p>
                  <p className="text-lg font-bold text-orange-400">{previewData.summary.duplicateEmail}</p>
                </div>
                <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl text-center">
                  <p className="text-[10px] text-red-400 font-medium">INVALID</p>
                  <p className="text-lg font-bold text-red-400">{previewData.summary.invalid}</p>
                </div>
              </div>

              {/* Filter Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-xs text-zinc-400 font-semibold">Filter:</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 text-white text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500"
                  >
                    <option value="ALL">All Rows ({previewData.summary.total})</option>
                    <option value="CREATEABLE">Importable Rows ({previewData.summary.ready + previewData.summary.incomplete})</option>
                    <option value="SKIPPED">Skipped Rows ({previewData.summary.total - previewData.summary.ready - previewData.summary.incomplete})</option>
                    <option value="READY">Ready</option>
                    <option value="INCOMPLETE">Incomplete</option>
                    <option value="DUPLICATE_ROLL_NUMBER">Duplicate Roll Number</option>
                    <option value="DUPLICATE_EMAIL">Duplicate Email</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="accent-amber-500 h-3.5 w-3.5 rounded"
                  />
                  <span>Queue automatic platform sync after import</span>
                </label>
              </div>

              {/* Preview Table */}
              <div className="border border-zinc-800 rounded-xl overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900 text-zinc-400 font-bold sticky top-0 border-b border-zinc-800">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Roll Number</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Dept / Yr</th>
                      <th className="p-2.5">CodeChef</th>
                      <th className="p-2.5">LeetCode</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Reason / Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                    {filteredPreviewRows?.map((r) => (
                      <tr key={r.index} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-2.5 text-zinc-500 font-mono">{r.rowNumber}</td>
                        <td className="p-2.5 font-semibold text-white">{r.name || "-"}</td>
                        <td className="p-2.5 font-mono text-zinc-300">{r.rollNumber || "-"}</td>
                        <td className="p-2.5 text-zinc-400">{r.email || "-"}</td>
                        <td className="p-2.5 text-zinc-400">{r.department} / Yr {r.year}</td>
                        <td className="p-2.5 text-zinc-400 font-mono">{r.codechefUsername || "-"}</td>
                        <td className="p-2.5 text-zinc-400 font-mono">{r.leetcodeUsername || "-"}</td>
                        <td className="p-2.5">{getStatusBadge(r.classification)}</td>
                        <td className="p-2.5 text-zinc-400 max-w-xs truncate" title={r.reasons.join(" ")}>
                          {r.reasons.join(" ") || "Valid profile payload"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Execution Final Report */}
          {importReport && (
            <div className="space-y-5">
              <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-amber-400 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Bulk Import Execution Complete</h4>
                    <p className="text-xs text-zinc-300">
                      Successfully registered {importReport.summary.createdCount} new student profiles. Existing profiles remained untouched.
                    </p>
                  </div>
                </div>
                {importReport.summary.skippedDuplicateRollCount + importReport.summary.skippedDuplicateEmailCount + importReport.summary.skippedInvalidCount > 0 && (
                  <button
                    onClick={handleDownloadSkippedRows}
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-xl transition-all"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Skipped Report (CSV)</span>
                  </button>
                )}
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl text-center">
                  <p className="text-[10px] text-zinc-400 font-medium">TOTAL PROCESSED</p>
                  <p className="text-lg font-bold text-white">{importReport.summary.totalRows}</p>
                </div>
                <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl text-center">
                  <p className="text-[10px] text-amber-400 font-medium font-bold">CREATED</p>
                  <p className="text-lg font-bold text-amber-400">{importReport.summary.createdCount}</p>
                </div>
                <div className="p-3 bg-orange-950/20 border border-orange-500/30 rounded-xl text-center">
                  <p className="text-[10px] text-orange-400 font-medium font-bold">DUP ROLL SKIPPED</p>
                  <p className="text-lg font-bold text-orange-400">{importReport.summary.skippedDuplicateRollCount}</p>
                </div>
                <div className="p-3 bg-orange-950/20 border border-orange-500/30 rounded-xl text-center">
                  <p className="text-[10px] text-orange-400 font-medium font-bold">DUP EMAIL SKIPPED</p>
                  <p className="text-lg font-bold text-orange-400">{importReport.summary.skippedDuplicateEmailCount}</p>
                </div>
                <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl text-center">
                  <p className="text-[10px] text-red-400 font-medium font-bold">INVALID SKIPPED</p>
                  <p className="text-lg font-bold text-red-400">{importReport.summary.skippedInvalidCount}</p>
                </div>
              </div>

              {/* Execution Row Details Table */}
              <div className="border border-zinc-800 rounded-xl overflow-x-auto max-h-64">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900 text-zinc-400 font-bold sticky top-0 border-b border-zinc-800">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Roll Number</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Result / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                    {importReport.rowDetails.map((r, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-2.5 text-zinc-500 font-mono">{r.rowNumber}</td>
                        <td className="p-2.5 font-semibold text-white">{r.name}</td>
                        <td className="p-2.5 font-mono text-zinc-300">{r.rollNumber}</td>
                        <td className="p-2.5 text-zinc-400">{r.email}</td>
                        <td className="p-2.5">{getStatusBadge(r.status)}</td>
                        <td className="p-2.5 text-zinc-400 max-w-xs truncate" title={r.reason}>
                          {r.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
          >
            {importReport ? "Close" : "Cancel"}
          </button>

          {previewData && !importReport && (
            <button
              onClick={executeImport}
              disabled={isImporting || previewData.summary.ready + previewData.summary.incomplete === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{importProgress ? `Processing batch ${importProgress.current} of ${importProgress.total}...` : "Importing Batch..."}</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Import {previewData.summary.ready + previewData.summary.incomplete} Valid Students</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
