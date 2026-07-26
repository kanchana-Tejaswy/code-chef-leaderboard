import { NextResponse } from "next/server";
import { BulkSyncService } from "@/services/bulkSync.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await BulkSyncService.getQueueProgressStats();
    return NextResponse.json({ success: true, stats });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
