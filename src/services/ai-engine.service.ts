import { ScrapedData } from "../types/scraper";
import { GitHubAnalytics } from "../types/github";
import { prisma } from "@/lib/prisma";
import { OverallScoreService } from "./overallScore.service";

export interface AiEngineResult {
  talentScore: number;
  consistencyScore: number;
  problemSolvingScore: number;
  competitiveProgrammingScore: number;
  contestScore: number;
  learningScore: number;
  growthScore: number;
  disciplineScore: number;
  overallPotential: string;
  placementReadiness: string;
  expectedRating6Months: number;
  strengths: string[];
  weaknesses: string[];
  improvementAreas: string[];
  careerRecommendation: string;
  suggestedCompanies: string[];
  recommendedLearningPath: string[];
}

export class CodechefAiEngine {
  static analyze(data: {
    currentRating: number | null;
    highestRating: number | null;
    stars: number | null;
    problemsSolved: number | null;
    contestCount: number | null;
    ratingHistory?: any[];
  }): AiEngineResult {
    const currentRating = data.currentRating ?? 0;
    const highestRating = data.highestRating ?? 0;
    const stars = data.stars ?? 0;
    const problemsSolved = data.problemsSolved ?? 0;
    const contestCount = data.contestCount ?? 0;

    if (!currentRating || !highestRating || !problemsSolved || !contestCount) {
      return {
        talentScore: 0,
        consistencyScore: 0,
        problemSolvingScore: 0,
        competitiveProgrammingScore: 0,
        contestScore: 0,
        learningScore: 0,
        growthScore: 0,
        disciplineScore: 0,
        overallPotential: "Insufficient verified data to generate this analysis.",
        placementReadiness: "Insufficient verified data to generate this analysis.",
        expectedRating6Months: 0,
        strengths: ["Insufficient verified data to generate this analysis."],
        weaknesses: ["Insufficient verified data to generate this analysis."],
        improvementAreas: ["Unable to determine improvement because contest history is unavailable."],
        careerRecommendation: "Insufficient verified data to generate this analysis.",
        suggestedCompanies: [],
        recommendedLearningPath: []
      };
    }

    const cpScore = Math.round(Math.min(100, (currentRating / 2200) * 100));
    const problemSolvingScore = Math.round(Math.min(100, (problemsSolved / 300) * 100));
    const contestScore = Math.round(Math.min(100, (contestCount / 20) * 100));
    const consistencyScore = Math.round(Math.min(100, (contestCount / 12) * 80 + 20));
    const learningScore = Math.round(Math.min(100, (stars / 7) * 40 + (problemsSolved / 250) * 60));
    const growthScore = currentRating >= highestRating ? 80 : 50;
    const disciplineScore = Math.round(Math.min(100, (problemsSolved / 150) * 50 + (contestCount / 10) * 50));

    const talentScore = Math.round(
      0.3 * cpScore + 0.3 * problemSolvingScore + 0.2 * contestScore + 0.1 * consistencyScore + 0.1 * disciplineScore
    );

    let overallPotential = "Rising Talent";
    if (talentScore >= 80) overallPotential = "Elite Competitive Programmer";
    else if (talentScore >= 60) overallPotential = "High Potential Problem Solver";

    let placementReadiness = "Standard SDE Ready";
    if (currentRating >= 1800) placementReadiness = "Immediate Tier-1 Ready";
    else if (currentRating >= 1500) placementReadiness = "Product SDE Ready";

    const strengths = ["Solid CodeChef rating index.", "Algorithmic thinking capability."];
    const weaknesses = ["Needs more Div-1 contest exposures."];
    const improvementAreas = ["Review editorials for Div-2 Hard problems."];
    
    if (stars >= 5) {
      strengths.push("Elite competitive programming performance.", "Advanced data structure mastery.");
      improvementAreas.push("Target Global CodeChef Lunchtime Div-1 challenges.");
    } else {
      weaknesses.push("Relatively low problem library count.");
    }

    return {
      talentScore,
      consistencyScore,
      problemSolvingScore,
      competitiveProgrammingScore: cpScore,
      contestScore,
      learningScore,
      growthScore,
      disciplineScore,
      overallPotential,
      placementReadiness,
      expectedRating6Months: 0,
      strengths: [],
      weaknesses: [],
      improvementAreas: [],
      careerRecommendation: "",
      suggestedCompanies: [],
      recommendedLearningPath: []
    };
  }
}

