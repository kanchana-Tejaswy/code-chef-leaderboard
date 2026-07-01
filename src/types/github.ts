export interface GitHubRepo {
  name: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  commits: number;
  lastUpdated: string;
  watchers?: number;
  openIssues?: number;
  license?: string;
  topics?: string[];
  visibility?: string;
}

export interface GitHubLanguage {
  name: string;
  value: number;
  color: string;
}

export interface GitHubCommitDay {
  date: string;
  commits: number;
}

export interface GitHubMonthTimeline {
  month: string;
  commits: number;
}

export interface GitHubRepoQuality {
  subject: string;
  A: number;
}

export interface GitHubAnalytics {
  totalRepositories: number;
  totalStars: number;
  totalForks: number;
  followers: number;
  openSourceScore: number;
  contributions: Record<string, number>;
  languages: GitHubLanguage[];
  repos: GitHubRepo[];
  commitTimeline: GitHubMonthTimeline[];
  repoQualityScore: GitHubRepoQuality[];
}
