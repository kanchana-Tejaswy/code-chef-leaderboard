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
        fullySolvedCount: scrapedData.fullySolvedCount,
        partiallySolvedCount: scrapedData.partiallySolvedCount,
        bestContestRank: scrapedData.bestContestRank,
        activeDaysCount: scrapedData.activeDaysCount,
      });

      // 4. Update Database inside a transaction
      await prisma.$transaction(async (tx) => {
        // Fetch old CodeChef profile rating if exists
        const oldProfile = await tx.codechefProfile.findUnique({
          where: { studentId },
          select: { currentRating: true },
        });
        const oldRating = oldProfile?.currentRating || 0;

        // Update or insert CodeChef profile
        await tx.codechefProfile.upsert({
          where: { studentId },
          create: {
            studentId,
            username: scrapedData.username,
            fullName: scrapedData.fullName,
            country: scrapedData.country,
            institution: scrapedData.institution,
            city: scrapedData.city,
            currentRating: scrapedData.currentRating,
            highestRating: scrapedData.highestRating,
            stars: scrapedData.stars,
            maxStars: scrapedData.maxStars,
            globalRank: scrapedData.globalRank,
            countryRank: scrapedData.countryRank,
            problemsSolved: scrapedData.problemsSolved,
            fullySolvedCount: scrapedData.fullySolvedCount,
            partiallySolvedCount: scrapedData.partiallySolvedCount,
            easySolvedCount: scrapedData.easySolvedCount,
            mediumSolvedCount: scrapedData.mediumSolvedCount,
            hardSolvedCount: scrapedData.hardSolvedCount,
            challengeSolvedCount: scrapedData.challengeSolvedCount,
            contestCount: scrapedData.contestCount,
            longChallengeCount: scrapedData.longChallengeCount,
            cookOffCount: scrapedData.cookOffCount,
            lunchtimeCount: scrapedData.lunchtimeCount,
            startersCount: scrapedData.startersCount,
            division: scrapedData.division,
            bestContestRank: scrapedData.bestContestRank,
            averageContestRank: scrapedData.averageContestRank,
            lastActive: scrapedData.lastActive,
            activeDaysCount: scrapedData.activeDaysCount,
            ratingHistory: scrapedData.ratingHistory as any,
            contestHistory: scrapedData.contestHistory as any,
            difficultyDistribution: scrapedData.difficultyDistribution as any,
            activitySummary: scrapedData.activitySummary as any,
            statisticDetails: scrapedData.statisticDetails as any,
            contests: scrapedData.contests as any,
            lastFetchedAt: new Date(),
          },
          update: {
            username: scrapedData.username,
            fullName: scrapedData.fullName,
            country: scrapedData.country,
            institution: scrapedData.institution,
            city: scrapedData.city,
            currentRating: scrapedData.currentRating,
            highestRating: scrapedData.highestRating,
            stars: scrapedData.stars,
            maxStars: scrapedData.maxStars,
            globalRank: scrapedData.globalRank,
            countryRank: scrapedData.countryRank,
            problemsSolved: scrapedData.problemsSolved,
            fullySolvedCount: scrapedData.fullySolvedCount,
            partiallySolvedCount: scrapedData.partiallySolvedCount,
            easySolvedCount: scrapedData.easySolvedCount,
            mediumSolvedCount: scrapedData.mediumSolvedCount,
            hardSolvedCount: scrapedData.hardSolvedCount,
            challengeSolvedCount: scrapedData.challengeSolvedCount,
            contestCount: scrapedData.contestCount,
            longChallengeCount: scrapedData.longChallengeCount,
            cookOffCount: scrapedData.cookOffCount,
            lunchtimeCount: scrapedData.lunchtimeCount,
            startersCount: scrapedData.startersCount,
            division: scrapedData.division,
            bestContestRank: scrapedData.bestContestRank,
            averageContestRank: scrapedData.averageContestRank,
            lastActive: scrapedData.lastActive,
            activeDaysCount: scrapedData.activeDaysCount,
            ratingHistory: scrapedData.ratingHistory as any,
            contestHistory: scrapedData.contestHistory as any,
            difficultyDistribution: scrapedData.difficultyDistribution as any,
            activitySummary: scrapedData.activitySummary as any,
            statisticDetails: scrapedData.statisticDetails as any,
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
            contestScore: analysis.contestScore,
            learningScore: analysis.learningScore,
            growthScore: analysis.growthScore,
            disciplineScore: analysis.disciplineScore,
            overallPotential: analysis.overallPotential,
            placementReadiness: analysis.placementReadiness,
            expectedRating6Months: analysis.expectedRating6Months,
            strengths: analysis.strengths as any,
            weaknesses: analysis.weaknesses as any,
            improvementAreas: analysis.improvementAreas as any,
            careerRecommendation: analysis.careerRecommendation,
            suggestedCompanies: analysis.suggestedCompanies as any,
            recommendedLearningPath: analysis.recommendedLearningPath as any,
            recommendations: analysis.recommendations as any,
            careerSuggestions: analysis.careerSuggestions as any,
            generatedAt: new Date(),
          },
          update: {
            talentScore: analysis.talentScore,
            consistencyScore: analysis.consistencyScore,
            problemSolvingScore: analysis.problemSolvingScore,
            competitiveProgrammingScore: analysis.competitiveProgrammingScore,
            contestScore: analysis.contestScore,
            learningScore: analysis.learningScore,
            growthScore: analysis.growthScore,
            disciplineScore: analysis.disciplineScore,
            overallPotential: analysis.overallPotential,
            placementReadiness: analysis.placementReadiness,
            expectedRating6Months: analysis.expectedRating6Months,
            strengths: analysis.strengths as any,
            weaknesses: analysis.weaknesses as any,
            improvementAreas: analysis.improvementAreas as any,
            careerRecommendation: analysis.careerRecommendation,
            suggestedCompanies: analysis.suggestedCompanies as any,
            recommendedLearningPath: analysis.recommendedLearningPath as any,
            recommendations: analysis.recommendations as any,
            careerSuggestions: analysis.careerSuggestions as any,
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

        // Save Activity Log
        if (oldProfile && scrapedData.currentRating > oldRating) {
          await tx.activityLog.create({
            data: {
              eventType: "RATING_INCREASE",
              studentId,
              message: `${student.name}'s rating increased from ${oldRating} to ${scrapedData.currentRating}!`,
            },
          });
        } else {
          await tx.activityLog.create({
            data: {
              eventType: "SYNC_SUCCESS",
              studentId,
              message: `${student.name}'s profile was successfully analyzed and synced.`,
            },
          });
        }
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

        // Save failure Activity Log
        await prisma.activityLog.create({
          data: {
            eventType: "SYNC_FAILURE",
            studentId,
            message: `CodeChef sync failed for ${student?.name || "Student"}: ${err.message || "Unknown error"}.`,
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
      // Execute raw SQL CTE update query to update all ranks
      await prisma.$executeRawUnsafe(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY rating DESC, talent_score DESC, stars DESC) as new_rank
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
          { rating: "desc" },
          { talentScore: "desc" },
          { stars: "desc" },
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