export class LeetcodeAiEngine {
  static analyze(data: {
    problemsSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
    acceptanceRate: number;
    contestRating: number;
    contestRank: number;
    consistencyScore: number;
  }): AiEngineResult {
    const { problemsSolved, easySolved, mediumSolved, hardSolved, acceptanceRate, contestRating, contestRank, consistencyScore } = data;

    if (!problemsSolved || !contestRating) {
      return {
        talentScore: 0,
        consistencyScore: 0,
        problemSolvingScore: 0,
        competitiveProgrammingScore: 0,
        contestScore: 0,
        learningScore: 0,
        growthScore: 0,
        disciplineScore: 0,
        overallPotential: "Insufficient verified data to generate this analysis.",
        placementReadiness: "Insufficient verified data to generate this analysis.",
        expectedRating6Months: 0,
        strengths: ["Insufficient verified data to generate this analysis."],
        weaknesses: ["Insufficient verified data to generate this analysis."],
        improvementAreas: ["Unable to determine improvement because contest history is unavailable."],
        careerRecommendation: "Insufficient verified data to generate this analysis.",
        suggestedCompanies: [],
        recommendedLearningPath: []
      };
    }

    const cpScore = Math.round(Math.min(100, contestRating > 0 ? (contestRating / 2200) * 100 : 40));
    const problemSolvingScore = Math.round(Math.min(100, (problemsSolved / 350) * 100));
    const contestScore = Math.round(Math.min(100, contestRank > 0 ? Math.max(10, 100 - (contestRank / 2000)) : 30));
    const learningScore = Math.round(Math.min(100, (mediumSolved / 150) * 60 + (hardSolved / 50) * 40));
    const growthScore = Math.round(Math.min(100, (acceptanceRate / 100) * 80 + 20));
    const disciplineScore = consistencyScore;

    const talentScore = Math.round(
      0.3 * problemSolvingScore + 0.3 * learningScore + 0.2 * disciplineScore + 0.2 * cpScore
    );

    let overallPotential = "Emerging SDE";
    if (talentScore >= 80) overallPotential = "Master Problem Solver";
    else if (talentScore >= 60) overallPotential = "SDE Candidate";

    let placementReadiness = "Mid-tier SDE Ready";
    if (contestRating >= 1800) placementReadiness = "Immediate Product SDE Ready";
    else if (problemsSolved >= 200) placementReadiness = "Standard SDE Ready";

    const strengths = ["High problem-solving solve rate.", "Comfortable with LeetCode medium questions."];
    const weaknesses = ["Needs larger coverage of LeetCode hard problems."];
    const improvementAreas = ["Solve 2-3 LeetCode hard questions weekly."];

    if (hardSolved > 20) {
      strengths.push("Advanced mathematical & tree structures understanding.");
    }

    return {
      talentScore,
      consistencyScore,
      problemSolvingScore,
      competitiveProgrammingScore: cpScore,
      contestScore,
      learningScore,
      growthScore,
      disciplineScore,
      overallPotential,
      placementReadiness,
      expectedRating6Months: 0,
      strengths: [],
      weaknesses: [],
      improvementAreas: [],
      careerRecommendation: "",
      suggestedCompanies: [],
      recommendedLearningPath: []
    };
  }
}

