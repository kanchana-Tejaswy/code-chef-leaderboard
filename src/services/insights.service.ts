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

  // Calculate consistency from AI Analysis
  const avgConsistency = activeStudents.length > 0
    ? activeStudents.reduce((acc, s) => acc + (s.aiAnalysis?.consistencyScore || 0), 0) / activeStudents.length
    : 0;
  
  let score = 0;
  // 1. Student volume contribution (up to 40)
  score += Math.min(40, (N / 12) * 40);
  // 2. Contest density contribution (up to 30)
  score += Math.min(30, (avgContests / 6) * 30);
  // 3. Consistency score contribution (up to 30)
  score += (avgConsistency / 100) * 30;

  const finalScore = Math.round(score);
  if (finalScore < 40) {
    return "Confidence unavailable due to limited historical data.";
  }
  return `${Math.min(100, finalScore)}%`;
}

export function predictGrowth(activeStudents: any[], confidence: string) {
  if (confidence.includes("unavailable")) {
    return { error: "Insufficient data to generate reliable predictions.", list: [] };
  }

  // Target 1: 3-Star (1400+ Rating)
  const current3Star = activeStudents.filter(s => (s.codechefProfile?.currentRating || 0) >= 1400).length;
  const predicted3Star = activeStudents.filter(s => {
    const r = s.codechefProfile?.currentRating || 0;
    if (r >= 1400) return true;
    const growth = s.aiAnalysis?.growthScore || 50;
    const velocity = Math.max(0, (growth - 48) * 2); // points per month
    return (r + velocity) >= 1400;
  }).length;

  // Target 2: 4-Star (1600+ Rating)
  const current4Star = activeStudents.filter(s => (s.codechefProfile?.currentRating || 0) >= 1600).length;
  const predicted4Star = activeStudents.filter(s => {
    const r = s.codechefProfile?.currentRating || 0;
    if (r >= 1600) return true;
    const growth = s.aiAnalysis?.growthScore || 50;
    const velocity = Math.max(0, (growth - 48) * 2) * 2; // in 60 days
    return (r + velocity) >= 1600;
  }).length;

  // Target 3: Placement Ready (Score >= 70)
  const getReadiness = (s: any) => {
    const r = s.codechefProfile?.currentRating || 0;
    const c = s.codechefProfile?.contestCount || 0;
    const cs = s.aiAnalysis?.consistencyScore || 0;
    const ts = s.aiAnalysis?.talentScore || 0;
    return calculatePlacementReadiness(r, c, cs, ts);
  };
  const currentPR = activeStudents.filter(s => getReadiness(s) >= 70).length;
  const predictedPR = activeStudents.filter(s => {
    const currentScore = getReadiness(s);
    if (currentScore >= 70) return true;
    const r = s.codechefProfile?.currentRating || 0;
    const c = s.codechefProfile?.contestCount || 0;
    const cs = s.aiAnalysis?.consistencyScore || 0;
    const ts = s.aiAnalysis?.talentScore || 0;
    const growth = s.aiAnalysis?.growthScore || 50;
    const velocity = Math.max(0, (growth - 48) * 2) * 1.5; // in 45 days
    const nextRating = r + velocity;
    const nextContests = c + 2;
    const nextScore = calculatePlacementReadiness(nextRating, nextContests, cs, ts);
    return nextScore >= 70;
  }).length;

  return {
    error: null,
    list: [
      {
        target: "Predicted 3-Star Candidates (1400+ Rating)",
        currentCount: current3Star,
        predictedCount: Math.max(current3Star, predicted3Star),
        confidence,
        timeframe: "30 Days"
      },
      {
        target: "Predicted 4-Star Candidates (1600+ Rating)",
        currentCount: current4Star,
        predictedCount: Math.max(current4Star, predicted4Star),
        confidence,
        timeframe: "60 Days"
      },
      {
        target: "Expected Placement Readiness (Score >= 70)",
        currentCount: currentPR,
        predictedCount: Math.max(currentPR, predictedPR),
        confidence,
        timeframe: "45 Days"
      }
    ]
  };
}

