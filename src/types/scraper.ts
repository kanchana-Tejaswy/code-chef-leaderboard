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
  currentRating: number;
  highestRating: number;
  globalRank: number | null;
  countryRank: number | null;
  stars: number;
  problemsSolved: number;
  contestCount: number;
  contests: ContestLog[];
  rawMetrics?: Record<string, any>;
  fullName?: string | null;
  country?: string | null;
  institution?: string | null;
  city?: string | null;
  maxStars?: number | null;
  fullySolvedCount?: number;
  partiallySolvedCount?: number;
  easySolvedCount?: number;
  mediumSolvedCount?: number;
  hardSolvedCount?: number;
  challengeSolvedCount?: number;
  longChallengeCount?: number;
  cookOffCount?: number;
  lunchtimeCount?: number;
  startersCount?: number;
  division?: string | null;
  bestContestRank?: number | null;
  averageContestRank?: number | null;
  lastActive?: Date | null;
  activeDaysCount?: number;
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
