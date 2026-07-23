import { prisma } from "@/lib/prisma";
import { CodechefService } from "./codechef.service";
import { LeetcodeService } from "./leetcode.service";

import { NormalizationService } from "./normalization.service";
import { AiEngineService } from "./ai-engine.service";
import { OverallScoreService } from "./overallScore.service";

export type SyncTrigger = "SYSTEM_CRON" | "USER_MANUAL" | "ADMIN_FORCE";

function validateProfileData(platform: string, username: string, data: any) {
  if (!data) return;

  if (typeof data !== "object" || Object.keys(data).length === 0) {
    throw new Error(`${platform} profile data is empty or invalid.`);
  }

  if (data.username && data.username.toLowerCase() !== username.toLowerCase()) {
    throw new Error(`${platform} username mismatch: expected ${username}, got ${data.username}`);
  }

  if (data.currentRating !== undefined && data.currentRating !== null) {
    const r = Number(data.currentRating);
    if (isNaN(r)) {
      throw new Error(`${platform} rating must be numeric.`);
    }
  }

  if (platform === "CODECHEF" && data.stars !== undefined && data.stars !== null) {
    const s = Number(data.stars);
    if (isNaN(s) || s < 0 || s > 7) {
      throw new Error("CodeChef stars must be an integer between 0 and 7.");
    }
  }

  const contestHistory = data.contestHistory || data.contests;
  if (contestHistory) {
    if (!Array.isArray(contestHistory)) {
      throw new Error(`${platform} contest history must be an array.`);
    }
    const seenContests = new Set<string>();
    for (const contest of contestHistory) {
      if (!contest.contest || typeof contest.contest !== "string") {
        throw new Error(`${platform} contest entry must have a valid contest title.`);
      }
      if (seenContests.has(contest.contest)) {
        throw new Error(`${platform} duplicate contest detected: ${contest.contest}`);
      }
      seenContests.add(contest.contest);

      if (contest.date) {
        const parsedDate = new Date(contest.date);
        if (isNaN(parsedDate.getTime())) {
          throw new Error(`${platform} contest date is invalid: ${contest.date}`);
        }
      }
    }
  }
}

export class SyncService {
  /**
   * Performs sync for a single student.
   * Runs collectors, normalizes, validates, stores raw data, computes scores, recalculates rankings.
   */
  static async syncStudent(
    studentId: string,
    initiatedBy: SyncTrigger,
    skipRankRecalculation: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();

    // 1. Fetch Student Profile to get usernames
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return { success: false, error: "Student profile not found." };
    }

    const isCloudTest = student.rollNumber === "CLOUDTEST001";
    if (isCloudTest) {
      console.log(`[Sanitized Log] [CLOUDTEST001] Sync started. Initiated by: ${initiatedBy}`);
    }

    // Create or update SyncJob
    const syncJob = await prisma.syncJob.create({
      data: {
        studentId,
        status: "RUNNING",
      },
    });

    const hasAnyHandle = Boolean(student.codechefUsername || student.leetcodeUsername || student.codeforcesUsername || student.githubUsername);

