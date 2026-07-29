import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { provisionStudentAccount } from "@/services/auth-provisioning.service";
import { recordAuditEvent, AuditAction } from "@/services/audit.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // allow Vercel to run this longer (up to 5 mins if possible)

export async function POST(request: NextRequest) {
  try {
    const adminSession = await requireAdmin();

    const body = await request.json();
    const { confirmation, studentProfileIds } = body;

    if (confirmation !== "PROVISION_STUDENT_ACCOUNTS") {
      return NextResponse.json({ success: false, error: "Missing or invalid confirmation string." }, { status: 400 });
    }

    if (!studentProfileIds || !Array.isArray(studentProfileIds)) {
      return NextResponse.json({ success: false, error: "studentProfileIds must be an array (or ['ALL_ELIGIBLE'])." }, { status: 400 });
    }

    let targetIds = [...studentProfileIds];

    if (targetIds.includes("ALL_ELIGIBLE")) {
      // Fetch all eligible profiles that do NOT have a UserAccess record yet
      const unprovisionedProfiles = await prisma.studentProfile.findMany({
        where: {
          userAccess: null,
          email: { not: null },
          rollNumber: { not: null },
          department: { not: null },
        },
        select: { id: true },
      });
      targetIds = unprovisionedProfiles.map(p => p.id);
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ success: true, message: "No valid students to provision.", summary: {} });
    }

    await recordAuditEvent({
      actorUserId: adminSession.id,
      action: AuditAction.STUDENT_PROVISION_BATCH_STARTED,
      metadata: { targetCount: targetIds.length }
    });

    // Concurrency limit of 2 as requested in earlier specs for student provisioning
    const summary = {
      attempted: 0,
      created: 0,
      linked: 0,
      alreadyProvisioned: 0,
      skippedInvalid: 0,
      conflicts: 0,
      failed: 0,
    };

    const CONCURRENCY = 2;
    for (let i = 0; i < targetIds.length; i += CONCURRENCY) {
      const chunk = targetIds.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (id) => {
        summary.attempted++;
        try {
          const result = await provisionStudentAccount(id);
          
          switch (result.status) {
            case "CREATED": summary.created++; break;
            case "LINKED": summary.linked++; break;
            case "ALREADY_PROVISIONED": summary.alreadyProvisioned++; break;
            case "SKIPPED_INVALID": summary.skippedInvalid++; break;
            case "CONFLICT": summary.conflicts++; break;
            case "PARTIAL_FAILURE":
            case "FAILED":
            default:
              summary.failed++; break;
          }
        } catch (error) {
          summary.failed++;
          console.error(`Unhandled error provisioning student ${id}:`, error);
        }
      }));
    }

    await recordAuditEvent({
      actorUserId: adminSession.id,
      action: AuditAction.STUDENT_PROVISION_BATCH_COMPLETED,
      metadata: { summary }
    });

    return NextResponse.json({
      success: true,
      message: "Batch provisioning completed.",
      summary
    });

  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json({ success: false, error: err.message }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in students provision API:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
