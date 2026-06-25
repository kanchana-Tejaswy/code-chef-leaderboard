import { prisma } from "@/lib/prisma";
import { ScraperService } from "./scraper.service";
import { AiEngineService } from "./ai-engine.service";

export type SyncTrigger = "SYSTEM_CRON" | "USER_MANUAL" | "ADMIN_FORCE";

export class SyncService {
  /**
   * Performs sync for a single student.
   * Scrapes CodeChef, updates profile, performs AI analysis, and updates leaderboard caches.
   */
  static async syncStudent(
    studentId: string,
    initiatedBy: SyncTrigger
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();

    // 1. Fetch Student Profile to get CodeChef Username
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return { success: false, error: "Student profile not found." };
    }

    if (!student.codechefUsername) {
      return { success: false, error: "No CodeChef username configured on this profile." };
    }

    try {
      // 2. Perform Scrape
      const scrapedData = await ScraperService.scrapeCodechef(student.codechefUsername);

      // 3. Perform AI Analysis & Calculations
      const analysis = AiEngineService.analyzeProfile({
        currentRating: scrapedData.currentRating,
        highestRating: scrapedData.highestRating,
        stars: scrapedData.stars,
        problemsSolved: scrapedData.problemsSolved,
        contestCount: scrapedData.contestCount,
        contests: scrapedData.contests,
      });

      // 4. Update Database inside a transaction
      await prisma.$transaction(async (tx) => {
        // Update or insert CodeChef profile
        await tx.codechefProfile.upsert({
          where: { studentId },
          create: {
            studentId,
            username: scrapedData.username,
            currentRating: scrapedData.currentRating,
            highestRating: scrapedData.highestRating,
            globalRank: scrapedData.globalRank,
            countryRank: scrapedData.countryRank,
            stars: scrapedData.stars,
            problemsSolved: scrapedData.problemsSolved,
            contestCount: scrapedData.contestCount,
            contests: scrapedData.contests as any,
            lastFetchedAt: new Date(),
          },
          update: {
            username: scrapedData.username,
            currentRating: scrapedData.currentRating,
            highestRating: scrapedData.highestRating,
            globalRank: scrapedData.globalRank,
            countryRank: scrapedData.countryRank,
            stars: scrapedData.stars,
            problemsSolved: scrapedData.problemsSolved,
            contestCount: scrapedData.contestCount,
            contests: scrapedData.contests as any,
            lastFetchedAt: new Date(),
          },
        });

        // Update or insert AI Analysis
        await tx.aiAnalysis.upsert({
          where: { studentId },
          create: {
            studentId,
            talentScore: analysis.talentScore,
            consistencyScore: analysis.consistencyScore,
            problemSolvingScore: analysis.problemSolvingScore,
            competitiveProgrammingScore: analysis.competitiveProgrammingScore,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            recommendations: analysis.recommendations,
            careerSuggestions: analysis.careerSuggestions,
            generatedAt: new Date(),
          },
          update: {
            talentScore: analysis.talentScore,
            consistencyScore: analysis.consistencyScore,
            problemSolvingScore: analysis.problemSolvingScore,
            competitiveProgrammingScore: analysis.competitiveProgrammingScore,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            recommendations: analysis.recommendations,
            careerSuggestions: analysis.careerSuggestions,
            generatedAt: new Date(),
          },
        });

        // Update or insert Leaderboard cache entry
        await tx.leaderboardEntry.upsert({
          where: { studentId },
          create: {
            studentId,
            rating: scrapedData.currentRating,
            stars: scrapedData.stars,
            talentScore: analysis.talentScore,
            rank: 0, // Will be updated during global ranks recalculation
          },
          update: {
            rating: scrapedData.currentRating,
            stars: scrapedData.stars,
            talentScore: analysis.talentScore,
          },
        });

        // Save Sync Log
        await tx.syncLog.create({
          data: {
            studentId,
            status: "SUCCESS",
            initiatedBy,
            durationMs: Date.now() - startTime,
          },
        });
      });

      // 5. Recalculate global ranks
      await this.recalculateLeaderboardRanks();

      return { success: true };
    } catch (err: any) {
      console.error(`Sync failed for student ${studentId}:`, err);

      // Save failure sync log
      try {
        await prisma.syncLog.create({
          data: {
            studentId,
            status: "FAILURE",
            errorMessage: err.message || "Unknown error occurred.",
            initiatedBy,
            durationMs: Date.now() - startTime,
          },
        });
      } catch (logErr) {
        console.error("Failed to write failure sync log:", logErr);
      }

      return { success: false, error: err.message };
    }
  }

  /**
   * Recalculates leaderboard rankings based on current Talent Scores (highest first),
   * updating the `rank` field in `leaderboard_entries` table.
   */
  /**
   * Recalculates leaderboard rankings based on current Talent Scores (highest first),
   * updating the `rank` field in `leaderboard_entries` table using raw SQL for maximum performance.
   */
  static async recalculateLeaderboardRanks(): Promise<void> {
    try {
      // Execute raw SQL CTE update query to update all ranks in a single Postgres operation
      await prisma.$executeRawUnsafe(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY talent_score DESC, rating DESC) as new_rank
          FROM leaderboard_entries
        )
        UPDATE leaderboard_entries le
        SET rank = r.new_rank
        FROM ranked r
        WHERE le.id = r.id
      `);
    } catch (err) {
      console.error("Failed to recalculate leaderboard ranks via raw SQL, executing transaction fallback:", err);
      
      // Graceful transaction fallback for non-PostgreSQL / test environments
      const entries = await prisma.leaderboardEntry.findMany({
        orderBy: [
          { talentScore: "desc" },
          { rating: "desc" },
        ],
      });

      if (entries.length > 0) {
        await prisma.$transaction(
          entries.map((entry, index) =>
            prisma.leaderboardEntry.update({
              where: { id: entry.id },
              data: { rank: index + 1 },
            })
          )
        );
      }
    }
  }
}
