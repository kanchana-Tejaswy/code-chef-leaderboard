import { NextRequest, NextResponse } from "next/server";
import { SyncService } from "@/services/sync.service";
import { createJob, getJob } from "@/lib/jobTracker";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prevent overlapping global refresh runs
    const { refreshJobs } = await import("@/lib/jobTracker");
    for (const [id, job] of refreshJobs.entries()) {
      if (job.status === "RUNNING") {
        return NextResponse.json({ error: "A refresh operation is already running." }, { status: 429 });
      }
    }

    // Process a single bounded batch of 10 jobs safely within 15s serverless execution window
    const { BulkSyncService } = await import("@/services/bulkSync.service");
    const result = await BulkSyncService.processBatch(10, 2);

    return NextResponse.json({
      success: true,
      jobId: `cron_${Date.now()}`,
      result,
      message: `Cron worker batch completed: ${result.processedCount} processed (${result.successCount} verified, ${result.remainingCount} remaining).`
    });
  } catch (err: any) {
    console.error("Error in cron refresh API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
