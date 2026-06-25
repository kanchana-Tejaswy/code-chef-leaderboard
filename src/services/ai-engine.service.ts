export interface AiAnalysisResult {
  talentScore: number;
  consistencyScore: number;
  problemSolvingScore: number;
  competitiveProgrammingScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  careerSuggestions: string[];
}

export interface ScoringReport {
  talentScore: number;
  consistencyScore: number;
  cpScore: number;
  problemSolvingScore: number;
  recommendations: string[];
}

export class AiEngineService {
  /**
   * Generates exact required JSON scoring report.
   */
  static generateScoringReport(data: {
    currentRating: number;
    highestRating: number;
    stars: number;
    problemsSolved: number;
    contestCount: number;
    contests: { date: string }[];
  }): ScoringReport {
    const { currentRating, highestRating, stars, problemsSolved, contestCount, contests } = data;

    // 1. Calculate Consistency Score (0 - 100)
    // Benchmarked against 30 contests for max base consistency
    const baseConsistency = Math.min(100, (contestCount / 30) * 100);
    
    // Check recency of participation (date within 30 days = 20 points, within 90 days = 10 points)
    let recencyBonus = 0;
    if (contests && contests.length > 0) {
      const dates = contests
        .map((c) => new Date(c.date).getTime())
        .filter((t) => !isNaN(t));
      if (dates.length > 0) {
        const lastContestTime = Math.max(...dates);
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        if (lastContestTime > thirtyDaysAgo) {
          recencyBonus = 20;
        } else if (lastContestTime > ninetyDaysAgo) {
          recencyBonus = 10;
        }
      }
    }
    const consistencyScore = Math.round(Math.min(100, baseConsistency + recencyBonus));

    // 2. Calculate Problem Solving Score (0 - 100)
    // Benchmarked against 300 solved problems for max score
    const problemSolvingScore = Math.round(Math.min(100, (problemsSolved / 300) * 100));

    // 3. Calculate Competitive Programming Score (0 - 100)
    // Benchmarked against 2000 rating (5 stars) for 100 points
    const cpScore = Math.round(Math.min(100, (currentRating / 2000) * 100));

    // 4. Combined Talent Score (0 - 100)
    // 40% performance, 40% volume, 20% consistency
    const rawTalentScore = 0.4 * cpScore + 0.4 * problemSolvingScore + 0.2 * consistencyScore;
    const talentScore = Math.round(Math.min(100, Math.max(0, rawTalentScore)));

    // 5. Generate Recommendations list
    const recommendations: string[] = [];

    if (cpScore < 50) {
      recommendations.push("Focus on basic algorithms: search, sort, and recursion.");
    } else {
      recommendations.push("Practice advanced data structures: segment trees, graphs, and dynamic programming.");
    }

    if (problemSolvingScore < 50) {
      recommendations.push("Increase problem solving frequency. Target 15-20 problems monthly.");
    }

    if (consistencyScore < 50) {
      recommendations.push("Register and participate in more timed contests to build speed and accuracy.");
    }

    if (highestRating - currentRating > 100) {
      recommendations.push("Work on submission correctness. Avoid wrong submissions to minimize rating penalties.");
    }

    recommendations.push("Review editorial solutions of problems you were unable to solve during the contest.");

    // Dynamic career recommendations
    if (currentRating >= 1800) {
      recommendations.push("Profile recommended for: Tier-1 engineering roles (Systems, HFT, Backend Architecture).");
    } else if (currentRating >= 1400) {
      recommendations.push("Profile recommended for: Software Engineering / Full Stack Dev positions.");
    } else {
      recommendations.push("Profile recommended for: Associate Software Engineer / Frontend Developer positions.");
    }

    return {
      talentScore,
      consistencyScore,
      cpScore,
      problemSolvingScore,
      recommendations,
    };
  }

  /**
   * Backward-compatible analyzeProfile for dashboard UI charts and details.
   */
  static analyzeProfile(data: {
    currentRating: number;
    highestRating: number;
    stars: number;
    problemsSolved: number;
    contestCount: number;
    contests: { date: string }[];
  }): AiAnalysisResult {
    const report = this.generateScoringReport(data);

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const careerSuggestions: string[] = [];

    // Strengths
    if (data.stars >= 5) {
      strengths.push(`Elite coding profile: Recognized as a ${data.stars}-Star competitive programmer.`);
    } else if (data.stars >= 3) {
      strengths.push(`Strong algorithmic core: Active ${data.stars}-Star competitor.`);
    } else {
      strengths.push("Active developer building competitive programming capabilities.");
    }

    if (data.problemsSolved >= 150) {
      strengths.push(`High practice volume: Solved ${data.problemsSolved} challenges on the platform.`);
    } else if (data.problemsSolved >= 50) {
      strengths.push("Solid foundation in solving standard algorithmic challenges.");
    }

    if (report.consistencyScore >= 80) {
      strengths.push("Excellent consistency: Shows a regular schedule of contest participations.");
    }

    if (data.currentRating > 1600 && data.highestRating - data.currentRating < 100) {
      strengths.push("Stable contest rating showing strong, reliable performance trends.");
    }

    // Weaknesses
    if (data.stars < 3) {
      weaknesses.push("Lower star rating: Needs to raise ranking tier by performing better in live contests.");
    }
    if (data.problemsSolved < 50) {
      weaknesses.push("Limited problem library coverage: Needs more practice across standard topics.");
    }
    if (data.contestCount < 8) {
      weaknesses.push("Insufficient contest exposure: Lacks enough timed competitive practice.");
    }
    if (data.highestRating - data.currentRating > 150) {
      weaknesses.push("Rating volatility: Highly fluctuating ratings; suggests penalties or inconsistent submissions.");
    }

    // Career Suggestions
    if (data.currentRating >= 1800) {
      careerSuggestions.push(
        "Top Product Engineering (FAANG / Unicorns)",
        "Quantitative Software Engineer / HFT Analyst",
        "Systems Programmer / Backend Specialist"
      );
    } else if (data.currentRating >= 1400) {
      careerSuggestions.push(
        "Backend Developer (Python/Go/Java)",
        "Software Engineer (Core Engineering)",
        "Full-Stack Developer (MERN/Next.js)"
      );
    } else {
      careerSuggestions.push(
        "Associate Software Engineer",
        "Frontend Engineer",
        "Technical Analyst"
      );
    }

    return {
      talentScore: report.talentScore,
      consistencyScore: report.consistencyScore,
      problemSolvingScore: report.problemSolvingScore,
      competitiveProgrammingScore: report.cpScore,
      strengths,
      weaknesses,
      recommendations: report.recommendations,
      careerSuggestions,
    };
  }
}