    if (!hasAnyHandle) {
      if (isCloudTest) {
        console.log(`[Sanitized Log] [CLOUDTEST001] No usernames configured. Creating unranked LeaderboardEntry.`);
      }

      await prisma.studentProfile.update({
        where: { id: studentId },
        data: {
          profileStatus: "INCOMPLETE",
          leaderboardEligible: false,
          dashboardEligible: false,
          verificationStatus: "UNABLE_TO_VERIFY",
        },
      });

      await prisma.leaderboardEntry.upsert({
        where: { studentId },
        create: {
          studentId,
          rating: 0,
          stars: 0,
          talentScore: 0,
          overallScore: 0,
          codechefScore: 0,
          leetcodeScore: 0,
          trendDirection: "NEUTRAL",
          rank: 0,
        },
        update: {
          rating: 0,
          stars: 0,
          talentScore: 0,
          overallScore: 0,
          codechefScore: 0,
          leetcodeScore: 0,
          trendDirection: "NEUTRAL",
          rank: 0,
        },
      });

      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: "COMPLETED",
        },
      });

      if (isCloudTest) {
        console.log(`[Sanitized Log] [CLOUDTEST001] Created unranked LeaderboardEntry and completed sync job.`);
      }

      return { success: true };
    }

    try {
      // 2. Collector Phase: Scrape platforms in parallel
      let codechefError: string | null = null;

      const scrapePromises = [
        // CodeChef Collector
        student.codechefUsername
          ? CodechefService.fetchData(student.codechefUsername).catch((err) => {
              console.error(`[Collector] CodeChef scrape failed for student ${student.name}:`, err);
              codechefError = err.message || "Failed to fetch CodeChef profile";
              return null;
            })
          : Promise.resolve(null),
        // LeetCode Collector
        student.leetcodeUsername
          ? LeetcodeService.fetchData(student.leetcodeUsername).catch((err) => {
              console.error(`[Collector] LeetCode scrape failed for student ${student.name}:`, err);
              return null;
            })
          : Promise.resolve(null),
      ];

      let [codechefData, leetcodeData] = await Promise.all(scrapePromises);

      if (isCloudTest) {
        console.log(`[Sanitized Log] [CLOUDTEST001] Platform fetch results: CodeChef success: ${codechefData !== null}, LeetCode success: ${leetcodeData !== null}`);
      }

      // Validate all successfully scraped data prior to database writes
      if (student.codechefUsername && codechefData) {
        try {
          validateProfileData("CODECHEF", student.codechefUsername, codechefData);
        } catch (e: any) {
          console.error(`[SyncService] CodeChef validation failed for ${student.name}: ${e.message}`);
          codechefError = e.message || "Validation failed";
          codechefData = null;
        }
      }
      if (student.leetcodeUsername && leetcodeData) {
        try {
          validateProfileData("LEETCODE", student.leetcodeUsername, leetcodeData);
        } catch (e: any) {
          console.error(`[SyncService] LeetCode validation failed for ${student.name}: ${e.message}`);
          leetcodeData = null;
        }
      }

      // Calculate verificationStatus
      let codechefSuccess = student.codechefUsername ? (codechefData !== null) : null;
      let leetcodeSuccess = student.leetcodeUsername ? (leetcodeData !== null) : null;

      const existingCc = await prisma.codechefProfile.findUnique({ where: { studentId } });
      const existingLc = await prisma.leetcodeProfile.findUnique({ where: { studentId } });

      if (student.codechefUsername && !codechefSuccess && existingCc && existingCc.username.toLowerCase() === student.codechefUsername.toLowerCase()) {
        codechefSuccess = true;
      }
      if (student.leetcodeUsername && !leetcodeSuccess && existingLc && existingLc.username.toLowerCase() === student.leetcodeUsername.toLowerCase()) {
        leetcodeSuccess = true;
      }

      let verificationStatus = "UNABLE_TO_VERIFY";
      const configuredCount = [student.codechefUsername, student.leetcodeUsername, student.codeforcesUsername, student.githubUsername].filter(Boolean).length;
      const successCount = [codechefSuccess, leetcodeSuccess].filter(x => x === true).length;

      if (configuredCount > 0) {
        if (successCount === configuredCount) {
          verificationStatus = "VERIFIED";
        } else if (successCount > 0) {
          verificationStatus = "PARTIAL";
        } else {
          verificationStatus = "UNABLE_TO_VERIFY";
        }
      }

      let profileStatus = "INVALID";
      let leaderboardEligible = false;
      let dashboardEligible = false;

      if (configuredCount === 0) {
        profileStatus = "INCOMPLETE";
        leaderboardEligible = false;
        dashboardEligible = false;
      } else if (successCount > 0) {
        profileStatus = "VERIFIED";
        leaderboardEligible = true;
        dashboardEligible = true;
      } else {
        profileStatus = "INVALID";
        leaderboardEligible = false;
        dashboardEligible = false;
      }

      // 3. Database Storage Phase: Update Database inside a transaction
      const queries: any[] = [];

      // Update StudentProfile status & eligibility
      queries.push(
        prisma.studentProfile.update({
          where: { id: studentId },
          data: {
            verificationStatus,
            profileStatus,
            leaderboardEligible,
            dashboardEligible,
          }
        })
      );

      // Upsert CodeChef Profile
      if (codechefData) {
        const retrievedAt = new Date().toISOString();
        const ccMetadata = {
          username: { value: codechefData.username, source: "CodeChef", retrievedAt, verificationStatus: "Verified" },
          fullName: { value: codechefData.fullName, source: "CodeChef", retrievedAt, verificationStatus: codechefData.fullName ? "Verified" : "Unavailable" },
          country: { value: codechefData.country, source: "CodeChef", retrievedAt, verificationStatus: codechefData.country ? "Verified" : "Unavailable" },
          institution: { value: codechefData.institution, source: "CodeChef", retrievedAt, verificationStatus: codechefData.institution ? "Verified" : "Unavailable" },
          city: { value: codechefData.city, source: "CodeChef", retrievedAt, verificationStatus: codechefData.city ? "Verified" : "Unavailable" },
          currentRating: { value: codechefData.currentRating, source: "CodeChef", retrievedAt, verificationStatus: codechefData.currentRating !== null ? "Verified" : "Unavailable" },
          highestRating: { value: codechefData.highestRating, source: "CodeChef", retrievedAt, verificationStatus: codechefData.highestRating !== null ? "Verified" : "Unavailable" },
          stars: { value: codechefData.stars, source: "CodeChef", retrievedAt, verificationStatus: codechefData.stars !== null ? "Verified" : "Unavailable" },
          maxStars: { value: codechefData.maxStars, source: "CodeChef", retrievedAt, verificationStatus: codechefData.maxStars !== null ? "Verified" : "Unavailable" },
          globalRank: { value: codechefData.globalRank, source: "CodeChef", retrievedAt, verificationStatus: codechefData.globalRank !== null ? "Verified" : "Unavailable" },
          countryRank: { value: codechefData.countryRank, source: "CodeChef", retrievedAt, verificationStatus: codechefData.countryRank !== null ? "Verified" : "Unavailable" },
          problemsSolved: { value: codechefData.problemsSolved, source: "CodeChef", retrievedAt, verificationStatus: codechefData.problemsSolved !== null ? "Verified" : "Unavailable" },
          fullySolvedCount: { value: codechefData.fullySolvedCount, source: "CodeChef", retrievedAt, verificationStatus: codechefData.fullySolvedCount !== null ? "Verified" : "Unavailable" },
          partiallySolvedCount: { value: codechefData.partiallySolvedCount, source: "CodeChef", retrievedAt, verificationStatus: codechefData.partiallySolvedCount !== null ? "Verified" : "Unavailable" },
          easySolvedCount: { value: codechefData.easySolvedCount, source: "CodeChef", retrievedAt, verificationStatus: codechefData.easySolvedCount !== null ? "Verified" : "Unavailable" },
          mediumSolvedCount: { value: codechefData.mediumSolvedCount, source: "CodeChef", retrievedAt, verificationStatus: codechefData.mediumSolvedCount !== null ? "Verified" : "Unavailable" },
          hardSolvedCount: { value: codechefData.hardSolvedCount, source: "CodeChef", retrievedAt, verificationStatus: codechefData.hardSolvedCount !== null ? "Verified" : "Unavailable" },
          challengeSolvedCount: { value: codechefData.challengeSolvedCount, source: "CodeChef", retrievedAt, verificationStatus: codechefData.challengeSolvedCount !== null ? "Verified" : "Unavailable" },
          contestCount: { value: codechefData.contestCount, source: "CodeChef", retrievedAt, verificationStatus: codechefData.contestCount !== null ? "Verified" : "Unavailable" },
          longChallengeCount: { value: codechefData.longChallengeCount, source: "CodeChef", retrievedAt, verificationStatus: codechefData.longChallengeCount !== null ? "Verified" : "Unavailable" },
          cookOffCount: { value: codechefData.cookOffCount, source: "CodeChef", retrievedAt, verificationStatus: codechefData.cookOffCount !== null ? "Verified" : "Unavailable" },
          lunchtimeCount: { value: codechefData.lunchtimeCount, source: "CodeChef", retrievedAt, verificationStatus: codechefData.lunchtimeCount !== null ? "Verified" : "Unavailable" },
          startersCount: { value: codechefData.startersCount, source: "CodeChef", retrievedAt, verificationStatus: codechefData.startersCount !== null ? "Verified" : "Unavailable" },
          division: { value: codechefData.division, source: "CodeChef", retrievedAt, verificationStatus: codechefData.division ? "Verified" : "Unavailable" },
          bestContestRank: { value: codechefData.bestContestRank, source: "CodeChef", retrievedAt, verificationStatus: codechefData.bestContestRank !== null ? "Verified" : "Unavailable" },
          averageContestRank: { value: codechefData.averageContestRank, source: "CodeChef", retrievedAt, verificationStatus: codechefData.averageContestRank !== null ? "Verified" : "Unavailable" },
          lastActive: { value: codechefData.lastActive, source: "CodeChef", retrievedAt, verificationStatus: codechefData.lastActive ? "Verified" : "Unavailable" },
          activeDaysCount: { value: codechefData.activeDaysCount, source: "CodeChef", retrievedAt, verificationStatus: codechefData.activeDaysCount !== null ? "Verified" : "Unavailable" },
          syncStatus: "SUCCESS"
        };

        queries.push(
          prisma.codechefProfile.upsert({
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
              fullySolvedCount: codechefData.fullySolvedCount,
              partiallySolvedCount: codechefData.partiallySolvedCount,
              easySolvedCount: codechefData.easySolvedCount,
              mediumSolvedCount: codechefData.mediumSolvedCount,
              hardSolvedCount: codechefData.hardSolvedCount,
              challengeSolvedCount: codechefData.challengeSolvedCount,
              contestCount: codechefData.contestCount,
              longChallengeCount: codechefData.longChallengeCount,
              cookOffCount: codechefData.cookOffCount,
              lunchtimeCount: codechefData.lunchtimeCount,
              startersCount: codechefData.startersCount,
              division: codechefData.division,
              bestContestRank: codechefData.bestContestRank,
              averageContestRank: codechefData.averageContestRank,
              lastActive: codechefData.lastActive,
              activeDaysCount: codechefData.activeDaysCount,
              ratingHistory: codechefData.ratingHistory as any,
              contestHistory: codechefData.contestHistory as any,
              difficultyDistribution: codechefData.difficultyDistribution as any,
              activitySummary: codechefData.activitySummary as any,
              statisticDetails: codechefData.statisticDetails as any,
              contests: codechefData.contests as any,
              verificationMetadata: ccMetadata as any,
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
              fullySolvedCount: codechefData.fullySolvedCount,
              partiallySolvedCount: codechefData.partiallySolvedCount,
              easySolvedCount: codechefData.easySolvedCount,
              mediumSolvedCount: codechefData.mediumSolvedCount,
              hardSolvedCount: codechefData.hardSolvedCount,
              challengeSolvedCount: codechefData.challengeSolvedCount,
              contestCount: codechefData.contestCount,
              longChallengeCount: codechefData.longChallengeCount,
              cookOffCount: codechefData.cookOffCount,
              lunchtimeCount: codechefData.lunchtimeCount,
              startersCount: codechefData.startersCount,
              division: codechefData.division,
              bestContestRank: codechefData.bestContestRank,
              averageContestRank: codechefData.averageContestRank,
              lastActive: codechefData.lastActive,
              activeDaysCount: codechefData.activeDaysCount,
              ratingHistory: codechefData.ratingHistory as any,
              contestHistory: codechefData.contestHistory as any,
              difficultyDistribution: codechefData.difficultyDistribution as any,
              activitySummary: codechefData.activitySummary as any,
              statisticDetails: codechefData.statisticDetails as any,
              contests: codechefData.contests as any,
              verificationMetadata: ccMetadata as any,
              lastFetchedAt: new Date(),
            },
          })
        );
      } else if (existingCc) {
        // If scraping failed but we have existing data, preserve it and mark status as FAILED
        const existingMetadata = existingCc.verificationMetadata as any || {};
        queries.push(
          prisma.codechefProfile.update({
            where: { studentId },
            data: {
              verificationMetadata: {
                ...existingMetadata,
                syncStatus: "FAILED",
                error: codechefError || "Unknown error during sync",
                lastAttemptedAt: new Date().toISOString()
              } as any
            }
          })
        );
      }

      // Upsert LeetCode Profile
      if (leetcodeData) {
        const metrics = leetcodeData.rawMetrics || {};
        const retrievedAt = new Date().toISOString();
        const lcMetadata = {
          username: { value: leetcodeData.username, source: "LeetCode", retrievedAt, verificationStatus: "Verified" },
          problemsSolved: { value: leetcodeData.problemsSolved, source: "LeetCode", retrievedAt, verificationStatus: leetcodeData.problemsSolved !== null ? "Verified" : "Unavailable" },
          easySolvedCount: { value: metrics.easySolvedCount, source: "LeetCode", retrievedAt, verificationStatus: metrics.easySolvedCount !== null ? "Verified" : "Unavailable" },
          mediumSolvedCount: { value: metrics.mediumSolvedCount, source: "LeetCode", retrievedAt, verificationStatus: metrics.mediumSolvedCount !== null ? "Verified" : "Unavailable" },
          hardSolvedCount: { value: metrics.hardSolvedCount, source: "LeetCode", retrievedAt, verificationStatus: metrics.hardSolvedCount !== null ? "Verified" : "Unavailable" },
          contestRating: { value: leetcodeData.currentRating, source: "LeetCode", retrievedAt, verificationStatus: leetcodeData.currentRating !== null ? "Verified" : "Unavailable" },
          contestRank: { value: leetcodeData.globalRank, source: "LeetCode", retrievedAt, verificationStatus: leetcodeData.globalRank !== null ? "Verified" : "Unavailable" },
          acceptanceRate: { value: metrics.acceptanceRate, source: "LeetCode", retrievedAt, verificationStatus: metrics.acceptanceRate !== null ? "Verified" : "Unavailable" },
          consistencyScore: { value: metrics.consistencyScore, source: "LeetCode", retrievedAt, verificationStatus: metrics.consistencyScore !== null ? "Verified" : "Unavailable" },
          profileRanking: { value: metrics.profileRanking, source: "LeetCode", retrievedAt, verificationStatus: metrics.profileRanking !== null ? "Verified" : "Unavailable" },
          contestsAttended: { value: metrics.contestsAttended, source: "LeetCode", retrievedAt, verificationStatus: metrics.contestsAttended !== null ? "Verified" : "Unavailable" },
          syncStatus: { value: "SUCCESS", source: "System", retrievedAt, verificationStatus: "Verified" }
        };

        queries.push(
          prisma.leetcodeProfile.upsert({
            where: { studentId },
            create: {
              studentId,
              username: leetcodeData.username,
              problemsSolved: leetcodeData.problemsSolved,
              easySolvedCount: metrics.easySolvedCount,
              mediumSolvedCount: metrics.mediumSolvedCount,
              hardSolvedCount: metrics.hardSolvedCount,
              contestRating: leetcodeData.currentRating,
              contestRank: leetcodeData.globalRank ?? null,
              acceptanceRate: metrics.acceptanceRate || 0,
              heatmap: metrics.heatmap as any,
              weeklyActivity: metrics.weeklyActivity as any,
              skillRadar: metrics.skillRadar as any,
              tagDistribution: metrics.tagDistribution as any,
              consistencyScore: metrics.consistencyScore || 0,
              ratingHistory: metrics.ratingHistory as any,
              contestHistory: metrics.contestHistory as any,
              verificationMetadata: lcMetadata as any,
              lastFetchedAt: new Date(),
            },
            update: {
              username: leetcodeData.username,
              problemsSolved: leetcodeData.problemsSolved,
              easySolvedCount: metrics.easySolvedCount,
              mediumSolvedCount: metrics.mediumSolvedCount,
              hardSolvedCount: metrics.hardSolvedCount,
              contestRating: leetcodeData.currentRating,
              contestRank: leetcodeData.globalRank ?? null,
              acceptanceRate: metrics.acceptanceRate || 0,
              heatmap: metrics.heatmap as any,
              weeklyActivity: metrics.weeklyActivity as any,
              skillRadar: metrics.skillRadar as any,
              tagDistribution: metrics.tagDistribution as any,
              consistencyScore: metrics.consistencyScore || 0,
              ratingHistory: metrics.ratingHistory as any,
              contestHistory: metrics.contestHistory as any,
              verificationMetadata: lcMetadata as any,
              lastFetchedAt: new Date(),
            },
          })
        );
      }



      // Pre-update LeaderboardEntry with raw scores to maintain transactional consistency
      queries.push(
        prisma.leaderboardEntry.upsert({
          where: { studentId },
          create: {
            studentId,
            rating: codechefData?.currentRating || existingCc?.currentRating || 0,
            stars: codechefData?.stars || existingCc?.stars || 0,
            talentScore: 0, // Computed later
            overallScore: 0, // Computed later
            codechefScore: 0, // Computed later
            leetcodeScore: 0, // Computed later
            trendDirection: "NEUTRAL",
            rank: 0,
          },
          update: {
            rating: codechefData?.currentRating || existingCc?.currentRating || 0,
            stars: codechefData?.stars || existingCc?.stars || 0,
          }
        })
      );

      // Execute sequential transaction
      await prisma.$transaction(queries);

      // 4. Normalization Phase: Unify and validate platform data
      const normalizedProfile = await NormalizationService.normalizeStudent(studentId);

      if (isCloudTest) {
        console.log(`[Sanitized Log] [CLOUDTEST001] Normalized profile created. Rating score: ${normalizedProfile?.ratingScore || 0}`);
      }

      // 5. AI Insights & Rating Phase: Execute AI engines strictly on normalized DB data
      const analysisResult = await AiEngineService.runAnalysisForStudent(studentId);
      const overallAi = analysisResult.overall;

      if (isCloudTest) {
        console.log(`[Sanitized Log] [CLOUDTEST001] AI analysis completed. Overall talent score: ${overallAi?.talentScore}`);
      }
      const codechefAi = analysisResult.codechef;
      const leetcodeAi = analysisResult.leetcode;

      // Fetch the updated profiles to calculate the overall rating cache
      const codechefProfile = await prisma.codechefProfile.findUnique({ where: { studentId } });
      const leetcodeProfile = await prisma.leetcodeProfile.findUnique({ where: { studentId } });

      const { OverallScoreService } = await import("@/services/overallScore.service");

      const ccScore = codechefProfile ? OverallScoreService.calculateCodechefScore(codechefProfile) : 0;
      const lcScore = leetcodeProfile ? OverallScoreService.calculateLeetcodeScore(leetcodeProfile) : 0;

      const active = {
        codechef: !!codechefProfile,
        leetcode: !!leetcodeProfile,
      };

      const overallScore = OverallScoreService.calculate(
        { codechef: ccScore, leetcode: lcScore },
        { codechef: active.codechef, leetcode: active.leetcode }
      );

      // Determine trend direction
      let trendDirection = "NEUTRAL";
      const oldEntry = await prisma.leaderboardEntry.findUnique({
        where: { studentId },
        select: { overallScore: true },
      });
      const oldOverall = oldEntry?.overallScore || 0;
      if (oldOverall > 0) {
        if (overallScore > oldOverall) trendDirection = "UP";
        else if (overallScore < oldOverall) trendDirection = "DOWN";
      }

      // Upsert Leaderboard Cache Entry
      await prisma.leaderboardEntry.upsert({
        where: { studentId },
        create: {
          studentId,
          rating: codechefProfile?.currentRating || 0,
          stars: codechefProfile?.stars ?? 0,
          talentScore: overallAi.talentScore,
          overallScore: overallScore,
          codechefScore: ccScore,
          leetcodeScore: lcScore,
          trendDirection,
          rank: 0,
        },
        update: {
          rating: codechefProfile?.currentRating || 0,
          stars: codechefProfile?.stars ?? 0,
          talentScore: overallAi.talentScore,
          overallScore: overallScore,
          codechefScore: ccScore,
          leetcodeScore: lcScore,
          trendDirection,
        },
      });

      if (isCloudTest) {
        console.log(`[Sanitized Log] [CLOUDTEST001] Leaderboard entry created/updated. Overall score: ${overallScore}, Rank trend: ${trendDirection}`);
      }

      // Recalculate ranks on the leaderboard
      if (!skipRankRecalculation) {
        await this.recalculateLeaderboardRanks();
      }

      // Log Sync Log
      await prisma.syncLog.create({
        data: {
          studentId,
          status: "SUCCESS",
          initiatedBy,
          durationMs: Date.now() - startTime,
        },
      });

      // Log Activity Log
      if (oldOverall > 0 && overallScore > oldOverall) {
        await prisma.activityLog.create({
          data: {
            eventType: "RATING_INCREASE",
            studentId,
            message: `${student.name}'s overall score increased from ${oldOverall} to ${overallScore}!`,
          },
        });
      } else {
        await prisma.activityLog.create({
          data: {
            eventType: "SYNC_SUCCESS",
            studentId,
            message: `${student.name}'s Unified Talent Profile was successfully synced.`,
          },
        });
      }

      // Complete SyncJob
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: "COMPLETED",
        },
      });

      // Invalidate relevant caches
      try {
        const { revalidatePath } = await import("next/cache");
        revalidatePath("/dashboard");
        revalidatePath("/leaderboard");
        revalidatePath("/analytics");
        revalidatePath("/departments");
        revalidatePath("/insights");
        revalidatePath(`/student/${studentId}`);
        revalidatePath("/api/dashboard/stats");
        revalidatePath("/api/dashboard/leaderboard-cache");
        revalidatePath("/api/leaderboard");
      } catch (cacheErr) {
        console.error("Cache invalidation failed:", cacheErr);
      }

      if (isCloudTest) {
        console.log("[Sanitized Log] [CLOUDTEST001] Sync completed successfully.");
      }

      return { success: true };
    } catch (err: any) {
      console.error(`Sync failed for student ${studentId}:`, err);
      if (student && student.rollNumber === "CLOUDTEST001") {
        console.log(`[Sanitized Log] [CLOUDTEST001] Sync failed: ${err.message || "Unknown error"}`);
      }

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

        // Fail SyncJob
        await prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: "FAILED",
            error: err.message || "Unknown error occurred.",
          },
        });
      } catch (logErr) {
        console.error("Failed to write failure sync logs:", logErr);
      }

      return { success: false, error: err.message };
    }
  }

  static async recalculateLeaderboardRanks(): Promise<void> {
    try {
      const { OverallScoreService } = await import("@/services/overallScore.service");

      // Fetch all active leaderboard entries, pre-sorted deterministically using our competitive ranking order
      const entries = await prisma.leaderboardEntry.findMany({
        where: {
          student: {
            leaderboardEligible: true,
          }
        },
        include: {
          student: true,
        },
        orderBy: OverallScoreService.getCompetitiveSortOrder("desc"),
      });

      // Calculate the dense competition ranks
      const rankedEntries = OverallScoreService.calculateDenseRank(
        entries,
        (entry) => [entry.overallScore, entry.codechefScore, entry.leetcodeScore]
      );

      console.log(`[SyncService] Recalculating dense competition rank for ${rankedEntries.length} students...`);

      // First reset all ranks to 0
      await prisma.$executeRawUnsafe(`UPDATE leaderboard_entries SET rank = 0`);

      // We process updates in batches to avoid overwhelming the database transaction pool
      const batchSize = 100;
      for (let i = 0; i < rankedEntries.length; i += batchSize) {
        const batch = rankedEntries.slice(i, i + batchSize);
        await prisma.$transaction(
          batch.map((entry) => 
            prisma.leaderboardEntry.update({
              where: { id: entry.id },
              data: { rank: entry.rank }
            })
          )
        );
      }
      
      console.log("[SyncService] Successfully rebuilt all global leaderboard competitive ranks.");
    } catch (err) {
      console.error("Failed to recalculate leaderboard ranks:", err);
    }
  }

  /**
   * Orchestrates bulk sync with max concurrency 2 to avoid EMAXCONN and DB pool saturation.
   */
  static async bulkSyncStudents(
    mode: "STALE_ONLY" | "ALL" | "FAILED_ONLY",
    jobId: string,
    adminId: string
  ): Promise<void> {
    try {
      const { updateJobProgress, getJob } = await import("@/lib/jobTracker");
      
      const staleThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000); // 6 hours
      
      let whereClause: any = {
        OR: [
          { codechefUsername: { not: null } },
          { leetcodeUsername: { not: null } },
        ]
      };

      if (mode === "STALE_ONLY") {
        whereClause = {
          ...whereClause,
          updatedAt: { lt: staleThreshold }
        };
      }

      const students = await prisma.studentProfile.findMany({
        where: whereClause,
        select: { id: true }
      });

      const totalStudents = students.length;
      updateJobProgress(jobId, { totalStudents, status: 'RUNNING' });

      if (totalStudents === 0) {
        updateJobProgress(jobId, { status: 'SUCCESS', completedAt: new Date() });
        return;
      }

      // Concurrency 2 max
      const maxConcurrency = 2;
      let currentIndex = 0;
      let successfulStudents = 0;
      let failedStudents = 0;

      const worker = async () => {
        while (currentIndex < students.length) {
          const index = currentIndex++;
          const studentId = students[index].id;
          
          updateJobProgress(jobId, { currentStudent: studentId });

          const result = await this.syncStudent(studentId, "ADMIN_FORCE", true);
          
          if (result.success) {
            successfulStudents++;
          } else {
            failedStudents++;
            const job = getJob(jobId);
            if (job) {
              updateJobProgress(jobId, { errors: [...job.errors, result.error || "Unknown error"] });
            }
          }
          
          updateJobProgress(jobId, {
            processedStudents: successfulStudents + failedStudents,
            successfulStudents,
            failedStudents,
          });
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(maxConcurrency, totalStudents) }, () => worker())
      );

      // Single Global Rank Recalculation after all complete
      await this.recalculateLeaderboardRanks();

      // Invalidate Global Caches
      try {
        const { revalidatePath } = await import("next/cache");
        revalidatePath("/dashboard");
        revalidatePath("/leaderboard");
        revalidatePath("/analytics");
        revalidatePath("/departments");
        revalidatePath("/insights");
        revalidatePath("/api/dashboard/stats");
        revalidatePath("/api/dashboard/leaderboard-cache");
        revalidatePath("/api/leaderboard");
      } catch (cacheErr) {
        console.error("Global Cache invalidation failed:", cacheErr);
      }

      updateJobProgress(jobId, {
        status: failedStudents > 0 ? (successfulStudents > 0 ? 'PARTIAL_SUCCESS' : 'FAILED') : 'SUCCESS',
        completedAt: new Date()
      });

    } catch (error: any) {
      console.error("Bulk sync failed:", error);
      const { updateJobProgress, getJob } = await import("@/lib/jobTracker");
      const job = getJob(jobId);
      if (job) {
         updateJobProgress(jobId, { status: 'FAILED', completedAt: new Date(), errors: [...job.errors, error.message || 'Fatal bulk sync error'] });
      }
    }
  }
}

