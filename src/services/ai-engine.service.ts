export interface AiAnalysisResult {
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
  recommendations?: string[]; // Backward compatibility
  careerSuggestions?: string[]; // Backward compatibility
}

export class AiEngineService {
  /**
   * Performs advanced CP analytics calculations and AI-driven predictions.
   */
  static analyzeProfile(data: {
    currentRating: number;
    highestRating: number;
    stars: number;
    problemsSolved: number;
    contestCount: number;
    contests: { date: string; rating: number; rank: number }[];
    fullySolvedCount?: number;
    partiallySolvedCount?: number;
    bestContestRank?: number | null;
    activeDaysCount?: number;
  }): AiAnalysisResult {
    const {
      currentRating,
      highestRating,
      stars,
      problemsSolved,
      contestCount,
      contests,
      fullySolvedCount = problemsSolved,
      bestContestRank = null,
      activeDaysCount = 0
    } = data;

    // 1. Calculate CP Score (0-100)
    // Capped at 100, 2200 rating (6-star) represents max rating base
    const cpScore = Math.round(Math.min(100, (currentRating / 2200) * 100));

    // 2. Calculate Problem Solving Score (0-100)
    // Capped at 100, benchmarked against 350 solved problems
    const problemSolvingScore = Math.round(Math.min(100, (fullySolvedCount / 300) * 80 + (problemsSolved / 350) * 20));

    // 3. Calculate Contest Score (0-100)
    let contestScore = 0;
    if (contestCount > 0) {
      const volumeScore = Math.min(40, (contestCount / 20) * 40);
      const rankScore = bestContestRank 
        ? Math.min(60, Math.max(10, 60 - Math.floor(bestContestRank / 100))) 
        : 30;
      contestScore = Math.round(Math.min(100, volumeScore + rankScore));
    }

    // 4. Calculate Consistency Score (0-100)
    const baseConsistency = Math.min(80, (contestCount / 15) * 80);
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

    // 5. Calculate Learning Score (0-100)
    const learningScore = Math.round(Math.min(100, (stars / 7) * 40 + (problemsSolved / 250) * 60));

    // 6. Calculate Growth Score (0-100)
    let growthScore = 50;
    if (contests && contests.length > 2) {
      const sortedContests = [...contests].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const lastRating = sortedContests[sortedContests.length - 1].rating;
      const prevRating = sortedContests[Math.max(0, sortedContests.length - 4)].rating;
      const diff = lastRating - prevRating;
      growthScore = Math.round(Math.max(10, Math.min(100, 50 + diff * 0.5)));
    }

    // 7. Calculate Discipline Score (0-100)
    const activeDaysBonus = Math.min(50, (activeDaysCount / 40) * 50);
    const solvedBonus = Math.min(50, (problemsSolved / 150) * 50);
    const disciplineScore = Math.round(Math.min(100, activeDaysBonus + solvedBonus));

    // 8. Overall Combined Talent Score (0-100)
    const talentScore = Math.round(
      0.20 * cpScore +
      0.20 * problemSolvingScore +
      0.15 * contestScore +
      0.15 * consistencyScore +
      0.15 * learningScore +
      0.05 * growthScore +
      0.10 * disciplineScore
    );

    // Expected Rating in 6 Months
    const ratingIncrement = Math.round((growthScore - 48) * 3.5);
    const expectedRating6Months = Math.max(currentRating, currentRating + ratingIncrement);

    // Placement Readiness & Overall Potential Labels
    let overallPotential = "Rising Talent";
    if (talentScore >= 85) overallPotential = "Elite Master Coder";
    else if (talentScore >= 72) overallPotential = "High Potential Developer";
    else if (talentScore >= 50) overallPotential = "Competent SDE Candidate";

    let placementReadiness = "Core Skills Phase";
    if (currentRating >= 1800) placementReadiness = "Immediate Tier-1 / HFT Ready";
    else if (currentRating >= 1600) placementReadiness = "Tier-2 Product Ready";
    else if (currentRating >= 1400) placementReadiness = "Standard SDE Ready";
    else if (currentRating >= 1200) placementReadiness = "Service / Mid-tier Ready";

    // Dynamic Lists based on Stars/Rating
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const improvementAreas: string[] = [];
    let careerRecommendation = "";
    const suggestedCompanies: string[] = [];
    const recommendedLearningPath: string[] = [];

    if (stars >= 5) {
      strengths.push("Elite competitive programming index.", "Strong grasp of complex graph models & geometry.", "Advanced data structure execution.");
      weaknesses.push("Occasional rating penalties due to edge-case submissions.", "Vulnerable in specialized combinatorial queries.");
      improvementAreas.push("Target Global CodeChef Lunchtimes Div 1 tasks.", "Participate in ACM-ICPC simulated training sets.", "Optimize execution speed on heavy implementation segments.");
      careerRecommendation = "Quantitative Platform Engineer, HFT Algorithmist, Core Infrastructure Architect";
      suggestedCompanies.push("Google", "Uber", "Tower Research", "Graviton", "Directi", "CodeNation", "Atlassian");
      recommendedLearningPath.push("Heavy-Light Decomposition & Centroid Trees", "Fast Fourier Transform (FFT) implementations", "Suffix Automaton & Palindromic Trees", "Min-Max Game Trees & Game Theory Optimization");
    } else if (stars >= 3) {
      strengths.push("Solid foundation in standard data structures.", "Capable of resolving Div2 medium-hard problems.", "Reliable contest speed.");
      weaknesses.push("Slow implementation on complex Tree layouts.", "Struggles with dynamic programming state reductions.");
      improvementAreas.push("Focus on segment trees and range queries.", "Master graph traversal algorithms (Dijkstra, Kruskal).", "Review editorial solutions for Div2 Div1 overlap problems.");
      careerRecommendation = "Software Development Engineer (SDE-1), Backend Architect, Systems Engineer";
      suggestedCompanies.push("Amazon", "Microsoft", "Razorpay", "Zoho", "Flipkart", "PayPal", "Intuit");
      recommendedLearningPath.push("Segment Trees & Fenwick trees", "Graph Algorithms (Dijkstra, Prim's, Tarjan's SCC)", "Dynamic Programming State Optimization", "String Hashing & KMP Search");
    } else {
      strengths.push("Active developer gaining CP exposure.", "Strong interest in basic algorithmic concepts.", "Comfortable with simple iterations & arrays.");
      weaknesses.push("Limited problem library solved.", "Struggles with time-limit constraint optimization (TLE).", "Lack of timed contest experience.");
      improvementAreas.push("Solve 15-20 easy/medium problems monthly.", "Participate in weekly Starters contests.", "Focus on time & space complexity math.");
      careerRecommendation = "Full-Stack Web Developer, Associate Software Engineer, Associate Consultant";
      suggestedCompanies.push("TCS Digital", "Cognizant", "Infosys", "Capgemini", "Wipro", "Accenture", "LTI Mindtree");
      recommendedLearningPath.push("Time & Space Complexity analysis", "Sorting and Binary Search algorithms", "Standard Template Library (STL) Containers", "Recursion & Backtracking basics");
    }

    // Add extra entries for richness
    if (problemsSolved >= 150 && strengths.length < 4) {
      strengths.push("Excellent practice consistency & volume.");
    }
    if (consistencyScore >= 80 && strengths.length < 4) {
      strengths.push("Reliable active coding timeline.");
    }

    // Recommendations list for backward compatibility
    const recommendations = [
      ...improvementAreas.map(i => `Improvement Area: ${i}`),
      `Path Recommendation: Master ${recommendedLearningPath[0]}`
    ];
    const careerSuggestions = suggestedCompanies.map(c => `${c} SDE Candidate`);

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
      expectedRating6Months,
      strengths,
      weaknesses,
      improvementAreas,
      careerRecommendation,
      suggestedCompanies,
      recommendedLearningPath,
      recommendations,
      careerSuggestions
    };
  }
}

