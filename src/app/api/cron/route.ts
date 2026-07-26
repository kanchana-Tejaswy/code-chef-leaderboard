import { NextRequest, NextResponse } from "next/server";
import { BulkSyncService } from "@/services/bulkSync.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader || (authHeader !== `Bearer ${cronSecret}` && authHeader !== cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await BulkSyncService.processBatch(10, 2);
    return NextResponse.json({
      ok: true,
      message: "Batch synchronization completed.",
      result,
    });
  } catch (err: any) {
    console.error("Critical error in Cron sync handler:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
