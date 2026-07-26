import { NextRequest, NextResponse } from "next/server";
import { BulkSyncService } from "@/services/bulkSync.service";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // 1. Authenticate the cron request
  const authHeader = request.headers.get("authorization") || request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;

  const isAuthorized = cronSecret && (
    authHeader === `Bearer ${cronSecret}` || 
    authHeader === cronSecret
  );

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    console.log("Cron: Starting batch sync queue processing run...");
    
    // Process next batch of 10 students, max concurrency 2
    const result = await BulkSyncService.processBatch(10, 2);

    console.log(`Cron: Sync batch complete. Processed: ${result.processedCount}, Success: ${result.successCount}, Failed: ${result.failedCount}, Remaining: ${result.remainingCount}`);

    return NextResponse.json({
      message: "Batch synchronization completed.",
      result,
    });
  } catch (err: any) {
    console.error("Critical error in Cron sync handler:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