export function getTopImprovingStudents(activeStudents: any[]) {
  const list = activeStudents.map(s => {
    const current = s.codechefProfile?.currentRating || 0;
    
    // Parse ratingHistory
    let ratingHistoryList: any[] = [];
    try {
      ratingHistoryList = typeof s.codechefProfile.ratingHistory === "string"
        ? JSON.parse(s.codechefProfile.ratingHistory)
        : s.codechefProfile.ratingHistory || [];
    } catch(e) {}

    let prevRating = 1200;
    if (Array.isArray(ratingHistoryList) && ratingHistoryList.length > 0) {
      const sorted = [...ratingHistoryList].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      prevRating = sorted[0]?.rating || 1200;
    }
    
    const growthPoints = current - prevRating;
    const growthPercent = prevRating > 0 ? (growthPoints / prevRating) * 100 : 0;
    
    return {
      id: s.id,
      name: s.name,
      rollNumber: s.rollNumber || "N/A",
      department: s.department || "Unknown",
      year: s.year || 3,
      currentRating: current,
      stars: s.codechefProfile?.stars || 1,
      growthPoints,
      growthPercent: parseFloat(growthPercent.toFixed(1)),
      talentScore: Math.round(s.aiAnalysis?.talentScore || 0)
    };
  });

  return list.sort((a, b) => b.growthPercent - a.growthPercent).slice(0, 5);
}

export function generateDepartmentInsights(students: any[]) {
  const depts = ["CSE", "IT", "CSM", "CSD", "ECE", "EEE", "ME", "CE"];
  
  const deptStats = depts.map(dept => {
    const deptStudents = students.filter(s => s.department === dept);
    const active = deptStudents.filter(s => s.codechefProfile);
    
    const totalRating = active.reduce((acc, s) => acc + (s.codechefProfile?.currentRating || 0), 0);
    const avgRating = active.length > 0 ? totalRating / active.length : 0;
    
    const totalTalent = active.reduce((acc, s) => acc + (s.aiAnalysis?.talentScore || 0), 0);
    const avgTalent = active.length > 0 ? totalTalent / active.length : 0;

    const totalContests = active.reduce((acc, s) => acc + (s.codechefProfile?.contestCount || 0), 0);
    const avgContests = active.length > 0 ? totalContests / active.length : 0;

    // Count placement ready
    const prCount = active.filter(s => {
      const r = s.codechefProfile?.currentRating || 0;
      const c = s.codechefProfile?.contestCount || 0;
      const cs = s.aiAnalysis?.consistencyScore || 0;
      const ts = s.aiAnalysis?.talentScore || 0;
      return calculatePlacementReadiness(r, c, cs, ts) >= 70;
    }).length;

    // Growth velocity
    const totalGrowth = active.reduce((acc, s) => acc + (s.aiAnalysis?.growthScore || 50), 0);
    const avgGrowth = active.length > 0 ? totalGrowth / active.length : 50;

    return {
      dept,
      studentCount: deptStudents.length,
      activeCount: active.length,
      avgRating,
      avgTalent,
      avgContests,
      prCount,
      avgGrowth
    };
  }).filter(d => d.activeCount > 0);

  if (deptStats.length === 0) {
    return {
      highestPerforming: "Unknown",
      lowestPerforming: "Unknown",
      fastestGrowing: "Unknown",
      bestContestParticipation: "Unknown",
      highestTalent: "Unknown",
      mostPlacementReady: "Unknown"
    };
  }

  const highestPerforming = [...deptStats].sort((a,b) => b.avgRating - a.avgRating)[0]?.dept || "Unknown";
  const lowestPerforming = [...deptStats].sort((a,b) => a.avgRating - b.avgRating)[0]?.dept || "Unknown";
  const fastestGrowing = [...deptStats].sort((a,b) => b.avgGrowth - a.avgGrowth)[0]?.dept || "Unknown";
  const bestContestParticipation = [...deptStats].sort((a,b) => b.avgContests - a.avgContests)[0]?.dept || "Unknown";
  const highestTalent = [...deptStats].sort((a,b) => b.avgTalent - a.avgTalent)[0]?.dept || "Unknown";
  const mostPlacementReady = [...deptStats].sort((a,b) => b.prCount - a.prCount)[0]?.dept || "Unknown";

  return {
    highestPerforming,
    lowestPerforming,
    fastestGrowing,
    bestContestParticipation,
    highestTalent,
    mostPlacementReady
  };
}

