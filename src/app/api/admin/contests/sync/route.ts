import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { ContestDiscoveryService } from "@/services/contest-discovery.service";
import { ContestSyncService } from "@/services/contest-sync.service";

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

    const body = await request.json().catch(() => ({}));
    const action = body.action || "discover"; // "discover" | "sync_results"
    const contestId = body.contestId;

    if (action === "discover") {
      console.log("[Admin Contest API] Triggering contest discovery...");
      const result = await ContestDiscoveryService.discoverContests();
      return NextResponse.json({
        success: true,
        message: "Contest discovery completed.",
        result,
      });
    }

    if (action === "sync_results") {
      if (!contestId) {
        return NextResponse.json({ error: "Missing contestId parameter for results sync." }, { status: 400 });
      }

      console.log(`[Admin Contest API] Triggering result sync for contest: ${contestId}...`);
      const result = await ContestSyncService.syncContestResults(contestId);
      return NextResponse.json({
        success: true,
        message: "Contest results sync completed.",
        result,
      });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/admin/contests/sync error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
