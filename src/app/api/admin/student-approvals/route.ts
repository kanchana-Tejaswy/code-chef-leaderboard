import { requireAdmin, requireRole, AuthError } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BulkSyncService } from "@/services/bulkSync.service";
import { UserRole } from "@prisma/client";
import { recordAuditEvent } from "@/services/audit.service";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const access = await requireRole(UserRole.ADMIN, UserRole.GK_SIR, UserRole.HOD);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const branch = searchParams.get("branch") || "";
    const yearStr = searchParams.get("year") || "";
    const profileStatus = searchParams.get("profileStatus") || "";
    const adminApprovalStatus = searchParams.get("adminApprovalStatus") || "";
    const codechefStatus = searchParams.get("codechefStatus") || "";
    const leetcodeStatus = searchParams.get("leetcodeStatus") || "";
    const leaderboardEligibleStr = searchParams.get("leaderboardEligible") || "";
    const doExport = searchParams.get("export") === "true";
    
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (access.role === UserRole.HOD) {
      if (!access.departmentId) {
        throw new AuthError("HOD missing department ID", "MISSING_DEPARTMENT");
      }
      where.department = access.departmentId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { rollNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (branch) {
      where.branch = branch;
    }

    if (yearStr) {
      const year = parseInt(yearStr, 10);
      if (!isNaN(year)) {
        where.year = year;
      }
    }

    if (profileStatus) {
      where.profileStatus = profileStatus;
    }

    if (adminApprovalStatus) {
      where.adminApprovalStatus = adminApprovalStatus;
    }

    if (leaderboardEligibleStr) {
      where.leaderboardEligible = leaderboardEligibleStr === "true";
    }

    // CodeChef Status Database Filters
    if (codechefStatus) {
      if (codechefStatus === "Verified") {
        where.codechefProfile = { isNot: null };
      } else if (codechefStatus === "Pending") {
        where.codechefProfile = null;
        where.codechefUsername = { not: null, notIn: [""] };
        where.profileStatus = { not: "INVALID" };
      } else if (codechefStatus === "Failed") {
        where.codechefProfile = null;
        where.codechefUsername = { not: null, notIn: [""] };
        where.profileStatus = "INVALID";
      } else if (codechefStatus === "Missing") {
        where.OR = [
          { codechefUsername: null },
          { codechefUsername: "" },
        ];
      }
    }

    // LeetCode Status Database Filters
    if (leetcodeStatus) {
      if (leetcodeStatus === "Verified") {
        where.leetcodeProfile = { isNot: null };
      } else if (leetcodeStatus === "Pending") {
        where.leetcodeProfile = null;
        where.leetcodeUsername = { not: null, notIn: [""] };
        where.profileStatus = { not: "INVALID" };
      } else if (leetcodeStatus === "Failed") {
        where.leetcodeProfile = null;
        where.leetcodeUsername = { not: null, notIn: [""] };
        where.profileStatus = "INVALID";
      } else if (leetcodeStatus === "Missing") {
        where.OR = [
          { leetcodeUsername: null },
          { leetcodeUsername: "" },
        ];
      }
    }

    if (doExport) {
      if (access.role === UserRole.GK_SIR) {
        await recordAuditEvent({
          actorUserId: access.id,
          action: "GK_SIR_EXPORTED_REPORT",
          targetType: "StudentProfile",
          metadata: { search, branch, year: yearStr, profileStatus, adminApprovalStatus },
        });
      }

      const exportStudents = await prisma.studentProfile.findMany({
        where,
        include: {
          codechefProfile: true,
          leetcodeProfile: true,
        },
        orderBy: { rollNumber: "asc" },
      });

      const exportData = exportStudents.map((s) => {
        const hasCcHandle = Boolean(s.codechefUsername && s.codechefUsername.trim() !== "");
        const hasLcHandle = Boolean(s.leetcodeUsername && s.leetcodeUsername.trim() !== "");
        const isCcVerified = Boolean(s.codechefProfile);
        const isLcVerified = Boolean(s.leetcodeProfile);

        let ccStatus = "Missing";
        if (hasCcHandle) {
          ccStatus = isCcVerified ? "Verified" : (s.profileStatus === "INVALID" ? "Failed" : "Pending");
        }

        let lcStatus = "Missing";
        if (hasLcHandle) {
          lcStatus = isLcVerified ? "Verified" : (s.profileStatus === "INVALID" ? "Failed" : "Pending");
        }

        return {
          Name: s.name,
          "Roll Number": s.rollNumber || "—",
          Branch: s.branch || s.department || "—",
          Year: s.year ? `${s.year} Year` : "—",
          "CodeChef Handle": s.codechefUsername || "—",
          "CodeChef Status": ccStatus,
          "LeetCode Handle": s.leetcodeUsername || "—",
          "LeetCode Status": lcStatus,
          "Sync Status": s.profileStatus === "VERIFIED" ? "SUCCESS" : s.profileStatus === "INVALID" ? "FAILURE" : "PENDING",
          "Profile Status": s.profileStatus,
          "Approval Status": s.adminApprovalStatus,
          "Leaderboard Eligible": s.leaderboardEligible ? "YES" : "NO",
          "Reason": s.profileStatus === "INCOMPLETE" ? "Missing handles" : s.profileStatus === "INVALID" ? "Verification failed" : s.adminApprovalStatus === "APPROVED" ? "Approved" : "Pending review",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
      worksheet["!cols"] = [
        { wch: 22 },
        { wch: 15 },
        { wch: 12 },
        { wch: 8 },
        { wch: 20 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 20 }
      ];

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        headers: {
          "Content-Disposition": "attachment; filename=student-directory-export.xlsx",
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Cache-Control": "private, no-store",
        },
      });
    }

    // Query list and counts in parallel
    const [students, total, eligibleForApproval, alreadyApproved, stillIncomplete, pendingVerification] = await Promise.all([
      prisma.studentProfile.findMany({
        where,
        include: {
          codechefProfile: true,
          leetcodeProfile: true,
          leaderboardEntry: true,
        },
        orderBy: { rollNumber: "asc" },
        skip,
        take: limit,
      }),
      prisma.studentProfile.count({ where }),
      // eligibleForApproval: verified profiles that are not yet approved
      prisma.studentProfile.count({
        where: {
          profileStatus: "VERIFIED",
          adminApprovalStatus: { not: "APPROVED" },
          codechefProfile: { isNot: null },
          leetcodeProfile: { isNot: null },
        }
      }),
      prisma.studentProfile.count({
        where: { adminApprovalStatus: "APPROVED" }
      }),
      prisma.studentProfile.count({
        where: { profileStatus: "INCOMPLETE" }
      }),
      prisma.studentProfile.count({
        where: { profileStatus: "PENDING_VERIFICATION" }
      })
    ]);

    const formattedStudents = students.map((s) => {
      const hasCcHandle = Boolean(s.codechefUsername && s.codechefUsername.trim() !== "");
      const hasLcHandle = Boolean(s.leetcodeUsername && s.leetcodeUsername.trim() !== "");
      const isCcVerified = Boolean(s.codechefProfile);
      const isLcVerified = Boolean(s.leetcodeProfile);

      let ccStatus = "Missing";
      if (hasCcHandle) {
        ccStatus = isCcVerified ? "Verified" : (s.profileStatus === "INVALID" ? "Failed" : "Pending");
      }

      let lcStatus = "Missing";
      if (hasLcHandle) {
        lcStatus = isLcVerified ? "Verified" : (s.profileStatus === "INVALID" ? "Failed" : "Pending");
      }

      const stage = BulkSyncService.getCurrentStage({
        id: s.id,
        profileStatus: s.profileStatus,
        adminApprovalStatus: s.adminApprovalStatus,
        codechefUsername: s.codechefUsername,
        leetcodeUsername: s.leetcodeUsername,
      }, null);

      return {
        id: s.id,
        name: s.name,
        rollNumber: s.rollNumber,
        maskedRollNumber: s.rollNumber ? `${s.rollNumber.slice(0, 2)}***` : "—",
        branch: s.branch || s.department || "CSE",
        year: s.year,
        codechefUsername: s.codechefUsername,
        leetcodeUsername: s.leetcodeUsername,
        codechefStatus: ccStatus,
        leetcodeStatus: lcStatus,
        syncStatus: s.profileStatus === "VERIFIED" ? "SUCCESS" : s.profileStatus === "INVALID" ? "FAILURE" : "PENDING",
        profileStatus: s.profileStatus,
        adminApprovalStatus: s.adminApprovalStatus,
        leaderboardEligible: s.leaderboardEligible,
        dashboardEligible: s.dashboardEligible,
        currentStage: stage,
        reason: s.profileStatus === "INCOMPLETE" ? "Missing handles" : s.profileStatus === "INVALID" ? "Verification failed" : s.adminApprovalStatus === "APPROVED" ? "Approved" : "Pending review",
        lastAttempt: s.updatedAt?.toISOString() || null,
        updatedAt: s.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      students: formattedStudents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        eligibleForApproval,
        alreadyApproved,
        stillIncomplete,
        pendingVerification,
      }
    }, { headers: { "Cache-Control": "private, no-store" } });

  } catch (err: any) {
    console.error("Error fetching student approvals list:", err);
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