export function generateCollegeInsights(students: any[]) {
  const active = students.filter(s => s.codechefProfile && s.aiAnalysis);
  
  const totalRating = active.reduce((acc, s) => acc + (s.codechefProfile?.currentRating || 0), 0);
  const averageCollegeRating = active.length > 0 ? Math.round(totalRating / active.length) : 0;

  const totalTalent = active.reduce((acc, s) => acc + (s.aiAnalysis?.talentScore || 0), 0);
  const averageTalentScore = active.length > 0 ? Math.round(totalTalent / active.length) : 0;

  const totalContests = active.reduce((acc, s) => acc + (s.codechefProfile?.contestCount || 0), 0);
  const averageContestParticipation = active.length > 0 ? parseFloat((totalContests / active.length).toFixed(1)) : 0;

  const totalSolved = active.reduce((acc, s) => acc + (s.codechefProfile?.problemsSolved || 0), 0);
  const averageProblemsSolved = active.length > 0 ? Math.round(totalSolved / active.length) : 0;

  const studentsAbove3Star = active.filter(s => (s.codechefProfile?.stars || 1) >= 3).length;
  const studentsAbove4Star = active.filter(s => (s.codechefProfile?.stars || 1) >= 4).length;

  return {
    averageCollegeRating,
    averageTalentScore,
    totalActiveCoders: active.length,
    averageContestParticipation,
    averageProblemsSolved,
    studentsAbove3Star,
    studentsAbove4Star
  };
}

export function generateAIRecommendations(students: any[], collegeStats: any) {
  const recommendations = [];
  const active = students.filter(s => s.codechefProfile && s.aiAnalysis);

  if (active.length === 0) return [];

  // Rule 1: 1300-1399 borderline cohort count
  const borderlineCount = active.filter(s => {
    const r = s.codechefProfile?.currentRating || 0;
    return r >= 1300 && r < 1400;
  }).length;
  
  if (borderlineCount > 0) {
    recommendations.push({
      title: "Focused Practice for Borderline 3-Star Coders",
      description: `We identified ${borderlineCount} students currently rated between 1300-1399, sitting just under the 3-Star threshold (1400). A focused 2-week practice bootcamp on search algorithms and basic dynamic programming is highly recommended to lift this cohort into the placement ready tier.`,
      priority: "HIGH",
      impact: `+${Math.round((borderlineCount / active.length) * 100)}% placement index`
    });
  }

  // Rule 2: Department contest participation comparison
  const depts = ["CSE", "IT", "CSM", "CSD", "ECE", "EEE", "ME", "CE"];
  const collegeAvgContests = collegeStats.averageContestParticipation;

  depts.forEach(dept => {
    const deptActive = active.filter(s => s.department === dept);
    if (deptActive.length > 0) {
      const deptAvgContests = deptActive.reduce((acc, s) => acc + (s.codechefProfile?.contestCount || 0), 0) / deptActive.length;
      if (deptAvgContests < collegeAvgContests * 0.85) {
        recommendations.push({
          title: `Incentivize Contest Volume in ${dept}`,
          description: `The average contest participation in the ${dept} department is ${deptAvgContests.toFixed(1)} rounds, which is below the college average of ${collegeAvgContests.toFixed(1)} rounds. We recommend implementing department-level coding incentives or weekly practice slots to boost active participation.`,
          priority: "MEDIUM",
          impact: `+${Math.round(deptActive.length * 0.3)} active profiles`
        });
      }
    }
  });

  // Rule 3: Low ratings in department
  depts.forEach(dept => {
    const deptActive = active.filter(s => s.department === dept);
    if (deptActive.length >= 2) {
      const deptAvgRating = deptActive.reduce((acc, s) => acc + (s.codechefProfile?.currentRating || 0), 0) / deptActive.length;
      if (deptAvgRating < 1300) {
        recommendations.push({
          title: `Introductory DSA Workshops for ${dept}`,
          description: `The average CodeChef rating in the ${dept} department is currently ${Math.round(deptAvgRating)} points, which indicates gaps in foundational problem-solving strategies. Organizing additional hands-on workshops focused on fundamental Data Structures & Algorithms is highly recommended.`,
          priority: "HIGH",
          impact: "+120 average rating pts"
        });
      }
    }
  });

  // Rule 4: High stars plateau
  const eliteCount = active.filter(s => (s.codechefProfile?.stars || 1) >= 4).length;
  if (eliteCount > 0) {
    recommendations.push({
      title: "Advanced Computational Topics for Elite Coders",
      description: `There are currently ${eliteCount} coders at 4-Star or higher tiers. To help them overcome rating plateaus and prepare for Tier-1 engineering roles, we suggest introducing weekly expert-led modules on Segment Trees, heavy implementation, and game theory.`,
      priority: "LOW",
      impact: "+3 elite master coders"
    });
  }

  const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  return recommendations
    .sort((a, b) => priorityWeight[b.priority as keyof typeof priorityWeight] - priorityWeight[a.priority as keyof typeof priorityWeight])
    .slice(0, 3);
}

