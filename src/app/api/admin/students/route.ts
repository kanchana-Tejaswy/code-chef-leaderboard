import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerformWrite } from "@/lib/write-access";
import { StudentProfileService } from "@/services/student-profile.service";
import { recordAuditEvent } from "@/services/audit.service";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    // Fetch all student profiles with their CodeChef status
    const students = await prisma.studentProfile.findMany({
      include: {
        codechefProfile: {
          select: {
            currentRating: true,
            stars: true,
            lastFetchedAt: true,
          },
        },
        aiAnalysis: {
          select: {
            talentScore: true,
          },
        },
      },
      orderBy: { rollNumber: "asc" },
    });

    return NextResponse.json({ students });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in admin students list API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const { id, name } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing student id." }, { status: 400 });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const student = await prisma.studentProfile.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json({ success: true, student });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error updating student via admin endpoint:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => ({}));

    const rawRoll = body.rollNumber || body.roll_number;
    if (rawRoll) {
      const normalizedRoll = String(rawRoll).trim().toUpperCase();
      const existing = await prisma.studentProfile.findUnique({
        where: { rollNumber: normalizedRoll }
      });
      if (existing) {
        return NextResponse.json(
          { error: "A student with this roll number already exists.", existingId: existing.id },
          { status: 409 }
        );
      }
    }

    const evaluated = await StudentProfileService.evaluateRows([body]);
    const row = evaluated[0];

    // For manual creation we bypass email validation constraint if email is empty
    if (row.classification === "INVALID_EMAIL" && !body.email) {
      // Allow creation without email
      row.classification = (row.normalized.codechefUsername && row.normalized.leetcodeUsername) ? "READY" : "INCOMPLETE";
      row.reasons = row.reasons.filter(r => !r.includes("Email ID is required"));
    }

    if (row.classification !== "READY" && row.classification !== "INCOMPLETE") {
      const errorMsg = row.reasons.join(" ") || "Invalid student profile payload.";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const creationData = {
      ...row.normalized,
      cohortId: body.cohortId || null,
      departmentId: body.departmentId || null,
      classSectionId: body.classSectionId || null,
    };

    const res = await StudentProfileService.createProfile(creationData);
    if (!res.success || !res.profile) {
      return NextResponse.json({ error: res.error || "Failed to create student profile." }, { status: 400 });
    }

    const profile = res.profile;

    // Queue verification SyncJob if usernames are present
    if (row.normalized.codechefUsername && row.normalized.leetcodeUsername) {
      await prisma.syncJob.create({
        data: {
          studentId: profile.id,
          status: "QUEUED",
          attemptCount: 0
        }
      });
    }

    // Record audit event STUDENT_CREATED
    await recordAuditEvent({
      actorUserId: admin.id,
      action: "STUDENT_CREATED",
      targetType: "StudentProfile",
      targetId: profile.id,
      metadata: { name: profile.name, rollNumber: profile.rollNumber, email: profile.email }
    });

    return NextResponse.json({ success: true, student: profile });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error creating student profile manually:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
