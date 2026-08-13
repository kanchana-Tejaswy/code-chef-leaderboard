import { prisma } from "../lib/prisma";
import { SyncService } from "./sync.service";
import { ContestPlatform } from "@prisma/client";
import { getAdapterForPlatform } from "./adapters";

export interface SyncSummary {
  eligibleHandles: number;
  matchedParticipants: number;
  nonparticipants: number;
  invalidHandles: number;
  fetchFailures: number;
  recordsInserted: number;
  recordsUpdated: number;
}

export class ContestSyncService {
  /**
   * Synchronizes the results for a specific contest by resolving its platform adapter.
   */
  static async syncContestResults(contestId: string): Promise<SyncSummary> {
    const contest = await prisma.contest.findFirst({
      where: {
        OR: [
          { id: contestId },
          { slug: contestId },
          { platformContestId: contestId },
        ],
      },
    });

    if (!contest) {
      throw new Error(`Contest not found with identifier: ${contestId}`);
    }

    const adapter = getAdapterForPlatform(contest.platform);
    return adapter.syncContestResults(contest.id);
  }

  /**
   * Original CodeChef results synchronization logic.
   */
  static async syncCodeChefResults(contestId: string): Promise<SyncSummary> {
    const summary: SyncSummary = {
      eligibleHandles: 0,
      matchedParticipants: 0,
      nonparticipants: 0,
      invalidHandles: 0,
      fetchFailures: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
    };

    // 1. Validate Contest
    const contest = await prisma.contest.findFirst({
      where: {
        OR: [
          { id: contestId },
          { slug: contestId },
          { platformContestId: contestId },
        ],
      },
    });

    if (!contest) {
      throw new Error(`Contest not found with identifier: ${contestId}`);
    }

    if (contest.platform !== ContestPlatform.CODECHEF) {
      throw new Error(`Contest platform ${contest.platform} sync is not supported by CodeChef adapter.`);
    }

    // 2. Fetch all student profiles with CodeChef usernames configured
    const students = await prisma.studentProfile.findMany({
      where: {
        codechefUsername: { not: null },
        profileStatus: "VERIFIED",
      },
      include: {
        codechefProfile: true,
      },
    });

    summary.eligibleHandles = students.length;
    console.log(`[Contest Sync] Found ${students.length} eligible students with CodeChef handles.`);

    // 3. Determine which students need profile updates
    // A profile needs updates if it hasn't been synced since the contest ended AND the contest is not already in the history.
    const contestCode = contest.platformContestId.toLowerCase();
    const studentsToSync: typeof students = [];

    for (const student of students) {
      const profile = student.codechefProfile;
      let hasContest = false;

      if (profile && Array.isArray(profile.contestHistory)) {
        hasContest = profile.contestHistory.some((h: any) => {
          const code = (h.contest || "").toLowerCase();
          return code === contestCode || code.startsWith(contestCode) || contestCode.startsWith(code);
        });
      }

      const needsSync = !profile || (!hasContest && profile.lastFetchedAt < contest.endTime);
      if (needsSync) {
        studentsToSync.push(student);
      }
    }

    console.log(
      `[Contest Sync] ${studentsToSync.length} students need real-time profile fetches to capture results.`
    );

    // Sync student profiles sequentially to respect rate limits
    for (const student of studentsToSync) {
      try {
        console.log(`[Contest Sync] Syncing profile for student ${student.name} (${student.rollNumber})...`);
        const result = await SyncService.syncStudent(student.id, "SYSTEM_CRON", true);
        if (!result.success) {
          summary.fetchFailures++;
          console.warn(`[Contest Sync] Profile sync failed for ${student.name}: ${result.error}`);
        }
      } catch (err: any) {
        summary.fetchFailures++;
        console.error(`[Contest Sync] Error syncing student ${student.name}:`, err);
      }
    }

    // 4. Reload updated CodeChef profiles
    const updatedProfiles = await prisma.codechefProfile.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
      },
    });

    // 5. Match results and insert/update participations
    for (const profile of updatedProfiles) {
      const history = Array.isArray(profile.contestHistory) ? (profile.contestHistory as any[]) : [];

      // Look for contest match in history
      const matchIndex = history.findIndex((h: any) => {
        const code = (h.contest || "").toLowerCase();
        return code === contestCode || code.startsWith(contestCode) || contestCode.startsWith(code);
      });

      if (matchIndex === -1) {
        summary.nonparticipants++;
        continue;
      }

      const entry = history[matchIndex];
      const rank = parseInt(entry.rank, 10) || null;
      const ratingAfter = parseInt(entry.rating, 10) || null;

      // Extract ratingBefore from chronologically previous contest (history is ordered oldest to newest)
      let ratingBefore: number | null = null;
      if (matchIndex > 0) {
        ratingBefore = parseInt(history[matchIndex - 1].rating, 10) || null;
      }

      const ratingChange = ratingAfter !== null && ratingBefore !== null ? ratingAfter - ratingBefore : null;

      // Find historical student enrollment matching contest start date
      const enrollment = await prisma.studentEnrollment.findFirst({
        where: {
          studentId: profile.studentId,
          startedAt: { lte: contest.startTime },
          OR: [
            { endedAt: null },
            { endedAt: { gte: contest.startTime } },
          ],
        },
      });

      // Upsert ContestParticipation
      const existingPart = await prisma.contestParticipation.findUnique({
        where: {
          contestId_studentId: {
            contestId: contest.id,
            studentId: profile.studentId,
          },
        },
      });

      try {
        await prisma.contestParticipation.upsert({
          where: {
            contestId_studentId: {
              contestId: contest.id,
              studentId: profile.studentId,
            },
          },
          update: {
            rank,
            ratingAfter,
            ratingBefore,
            ratingChange,
            platformUsername: profile.username,
            studentEnrollmentId: enrollment?.id || null,
            syncedAt: new Date(),
          },
          create: {
            contestId: contest.id,
            studentId: profile.studentId,
            studentEnrollmentId: enrollment?.id || null,
            platformUsername: profile.username,
            rank,
            ratingAfter,
            ratingBefore,
            ratingChange,
            syncedAt: new Date(),
          },
        });

        if (existingPart) {
          summary.recordsUpdated++;
        } else {
          summary.recordsInserted++;
        }
        summary.matchedParticipants++;
      } catch (upsertErr) {
        console.error(`[Contest Sync] Failed to upsert participation for ${profile.username}:`, upsertErr);
      }
    }

    // 6. Update Sync timestamps on Contest
    await prisma.contest.update({
      where: { id: contest.id },
      data: {
        lastResultsSyncedAt: new Date(),
      },
    });

    // 7. Recalculate leaderboard ranks in case student rating shifts occurred during fetches
    await SyncService.recalculateLeaderboardRanks();

    console.log(`[Contest Sync] Finished contest sync for ${contest.name}:`, JSON.stringify(summary));
    return summary;
  }
}
