export class OverallScoreService {
  /**
   * Loads configured weights from process.env, defaulting to 35% CodeChef, 35% LeetCode, 30% GitHub.
   */
  static getWeights(): { codechef: number; leetcode: number; github: number } {
    const codechefRaw = parseFloat(process.env.WEIGHT_CODECHEF || "35");
    const leetcodeRaw = parseFloat(process.env.WEIGHT_LEETCODE || "35");
    const githubRaw = parseFloat(process.env.WEIGHT_GITHUB || "30");

    const sum = codechefRaw + leetcodeRaw + githubRaw;
    if (sum === 0) {
      return { codechef: 0.35, leetcode: 0.35, github: 0.3 };
    }

    return {
      codechef: codechefRaw / sum,
      leetcode: leetcodeRaw / sum,
      github: githubRaw / sum,
    };
  }

  /**
   * Calculates overall score dynamically.
   * Only aggregates platforms that are active for this student.
   * Normalizes remaining weights if some platforms are missing.
   */
  static calculate(
    scores: { codechef: number; leetcode: number; github: number },
    active: { codechef: boolean; leetcode: boolean; github: boolean }
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
    if (active.github) {
      weightedSum += scores.github * weights.github;
      totalWeight += weights.github;
    }

    if (totalWeight === 0) {
      return 0;
    }

    return Math.round(weightedSum / totalWeight);
  }
}
