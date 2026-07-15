export interface ContestLog {
  code: string;
  name: string;
  rating: number;
  rank: number;
  date: string;
}
                         
export interface ScrapedData {
  platform: "CODECHEF" | "LEETCODE" | "GITHUB" | "CODEFORCES";
  username: string;
  currentRating: number | null;
  highestRating: number | null;
  globalRank: number | null;
  countryRank: number | null;
  stars: number | null;
  problemsSolved: number | null;
  contestCount: number | null;
  contests: ContestLog[];
  rawMetrics?: Record<string, any>;
  fullName?: string | null;
  country?: string | null;
  institution?: string | null;
  city?: string | null;
  maxStars?: number | null;
  fullySolvedCount?: number | null;
  partiallySolvedCount?: number | null;
  easySolvedCount?: number | null;
  mediumSolvedCount?: number | null;
  hardSolvedCount?: number | null;
  challengeSolvedCount?: number | null;
  longChallengeCount?: number | null;
  cookOffCount?: number | null;
  lunchtimeCount?: number | null;
  startersCount?: number | null;
  division?: string | null;
  bestContestRank?: number | null;
  averageContestRank?: number | null;
  lastActive?: Date | null;
  activeDaysCount?: number | null;
  ratingHistory?: any[];
  contestHistory?: any[];
  difficultyDistribution?: any;
  activitySummary?: any;
  statisticDetails?: any;
  aiAnalysis?: any;
}

export interface IPlatformScraper {
  scrape(input: string): Promise<ScrapedData>;
  validate(input: string): { isValid: boolean; username: string; error?: string };
}
