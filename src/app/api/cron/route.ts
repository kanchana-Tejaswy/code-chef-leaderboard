import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncService } from "@/services/sync.service";

export async function GET(request: NextRequest) {
  // 1. Authenticate the cron request
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    // 2. Fetch all student profiles that have CodeChef usernames configured
    const studentsToSync = await prisma.studentProfile.findMany({
      where: {
        codechefUsername: {
          not: null,
        },
      },
      select: {
        id: true,
        codechefUsername: true,
      },
    });

    console.log(`Cron: Starting sync for ${studentsToSync.length} students...`);

    const results = {
      total: studentsToSync.length,
      successCount: 0,
      failedCount: 0,
      failures: [] as { studentId: string; username: string; error: string }[],
    };

    // 3. Process students sequentially with a brief delay between fetches to respect CodeChef rate limits
    for (const student of studentsToSync) {
      if (!student.codechefUsername) continue;

      console.log(`Cron: Syncing student ${student.id} (${student.codechefUsername})`);
      const syncResult = await SyncService.syncStudent(student.id, "SYSTEM_CRON");

      if (syncResult.success) {
        results.successCount++;
      } else {
        results.failedCount++;
        results.failures.push({
          studentId: student.id,
          username: student.codechefUsername,
          error: syncResult.error || "Unknown error",
        });
      }

      // 1.5 seconds delay between requests to be gentle to CodeChef
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log(`Cron: Sync complete. Success: ${results.successCount}, Failures: ${results.failedCount}`);

    return NextResponse.json({
      message: "Batch synchronization completed.",
      results,
    });
  } catch (err: any) {
    console.error("Critical error in Cron sync handler:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
