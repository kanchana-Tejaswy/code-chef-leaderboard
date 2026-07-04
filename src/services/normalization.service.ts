import { prisma } from "@/lib/prisma";

export interface NormalizedProfileData {
  studentId: string;
  username: string;
  platforms: {
    codechef: {
      username: string;
      rating: number;
      highestRating: number;
      stars: number;
      globalRank: number;
      countryRank: number;
      problemsSolved: number;
      contests: any[];
      submissions: any[];
      heatmap: Record<string, number>;
    };
    leetcode: {
      username: string;
      totalSolved: number;
      easy: number;
      medium: number;
      hard: number;
      contestRating: number;
      ranking: number;
      submissionsCalendar: Record<string, number>;
      badges: any[];
    };
    github: {
      username: string;
      followers: number;
      following: number;
      repos: number;
      stars: number;
      languages: Record<string, number>;
      contributions: Record<string, number>;
      commits: number;
      activityGraph: any[];
    };
  };
  unifiedMetrics: {
    ratingScore: number;
    consistencyScore: number;
    problemSolvingScore: number;
    activityScore: number;
  };
}

export class NormalizationService {
  /**
   * Helper to ensure numbers are safe, converting null/undefined/invalid to 0.
   */
  private static safeNumber(val: any, fallback: number = 0): number {
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    return isNaN(num) ? fallback : num;
  }

  private static safeNullableNumber(val: any): number | null {
    if (val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }

  /**
   * Helper to ensure strings are safe, converting null/undefined to fallback.
   */
  private static safeString(val: any, fallback: string = "N/A"): string {
    if (val === null || val === undefined || String(val).trim() === "") return fallback;
    return String(val);
  }

  /**
   * Helper to ensure arrays are valid, handling empty objects or empty values.
   */
  private static safeArray(val: any): any[] {
    if (val === null || val === undefined) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "object") {
      // If it's an empty object {} mistakenly parsed, convert to empty array
      if (Object.keys(val).length === 0) return [];
      return Object.values(val);
    }
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [];
  }

  /**
   * Helper to ensure JSON objects are valid maps.
   */
  private static safeMap(val: any): Record<string, any> {
    if (val === null || val === undefined) return {};
    if (typeof val === "object" && !Array.isArray(val)) return val;
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {}
    return {};
  }

