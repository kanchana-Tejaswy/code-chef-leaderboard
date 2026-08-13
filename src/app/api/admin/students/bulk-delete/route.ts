import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/services/audit.service";
import { SyncService } from "@/services/sync.service";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    // Check delete permission in DB UserAccess record
    if (!admin.canDeleteStudents) {
      return NextResponse.json(
        { error: "Insufficient permissions. Student deletion access is disabled." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { studentIds, reason, notes, confirmString, confirmCheckbox } = body;

    // Validate confirmation inputs
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: "Missing or invalid studentIds list." }, { status: 422 });
    }

    if (confirmCheckbox !== true) {
      return NextResponse.json({ error: "Please check the confirmation checkbox." }, { status: 422 });
    }

    const expectedConfirm = `DELETE ${studentIds.length} STUDENTS`;
    if (confirmString !== expectedConfirm) {
      return NextResponse.json(
        { error: `Typed confirmation does not match. Expected: "${expectedConfirm}"` },
        { status: 422 }
      );
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json({ error: "Deletion reason is required." }, { status: 422 });
    }

    if (reason === "Other" && (!notes || typeof notes !== "string" || !notes.trim())) {
      return NextResponse.json({ error: "A note is required when selecting 'Other' reason." }, { status: 422 });
    }

    const succeeded: string[] = [];
    const failed: Array<{ id: string; name: string; rollNumber: string; error: string }> = [];

    // Process in safe chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const chunk = studentIds.slice(i, i + chunkSize);

      for (const id of chunk) {
        try {
          const student = await prisma.studentProfile.findUnique({
            where: { id },
            include: { userAccess: true }
          });

          if (!student) {
            failed.push({
              id,
              name: "Unknown",
              rollNumber: "Unknown",
              error: "Student profile not found"
            });
            continue;
          }

          // Disable and delete Supabase Auth user if exists
          const authUserId = student.userAccess?.authUserId;
          if (authUserId) {
            let supabaseAdmin = null;
            try {
              supabaseAdmin = createAdminClient();
            } catch (e) {
              console.error("[Bulk Delete] Supabase admin client unavailable, skipping Auth cleanup:", e);
            }

            if (supabaseAdmin) {
              try {
                // Disable user first (ban user)
                const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
                  ban_duration: "876000h"
                });
                if (banError) {
                  console.error(`[Bulk Delete] Failed to ban Supabase user ${authUserId}:`, banError);
                }
              } catch (e) {
                console.error(`[Bulk Delete] Exception banning Supabase user ${authUserId}:`, e);
              }

              try {
                // Delete Auth account
                const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
                if (deleteAuthError) {
                  console.error(`[Bulk Delete] Failed to delete Supabase user ${authUserId}:`, deleteAuthError);
                }
              } catch (e) {
                console.error(`[Bulk Delete] Exception deleting Supabase user ${authUserId}:`, e);
              }
            }
          }

          // Run database deletion sequentially for this student
          await prisma.syncJob.deleteMany({ where: { studentId: id } });
          await prisma.leaderboardEntry.deleteMany({ where: { studentId: id } });
          await prisma.codechefProfile.deleteMany({ where: { studentId: id } });
          await prisma.leetcodeProfile.deleteMany({ where: { studentId: id } });
          await prisma.githubProfile.deleteMany({ where: { studentId: id } });
          await prisma.aiAnalysis.deleteMany({ where: { studentId: id } });
          await prisma.syncLog.deleteMany({ where: { studentId: id } });
          await prisma.activityLog.deleteMany({ where: { studentId: id } });
          await prisma.normalizedProfile.deleteMany({ where: { studentId: id } });
          await prisma.userAccess.deleteMany({ where: { studentProfileId: id } });
          await prisma.studentProfile.delete({ where: { id } });

          // Record audit event
          const rollSnapshot = student.rollNumber ? student.rollNumber.trim() : "N/A";
          const maskedRoll = rollSnapshot !== "N/A"
            ? rollSnapshot.substring(0, 2) + "****" + rollSnapshot.substring(rollSnapshot.length - 2)
            : "N/A";

          await recordAuditEvent({
            actorUserId: admin.id,
            action: "STUDENT_DELETED",
            targetType: "StudentProfile",
            targetId: id,
            metadata: {
              email: student.email,
              name: student.name,
              rollNumber: maskedRoll,
              reason,
              notes,
              bulk: true
            }
          });

          succeeded.push(id);
        } catch (err: any) {
          console.error(`Failed to delete student ${id}:`, err);
          failed.push({
            id,
            name: "Unknown",
            rollNumber: "Unknown",
            error: err.message || "Relational database transaction failed."
          });
        }
      }
    }

    // Record bulk deletion audit event summary
    await recordAuditEvent({
      actorUserId: admin.id,
      action: "STUDENT_BULK_DELETED",
      metadata: {
        attemptedCount: studentIds.length,
        successCount: succeeded.length,
        failedCount: failed.length,
        reason,
        notes
      }
    });

    // Recalculate leaderboard ranks
    await SyncService.recalculateLeaderboardRanks();

    // Invalidate caches
    try {
      revalidatePath("/dashboard");
      revalidatePath("/leaderboard");
    } catch (e) {
      // ignore
    }

    return NextResponse.json({
      success: true,
      processed: studentIds.length,
      deleted: succeeded.length,
      failed: failed.length,
      failedDetails: failed
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in POST /api/admin/students/bulk-delete:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
