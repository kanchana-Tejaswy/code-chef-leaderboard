import { NextRequest, NextResponse } from "next/server";
import { SyncService } from "@/services/sync.service";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    
    // Note: Use a stronger secret pattern in production (e.g., from process.env)
    const ADMIN_SECRET = process.env.ADMIN_API_SECRET || "ADMIN_FORCE";
    if (!authHeader || !authHeader.includes(ADMIN_SECRET)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Admin API] Triggering recalculateLeaderboardRanks manually...");
    await SyncService.recalculateLeaderboardRanks();

    return NextResponse.json({
      success: true,
      message: "Leaderboard ranks recalculated successfully based on competitive ordering."
    });
  } catch (error: any) {
    console.error("[Admin API] Failed to recalculate ranks:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
