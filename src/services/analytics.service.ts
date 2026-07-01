import { CodechefService } from "./codechef.service";
import { LeetcodeService } from "./leetcode.service";
import { GithubService } from "./github.service";
import { CodechefAiEngine, LeetcodeAiEngine, GithubAiEngine, OverallAiEngine } from "./ai-engine.service";
import { OverallScoreService } from "./overallScore.service";

export class AnalyticsService {
  /**
   * Runs CodeChef, LeetCode, and GitHub analyzers in parallel using Promise.allSettled.
   * Isolates bugs/failures in any platform scraper.
   */
  static async analyzeStudent(urls: {
    codechefUrl?: string | null;
    leetcodeUrl?: string | null;
    githubUrl?: string | null;
  }) {
    const { codechefUrl, leetcodeUrl, githubUrl } = urls;

    // Build promises array
    const promises: Promise<any>[] = [
      // CodeChef [Index 0]
      codechefUrl
        ? CodechefService.fetchData(codechefUrl).catch((err) => {
            console.error("CodeChef scrape failed during sync:", err);
            return null;
          })
        : Promise.resolve(null),
      
      // LeetCode [Index 1]
      leetcodeUrl
        ? LeetcodeService.fetchData(leetcodeUrl).catch((err) => {
            console.error("LeetCode scrape failed during sync:", err);
            return null;
          })
        : Promise.resolve(null),

      // GitHub [Index 2]
      githubUrl
        ? GithubService.fetchData(githubUrl).catch((err) => {
            console.error("GitHub scrape failed during sync:", err);
            return null;
          })
        : Promise.resolve(null),
    ];

    // Run simultaneously in parallel
    const [codechefResult, leetcodeResult, githubResult] = await Promise.all(promises);

    // Compute platform-specific AI engine evaluations
    let codechefAi = null;
    let codechefScore = 0;
    if (codechefResult) {
      codechefAi = CodechefAiEngine.analyze({
        currentRating: codechefResult.currentRating,
        highestRating: codechefResult.highestRating,
        stars: codechefResult.stars,
        problemsSolved: codechefResult.problemsSolved,
        contestCount: codechefResult.contestCount,
      });
      // CodeChef Platform Score: derived from CP performance & solve rates
      codechefScore = codechefAi.talentScore;
    }

    let leetcodeAi = null;
    let leetcodeScore = 0;
    if (leetcodeResult) {
      const { easySolvedCount = 0, mediumSolvedCount = 0, hardSolvedCount = 0, acceptanceRate = 45, consistencyScore = 50, contestHistory = [] } = leetcodeResult.rawMetrics || {};
      const rating = leetcodeResult.currentRating || 0;
      const rank = leetcodeResult.globalRank || 0;

      leetcodeAi = LeetcodeAiEngine.analyze({
        problemsSolved: leetcodeResult.problemsSolved,
        easySolved: easySolvedCount,
        mediumSolved: mediumSolvedCount,
        hardSolved: hardSolvedCount,
        acceptanceRate,
        contestRating: rating,
        contestRank: rank,
        consistencyScore,
      });
      // LeetCode Platform Score: derived from algorithmic profile
      leetcodeScore = leetcodeAi.talentScore;
    }

    let githubAi = null;
    let githubScore = 0;
    if (githubResult && githubResult.rawMetrics?.careerInsights && githubResult.rawMetrics?.developerScore) {
      // githubResult.rawMetrics contains the fully computed GitHubAnalytics payload
      githubAi = GithubAiEngine.analyze(githubResult.rawMetrics);
      githubScore = githubAi.talentScore;
    }

    // Determine platform configurations
    const active = {
      codechef: !!codechefResult,
      leetcode: !!leetcodeResult,
      github: !!githubResult,
    };

    // Calculate Overall Weighted Score
    const overallScore = OverallScoreService.calculate(
      { codechef: codechefScore, leetcode: leetcodeScore, github: githubScore },
      active
    );

    // Compute Overall Unified AI Report
    const weights = OverallScoreService.getWeights();
    const overallAi = OverallAiEngine.analyze(
      codechefAi,
      leetcodeAi,
      githubAi,
      weights
    );

    return {
      success: true,
      active,
      codechef: codechefResult ? { data: codechefResult, score: codechefScore, ai: codechefAi } : null,
      leetcode: leetcodeResult ? { data: leetcodeResult, score: leetcodeScore, ai: leetcodeAi } : null,
      github: githubResult ? { data: githubResult, score: githubScore, ai: githubAi } : null,
      overall: {
        score: overallScore,
        ai: overallAi,
      },
    };
  }
}
