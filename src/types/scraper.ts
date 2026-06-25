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
}

export interface IPlatformScraper {
  scrape(input: string): Promise<ScrapedData>;
  validate(input: string): { isValid: boolean; username: string; error?: string };
}
