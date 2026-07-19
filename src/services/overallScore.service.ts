export class OverallScoreService {
  /**
   * Loads configured weights from process.env, defaulting to equal weights (50/50).
   * It reads the original weights, ignoring GitHub, and normalizes CodeChef and LeetCode so their combined total is 100%.
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
   * Calculates overall score dynamically.
   * Only aggregates platforms that are active for this student.
   * Normalizes remaining weights if some platforms are missing.
   * Excludes GitHub entirely.
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
}
