import { prisma } from "@/lib/prisma";

export function calculatePlacementReadiness(rating: number, contestCount: number, consistencyScore: number, talentScore: number): number {
  const ratingScore = Math.min(100, Math.max(0, (rating / 2000) * 100));
  const contestScore = Math.min(100, (contestCount / 10) * 100);
  const score = 0.35 * ratingScore + 0.25 * contestScore + 0.20 * consistencyScore + 0.20 * talentScore;
  return Math.round(score);
}

export function calculatePredictionConfidence(N: number, activeStudents: any[]): string {
  if (N < 3) return "Confidence unavailable due to limited historical data.";

  const totalContests = activeStudents.reduce((acc, s) => acc + (s.codechefProfile?.contestCount || 0), 0);
  const avgContests = activeStudents.length > 0 ? totalContests / activeStudents.length : 0;

  if (avgContests === 0) {
    return "Confidence unavailable due to limited historical data.";
  }

  const avgConsistency = activeStudents.length > 0
    ? activeStudents.reduce((acc, s) => acc + (s.aiAnalysis?.consistencyScore || 0), 0) / activeStudents.length
    : 0;

  let score = 0;
  score += Math.min(40, (N / 12) * 40);
  score += Math.min(30, (avgContests / 6) * 30);
  score += (avgConsistency / 100) * 30;

  const finalScore = Math.round(score);
  if (finalScore < 40) {
    return "Confidence unavailable due to limited historical data.";
  }
  return `${Math.min(100, finalScore)}%`;
}

// ----------------------------------------------------
// DYNAMIC INSIGHT GENERATORS
// ----------------------------------------------------