export function getStudentRecommendation(student: any): string {
  const rating = student.codechefProfile?.currentRating || 0;
  const contestCount = student.codechefProfile?.contestCount || 0;
  const cs = student.aiAnalysis?.consistencyScore || 0;
  const ts = student.aiAnalysis?.talentScore || 0;
  const problems = student.codechefProfile?.problemsSolved || 0;

  if (rating < 1300) {
    return "Focus on foundational sorting, searching, and recursion tasks; solve at least 15 easy problems.";
  }
  if (contestCount < 4) {
    return "Participate in at least 2 live CodeChef Starters contests monthly to build timed speed.";
  }
  if (cs < 55) {
    return "Maintain a 14-day coding practice streak to stabilize consistency index.";
  }
  if (problems < 100) {
    return "Increase practice volume; solve 20 additional easy-medium problems weekly.";
  }
  if (rating < 1500) {
    return "Study dynamic programming basics and range query data structures.";
  }
  if (rating < 1800) {
    return "Solve medium-hard Graph algorithms and Dijkstra/MST challenges.";
  }
  return "Practice advanced Tree segment structures (HLD, Centroid trees) for elite optimization.";
}

// ---------------------------------------------------------------------------
// New utility functions for coding streak estimation and performance scores
// ---------------------------------------------------------------------------
/**
 * Estimate coding streak based on CodeChef rating history dates.
 * Returns current streak, longest streak, last active date, and activity flags.
 */
export function calculateCodingStreak(student: any) {
  const rawHistory = student.codechefProfile?.ratingHistory;
  let history: any[] = [];
  try {
    history = typeof rawHistory === "string" ? JSON.parse(rawHistory) : rawHistory || [];
  } catch (e) {
    history = [];
  }

  if (!Array.isArray(history) || history.length === 0) {
    return {
      currentStreak: null,
      longestStreak: null,
      lastActiveDate: null,
      activeThisWeek: false,
      activeThisMonth: false,
    };
  }

  // Convert to timestamps at start of UTC day
  const dates = history
    .map((h: any) => new Date(h.date))
    .filter((d: Date) => !isNaN(d.getTime()))
    .map((d: Date) => d.setUTCHours(0, 0, 0, 0))
    .sort((a: number, b: number) => a - b);

  // Compute longest consecutive streak
  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = dates[i] - dates[i - 1];
    if (diff === 86400000) {
      current += 1;
    } else {
      longest = Math.max(longest, current);
      current = 1;
    }
  }
  longest = Math.max(longest, current);

  // Compute current streak (from most recent backwards)
  let currentStreak = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    if (dates[i] - dates[i - 1] === 86400000) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  const lastActive = new Date(dates[dates.length - 1]);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const diffFromToday = today.getTime() - dates[dates.length - 1];
  const activeThisWeek = diffFromToday <= 7 * 86400000;
  const activeThisMonth = diffFromToday <= 30 * 86400000;

  return {
    currentStreak,
    longestStreak: longest,
    lastActiveDate: lastActive.toISOString().split('T')[0],
    activeThisWeek,
    activeThisMonth,
  };
}

/**
 * Generate a set of performance scores for a student based on raw metrics.
 */
