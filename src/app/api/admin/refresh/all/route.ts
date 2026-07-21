import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { SyncService } from "@/services/sync.service";
import { createJob, getJob } from "@/lib/jobTracker";

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
    await requireAdmin();
    if (!isAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const mode: "STALE_ONLY" | "ALL" | "FAILED_ONLY" = body.mode || "STALE_ONLY";
    const adminId = body.adminId || "ADMIN_SECRET";

    // Prevent overlapping global refresh runs
    const { refreshJobs } = await import("@/lib/jobTracker");
    for (const [id, job] of refreshJobs.entries()) {
      if (job.status === "RUNNING") {
        return NextResponse.json({ error: "A refresh operation is already running." }, { status: 429 });
      }
    }

    const jobId = crypto.randomUUID();
    
    // We pass 1 for totalStudents initially, and bulkSyncStudents will update it correctly.
    createJob(jobId, adminId, mode, 1);

    // Start background sync without awaiting
    SyncService.bulkSyncStudents(mode, jobId, adminId).catch((err) => {
      console.error("Background sync error:", err);
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: `Bulk sync started in mode: ${mode}`
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Error in bulk refresh API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