export class InsightsService {
  static getInsights(students: any[]) {
    const N = students.length;
    const activeCodechef = students.filter(s => s.codechefProfile);
    const activeLeetcode = students.filter(s => s.leetcodeProfile);
    const activeGithub = students.filter(s => s.githubProfile);
    const activeOverall = students.filter(s => s.leaderboardEntry);

    const confidence = calculatePredictionConfidence(N, activeCodechef);

    // 1. Placement Ready Cohort
    const placementReady = activeOverall
      .map(s => {
        const rating = s.codechefProfile?.currentRating || 0;
        const contestCount = s.codechefProfile?.contestCount || 0;
        const cs = s.aiAnalysis?.consistencyScore || 0;
        const ts = s.aiAnalysis?.talentScore || 0;
        const score = s.leaderboardEntry?.overallScore || calculatePlacementReadiness(rating, contestCount, cs, ts);

        // Individual suggestions
        let recommendation = "Maintain active coding routines to stabilize skills.";
        if (score < 60) {
          recommendation = "Complete 15 basic DSA and coding challenges to secure score benchmarks.";
        } else if (rating < 1400) {
          recommendation = "Practice borderline binary search and sorting tasks on CodeChef.";
        } else if ((s.leetcodeProfile?.problemsSolved || 0) < 150) {
          recommendation = "Enhance LeetCode volume; target 20 medium-level problems.";
        } else if ((s.githubProfile?.openSourceScore || 0) < 50) {
          recommendation = "Structure your GitHub repositories; add readme documentation and star indicators.";
        }

        return {
          id: s.id,
          name: s.name,
          rollNumber: s.rollNumber || "N/A",
          department: s.department || "Unknown",
          currentRating: rating,
          stars: s.codechefProfile?.stars ?? 0,
          placementReadinessScore: score,
          aiRecommendation: recommendation
        };
      })
      .filter(s => s.placementReadinessScore >= 70)
      .sort((a, b) => b.placementReadinessScore - a.placementReadinessScore);

    // 2. College Institutional Stats
    const totalActiveCoders = Math.max(activeCodechef.length, activeLeetcode.length, activeGithub.length);
    const avgCcRating = activeCodechef.length > 0 ? Math.round(activeCodechef.reduce((acc, curr) => acc + curr.codechefProfile.currentRating, 0) / activeCodechef.length) : 0;
    const avgLcSolved = activeLeetcode.length > 0 ? Math.round(activeLeetcode.reduce((acc, curr) => acc + curr.leetcodeProfile.problemsSolved, 0) / activeLeetcode.length) : 0;
    const avgConsistency = students.length > 0 ? Math.round(students.reduce((acc, curr) => acc + (curr.aiAnalysis?.consistencyScore || 0), 0) / students.length) : 0;
    const avgOverallScore = activeOverall.length > 0 ? Math.round(activeOverall.reduce((acc, curr) => acc + curr.leaderboardEntry.overallScore, 0) / activeOverall.length) : 0;

    const collegeStats = {
      averageCollegeRating: avgCcRating,
      averageTalentScore: avgOverallScore,
      totalActiveCoders,
      averageContestParticipation: activeCodechef.length > 0 ? parseFloat((activeCodechef.reduce((acc, curr) => acc + curr.codechefProfile.contestCount, 0) / activeCodechef.length).toFixed(1)) : 0,
      averageProblemsSolved: avgLcSolved,
      studentsAbove3Star: activeCodechef.filter(s => s.codechefProfile.stars >= 3).length,
      studentsAbove4Star: activeCodechef.filter(s => s.codechefProfile.stars >= 4).length,
    };

    // 3. Department Insights
    const depts = ["CSE", "IT", "CSM", "CSD", "ECE", "EEE", "ME", "CE"];
    const deptStats = depts.map(dept => {
      const deptStudents = students.filter(s => s.department === dept);
      const withScore = deptStudents.filter(s => s.leaderboardEntry);
      const avgScore = withScore.length > 0 ? withScore.reduce((acc, s) => acc + s.leaderboardEntry.overallScore, 0) / withScore.length : 0;
      const totalGrowth = withScore.reduce((acc, s) => acc + (s.aiAnalysis?.growthScore || 50), 0);
      const avgGrowth = withScore.length > 0 ? totalGrowth / withScore.length : 50;

      return {
        dept,
        activeCount: withScore.length,
        avgScore,
        avgGrowth,
      };
    }).filter(d => d.activeCount > 0);

    const highestPerforming = [...deptStats].sort((a, b) => b.avgScore - a.avgScore)[0]?.dept || "Unknown";
    const lowestPerforming = [...deptStats].sort((a, b) => a.avgScore - b.avgScore)[0]?.dept || "Unknown";
    const fastestGrowing = [...deptStats].sort((a, b) => b.avgGrowth - a.avgGrowth)[0]?.dept || "Unknown";

    const departmentInsights = {
      highestPerforming,
      lowestPerforming,
      fastestGrowing,
      bestContestParticipation: highestPerforming,
      highestTalent: highestPerforming,
      mostPlacementReady: highestPerforming,
    };

    // 4. Recommendations Segment
    const recOverall: any[] = [];
    const recCodechef: any[] = [];
    const recLeetcode: any[] = [];
    const recGithub: any[] = [];

    // 5. Predictions Segment
    const predOverall: any[] = [];
    const predCodechef: any[] = [];
    const predLeetcode: any[] = [];
    const predGithub: any[] = [];

    // 6. Top Improving Segment
    const mapTopImproving = (list: any[], valueExtractor: (s: any) => number) => {
      return list.map(s => {
        const val = valueExtractor(s);
        const growth = Math.round(s.aiAnalysis?.growthScore || 50);
        return {
          id: s.id,
          name: s.name,
          rollNumber: s.rollNumber || "N/A",
          department: s.department || "Unknown",
          year: s.year || 3,
          currentRating: val,
          stars: s.codechefProfile?.stars ?? 0,
          growthPoints: Math.round(val * 0.1),
          growthPercent: growth,
          talentScore: Math.round(s.aiAnalysis?.talentScore || 0)
        };
      }).sort((a, b) => b.growthPercent - a.growthPercent).slice(0, 5);
    };

    const topImpOverall = mapTopImproving(activeOverall, s => s.leaderboardEntry.overallScore);
    const topImpCodechef = mapTopImproving(activeCodechef, s => s.codechefProfile.currentRating);
    const topImpLeetcode = mapTopImproving(activeLeetcode, s => s.leetcodeProfile.problemsSolved);
    const topImpGithub = mapTopImproving(activeGithub, s => s.githubProfile.openSourceScore);

    // Dynamic Discovery Reports
    const discoveryReports: any[] = [];

    return {
      insufficientData: N < 3,
      confidence,
      collegeStats,
      departmentInsights,
      placementReady,
      discoveryReports,
      // Root arrays for compatibility
      recommendations: recOverall,
      predictions: predOverall,
      topImproving: topImpOverall,
      // Platform segmented details
      segments: {
        overall: {
          recommendations: recOverall,
          predictions: predOverall,
          topImproving: topImpOverall
        },
        codechef: {
          recommendations: recCodechef,
          predictions: predCodechef,
          topImproving: topImpCodechef
        },
        leetcode: {
          recommendations: recLeetcode,
          predictions: predLeetcode,
          topImproving: topImpLeetcode
        },
        github: {
          recommendations: recGithub,
          predictions: predGithub,
          topImproving: topImpGithub
        }
      }
    };
  }
}
