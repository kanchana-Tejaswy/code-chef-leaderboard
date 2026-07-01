export interface GitHubRepo {
  name: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  commits: number;
  lastUpdated: string;
  watchers: number;
  openIssues: number;
  license: string;
  topics: string[];
  visibility: string;
  size: number; // In KB
  createdDate: string;
  defaultBranch: string;
  isArchived: boolean;
}

export interface GitHubLanguage {
  name: string;
  value: number; // Percentage
  color: string;
  totalRepos: number;
  totalLines?: number;
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
  A: number; // Score 0-100
}

export interface GitHubCommitAnalytics {
  total: number;
  commitsThisYear: number;
  commitsThisMonth: number;
  weeklyCommits: number;
  dailyAverage: number;
  monthlyAverage: number;
  mostActiveWeekday: string;
  mostActiveMonth: string;
}

export interface GitHubContributionStreak {
  current: number;
  longest: number;
  activeDays: number;
}

export interface GitHubOpenSourceAnalytics {
  pullRequests: number;
  pullRequestsMerged: number;
  pullRequestsOpen: number;
  issuesCreated: number;
  issuesClosed: number;
  organizations: number;
  forkContributions: number;
  discussions: number;
  releases: number;
}

export interface GitHubDeveloperPortfolio {
  fullStack: number;
  ai: number;
  web: number;
  mobile: number;
  openSource: number;
  college: number;
  hackathon: number;
}

export interface GitHubCareerInsights {
  strongestSkills: string[];
  weaknesses: string[];
  missingTechnologies: string[];
  recommendedLearningPath: string[];
  hiringReadiness: string;
  resumeStrength: number;
  portfolioStrength: number;
  openSourceReadiness: string;
  industryReadiness: number;
  suggestedProjects: string[];
  interviewPrep: string[];
}

export interface GitHubDeveloperScoreDetails {
  score: number;
  quality: number;
  codingActivity: number;
  consistency: number;
  openSource: number;
  technologyDiversity: number;
  documentation: number;
  complexity: number;
  community: number;
}

export interface GitHubProfileDetails {
  username: string;
  name: string;
  bio: string;
  avatarUrl: string;
  followers: number;
  following: number;
  publicRepos: number;
  publicGists: number;
  company: string;
  location: string;
  blog: string;
  twitter: string;
  accountAgeYears: number;
  createdDate: string;
  lastUpdate: string;
  isHireable: boolean;
  email?: string;
  organizationsList?: string[];
  pinnedRepositories?: any[];
}

export interface GitHubAnalytics {
  totalRepositories: number;
  totalStars: number;
  totalForks: number;
  followers: number;
  openSourceScore: number;
  contributions: Record<string, number> | null; // date -> count map
  languages: GitHubLanguage[];
  repos: GitHubRepo[];
  commitTimeline: GitHubMonthTimeline[];
  repoQualityScore: GitHubRepoQuality[];
  streaks: GitHubContributionStreak | null;
  commitAnalytics: GitHubCommitAnalytics;
  openSource: GitHubOpenSourceAnalytics;
  portfolio: GitHubDeveloperPortfolio;
  careerInsights: GitHubCareerInsights;
  profileDetails: GitHubProfileDetails;
  developerScore: GitHubDeveloperScoreDetails;
}