export class GithubAiEngine {
  static analyze(analytics: GitHubAnalytics): AiEngineResult {
    if (!analytics || !analytics.totalRepositories || analytics.totalRepositories === 0) {
      return {
        talentScore: 0,
        consistencyScore: 0,
        problemSolvingScore: 0,
        competitiveProgrammingScore: 0,
        contestScore: 0,
        learningScore: 0,
        growthScore: 0,
        disciplineScore: 0,
        overallPotential: "Insufficient verified data to generate this analysis.",
        placementReadiness: "Insufficient verified data to generate this analysis.",
        expectedRating6Months: 0,
        strengths: ["Insufficient verified data to generate this analysis."],
        weaknesses: ["Insufficient verified data to generate this analysis."],
        improvementAreas: ["Unable to determine improvement because project history is unavailable."],
        careerRecommendation: "Insufficient verified data to generate this analysis.",
        suggestedCompanies: [],
        recommendedLearningPath: []
      };
    }

    const rating = analytics.developerScore.score;

    return {
      talentScore: rating,
      consistencyScore: analytics.developerScore.consistency,
      problemSolvingScore: rating,
      competitiveProgrammingScore: rating,
      contestScore: analytics.developerScore.codingActivity,
      learningScore: analytics.developerScore.documentation,
      growthScore: rating,
      disciplineScore: analytics.developerScore.consistency,
      overallPotential: "",
      placementReadiness: "",
      expectedRating6Months: 0,
      strengths: [],
      weaknesses: [],
      improvementAreas: [],
      careerRecommendation: "",
      suggestedCompanies: [],
      recommendedLearningPath: []
    };
  }
}

export class OverallAiEngine {
  /**
   * Combines CodeChef, LeetCode, and GitHub AI analyses dynamically.
   */
  static analyze(
    codechefAnalysis: AiEngineResult | null,
    leetcodeAnalysis: AiEngineResult | null,
    githubAnalysis: AiEngineResult | null,
    weights: { codechef: number; leetcode: number; github: number }
  ): AiEngineResult {
    let talentSum = 0;
    let consistencySum = 0;
    let problemSolvingSum = 0;
    let cpSum = 0;
    let contestSum = 0;
    let learningSum = 0;
    let growthSum = 0;
    let disciplineSum = 0;
    let expectedRatingSum = 0;
    let count = 0;

    let totalWeight = 0;

    const list: AiEngineResult[] = [];
    
    if (codechefAnalysis) {
      list.push(codechefAnalysis);
      talentSum += codechefAnalysis.talentScore * weights.codechef;
      consistencySum += codechefAnalysis.consistencyScore * weights.codechef;
      problemSolvingSum += codechefAnalysis.problemSolvingScore * weights.codechef;
      cpSum += codechefAnalysis.competitiveProgrammingScore * weights.codechef;
      contestSum += codechefAnalysis.contestScore * weights.codechef;
      learningSum += codechefAnalysis.learningScore * weights.codechef;
      growthSum += codechefAnalysis.growthScore * weights.codechef;
      disciplineSum += codechefAnalysis.disciplineScore * weights.codechef;
      expectedRatingSum += codechefAnalysis.expectedRating6Months * weights.codechef;
      totalWeight += weights.codechef;
      count++;
    }

    if (leetcodeAnalysis) {
      list.push(leetcodeAnalysis);
      talentSum += leetcodeAnalysis.talentScore * weights.leetcode;
      consistencySum += leetcodeAnalysis.consistencyScore * weights.leetcode;
      problemSolvingSum += leetcodeAnalysis.problemSolvingScore * weights.leetcode;
      cpSum += leetcodeAnalysis.competitiveProgrammingScore * weights.leetcode;
      contestSum += leetcodeAnalysis.contestScore * weights.leetcode;
      learningSum += leetcodeAnalysis.learningScore * weights.leetcode;
      growthSum += leetcodeAnalysis.growthScore * weights.leetcode;
      disciplineSum += leetcodeAnalysis.disciplineScore * weights.leetcode;
      expectedRatingSum += leetcodeAnalysis.expectedRating6Months * weights.leetcode;
      totalWeight += weights.leetcode;
      count++;
    }

    if (githubAnalysis) {
      list.push(githubAnalysis);
      talentSum += githubAnalysis.talentScore * weights.github;
      consistencySum += githubAnalysis.consistencyScore * weights.github;
      problemSolvingSum += githubAnalysis.problemSolvingScore * weights.github;
      cpSum += githubAnalysis.competitiveProgrammingScore * weights.github;
      contestSum += githubAnalysis.contestScore * weights.github;
      learningSum += githubAnalysis.learningScore * weights.github;
      growthSum += githubAnalysis.growthScore * weights.github;
      disciplineSum += githubAnalysis.disciplineScore * weights.github;
      expectedRatingSum += githubAnalysis.expectedRating6Months * weights.github;
      totalWeight += weights.github;
      count++;
    }

    if (totalWeight === 0) {
      return {
        talentScore: 0,
        consistencyScore: 0,
        problemSolvingScore: 0,
        competitiveProgrammingScore: 0,
        contestScore: 0,
        learningScore: 0,
        growthScore: 0,
        disciplineScore: 0,
        overallPotential: "N/A",
        placementReadiness: "N/A",
        expectedRating6Months: 0,
        strengths: [],
        weaknesses: [],
        improvementAreas: [],
        careerRecommendation: "N/A",
        suggestedCompanies: [],
        recommendedLearningPath: []
      };
    }

    const talentScore = Math.round(talentSum / totalWeight);
    const consistencyScore = Math.round(consistencySum / totalWeight);
    const problemSolvingScore = Math.round(problemSolvingSum / totalWeight);
    const competitiveProgrammingScore = Math.round(cpSum / totalWeight);
    const contestScore = Math.round(contestSum / totalWeight);
    const learningScore = Math.round(learningSum / totalWeight);
    const growthScore = Math.round(growthSum / totalWeight);
    const disciplineScore = Math.round(disciplineSum / totalWeight);
    const expectedRating6Months = Math.round(expectedRatingSum / totalWeight);

    // Merge strengths, weaknesses, suggested companies and learning paths
    const strengths = Array.from(new Set(list.flatMap(item => item.strengths)));
    const weaknesses = Array.from(new Set(list.flatMap(item => item.weaknesses)));
    const improvementAreas = Array.from(new Set(list.flatMap(item => item.improvementAreas)));
    const suggestedCompanies = Array.from(new Set(list.flatMap(item => item.suggestedCompanies)));
    const recommendedLearningPath = Array.from(new Set(list.flatMap(item => item.recommendedLearningPath)));

    let overallPotential = "High Potential Developer";
    if (talentScore >= 80) overallPotential = "Elite Master Coder";
    else if (talentScore < 50) overallPotential = "Emerging Technology Engineer";

    let placementReadiness = "Standard SDE Ready";
    if (list.some(item => item.placementReadiness.includes("Tier-1") || item.placementReadiness.includes("Immediate"))) {
      placementReadiness = "Immediate Tier-1 Ready";
    } else if (list.some(item => item.placementReadiness.includes("Product"))) {
      placementReadiness = "Product SDE Ready";
    }

    const careerRecommendations = list.map(item => item.careerRecommendation);
    const careerRecommendation = careerRecommendations.join(" / ");

    return {
      talentScore,
      consistencyScore,
      problemSolvingScore,
      competitiveProgrammingScore,
      contestScore,
      learningScore,
      growthScore,
      disciplineScore,
      overallPotential,
      placementReadiness,
      expectedRating6Months,
      strengths,
      weaknesses,
      improvementAreas,
      careerRecommendation,
      suggestedCompanies,
      recommendedLearningPath
    };
  }
}

