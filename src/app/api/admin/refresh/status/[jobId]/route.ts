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
    await requireAdmin();
    if (!isAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const job = getJob(jobId);
    
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      job
    });
  } catch (err: any) {
    if (err.name === "AuthError") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Error in job status API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
