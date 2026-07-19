import { prisma } from "@/lib/prisma";
import { CodechefService } from "./codechef.service";
import { LeetcodeService } from "./leetcode.service";
import { GithubService } from "./github.service";
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

    if (!student.codechefUsername && !student.leetcodeUsername && !student.githubUsername) {
      if (isCloudTest) {
        console.log(`[Sanitized Log] [CLOUDTEST001] No usernames configured. Creating unranked LeaderboardEntry.`);
      }

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
          githubScore: 0,
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
          githubScore: 0,
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
        // GitHub Collector
        student.githubUsername
          ? GithubService.fetchData(student.githubUsername, false).catch((err) => {
              console.error(`[Collector] GitHub scrape failed for student ${student.name}:`, err);
              return null;
            })
          : Promise.resolve(null),
      ];

      let [codechefData, leetcodeData, githubData] = await Promise.all(scrapePromises);

      if (isCloudTest) {
        console.log(`[Sanitized Log] [CLOUDTEST001] Platform fetch results: CodeChef success: ${codechefData !== null}, LeetCode success: ${leetcodeData !== null}, GitHub success: ${githubData !== null}`);
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
      if (student.githubUsername && githubData) {
        validateProfileData("GITHUB", student.githubUsername, githubData);
      }

      // Calculate verificationStatus
      let codechefSuccess = student.codechefUsername ? (codechefData !== null) : null;
      let leetcodeSuccess = student.leetcodeUsername ? (leetcodeData !== null) : null;
      let githubSuccess = student.githubUsername ? (githubData !== null) : null;

      const existingCc = await prisma.codechefProfile.findUnique({ where: { studentId } });
      const existingLc = await prisma.leetcodeProfile.findUnique({ where: { studentId } });
      const existingGh = await prisma.githubProfile.findUnique({ where: { studentId } });

      if (student.codechefUsername && !codechefSuccess && existingCc && existingCc.username.toLowerCase() === student.codechefUsername.toLowerCase()) {
        codechefSuccess = true;
      }
      if (student.leetcodeUsername && !leetcodeSuccess && existingLc && existingLc.username.toLowerCase() === student.leetcodeUsername.toLowerCase()) {
        leetcodeSuccess = true;
      }
      if (student.githubUsername && !githubSuccess && existingGh && existingGh.username.toLowerCase() === student.githubUsername.toLowerCase()) {
        githubSuccess = true;
      }

      let verificationStatus = "UNABLE_TO_VERIFY";
      const configuredCount = [student.codechefUsername, student.leetcodeUsername, student.githubUsername].filter(Boolean).length;
      const successCount = [codechefSuccess, leetcodeSuccess, githubSuccess].filter(x => x === true).length;

      if (configuredCount > 0) {
        if (successCount === configuredCount) {
          verificationStatus = "VERIFIED";
        } else if (successCount > 0) {
          verificationStatus = "PARTIAL";
        } else {
          verificationStatus = "UNABLE_TO_VERIFY";
        }
      }

      // 3. Database Storage Phase: Update Database inside a transaction
      await prisma.$transaction(async (tx) => {
        // Update StudentProfile verificationStatus
        await tx.studentProfile.update({
          where: { id: studentId },
          data: { verificationStatus }
        });

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
          });
        } else if (existingCc) {
          // If scraping failed but we have existing data, preserve it and mark status as FAILED
          const existingMetadata = existingCc.verificationMetadata as any || {};
          await tx.codechefProfile.update({
            where: { studentId },
            data: {
              verificationMetadata: {
                ...existingMetadata,
                syncStatus: "FAILED",
                error: codechefError || "Unknown error during sync",
                lastAttemptedAt: new Date().toISOString()
              } as any
            }
          });
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

          await tx.leetcodeProfile.upsert({
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
          });
        }

        // Upsert GitHub Profile
        if (githubData) {
          const metrics = githubData.rawMetrics || {};
          const reposExtended = {
            list: metrics.repos?.list || [],
            intelligence: metrics.repos?.intelligence || {},
            commitAnalytics: metrics.repos?.commitAnalytics || {},
            openSource: metrics.repos?.openSource || {},
            portfolio: metrics.repos?.portfolio || {},
            careerInsights: metrics.repos?.careerInsights || {},
            profileDetails: metrics.repos?.profileDetails || {},
            developerScore: metrics.repos?.developerScore || {}
          };
          const retrievedAt = new Date().toISOString();
          const ghMetadata = {
            username: { value: githubData.username, source: "GitHub", retrievedAt, verificationStatus: "Verified" },
            totalRepositories: { value: metrics.totalRepositories, source: "GitHub", retrievedAt, verificationStatus: metrics.totalRepositories !== null ? "Verified" : "Unavailable" },
            totalStars: { value: metrics.totalStars, source: "GitHub", retrievedAt, verificationStatus: metrics.totalStars !== null ? "Verified" : "Unavailable" },
            totalForks: { value: metrics.totalForks, source: "GitHub", retrievedAt, verificationStatus: metrics.totalForks !== null ? "Verified" : "Unavailable" },
            followers: { value: metrics.followers, source: "GitHub", retrievedAt, verificationStatus: metrics.followers !== null ? "Verified" : "Unavailable" },
            openSourceScore: { value: metrics.openSourceScore, source: "GitHub", retrievedAt, verificationStatus: metrics.openSourceScore !== null ? "Verified" : "Unavailable" }
          };

          await tx.githubProfile.upsert({
            where: { studentId },
            create: {
              studentId,
              username: githubData.username,
              totalRepositories: metrics.totalRepositories,
              totalStars: metrics.totalStars,
              totalForks: metrics.totalForks,
              followers: metrics.followers,
              contributions: metrics.contributions as any,
              languages: metrics.languages as any,
              repos: reposExtended as any,
              commitTimeline: metrics.commitTimeline as any,
              openSourceScore: metrics.openSourceScore,
              repoQualityScore: metrics.repoQualityScore as any,
              verificationMetadata: ghMetadata as any,
              lastFetchedAt: new Date(),
            },
            update: {
              username: githubData.username,
              totalRepositories: metrics.totalRepositories,
              totalStars: metrics.totalStars,
              totalForks: metrics.totalForks,
              followers: metrics.followers,
              contributions: metrics.contributions as any,
              languages: metrics.languages as any,
              repos: reposExtended as any,
              commitTimeline: metrics.commitTimeline as any,
              openSourceScore: metrics.openSourceScore,
              repoQualityScore: metrics.repoQualityScore as any,
              verificationMetadata: ghMetadata as any,
              lastFetchedAt: new Date(),
            },
          });
        }
      });

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
      const githubAi = analysisResult.github;

      // Fetch the updated profiles to calculate the overall rating cache
      const codechefProfile = await prisma.codechefProfile.findUnique({ where: { studentId } });
      const leetcodeProfile = await prisma.leetcodeProfile.findUnique({ where: { studentId } });
      const githubProfile = await prisma.githubProfile.findUnique({ where: { studentId } });

      const { OverallScoreService } = await import("@/services/overallScore.service");

      const ccScore = codechefProfile ? OverallScoreService.calculateCodechefScore(codechefProfile) : 0;
      const lcScore = leetcodeProfile ? OverallScoreService.calculateLeetcodeScore(leetcodeProfile) : 0;
      const ghScore = githubAi ? githubAi.talentScore : 0;

      const active = {
        codechef: !!codechefProfile,
        leetcode: !!leetcodeProfile,
        github: !!githubProfile,
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
          githubScore: ghScore,
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
          githubScore: ghScore,
          trendDirection,
        },
      });

      if (isCloudTest) {
        console.log(`[Sanitized Log] [CLOUDTEST001] Leaderboard entry created/updated. Overall score: ${overallScore}, Rank trend: ${trendDirection}`);
      }

      // Recalculate ranks on the leaderboard
      await this.recalculateLeaderboardRanks();

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
            OR: [
              { codechefUsername: { not: null } },
              { leetcodeUsername: { not: null } },
              { githubUsername: { not: null } }
            ]
          }
        },
        include: {
          student: true,
        },
        orderBy: OverallScoreService.getCompetitiveSortOrder("desc"),
      });

      // Calculate the standard competition ranks
      const rankedEntries = OverallScoreService.calculateCompetitionRank(
        entries,
        (entry) => [entry.overallScore, entry.codechefScore, entry.leetcodeScore]
      );

      console.log(`[SyncService] Recalculating standard competition rank for ${rankedEntries.length} students...`);

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
}
