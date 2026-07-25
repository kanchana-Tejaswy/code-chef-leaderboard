import { requireAdmin } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { BulkSyncService } from "@/services/bulkSync.service";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    // 1. Queue eligible profiles
    const queueResult = await BulkSyncService.queueEligibleStudents();

    // 2. Unpause queue if paused
    BulkSyncService.setPaused(false);

    // 3. Start processing first batch asynchronously (does not block HTTP response)
    BulkSyncService.processBatch(5, 2).catch((err) => {
      console.error("Background batch processing error:", err);
    });

    // 4. Return progress stats immediately
    const stats = await BulkSyncService.getQueueProgressStats();

    return NextResponse.json(
      {
        success: true,
        message: `Queued ${queueResult.queuedCount} eligible profiles. Verification processing started.`,
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
