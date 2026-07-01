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

    // 1. Fetch Student Profile to get usernames
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return { success: false, error: "Student profile not found." };
    }

    if (!student.codechefUsername && !student.leetcodeUsername && !student.githubUsername) {
      return { success: false, error: "No profile usernames configured for this student." };
    }

    try {
      // 2. Perform Scrapes for each active platform
      let codechefData = null;
      let leetcodeData = null;
      let githubData = null;

      if (student.codechefUsername) {
        try {
          codechefData = await ScraperService.scrapeCodechef(student.codechefUsername);
        } catch (err) {
          console.error(`Failed to scrape CodeChef for student ${studentId}:`, err);
        }
      }

      if (student.leetcodeUsername) {
        try {
          leetcodeData = await ScraperService.scrapeLeetcode(student.leetcodeUsername);
        } catch (err) {
          console.error(`Failed to scrape LeetCode for student ${studentId}:`, err);
        }
      }

      if (student.githubUsername) {
        try {
          githubData = await ScraperService.scrapeGithub(student.githubUsername);
        } catch (err) {
          console.error(`Failed to scrape GitHub for student ${studentId}:`, err);
        }
      }

      // Calculate individual scores (0-100)
      const codechefScore = codechefData
        ? Math.round(Math.min(100, (codechefData.currentRating / 2200) * 100))
        : 0;

      const leetcodeScore = leetcodeData
        ? Math.round(Math.min(100, (leetcodeData.problemsSolved / 350) * 70 + (leetcodeData.currentRating > 0 ? (leetcodeData.currentRating / 2000) * 30 : 0)))
        : 0;

      const githubScore = githubData
        ? Math.round(
            Math.min(
              100,
              (((githubData.rawMetrics?.totalStars || 0) * 5 +
                (githubData.rawMetrics?.totalForks || 0) * 10 +
                (githubData.rawMetrics?.followers || 0) * 3 +
                (githubData.rawMetrics?.totalRepositories || 0) * 2) /
                100) *
                50 +
                (Object.keys(githubData.rawMetrics?.contributions || {}).length / 300) * 50
            )
          )
        : 0;

      // Compute weighted overall score based on configured platforms
      let totalWeight = 0;
      let weightedSum = 0;

      if (student.codechefUsername && codechefData) {
        weightedSum += codechefScore * 0.4;
        totalWeight += 0.4;
      }
      if (student.leetcodeUsername && leetcodeData) {
        weightedSum += leetcodeScore * 0.4;
        totalWeight += 0.4;
      }
      if (student.githubUsername && githubData) {
        weightedSum += githubScore * 0.2;
        totalWeight += 0.2;
      }

      const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

      // 3. Perform AI Analysis & Calculations (CodeChef/LeetCode combined metrics)
      const analysis = AiEngineService.analyzeProfile({
        currentRating: codechefData?.currentRating || (leetcodeData ? Math.round(leetcodeData.currentRating) : 1200),
        highestRating: codechefData?.highestRating || (leetcodeData ? Math.round(leetcodeData.highestRating) : 1200),
        stars: codechefData?.stars || (leetcodeData ? leetcodeData.stars : 1),
        problemsSolved: (codechefData?.problemsSolved || 0) + (leetcodeData?.problemsSolved || 0),
        contestCount: (codechefData?.contestCount || 0) + (leetcodeData?.contestCount || 0),
        contests: codechefData?.contests || [],
        fullySolvedCount: codechefData?.fullySolvedCount || (codechefData?.problemsSolved || 0) + (leetcodeData?.problemsSolved || 0),
        partiallySolvedCount: codechefData?.partiallySolvedCount || 0,
        bestContestRank: codechefData?.bestContestRank || null,
        activeDaysCount: (codechefData?.activeDaysCount || 0) + (leetcodeData ? 30 : 0) + (githubData ? 50 : 0),
      });

      // Override AI consistencyScore with overall consistency calculation if appropriate
      if (leetcodeData && analysis.consistencyScore) {
        analysis.consistencyScore = Math.round((analysis.consistencyScore + (leetcodeData.rawMetrics?.consistencyScore || 0)) / 2);
      }

      // 4. Update Database inside a transaction
      await prisma.$transaction(async (tx) => {
        // Fetch old leaderboard entry rating if exists
        const oldEntry = await tx.leaderboardEntry.findUnique({
          where: { studentId },
          select: { overallScore: true },
        });
        const oldOverall = oldEntry?.overallScore || 0;

        // Update or insert CodeChef profile
        if (codechefData) {
          await tx.codechefProfile.upsert({
            where: { studentId },
            create: {
              studentId,
              username: codechefData.username,
              fullName: codechefData.fullName,
              country: codechefData.country,
              institution: codechefData.institution,
              city: codechefData.city,
              currentRating: codechefData.currentRating,
              highestRating: codechefData.highestRating,
              stars: codechefData.stars,
              maxStars: codechefData.maxStars,
              globalRank: codechefData.globalRank,
              countryRank: codechefData.countryRank,
              problemsSolved: codechefData.problemsSolved,
              fullySolvedCount: codechefData.fullySolvedCount || 0,
              partiallySolvedCount: codechefData.partiallySolvedCount || 0,
              easySolvedCount: codechefData.easySolvedCount || 0,
              mediumSolvedCount: codechefData.mediumSolvedCount || 0,
              hardSolvedCount: codechefData.hardSolvedCount || 0,
              challengeSolvedCount: codechefData.challengeSolvedCount || 0,
              contestCount: codechefData.contestCount,
              longChallengeCount: codechefData.longChallengeCount || 0,
              cookOffCount: codechefData.cookOffCount || 0,
              lunchtimeCount: codechefData.lunchtimeCount || 0,
              startersCount: codechefData.startersCount || 0,
              division: codechefData.division,
              bestContestRank: codechefData.bestContestRank,
              averageContestRank: codechefData.averageContestRank,
              lastActive: codechefData.lastActive,
              activeDaysCount: codechefData.activeDaysCount || 0,
              ratingHistory: codechefData.ratingHistory as any,
              contestHistory: codechefData.contestHistory as any,
              difficultyDistribution: codechefData.difficultyDistribution as any,
              activitySummary: codechefData.activitySummary as any,
              statisticDetails: codechefData.statisticDetails as any,
              contests: codechefData.contests as any,
              lastFetchedAt: new Date(),
            },
            update: {
              username: codechefData.username,
              fullName: codechefData.fullName,
              country: codechefData.country,
              institution: codechefData.institution,
              city: codechefData.city,
              currentRating: codechefData.currentRating,
              highestRating: codechefData.highestRating,
              stars: codechefData.stars,
              maxStars: codechefData.maxStars,
              globalRank: codechefData.globalRank,
              countryRank: codechefData.countryRank,
              problemsSolved: codechefData.problemsSolved,
              fullySolvedCount: codechefData.fullySolvedCount || 0,
              partiallySolvedCount: codechefData.partiallySolvedCount || 0,
              easySolvedCount: codechefData.easySolvedCount || 0,
              mediumSolvedCount: codechefData.mediumSolvedCount || 0,
              hardSolvedCount: codechefData.hardSolvedCount || 0,
              challengeSolvedCount: codechefData.challengeSolvedCount || 0,
              contestCount: codechefData.contestCount,
              longChallengeCount: codechefData.longChallengeCount || 0,
              cookOffCount: codechefData.cookOffCount || 0,
              lunchtimeCount: codechefData.lunchtimeCount || 0,
              startersCount: codechefData.startersCount || 0,
              division: codechefData.division,
              bestContestRank: codechefData.bestContestRank,
              averageContestRank: codechefData.averageContestRank,
              lastActive: codechefData.lastActive,
              activeDaysCount: codechefData.activeDaysCount || 0,
              ratingHistory: codechefData.ratingHistory as any,
              contestHistory: codechefData.contestHistory as any,
              difficultyDistribution: codechefData.difficultyDistribution as any,
              activitySummary: codechefData.activitySummary as any,
              statisticDetails: codechefData.statisticDetails as any,
              contests: codechefData.contests as any,
              lastFetchedAt: new Date(),
            },
          });
        }

        // Update or insert LeetCode profile
        if (leetcodeData) {
          const metrics = leetcodeData.rawMetrics || {};
          await tx.leetcodeProfile.upsert({
            where: { studentId },
            create: {
              studentId,
              username: leetcodeData.username,
              problemsSolved: leetcodeData.problemsSolved,
              easySolvedCount: metrics.easySolvedCount || 0,
              mediumSolvedCount: metrics.mediumSolvedCount || 0,
              hardSolvedCount: metrics.hardSolvedCount || 0,
              contestRating: leetcodeData.currentRating,
              contestRank: leetcodeData.globalRank || 0,
              acceptanceRate: metrics.acceptanceRate || 0,
              heatmap: metrics.heatmap as any,
              weeklyActivity: metrics.weeklyActivity as any,
              skillRadar: metrics.skillRadar as any,
              tagDistribution: metrics.tagDistribution as any,
              consistencyScore: metrics.consistencyScore || 0,
              ratingHistory: metrics.ratingHistory as any,
              contestHistory: metrics.contestHistory as any,
              lastFetchedAt: new Date(),
            },
            update: {
              username: leetcodeData.username,
              problemsSolved: leetcodeData.problemsSolved,
              easySolvedCount: metrics.easySolvedCount || 0,
              mediumSolvedCount: metrics.mediumSolvedCount || 0,
              hardSolvedCount: metrics.hardSolvedCount || 0,
              contestRating: leetcodeData.currentRating,
              contestRank: leetcodeData.globalRank || 0,
              acceptanceRate: metrics.acceptanceRate || 0,
              heatmap: metrics.heatmap as any,
              weeklyActivity: metrics.weeklyActivity as any,
              skillRadar: metrics.skillRadar as any,
              tagDistribution: metrics.tagDistribution as any,
              consistencyScore: metrics.consistencyScore || 0,
              ratingHistory: metrics.ratingHistory as any,
              contestHistory: metrics.contestHistory as any,
              lastFetchedAt: new Date(),
            },
          });
        }

        // Update or insert GitHub profile
        if (githubData) {
          const metrics = githubData.rawMetrics || {};
          await tx.githubProfile.upsert({
            where: { studentId },
            create: {
              studentId,
              username: githubData.username,
              totalRepositories: metrics.totalRepositories || 0,
              totalStars: metrics.totalStars || 0,
              totalForks: metrics.totalForks || 0,
              followers: metrics.followers || 0,
              contributions: metrics.contributions as any,
              languages: metrics.languages as any,
              repos: metrics.repos as any,
              commitTimeline: metrics.commitTimeline as any,
              openSourceScore: metrics.openSourceScore || 0,
              repoQualityScore: metrics.repoQualityScore as any,
              lastFetchedAt: new Date(),
            },
            update: {
              username: githubData.username,
              totalRepositories: metrics.totalRepositories || 0,
              totalStars: metrics.totalStars || 0,
              totalForks: metrics.totalForks || 0,
              followers: metrics.followers || 0,
              contributions: metrics.contributions as any,
              languages: metrics.languages as any,
              repos: metrics.repos as any,
              commitTimeline: metrics.commitTimeline as any,
              openSourceScore: metrics.openSourceScore || 0,
              repoQualityScore: metrics.repoQualityScore as any,
              lastFetchedAt: new Date(),
            },
          });
        }

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

        // Determine trend direction
        let trendDirection = "NEUTRAL";
        if (oldOverall > 0) {
          if (overallScore > oldOverall) trendDirection = "UP";
          else if (overallScore < oldOverall) trendDirection = "DOWN";
        }

        // Update or insert Leaderboard cache entry
        await tx.leaderboardEntry.upsert({
          where: { studentId },
          create: {
            studentId,
            rating: codechefData?.currentRating || 0,
            stars: codechefData?.stars || 1,
            talentScore: analysis.talentScore,
            overallScore,
            codechefScore,
            leetcodeScore,
            githubScore,
            trendDirection,
            rank: 0,
          },
          update: {
            rating: codechefData?.currentRating || 0,
            stars: codechefData?.stars || 1,
            talentScore: analysis.talentScore,
            overallScore,
            codechefScore,
            leetcodeScore,
            githubScore,
            trendDirection,
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
        if (oldOverall > 0 && overallScore > oldOverall) {
          await tx.activityLog.create({
            data: {
              eventType: "RATING_INCREASE",
              studentId,
              message: `${student.name}'s overall score increased from ${oldOverall} to ${overallScore}!`,
            },
          });
        } else {
          await tx.activityLog.create({
            data: {
              eventType: "SYNC_SUCCESS",
              studentId,
              message: `${student.name}'s developer intelligence profile was successfully synced.`,
            },
          });
        }
      });

      // 5. Recalculate global ranks
      await this.recalculateLeaderboardRanks();

      return { success: true };
    } catch (err: any) {
      console.error(`Sync failed for student ${studentId}:`, err);

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

        await prisma.activityLog.create({
          data: {
            eventType: "SYNC_FAILURE",
            studentId,
            message: `Profile sync failed for ${student?.name || "Student"}: ${err.message || "Unknown error"}.`,
          },
        });
      } catch (logErr) {
        console.error("Failed to write failure sync log:", logErr);
      }

      return { success: false, error: err.message };
    }
  }

  static async recalculateLeaderboardRanks(): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY overall_score DESC, rating DESC, talent_score DESC) as new_rank
          FROM leaderboard_entries
        )
        UPDATE leaderboard_entries le
        SET rank = r.new_rank
        FROM ranked r
        WHERE le.id = r.id
      `);
    } catch (err) {
      console.error("Failed to recalculate leaderboard ranks via raw SQL, executing transaction fallback:", err);
      
      const entries = await prisma.leaderboardEntry.findMany({
        orderBy: [
          { overallScore: "desc" },
          { rating: "desc" },
          { talentScore: "desc" },
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