export function generatePerformanceScores(student: any) {
  const rating = student.codechefProfile?.currentRating || 0;
  const highestRating = student.codechefProfile?.highestRating || rating;
  const stars = student.codechefProfile?.stars || 1;
  const highestStars = student.codechefProfile?.highestStars || stars;
  const contestCount = student.codechefProfile?.contestCount || 0;
  const problemsSolved = student.codechefProfile?.problemsSolved || 0;
  const consistency = student.aiAnalysis?.consistencyScore || 0;
  const talent = student.aiAnalysis?.talentScore || 0;
  const growth = student.aiAnalysis?.growthScore || 0;
  const learning = student.aiAnalysis?.learningScore || 0;

  const talentScore = Math.round(talent);
  const problemSolvingScore = Math.min(100, Math.round((problemsSolved / 200) * 100));
  const contestScore = Math.min(100, Math.round((contestCount / 20) * 100));
  const consistencyScore = Math.min(100, Math.round(consistency));
  const learningScore = Math.min(100, Math.round(learning));
  const growthScore = Math.min(100, Math.round(growth));
  const competitiveProgrammingScore = Math.min(
    100,
    Math.round((rating / 2000) * 100 + (stars / 5) * 20)
  );

  return {
    talentScore,
    problemSolvingScore,
    contestScore,
    consistencyScore,
    learningScore,
    growthScore,
    competitiveProgrammingScore,
  };
}


export class InsightsService {
  static getInsights(students: any[]) {
    const activeStudents = students.filter(s => s.codechefProfile && s.aiAnalysis);
    const N = students.length;

    const confidence = calculatePredictionConfidence(N, activeStudents);
    const collegeStats = generateCollegeInsights(students);
    const departmentInsights = generateDepartmentInsights(students);
    const recommendations = generateAIRecommendations(students, collegeStats);
    const predictionsResult = predictGrowth(activeStudents, confidence);
    const topImproving = getTopImprovingStudents(activeStudents);

    // Compute Placement Ready cohort (threshold score >= 70)
    const placementReady = activeStudents
      .map(s => {
        const rating = s.codechefProfile?.currentRating || 0;
        const contestCount = s.codechefProfile?.contestCount || 0;
        const consistencyScore = s.aiAnalysis?.consistencyScore || 0;
        const talentScore = s.aiAnalysis?.talentScore || 0;
        const score = calculatePlacementReadiness(rating, contestCount, consistencyScore, talentScore);
        
        return {
          id: s.id,
          name: s.name,
          rollNumber: s.rollNumber || "N/A",
          department: s.department || "Unknown",
          currentRating: rating,
          stars: s.codechefProfile?.stars || 1,
          placementReadinessScore: score,
          aiRecommendation: getStudentRecommendation(s)
        };
      })
      .filter(s => s.placementReadinessScore >= 70)
      .sort((a, b) => b.placementReadinessScore - a.placementReadinessScore);

    // Create the dynamic Talent Discovery Reports
    const discoveryReports = [
      {
        title: "Department Dominance Report",
        details: departmentInsights.highestPerforming !== "Unknown"
          ? `${departmentInsights.highestPerforming} department is currently leading in performance with the highest average rating. Meanwhile, ${departmentInsights.fastestGrowing} shows the fastest rating growth velocity among all departments.`
          : "Insufficient active profile counts across departments to determine statistical dominance metrics."
      },
      {
        title: "College-Wide Algorithmic Summary",
        details: collegeStats.totalActiveCoders > 0
          ? `ACE College records an average rating of ${collegeStats.averageCollegeRating} and average talent score of ${collegeStats.averageTalentScore} across ${collegeStats.totalActiveCoders} active coders, with an average of ${collegeStats.averageProblemsSolved} problems solved per student.`
          : "Institutional benchmarks are currently pending additional registered student profile sync cycles."
      }
    ];

    return {
      insufficientData: N < 3,
      topImproving,
      placementReady,
      recommendations,
      predictions: predictionsResult.list,
      predictionError: predictionsResult.error,
      discoveryReports,
      confidence,
      collegeStats,
      departmentInsights,
      studentMetrics: activeStudents.map((s: any) => ({
        id: s.id,
        codingStreak: calculateCodingStreak(s),
        performanceScores: generatePerformanceScores(s)
      }))
    };
  }
}