// Backward compatible default export mapping
export class AiEngineService {
  static analyzeProfile(data: {
    currentRating: number | null;
    highestRating: number | null;
    stars: number | null;
    problemsSolved: number | null;
    contestCount: number | null;
    contests: { date: string; rating: number; rank: number }[];
    fullySolvedCount?: number | null;
    partiallySolvedCount?: number | null;
    bestContestRank?: number | null;
    activeDaysCount?: number | null;
  }): any {
    return CodechefAiEngine.analyze({
      currentRating: data.currentRating,
      highestRating: data.highestRating,
      stars: data.stars,
      problemsSolved: data.problemsSolved,
      contestCount: data.contestCount
    });
  }

  static async runAnalysisForStudent(studentId: string): Promise<any> {
    const normalized = await prisma.normalizedProfile.findUnique({
      where: { studentId },
    });
    if (!normalized) {
      throw new Error(`Normalized profile not found for student ${studentId}`);
    }

    const platforms = normalized.platforms as any;
    const cc = platforms.codechef;
    const lc = platforms.leetcode;
    const gh = platforms.github;

    // 1. CodeChef AI
    let codechefAi = null;
    if (cc && cc.username !== "N/A" && cc.rating > 0) {
      codechefAi = CodechefAiEngine.analyze({
        currentRating: cc.rating,
        highestRating: cc.highestRating,
        stars: cc.stars,
        problemsSolved: cc.problemsSolved,
        contestCount: cc.contests.length,
      });
    }

    // 2. LeetCode AI
    let leetcodeAi = null;
    if (lc && lc.username !== "N/A" && (lc.totalSolved > 0 || lc.contestRating > 0)) {
      leetcodeAi = LeetcodeAiEngine.analyze({
        problemsSolved: lc.totalSolved,
        easySolved: lc.easy,
        mediumSolved: lc.medium,
        hardSolved: lc.hard,
        acceptanceRate: 52, // fallback
        contestRating: lc.contestRating,
        contestRank: lc.ranking,
        consistencyScore: normalized.consistencyScore,
      });
    }

    // 3. GitHub AI
    let githubAi = null;
    const githubProfile = await prisma.githubProfile.findUnique({
      where: { studentId }
    });
    if (githubProfile) {
      const repos = githubProfile.repos as any;
      const analytics = {
        totalRepositories: githubProfile.totalRepositories,
        totalStars: githubProfile.totalStars,
        totalForks: githubProfile.totalForks,
        followers: githubProfile.followers,
        openSourceScore: githubProfile.openSourceScore,
        contributions: githubProfile.contributions,
        languages: githubProfile.languages,
        repos: repos?.list || [],
        commitTimeline: githubProfile.commitTimeline,
        repoQualityScore: githubProfile.repoQualityScore,
        developerScore: repos?.developerScore || { score: githubProfile.openSourceScore, consistency: 50, codingActivity: 50, documentation: 50 },
        careerInsights: repos?.careerInsights || { hiringReadiness: "Capable Software Builder", strongestSkills: ["Git"], weaknesses: ["No documented repositories"], recommendedLearningPath: ["Expand project portfolio"] },
        portfolio: repos?.portfolio || { web: 0, fullStack: 0, ai: 0, mobile: 0 }
      };
      githubAi = GithubAiEngine.analyze(analytics as any);
    }

    const weights = OverallScoreService.getWeights();
    const overallAi = OverallAiEngine.analyze(
      codechefAi,
      leetcodeAi,
      githubAi,
      weights
    );

    // Save to DB
    await prisma.aiAnalysis.upsert({
      where: { studentId },
      create: {
        studentId,
        talentScore: overallAi.talentScore,
        consistencyScore: overallAi.consistencyScore,
        problemSolvingScore: overallAi.problemSolvingScore,
        competitiveProgrammingScore: overallAi.competitiveProgrammingScore,
        contestScore: overallAi.contestScore,
        learningScore: overallAi.learningScore,
        growthScore: overallAi.growthScore,
        disciplineScore: overallAi.disciplineScore,
        overallPotential: overallAi.overallPotential,
        placementReadiness: overallAi.placementReadiness,
        expectedRating6Months: overallAi.expectedRating6Months,
        strengths: overallAi.strengths as any,
        weaknesses: overallAi.weaknesses as any,
        improvementAreas: overallAi.improvementAreas as any,
        careerRecommendation: overallAi.careerRecommendation,
        suggestedCompanies: overallAi.suggestedCompanies as any,
        recommendedLearningPath: overallAi.recommendedLearningPath as any,
        recommendations: [] as any,
        careerSuggestions: [] as any,
        generatedAt: new Date(),
      },
      update: {
        talentScore: overallAi.talentScore,
        consistencyScore: overallAi.consistencyScore,
        problemSolvingScore: overallAi.problemSolvingScore,
        competitiveProgrammingScore: overallAi.competitiveProgrammingScore,
        contestScore: overallAi.contestScore,
        learningScore: overallAi.learningScore,
        growthScore: overallAi.growthScore,
        disciplineScore: overallAi.disciplineScore,
        overallPotential: overallAi.overallPotential,
        placementReadiness: overallAi.placementReadiness,
        expectedRating6Months: overallAi.expectedRating6Months,
        strengths: overallAi.strengths as any,
        weaknesses: overallAi.weaknesses as any,
        improvementAreas: overallAi.improvementAreas as any,
        careerRecommendation: overallAi.careerRecommendation,
        suggestedCompanies: overallAi.suggestedCompanies as any,
        recommendedLearningPath: overallAi.recommendedLearningPath as any,
        generatedAt: new Date(),
      },
    });

    return overallAi;
  }
}
