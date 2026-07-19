import { Prisma } from "@prisma/client";

/**
 * Global tie-breaker ordering for leaderboard ranking.
 * Ensures that if two students have the same overallScore,
 * they are deterministically ranked based on CodeChef, LeetCode, and Name.
 */
export const getCompetitiveSortOrder = (
  order: Prisma.SortOrder = "desc"
): Prisma.LeaderboardEntryOrderByWithRelationInput[] => {
  const secondaryOrder = order === "desc" ? "asc" : "desc";

  return [
    { overallScore: order },
    { codechefScore: order },
    { leetcodeScore: order },
    { student: { name: secondaryOrder } },
  ];
};

/**
 * Calculates standard competition ranking (1, 2, 2, 4) for any array of items.
 * Assumes the array is ALREADY sorted in the correct competitive order.
 * 
 * @param sortedItems The pre-sorted array of items
 * @param getScoreKeys A function to extract the numerical keys used for tie-breaking
 * @returns The original items augmented with a `rank` property
 */
export function calculateCompetitionRank<T>(
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
      // Check if all tie-breaker keys match
      const isTie = keys.length === previousKeys.length && 
        keys.every((val, i) => val === previousKeys![i]);
        
      if (!isTie) {
        // Standard competition ranking skips ranks for ties (e.g., 1, 2, 2, 4)
        // Since array is 0-indexed, index + 1 is the true sequential rank
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
