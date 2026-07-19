import { Prisma } from "@prisma/client";

export class OverallScoreService {
  /**
   * Calculates standard competition ranking (1, 2, 2, 4) for any array of items.
   * Assumes the array is ALREADY sorted in the correct competitive order.
   */
  static calculateCompetitionRank<T>(
    sortedItems: T[],
    getScoreKeys: (item: T) => number[]
  ): (T & { rank: number })[] {
    let currentRank = 1;
    let previousKeys: number[] | null = null;
    
    return sortedItems.map((item, index) => {
      const keys = getScoreKeys(item);
      
      if (!previousKeys) {
        previousKeys = keys;
      } else {
        const isTie = keys.length === previousKeys.length && 
          keys.every((val, i) => val === previousKeys![i]);
          
        if (!isTie) {
          currentRank = index + 1;
          previousKeys = keys;
        }
      }
      
      return {
        ...item,
        rank: currentRank
      };
    });
  }

  /**
   * Global tie-breaker ordering for leaderboard ranking.
   */
  static getCompetitiveSortOrder(
    order: Prisma.SortOrder = "desc"
  ): Prisma.LeaderboardEntryOrderByWithRelationInput[] {
    const secondaryOrder = order === "desc" ? "asc" : "desc";
    return [
      { overallScore: order },
      { codechefScore: order },
      { leetcodeScore: order },
      { student: { name: secondaryOrder } },
    ];
  }

  /**
   * Loads configured weights, excluding GitHub.
   */
  static getWeights(): { codechef: number; leetcode: number } {
    const codechefRaw = parseFloat(process.env.WEIGHT_CODECHEF || "35");
    const leetcodeRaw = parseFloat(process.env.WEIGHT_LEETCODE || "35");

    const sum = codechefRaw + leetcodeRaw;
    if (sum === 0) {
      return { codechef: 0.5, leetcode: 0.5 };
    }

    return {
      codechef: codechefRaw / sum,
      leetcode: leetcodeRaw / sum,
    };
  }

  /**
   * Calculates overall score dynamically out of 100 based on active platforms.
   */
  static calculate(
    scores: { codechef: number; leetcode: number },
    active: { codechef: boolean; leetcode: boolean }
  ): number {
    const weights = this.getWeights();
    
    let weightedSum = 0;
    let totalWeight = 0;

    if (active.codechef) {
      weightedSum += scores.codechef * weights.codechef;
      totalWeight += weights.codechef;
    }
    if (active.leetcode) {
      weightedSum += scores.leetcode * weights.leetcode;
      totalWeight += weights.leetcode;
    }

    if (totalWeight === 0) {
      return 0;
    }

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Calculate competitive CodeChef score (Talent Score logic minus the zero bailout)
   */
  static calculateCodechefScore(data: {
    currentRating?: number | null;
    highestRating?: number | null;
    stars?: number | null;
    problemsSolved?: number | null;
    contestCount?: number | null;
  }): number {
    const currentRating = data.currentRating ?? 0;
    const highestRating = data.highestRating ?? 0;
    const stars = data.stars ?? 0;
    const problemsSolved = data.problemsSolved ?? 0;
    const contestCount = data.contestCount ?? 0;

    const cpScore = Math.round(Math.min(100, (currentRating / 2200) * 100));
    const problemSolvingScore = Math.round(Math.min(100, (problemsSolved / 300) * 100));
    const contestScore = Math.round(Math.min(100, (contestCount / 20) * 100));
    const consistencyScore = Math.round(Math.min(100, (contestCount / 12) * 80 + 20));
    const disciplineScore = Math.round(Math.min(100, (problemsSolved / 150) * 50 + (contestCount / 10) * 50));

    return Math.round(
      0.3 * cpScore + 
      0.3 * problemSolvingScore + 
      0.2 * contestScore + 
      0.1 * consistencyScore + 
      0.1 * disciplineScore
    );
  }

  /**
   * Calculate competitive LeetCode score (Talent Score logic minus the zero bailout)
   */
  static calculateLeetcodeScore(data: {
    problemsSolved?: number | null;
    mediumSolvedCount?: number | null;
    hardSolvedCount?: number | null;
    contestRating?: number | null;
    contestRank?: number | null;
    consistencyScore?: number | null;
  }): number {
    const problemsSolved = data.problemsSolved ?? 0;
    const mediumSolvedCount = data.mediumSolvedCount ?? 0;
    const hardSolvedCount = data.hardSolvedCount ?? 0;
    const contestRating = data.contestRating ?? 0;
    const contestRank = data.contestRank ?? 0;
    const consistencyScore = data.consistencyScore ?? 0;

    const cpScore = Math.round(Math.min(100, contestRating > 0 ? (contestRating / 2200) * 100 : 40));
    const problemSolvingScore = Math.round(Math.min(100, (problemsSolved / 350) * 100));
    const contestScore = Math.round(Math.min(100, contestRank > 0 ? Math.max(10, 100 - (contestRank / 2000)) : 30));
    const learningScore = Math.round(Math.min(100, (mediumSolvedCount / 150) * 60 + (hardSolvedCount / 50) * 40));
    const disciplineScore = consistencyScore;

    return Math.round(
      0.3 * problemSolvingScore + 
      0.3 * learningScore + 
      0.2 * disciplineScore + 
      0.2 * cpScore
    );
  }
}
