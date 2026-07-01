import { prisma } from "@/lib/prisma";
import { AnalyticsService } from "./analytics.service";

export type SyncTrigger = "SYSTEM_CRON" | "USER_MANUAL" | "ADMIN_FORCE";

export class SyncService {
  /**
   * Performs sync for a single student.
   * Invokes parallel scrapes for active platforms, updates DB tables, and adjusts ratings caches.
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
      // 2. Call AnalyticsService to scrape and process in parallel
      const analysisResult = await AnalyticsService.analyzeStudent({
        codechefUrl: student.codechefUsername,
        leetcodeUrl: student.leetcodeUsername,
        githubUrl: student.githubUsername,
      });

      const { codechef, leetcode, github, overall } = analysisResult;

      // 3. Update Database inside a transaction
      await prisma.$transaction(async (tx) => {
        // Fetch old leaderboard entry overall score if exists
        const oldEntry = await tx.leaderboardEntry.findUnique({
          where: { studentId },
          select: { overallScore: true },
        });
        const oldOverall = oldEntry?.overallScore || 0;

        // Upsert CodeChef profile if data returned
        if (codechef && codechef.data) {
          const codechefData = codechef.data;
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

        // Upsert LeetCode profile if data returned
        if (leetcode && leetcode.data) {
          const leetcodeData = leetcode.data;
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

        // Upsert GitHub profile if data returned
        if (github && github.data) {
          const githubData = github.data;
          const metrics = githubData.rawMetrics || {};
          const reposExtended = {
            list: metrics.repos,
            intelligence: metrics.intelligence,
            commitAnalytics: metrics.commitAnalytics,
            openSource: metrics.openSource,
            portfolio: metrics.portfolio,
            careerInsights: metrics.careerInsights,
            profileDetails: metrics.profileDetails,
            developerScore: metrics.developerScore
          };
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
              repos: reposExtended as any,
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
              repos: reposExtended as any,
              commitTimeline: metrics.commitTimeline as any,
              openSourceScore: metrics.openSourceScore || 0,
              repoQualityScore: metrics.repoQualityScore as any,
              lastFetchedAt: new Date(),
            },
          });
        }

        // Upsert AI analysis using aggregated overall AI insights
        const analysis = overall.ai;
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
            recommendations: [] as any,
            careerSuggestions: [] as any,
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
            generatedAt: new Date(),
          },
        });

        // Determine trend direction
        let trendDirection = "NEUTRAL";
        if (oldOverall > 0) {
          if (overall.score > oldOverall) trendDirection = "UP";
          else if (overall.score < oldOverall) trendDirection = "DOWN";
        }

        // Upsert Leaderboard Cache Entry
        await tx.leaderboardEntry.upsert({
          where: { studentId },
          create: {
            studentId,
            rating: codechef?.data?.currentRating || 0,
            stars: codechef?.data?.stars || 1,
            talentScore: analysis.talentScore,
            overallScore: overall.score,
            codechefScore: codechef?.score || 0,
            leetcodeScore: leetcode?.score || 0,
            githubScore: github?.score || 0,
            trendDirection,
            rank: 0,
          },
          update: {
            rating: codechef?.data?.currentRating || 0,
            stars: codechef?.data?.stars || 1,
            talentScore: analysis.talentScore,
            overallScore: overall.score,
            codechefScore: codechef?.score || 0,
            leetcodeScore: leetcode?.score || 0,
            githubScore: github?.score || 0,
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
        if (oldOverall > 0 && overall.score > oldOverall) {
          await tx.activityLog.create({
            data: {
              eventType: "RATING_INCREASE",
              studentId,
              message: `${student.name}'s overall score increased from ${oldOverall} to ${overall.score}!`,
            },
          });
        } else {
          await tx.activityLog.create({
            data: {
              eventType: "SYNC_SUCCESS",
              studentId,
              message: `${student.name}'s Unified Talent Profile was successfully synced.`,
            },
          });
        }
      });

      // 4. Recalculate global ranks
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
