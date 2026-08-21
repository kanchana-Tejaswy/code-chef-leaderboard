import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { BulkSyncService } from "@/services/bulkSync.service";
import crypto from "crypto";

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

export async function POST(request: NextRequest) {
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

    // 1. Queue eligible profiles
    const queueResult = await BulkSyncService.queueEligibleStudents();

    // 2. Unpause queue if paused
    BulkSyncService.setPaused(false);

    // 3. Register virtual job in jobTracker
    const jobId = crypto.randomUUID();
    const stats = await BulkSyncService.getQueueProgressStats();
    
    const { createJob } = await import("@/lib/jobTracker");
    createJob(jobId, "ADMIN_UI", "ALL", stats.eligibleProfiles);

    // 4. Start processing batches continuously in background
    (async () => {
      let remaining = 1;
      while (remaining > 0 && !BulkSyncService.isPaused()) {
        const batchRes = await BulkSyncService.processBatch(10, 2);
        remaining = batchRes.remainingCount;
        if (batchRes.processedCount === 0) break;
      }
    })().catch((err) => {
      console.error("Background processing loop error:", err);
    });

    return NextResponse.json(
      {
        success: true,
        message: `Queued ${queueResult.queuedCount} eligible profiles. Verification processing started.`,
        jobId,
        queueResult,
        stats,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: any) {
    if (err.name === "AuthError") {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      const errorMsg = err.code === "UNAUTHORIZED" ? "Authentication required." : "Access denied.";
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    console.error("Error in refresh live data API:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
