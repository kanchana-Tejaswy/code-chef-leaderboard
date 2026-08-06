import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffReadAccess, requireAdmin } from "@/lib/auth";
import { CohortStatus } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffReadAccess();
    const resolvedParams = await params;
    const cohort = await prisma.cohort.findUnique({
      where: { id: resolvedParams.id }
    });

    if (!cohort) {
      return NextResponse.json({ success: false, error: "Cohort not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, cohort });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message || "Access denied." }, { status });
    }
    console.error("GET Cohort Detail Error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const resolvedParams = await params;
    const body = await request.json().catch(() => ({}));
    const { code, startYear, endYear, status } = body;

    const cohortId = resolvedParams.id;
    const currentCohort = await prisma.cohort.findUnique({
      where: { id: cohortId }
    });

    if (!currentCohort) {
      return NextResponse.json({ success: false, error: "Cohort not found." }, { status: 404 });
    }

    const dataToUpdate: any = {};

    if (code !== undefined) {
      if (!code || typeof code !== "string" || !code.trim()) {
        return NextResponse.json({ success: false, error: "Cohort code is required." }, { status: 400 });
      }
      const normalizedCode = code.trim().toUpperCase();
      if (normalizedCode.length > 20) {
        return NextResponse.json({ success: false, error: "Cohort code cannot exceed 20 characters." }, { status: 400 });
      }

      if (normalizedCode !== currentCohort.code) {
        const existing = await prisma.cohort.findUnique({
          where: { code: normalizedCode }
        });
        if (existing) {
          return NextResponse.json({ success: false, error: "Cohort code already exists." }, { status: 400 });
        }
      }
      dataToUpdate.code = normalizedCode;
    }

    const start = startYear !== undefined ? parseInt(startYear, 10) : currentCohort.startYear;
    const end = endYear !== undefined ? parseInt(endYear, 10) : currentCohort.endYear;

    if (startYear !== undefined || endYear !== undefined) {
      if (isNaN(start) || isNaN(end)) {
        return NextResponse.json({ success: false, error: "Start year and End year must be valid integers." }, { status: 400 });
      }
      if (start >= end) {
        return NextResponse.json({ success: false, error: "Start year must be earlier than end year." }, { status: 400 });
      }

      if (start !== currentCohort.startYear || end !== currentCohort.endYear) {
        const existingCombo = await prisma.cohort.findUnique({
          where: { startYear_endYear: { startYear: start, endYear: end } }
        });
        if (existingCombo) {
          return NextResponse.json({ success: false, error: "Cohort combination of start and end years already exists." }, { status: 400 });
        }
      }
      dataToUpdate.startYear = start;
      dataToUpdate.endYear = end;
    }

    if (status !== undefined) {
      if (!Object.values(CohortStatus).includes(status as CohortStatus)) {
        return NextResponse.json({ success: false, error: "Invalid status value." }, { status: 400 });
      }
      dataToUpdate.status = status as CohortStatus;
      if (status === CohortStatus.ARCHIVED) {
        dataToUpdate.archivedAt = new Date();
      } else {
        dataToUpdate.archivedAt = null;
      }
      if (status === CohortStatus.GRADUATED) {
        dataToUpdate.graduatedAt = new Date();
      } else {
        dataToUpdate.graduatedAt = null;
      }
    }

    const cohort = await prisma.cohort.update({
      where: { id: cohortId },
      data: dataToUpdate
    });

    return NextResponse.json({ success: true, cohort });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message || "Access denied." }, { status });
    }
    console.error("PATCH Cohort Error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
