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
          stars: s.codechefProfile?.stars || 1,
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
    const recOverall = [
      {
        title: "Platform Synergy Optimizations",
        description: `Ensure students maintain balanced performance profiles. We recommend students with strong CodeChef/LeetCode records but empty GitHub credentials link their repositories to optimize overall scores.`,
        priority: "HIGH",
        impact: "+15% overall ready index"
      },
      {
        title: "Placement Readiness Bootcamps",
        description: "Organize mock placement drives for students with Overall Score between 60-69 to push them above the tier threshold.",
        priority: "MEDIUM",
        impact: "+8 elite candidates"
      }
    ];

    const recCodechef = [
      {
        title: "DSA Search Bootcamp for Borderline Coders",
        description: `Bootcamps on recursion and basic dynamic programming are recommended for CodeChef users sitting just under the 3-star (1400) rating threshold.`,
        priority: "HIGH",
        impact: "+120 rating pts"
      },
      {
        title: "Live Contest Participation Slots",
        description: "Integrate mock live contest slots weekly during academic lab periods to boost timing speed.",
        priority: "MEDIUM",
        impact: "+35 active rounds count"
      }
    ];

    const recLeetcode = [
      {
        title: "Medium Problems Target Drive",
        description: "Incentivize solving medium-level LeetCode problems to improve success ratios on interview questions.",
        priority: "HIGH",
        impact: "+40% technical test success"
      },
      {
        title: "Daily Coding Streak Calendar",
        description: "Launch institutional leaderboards for longest LeetCode submission streaks to build consistency.",
        priority: "MEDIUM",
        impact: "Stablizes student focus"
      }
    ];

    const recGithub = [
      {
        title: "Open Source Documentation Workshops",
        description: "Add structured readmes, licensing, and clean code comments to active portfolio projects.",
        priority: "HIGH",
        impact: "Builds resume credibility"
      },
      {
        title: "Star Booster & Project Showcases",
        description: "Encourage students to share work in departmental showcase forums to build followers and ratings.",
        priority: "LOW",
        impact: "+15 stars average"
      }
    ];

    // 5. Predictions Segment
    const predOverall = [
      {
        target: "Overall Placement Ready Candidates (Overall Score >= 70)",
        currentCount: placementReady.length,
        predictedCount: activeOverall.filter(s => s.leaderboardEntry.overallScore >= 60).length,
        confidence,
        timeframe: "45 Days"
      },
      {
        target: "Elite Technical Roles Pipeline (Overall Score >= 85)",
        currentCount: activeOverall.filter(s => s.leaderboardEntry.overallScore >= 85).length,
        predictedCount: activeOverall.filter(s => s.leaderboardEntry.overallScore >= 75).length,
        confidence,
        timeframe: "60 Days"
      }
    ];

    const predCodechef = [
      {
        target: "Potential 3-Star Candidates (1400+ Rating)",
        currentCount: activeCodechef.filter(s => s.codechefProfile.stars >= 3).length,
        predictedCount: activeCodechef.filter(s => s.codechefProfile.currentRating >= 1300).length,
        confidence,
        timeframe: "30 Days"
      },
      {
        target: "Potential 4-Star Candidates (1600+ Rating)",
        currentCount: activeCodechef.filter(s => s.codechefProfile.stars >= 4).length,
        predictedCount: activeCodechef.filter(s => s.codechefProfile.currentRating >= 1500).length,
        confidence,
        timeframe: "60 Days"
      }
    ];

    const predLeetcode = [
      {
        target: "Potential Candidates Solved 150+ Problems",
        currentCount: activeLeetcode.filter(s => s.leetcodeProfile.problemsSolved >= 150).length,
        predictedCount: activeLeetcode.filter(s => s.leetcodeProfile.problemsSolved >= 120).length,
        confidence,
        timeframe: "45 Days"
      },
      {
        target: "Potential Candidates Solved 300+ Problems",
        currentCount: activeLeetcode.filter(s => s.leetcodeProfile.problemsSolved >= 300).length,
        predictedCount: activeLeetcode.filter(s => s.leetcodeProfile.problemsSolved >= 250).length,
        confidence,
        timeframe: "60 Days"
      }
    ];

    const predGithub = [
      {
        target: "Potential Active Portfolios (Repositories >= 10)",
        currentCount: activeGithub.filter(s => s.githubProfile.totalRepositories >= 10).length,
        predictedCount: activeGithub.filter(s => s.githubProfile.totalRepositories >= 7).length,
        confidence,
        timeframe: "30 Days"
      },
      {
        target: "Potential Open Source Ready (OS Score >= 70%)",
        currentCount: activeGithub.filter(s => s.githubProfile.openSourceScore >= 70).length,
        predictedCount: activeGithub.filter(s => s.githubProfile.openSourceScore >= 55).length,
        confidence,
        timeframe: "60 Days"
      }
    ];

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
          stars: s.codechefProfile?.stars || 1,
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
    const discoveryReports = [
      {
        title: "Algorithmic Placement Dominance",
        details: departmentInsights.highestPerforming !== "Unknown"
          ? `${departmentInsights.highestPerforming} department is currently leading in performance with the highest overall placement score. Meanwhile, ${departmentInsights.fastestGrowing} shows the fastest talent score growth velocity among all branches.`
          : "Insufficient active profile counts across departments to determine statistical dominance metrics."
      },
      {
        title: "College-Wide Technical Portfolio Summary",
        details: totalActiveCoders > 0
          ? `ACE College records an institutional rating of ${collegeStats.averageCollegeRating} rating, average Problems Solved of ${collegeStats.averageProblemsSolved} problems, and average placement score of ${collegeStats.averageTalentScore} across active student coders.`
          : "Institutional benchmarks are currently pending registered student profile sync cycles."
      }
    ];

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
