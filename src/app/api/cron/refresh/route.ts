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

    const jobId = crypto.randomUUID();
    const mode = "STALE_ONLY";
    const adminId = "SYSTEM_CRON";
    
    // We pass 1 for totalStudents initially, and bulkSyncStudents will update it correctly.
    createJob(jobId, adminId, mode, 1);

    // Run the sync completely (for cron jobs, we await it so Vercel doesn't kill it prematurely, 
    // though for very long jobs it might still timeout depending on the Vercel function timeout config).
    // Note: If timeouts happen on Vercel, this should be converted to an async queue.
    await SyncService.bulkSyncStudents(mode, jobId, adminId);

    const job = getJob(jobId);

    return NextResponse.json({
      success: true,
      jobId,
      status: job?.status,
      message: `Cron bulk sync completed.`
    });
  } catch (err: any) {
    console.error("Error in cron refresh API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
