import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobTracker";

function isAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  
  if (!adminSecret) return false;
  
  if (authHeader && authHeader.trim().toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token === adminSecret) return true;
  }
  
  return false;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    let authorized = false;
    try {
      await requireAdmin();
      authorized = true;
    } catch (e) {
      if (isAdmin(request)) {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    // 1. Advance the database queue asynchronously by processing next batch of 5
    const { BulkSyncService } = await import("@/services/bulkSync.service");
    BulkSyncService.processBatch(5, 2).catch((err) => {
      console.error("Background batch processing error in status endpoint:", err);
    });

    // 2. Query database-driven queue counts
    const stats = await BulkSyncService.getQueueProgressStats();

    // 3. Map queue statistics to JobStatus format
    const totalStudents = stats.eligibleProfiles || 1;
    const remaining = stats.remaining;
    const processedStudents = Math.max(0, stats.eligibleProfiles - remaining);
    const successfulStudents = stats.verified;
    const failedStudents = stats.failed;
    const skippedStudents = stats.incomplete;

    const statusValue = remaining > 0 ? "RUNNING" : "SUCCESS";

    const job = {
      id: jobId,
      requestedBy: "ADMIN_UI",
      mode: "ALL",
      startedAt: new Date(),
      totalStudents,
      processedStudents,
      successfulStudents,
      failedStudents,
      skippedStudents,
      status: statusValue,
      errors: [],
    };

    // 4. Update the memory cache so other controllers stay in sync
    const { updateJobProgress } = await import("@/lib/jobTracker");
    updateJobProgress(jobId, job as any);

    return NextResponse.json({
      success: true,
      job
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json({ success: false, error: errorMsg }, { status, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("Error in job status API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
