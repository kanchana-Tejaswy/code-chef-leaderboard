import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncService } from "@/services/sync.service";

export const maxDuration = 60; // Extend duration for long-running sync tasks

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    
    // Require an admin authorization secret
    const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
    
    if (!adminSecret) {
      return NextResponse.json(
        { error: "Server is not configured for admin access (Missing ADMIN_SECRET)" }, 
        { status: 500 }
      );
    }
    
    if (authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const identifiers = body.identifiers;

    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid identifiers array. Must provide rollNumber, email, or studentProfileId." }, 
        { status: 400 }
      );
    }

    const results = [];

    // Process each student one at a time to prevent connection exhaustion
    for (const identifier of identifiers) {
      const student = await prisma.studentProfile.findFirst({
        where: {
          OR: [
            { id: identifier },
            { rollNumber: identifier },
          ],
        },
      });

      if (!student) {
        results.push({ identifier, status: "NOT_FOUND" });
        continue;
      }

      try {
        // Await the synchronization and force update to existing profiles using the shared Prisma client.
        // It strictly updates or upserts existing platform and leaderboard records without creating duplicates.
        const syncRes = await SyncService.syncStudent(student.id, "ADMIN_FORCE");
        
        results.push({
          identifier,
          status: syncRes.success ? "SUCCESS" : "FAILED",
          // Avoid exposing stack traces to the browser
          error: syncRes.success ? undefined : (syncRes.error || "Unknown error"),
        });
      } catch (err: any) {
        results.push({ 
          identifier, 
          status: "FAILED", 
          error: "An unexpected error occurred during synchronization."
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