  /**
   * Unifies and normalizes the raw platform data of a student, then stores it in the database.
   */
  static async normalizeStudent(studentId: string): Promise<any> {
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        codechefProfile: true,
        leetcodeProfile: true,
        githubProfile: true,
      },
    });

    if (!student) {
      throw new Error(`Student ${studentId} not found for normalization.`);
    }

    // 1. Extract and validate CodeChef Data
    const cc = student.codechefProfile;
    const hasCc = !!cc;
    const ccData = {
      username: this.safeString(cc?.username || student.codechefUsername),
      rating: this.safeNullableNumber(cc?.currentRating),
      highestRating: this.safeNullableNumber(cc?.highestRating),
      stars: this.safeNullableNumber(cc?.stars),
      globalRank: this.safeNullableNumber(cc?.globalRank),
      countryRank: this.safeNullableNumber(cc?.countryRank),
      problemsSolved: this.safeNullableNumber(cc?.problemsSolved),
      contests: this.safeArray(cc?.contestHistory || cc?.contests),
      submissions: this.safeArray(cc?.ratingHistory),
      heatmap: this.safeMap(cc?.activitySummary),
    };

    // 2. Extract and validate LeetCode Data
    const lc = student.leetcodeProfile;
    const hasLc = !!lc;
    const lcData = {
      username: this.safeString(lc?.username || student.leetcodeUsername),
      totalSolved: this.safeNullableNumber(lc?.problemsSolved),
      easy: this.safeNullableNumber(lc?.easySolvedCount),
      medium: this.safeNullableNumber(lc?.mediumSolvedCount),
      hard: this.safeNullableNumber(lc?.hardSolvedCount),
      contestRating: this.safeNullableNumber(lc?.contestRating),
      ranking: this.safeNullableNumber(lc?.contestRank),
      submissionsCalendar: this.safeMap(lc?.heatmap),
      badges: this.safeArray(lc?.weeklyActivity || (lc as any)?.skillRadar),
    };

    // 3. Extract and validate GitHub Data
    const gh = student.githubProfile;
    const hasGh = !!gh;
    const ghData = {
      username: this.safeString(gh?.username || student.githubUsername),
      followers: this.safeNullableNumber(gh?.followers),
      following: this.safeNullableNumber(gh?.followers ? (gh as any)?.following : 0),
      repos: this.safeNullableNumber(gh?.totalRepositories),
      stars: this.safeNullableNumber(gh?.totalStars),
      languages: this.safeMap(gh?.languages),
      contributions: this.safeMap(gh?.contributions),
      commits: this.safeNullableNumber((gh as any)?.repos?.commitAnalytics?.totalCommits || (gh ? (gh.totalRepositories ? gh.totalRepositories * 12 : 0) : null)),
      activityGraph: this.safeArray(gh?.commitTimeline),
    };

    // Calculate ratingScore (Normalized to 0-100)
    let ratingScore = 0;
    let ratingPlatformsCount = 0;
    if (hasCc && ccData.rating && ccData.rating > 0) {
      ratingScore += Math.min(100, (ccData.rating / 2000) * 100);
      ratingPlatformsCount++;
    }
    if (hasLc && lcData.contestRating && lcData.contestRating > 0) {
      ratingScore += Math.min(100, (lcData.contestRating / 2000) * 100);
      ratingPlatformsCount++;
    }
    ratingScore = ratingPlatformsCount > 0 ? Math.round(ratingScore / ratingPlatformsCount) : 0;

    // Calculate consistencyScore (Normalized to 0-100)
    let consistencyScore = 0;
    let consistencyPlatformsCount = 0;
    if (hasCc) {
      consistencyScore += Math.min(100, (ccData.contests.length / 10) * 100);
      consistencyPlatformsCount++;
    }
    if (hasLc) {
      const activeDays = this.safeNumber(lc?.problemsSolved ? (lc as any).consistencyScore : 0);
      consistencyScore += Math.min(100, activeDays || 0);
      consistencyPlatformsCount++;
    }
    if (hasGh && ghData.commits !== null) {
      consistencyScore += Math.min(100, (ghData.commits / 150) * 100);
      consistencyPlatformsCount++;
    }
    consistencyScore = consistencyPlatformsCount > 0 ? Math.round(consistencyScore / consistencyPlatformsCount) : 0;

    // Calculate problemSolvingScore (Normalized to 0-100)
    let problemSolvingScore = 0;
    let problemSolvingCount = 0;
    if (hasCc && ccData.problemsSolved !== null) {
      problemSolvingScore += Math.min(100, (ccData.problemsSolved / 150) * 100);
      problemSolvingCount++;
    }
    if (hasLc && lcData.easy !== null && lcData.medium !== null && lcData.hard !== null) {
      // Weighted solved count
      const weightedLc = (lcData.easy ?? 0) * 1 + (lcData.medium ?? 0) * 2 + (lcData.hard ?? 0) * 3;
      problemSolvingScore += Math.min(100, (weightedLc / 450) * 100);
      problemSolvingCount++;
    }
    problemSolvingScore = problemSolvingCount > 0 ? Math.round(problemSolvingScore / problemSolvingCount) : 0;

    // Calculate activityScore (Normalized to 0-100)
    let activityScore = 0;
    let activityCount = 0;
    if (hasCc) {
      const ccActivity = Object.values(ccData.heatmap).reduce((acc, v) => acc + v, 0);
      activityScore += Math.min(100, (ccActivity / 80) * 100);
      activityCount++;
    }
    if (hasLc) {
      const lcActivity = Object.values(lcData.submissionsCalendar).reduce((acc, v) => acc + v, 0);
      activityScore += Math.min(100, (lcActivity / 120) * 100);
      activityCount++;
    }
    if (hasGh) {
      const ghActivity = Object.values(ghData.contributions).reduce((acc, v) => acc + v, 0);
      activityScore += Math.min(100, (ghActivity / 200) * 100);
      activityCount++;
    }
    activityScore = activityCount > 0 ? Math.round(activityScore / activityCount) : 0;

    // Determine status (PARTIAL if any active account is configured but has no scraped data in DB)
    let status = "COMPLETE";
    if (
      (student.codechefUsername && !hasCc) ||
      (student.leetcodeUsername && !hasLc) ||
      (student.githubUsername && !hasGh)
    ) {
      status = "PARTIAL";
    }

    const payload = {
      codechef: ccData,
      leetcode: lcData,
      github: ghData,
    };

    // Store in Database
    const normalizedProfile = await prisma.normalizedProfile.upsert({
      where: { studentId },
      create: {
        studentId,
        username: student.name,
        platforms: payload as any,
        ratingScore,
        consistencyScore,
        problemSolvingScore,
        activityScore,
        status,
      },
      update: {
        username: student.name,
        platforms: payload as any,
        ratingScore,
        consistencyScore,
        problemSolvingScore,
        activityScore,
        status,
      },
    });

    return normalizedProfile;
  }
}
