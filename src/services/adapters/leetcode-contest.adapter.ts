import { prisma } from "../../lib/prisma";
import { ContestPlatform, ContestStatus, Contest } from "@prisma/client";
import { ContestPlatformAdapter } from "./contest-platform-adapter.interface";
import { SyncSummary } from "../contest-sync.service";
import { SyncService } from "../sync.service";

export class LeetCodeContestAdapter implements ContestPlatformAdapter {
  /**
   * Fetches active, upcoming, and recent past contests from LeetCode.
   */
  async discoverContests(): Promise<{
    discovered: number;
    upserted: number;
    errors: string[];
  }> {
    const url = "https://leetcode.com/graphql";
    const headers = {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://leetcode.com",
    };

    const errors: string[] = [];
    let discovered = 0;
    let upserted = 0;

    try {
      console.log(`[LeetCode Discovery] Fetching contest list from LeetCode...`);

      // 1. Fetch topTwoContests (Upcoming / Live / Very Recent)
      const topTwoQuery = `
        query {
          topTwoContests {
            title
            titleSlug
            startTime
            duration
          }
        }
      `;
      const resTop = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: topTwoQuery }),
        next: { revalidate: 0 },
      });

      let topContests: any[] = [];
      if (resTop.ok) {
        const topData = await resTop.json();
        topContests = topData.data?.topTwoContests || [];
      } else {
        errors.push(`Failed to fetch topTwoContests: ${resTop.statusText}`);
      }

      // 2. Fetch pastContests (Page 1)
      const pastQuery = `
        query {
          pastContests(pageNo: 1) {
            data {
              title
              titleSlug
              startTime
              duration
            }
          }
        }
      `;
      const resPast = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: pastQuery }),
        next: { revalidate: 0 },
      });

      let pastContests: any[] = [];
      if (resPast.ok) {
        const pastData = await resPast.json();
        pastContests = pastData.data?.pastContests?.data || [];
      } else {
        errors.push(`Failed to fetch pastContests: ${resPast.statusText}`);
      }

      // Merge and deduplicate by titleSlug
      const allItemsMap = new Map<string, any>();
      topContests.forEach((c) => {
        if (c && c.titleSlug) allItemsMap.set(c.titleSlug, c);
      });
      // Bounded limit: take only the most recent 10 completed contests from page 1
      pastContests.slice(0, 10).forEach((c) => {
        if (c && c.titleSlug) allItemsMap.set(c.titleSlug, c);
      });

      const allItems = Array.from(allItemsMap.values());
      discovered = allItems.length;

      for (const item of allItems) {
        try {
          const startTimeSeconds = parseInt(item.startTime, 10);
          const durationSeconds = parseInt(item.duration, 10);
          if (isNaN(startTimeSeconds) || isNaN(durationSeconds)) {
            continue;
          }

          const startTime = new Date(startTimeSeconds * 1000);
          const endTime = new Date((startTimeSeconds + durationSeconds) * 1000);
          const durationMinutes = Math.round(durationSeconds / 60);
          const name = item.title;
          const slug = `leetcode-${item.titleSlug.toLowerCase()}`;
          const contestUrl = `https://leetcode.com/contest/${item.titleSlug}`;

          // Classify status based on start/end times
          const now = Date.now();
          let status: ContestStatus = ContestStatus.UPCOMING;
          if (now >= startTime.getTime() && now < endTime.getTime()) {
            status = ContestStatus.LIVE;
          } else if (now >= endTime.getTime()) {
            status = ContestStatus.COMPLETED;
          }

          await prisma.contest.upsert({
            where: {
              platform_platformContestId: {
                platform: ContestPlatform.LEETCODE,
                platformContestId: item.titleSlug,
              },
            },
            update: {
              name,
              startTime,
              endTime,
              durationMinutes,
              status,
              lastMetadataSyncedAt: new Date(),
            },
            create: {
              platform: ContestPlatform.LEETCODE,
              platformContestId: item.titleSlug,
              name,
              slug,
              contestUrl,
              startTime,
              endTime,
              durationMinutes,
              status,
              lastMetadataSyncedAt: new Date(),
            },
          });

          upserted++;
        } catch (e: any) {
          console.error(`[LeetCode Discovery] Failed to upsert LeetCode contest ${item.titleSlug}:`, e);
          errors.push(`Contest ${item.titleSlug} upsert failed: ${e.message}`);
        }
      }

      console.log(`[LeetCode Discovery] Completed. Discovered: ${discovered}, Upserted: ${upserted}`);
    } catch (err: any) {
      console.error(`[LeetCode Discovery] Critical failure during discovery:`, err);
      errors.push(`Critical LeetCode discovery failure: ${err.message}`);
    }

    return { discovered, upserted, errors };
  }

  /**
   * Syncs participation standings for LeetCode by reading student profiles.
   */
  async syncContestResults(contestId: string): Promise<SyncSummary> {
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
        platform: ContestPlatform.LEETCODE,
        OR: [
          { id: contestId },
          { slug: contestId },
          { platformContestId: contestId },
        ],
      },
    });

    if (!contest) {
      throw new Error(`LeetCode contest not found with identifier: ${contestId}`);
    }

    // 2. Fetch verified students with LeetCode handles
    const students = await prisma.studentProfile.findMany({
      where: {
        leetcodeUsername: { not: null },
        profileStatus: "VERIFIED",
      },
      include: {
        leetcodeProfile: true,
      },
    });

    summary.eligibleHandles = students.length;
    console.log(`[LeetCode Sync] Found ${students.length} eligible students with LeetCode handles.`);

    // 3. Sync profile data for students that don't have the contest in their history
    const contestCode = contest.platformContestId.toLowerCase();
    const studentsToSync: typeof students = [];

    for (const student of students) {
      const profile = student.leetcodeProfile;
      let hasContest = false;

      if (profile && Array.isArray(profile.contestHistory)) {
        hasContest = profile.contestHistory.some((h: any) => {
          const code = (h.contest || "").toLowerCase();
          return code === contestCode || code.startsWith(contestCode) || contestCode.startsWith(code);
        });
      }

      // Profile needs update if missing or doesn't have the contest yet AND lastFetchedAt is before contest end time
      const needsSync = !profile || (!hasContest && profile.lastFetchedAt < contest.endTime);
      if (needsSync) {
        studentsToSync.push(student);
      }
    }

    console.log(`[LeetCode Sync] ${studentsToSync.length} students require profile updates.`);

    for (const student of studentsToSync) {
      try {
        console.log(`[LeetCode Sync] Syncing profile for student ${student.name}...`);
        const result = await SyncService.syncStudent(student.id, "SYSTEM_CRON", true);
        if (!result.success) {
          summary.fetchFailures++;
        }
      } catch (err: any) {
        summary.fetchFailures++;
        console.error(`[LeetCode Sync] Error syncing student ${student.name}:`, err);
      }
    }

    // 4. Reload LeetCode profiles to parse history
    const updatedProfiles = await prisma.leetcodeProfile.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
      },
    });

    // 5. Match and insert standings
    for (const profile of updatedProfiles) {
      const history = Array.isArray(profile.contestHistory) ? (profile.contestHistory as any[]) : [];

      // Find match in student history (case-insensitive contest title or slug matching)
      const matchIndex = history.findIndex((h: any) => {
        const title = (h.contest || "").toLowerCase();
        return title === contest.name.toLowerCase() || title === contestCode || title.includes(contestCode);
      });

      if (matchIndex === -1) {
        summary.nonparticipants++;
        continue;
      }

      const entry = history[matchIndex];
      const rank = parseInt(entry.rank || entry.ranking, 10) || null;
      const ratingAfter = parseInt(entry.rating, 10) || null;
      const problemsSolved = parseInt(entry.problemsSolved, 10) || null;
      // penalty/finishTimeInSeconds
      const penalty = parseInt(entry.finishTimeInSeconds, 10) || null;

      // Extract ratingBefore from chronologically previous contest in history
      let ratingBefore: number | null = null;
      if (matchIndex > 0) {
        ratingBefore = parseInt(history[matchIndex - 1].rating, 10) || null;
      }
      const ratingChange = ratingAfter !== null && ratingBefore !== null ? ratingAfter - ratingBefore : null;

      // Find enrollment
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
            problemsSolved,
            score: problemsSolved !== null ? parseFloat(problemsSolved.toString()) : null,
            penalty: penalty !== null ? parseFloat(penalty.toString()) : null,
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
            problemsSolved,
            score: problemsSolved !== null ? parseFloat(problemsSolved.toString()) : null,
            penalty: penalty !== null ? parseFloat(penalty.toString()) : null,
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
        console.error(`[LeetCode Sync] Failed to upsert standings record for ${profile.username}:`, upsertErr);
      }
    }

    // 6. Update contest timestamp
    await prisma.contest.update({
      where: { id: contest.id },
      data: {
        lastResultsSyncedAt: new Date(),
      },
    });

    // 7. Recalculate leaderboard
    await SyncService.recalculateLeaderboardRanks();

    console.log(`[LeetCode Sync] Completed sync for ${contest.name}:`, JSON.stringify(summary));
    return summary;
  }
}
