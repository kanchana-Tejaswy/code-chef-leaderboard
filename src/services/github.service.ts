import { queryGitHubGraphQL, queryGitHubREST } from "../lib/github";
import { GithubAnalyticsService } from "./githubAnalytics";

// Helper function to process requests with a concurrency limit
async function pool<T, R>(items: T[], fn: (item: T) => Promise<R>, maxConcurrency: number = 8): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<any>[] = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p as any);
    if (maxConcurrency < items.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

export class GithubService {
  /**
   * Validates GitHub profile username or URL.
   */
  static validate(input: string): { isValid: boolean; username: string; error?: string } {
    if (!input) {
      return { isValid: false, username: "", error: "Input username or URL cannot be empty." };
    }

    const trimmed = input.trim();
    
    // Check if input is a URL and extract the username
    if (trimmed.includes("github.com/")) {
      const urlMatch = trimmed.match(/(?:github\.com\/)([a-zA-Z0-9_\-]+)/i);
      if (urlMatch && urlMatch[1]) {
        return { isValid: true, username: urlMatch[1] };
      }
      return { isValid: false, username: "", error: "Invalid GitHub profile URL format." };
    }

    // Otherwise, validate as alphanumeric with hyphens (max 39 chars per GitHub rules)
    const usernameRegex = /^[a-zA-Z0-9\-]{1,39}$/;
    if (!usernameRegex.test(trimmed)) {
      return { 
        isValid: false, 
        username: "", 
        error: "GitHub username must be 1-39 characters long and contain only letters, numbers, or hyphens." 
      };
    }

    return { isValid: true, username: trimmed };
  }

  /**
   * Automatically extracts the GitHub username from a URL or raw string.
   */
  static extractUsername(input: string): string {
    const validation = this.validate(input);
    return validation.isValid ? validation.username : "";
  }

  /**
   * Queries real-time, authenticated data from GitHub APIs and processes metrics.
   */
  static async fetchData(input: string, useCache: boolean = false): Promise<any> {
    const validation = this.validate(input);
    if (!validation.isValid) {
      console.error(`[GitHub Scraper] Username validation failed: ${validation.error}`);
      throw new Error(validation.error || "Invalid GitHub username or profile URL.");
    }
    const username = validation.username;
    console.log(`[GitHub Scraper] Starting fetch for user: ${username}, useCache: ${useCache}`);

    // Comprehensive GraphQL Query to get profile info, contributions, pinned items, and paginated repos
    const query = `
      query ($username: String!, $cursor: String) {
        user(login: $username) {
          login
          name
          bio
          avatarUrl
          company
          location
          websiteUrl
          twitterUsername
          email
          createdAt
          updatedAt
          isHireable
          followers {
            totalCount
          }
          following {
            totalCount
          }
          gists {
            totalCount
          }
          publicRepositories: repositories(privacy: PUBLIC) {
            totalCount
          }
          organizations(first: 10) {
            totalCount
            nodes {
              name
              login
            }
          }
          pinnedItems(first: 6, types: REPOSITORY) {
            nodes {
              ... on Repository {
                name
                description
                url
                stargazerCount
                forkCount
                primaryLanguage {
                  name
                  color
                }
              }
            }
          }
          repositories(first: 30, after: $cursor, ownerAffiliations: OWNER, orderBy: {field: PUSHED_AT, direction: DESC}) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              name
              description
              url
              stargazerCount
              forkCount
              isFork
              isArchived
              diskUsage
              visibility
              createdAt
              updatedAt
              pushedAt
              homepageUrl
              watchers {
                totalCount
              }
              primaryLanguage {
                name
                color
              }
              languages(first: 10) {
                edges {
                  size
                  node {
                    name
                    color
                  }
                }
              }
              repositoryTopics(first: 10) {
                nodes {
                  topic {
                    name
                  }
                }
              }
              licenseInfo {
                name
                key
              }
              openIssues: issues(states: OPEN) {
                totalCount
              }
              readme: object(expression: "HEAD:README.md") {
                ... on Blob {
                  byteSize
                }
              }
              readmeLowercase: object(expression: "HEAD:readme.md") {
                ... on Blob {
                  byteSize
                }
              }
              readmeTxt: object(expression: "HEAD:README.txt") {
                ... on Blob {
                  byteSize
                }
              }
              readmeUpper: object(expression: "HEAD:README") {
                ... on Blob {
                  byteSize
                }
              }
              branches: refs(first: 0, refPrefix: "refs/heads/") {
                totalCount
              }
              releases(first: 0) {
                totalCount
              }
              tags: refs(first: 0, refPrefix: "refs/tags/") {
                totalCount
              }
            }
          }
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                  color
                }
              }
            }
          }
          pullRequests(states: [MERGED]) {
            totalCount
          }
          pullRequestsOpen: pullRequests(states: [OPEN]) {
            totalCount
          }
          pullRequestsAll: pullRequests {
            totalCount
          }
          issuesClosed: issues(states: [CLOSED]) {
            totalCount
          }
          issuesAll: issues {
            totalCount
          }
        }
      }
    `;

    // Query template for fetching subsequent pages of repositories if hasNextPage is true
    const nextPageQuery = `
      query ($username: String!, $cursor: String) {
        user(login: $username) {
          repositories(first: 30, after: $cursor, ownerAffiliations: OWNER, orderBy: {field: PUSHED_AT, direction: DESC}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              name
              description
              url
              stargazerCount
              forkCount
              isFork
              isArchived
              diskUsage
              visibility
              createdAt
              updatedAt
              pushedAt
              homepageUrl
              watchers {
                totalCount
              }
              primaryLanguage {
                name
                color
              }
              languages(first: 10) {
                edges {
                  size
                  node {
                    name
                    color
                  }
                }
              }
              repositoryTopics(first: 10) {
                nodes {
                  topic {
                    name
                  }
                }
              }
              licenseInfo {
                name
                key
              }
              openIssues: issues(states: OPEN) {
                totalCount
              }
              readme: object(expression: "HEAD:README.md") {
                ... on Blob {
                  byteSize
                }
              }
              readmeLowercase: object(expression: "HEAD:readme.md") {
                ... on Blob {
                  byteSize
                }
              }
              readmeTxt: object(expression: "HEAD:README.txt") {
                ... on Blob {
                  byteSize
                }
              }
              readmeUpper: object(expression: "HEAD:README") {
                ... on Blob {
                  byteSize
                }
              }
              branches: refs(first: 0, refPrefix: "refs/heads/") {
                totalCount
              }
              releases(first: 0) {
                totalCount
              }
              tags: refs(first: 0, refPrefix: "refs/tags/") {
                totalCount
              }
            }
          }
        }
      }
    `;

    const variables = {
      username,
      cursor: null as string | null
    };

    let data: any = null;
    try {
      console.log(`[GitHub Scraper] Fetching main profile info from GraphQL...`);
      data = await queryGitHubGraphQL(query, variables, { useCache });
    } catch (err: any) {
      console.error(`[GitHub Scraper] GraphQL execution failed for user "${username}":`, err.message);
      if (err.message?.includes("was not found")) {
        throw new Error(`GitHub profile for user '${username}' not found.`);
      }
      throw new Error(`GitHub profile for user "${username}" does not exist or is invalid.`);
    }

    const user = data?.user;
    if (!user) {
      throw new Error(`GitHub user "${username}" was not found.`);
    }

    let allReposNodes = user.repositories?.nodes || [];
    let hasNextPage = user.repositories?.pageInfo?.hasNextPage || false;
    let endCursor = user.repositories?.pageInfo?.endCursor || null;

    // Loop to fetch remaining repositories if any (paginating in chunks of 100)
    while (hasNextPage && endCursor) {
      try {
        console.log(`[GitHub Scraper] Fetching subsequent repository page...`);
        const nextPageData = await queryGitHubGraphQL(nextPageQuery, {
          username,
          cursor: endCursor
        }, { useCache });
        const nextPageUser = nextPageData?.user;
        const nodes = nextPageUser?.repositories?.nodes || [];
        allReposNodes = [...allReposNodes, ...nodes];
        hasNextPage = nextPageUser?.repositories?.pageInfo?.hasNextPage || false;
        endCursor = nextPageUser?.repositories?.pageInfo?.endCursor || null;
      } catch (err: any) {
        console.warn("Failed to fetch next page of repositories, stopping pagination:", err.message);
        break;
      }
    }

    // Parallel fetch contributors list for every repository with concurrency pool of 6
    const reposList = await pool(allReposNodes, async (r: any) => {
      let contributors: string[] = [];
      try {
        const contribRes = await queryGitHubREST(`/repos/${username}/${r.name}/contributors?per_page=15`, {
          useCache,
          maxRetries: 2,
          timeoutMs: 8000
        });
        if (Array.isArray(contribRes)) {
          contributors = contribRes.map((c: any) => c.login);
        }
      } catch (err: any) {
        // Degrade gracefully if contributors fetch fails (e.g. empty repo)
        console.warn(`Could not fetch contributors for repository ${r.name}:`, err.message);
      }

      const readmeSize = r.readme?.byteSize || r.readmeLowercase?.byteSize || r.readmeTxt?.byteSize || r.readmeUpper?.byteSize || 0;
      
      const lastCommitNode = r.defaultBranchRef?.target?.history?.nodes?.[0];
      const latestCommit = lastCommitNode ? {
        sha: lastCommitNode.oid ? lastCommitNode.oid.substring(0, 7) : "Not available from platform.",
        message: lastCommitNode.message || "Not available from platform.",
        date: lastCommitNode.committedDate ? new Date(lastCommitNode.committedDate).toISOString() : "Not available from platform.",
        author: lastCommitNode.author?.name || "Not available from platform."
      } : {
        sha: "Not available from platform.",
        message: "Not available from platform.",
        date: "Not available from platform.",
        author: "Not available from platform."
      };

      const languagesMap = (r.languages?.edges || []).map((edge: any) => ({
        name: edge.node.name,
        bytes: edge.size || 0,
        color: edge.node.color || "#8B5CF6"
      }));

      return {
        name: r.name,
        description: r.description || "No description provided.",
        url: r.url,
        stars: r.stargazerCount || 0,
        forks: r.forkCount || 0,
        language: r.primaryLanguage?.name || "Markdown",
        languages: languagesMap,
        commits: r.defaultBranchRef?.target?.history?.totalCount || 0,
        lastUpdated: r.pushedAt ? new Date(r.pushedAt).toISOString() : new Date(r.updatedAt).toISOString(),
        watchers: r.watchers?.totalCount || 0,
        openIssues: r.openIssues?.totalCount || 0,
        license: r.licenseInfo?.name || "Not available from platform.",
        topics: (r.repositoryTopics?.nodes || []).map((n: any) => n.topic.name),
        visibility: r.visibility?.toLowerCase() || "public",
        size: r.diskUsage || 0,
        createdDate: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        defaultBranch: r.defaultBranchRef?.name || "main",
        isArchived: r.isArchived || false,
        homepage: r.homepageUrl || "Not available from platform.",
        latestCommit,
        commitCount: r.defaultBranchRef?.target?.history?.totalCount || 0,
        contributors,
        branchesCount: r.branches?.totalCount || 0,
        releasesCount: r.releases?.totalCount || 0,
        tagsCount: r.tags?.totalCount || 0,
        readmeSize
      };
    }, 6);

    const prCreatedCount = user.pullRequestsAll?.totalCount || 0;
    const prMergedCount = user.pullRequests?.totalCount || 0;
    const prOpenCount = user.pullRequestsOpen?.totalCount || 0;
    const issuesCreatedCount = user.issuesAll?.totalCount || 0;
    const issuesClosedCount = user.issuesClosed?.totalCount || 0;

    // Run dynamic application calculations
    const analytics = GithubAnalyticsService.computeAnalytics(
      user,
      reposList,
      prCreatedCount,
      prMergedCount,
      prOpenCount,
      issuesCreatedCount,
      issuesClosedCount
    );

    const rating = analytics.developerScore.score;

    const finalResult = {
      platform: "GITHUB",
      username,
      currentRating: rating,
      highestRating: rating,
      globalRank: null,
      countryRank: null,
      stars: rating >= 80 ? 5 : rating >= 60 ? 4 : rating >= 40 ? 3 : 2,
      problemsSolved: analytics.totalRepositories,
      contestCount: analytics.totalStars,
      contests: [],
      fullName: user.name || null,
      country: user.location || null,
      institution: user.company || null,
      city: user.location || null,
      fullySolvedCount: analytics.totalRepositories,
      partiallySolvedCount: 0,
      easySolvedCount: analytics.portfolio?.web || 0,
      mediumSolvedCount: analytics.portfolio?.fullStack || 0,
      hardSolvedCount: analytics.portfolio?.ai || 0,
      challengeSolvedCount: analytics.portfolio?.mobile || 0,
      activeDaysCount: analytics.streaks?.activeDays || 0,
      ratingHistory: analytics.commitTimeline || [],
      contestHistory: [],
      difficultyDistribution: {
        easy: analytics.portfolio?.web || 0,
        medium: analytics.portfolio?.fullStack || 0,
        hard: analytics.portfolio?.ai || 0,
        challenge: analytics.portfolio?.mobile || 0
      },
      activitySummary: analytics.contributions || {},
      statisticDetails: {
        stars: rating >= 80 ? 5 : rating >= 60 ? 4 : rating >= 40 ? 3 : 2,
        currentRating: rating,
        highestRating: rating,
        problemsSolved: analytics.totalRepositories,
        totalStars: analytics.totalStars,
        totalForks: analytics.totalForks,
        followers: analytics.followers,
        pullRequests: analytics.openSource?.pullRequests || 0,
        issuesCreated: analytics.openSource?.issuesCreated || 0,
        contributionsCount: analytics.streaks?.activeDays || 0
      },
      rawMetrics: {
        totalRepositories: analytics.totalRepositories,
        totalStars: analytics.totalStars,
        totalForks: analytics.totalForks,
        followers: analytics.followers,
        openSourceScore: analytics.openSourceScore,
        contributions: analytics.contributions,
        languages: analytics.languages,
        repos: analytics.repos,
        commitTimeline: analytics.commitTimeline,
        repoQualityScore: analytics.repoQualityScore,
        streaks: analytics.streaks,
        commitAnalytics: analytics.commitAnalytics,
        openSource: analytics.openSource,
        portfolio: analytics.portfolio,
        careerInsights: analytics.careerInsights,
        profileDetails: analytics.profileDetails,
        developerScore: analytics.developerScore
      },
      aiAnalysis: {
        talentScore: rating,
        consistencyScore: analytics.developerScore.consistency,
        problemSolvingScore: rating,
        competitiveProgrammingScore: rating,
        contestScore: analytics.developerScore.codingActivity,
        learningScore: analytics.developerScore.documentation,
        growthScore: rating,
        disciplineScore: analytics.developerScore.consistency,
        overallPotential: analytics.careerInsights.hiringReadiness === "Immediate Tier-1 Ready" ? "Elite Developer Portfolio" : "Capable Software Builder",
        placementReadiness: analytics.careerInsights.hiringReadiness,
        expectedRating6Months: rating + 10,
        strengths: analytics.careerInsights.strongestSkills.map((s: string) => `${s} Specialist`),
        weaknesses: analytics.careerInsights.weaknesses,
        improvementAreas: analytics.careerInsights.weaknesses,
        careerRecommendation: analytics.portfolio.ai > 1 ? "Machine Learning Specialist" : analytics.portfolio.mobile > 1 ? "Mobile Developer" : "Full Stack Developer",
        suggestedCompanies: rating >= 75 ? ["Google", "Atlassian", "GitHub"] : ["TCS Digital", "Cognizant"],
        recommendedLearningPath: analytics.careerInsights.recommendedLearningPath
      }
    };

    console.log(`[GitHub Scraper] Extraction and normalization finished. Returning final object for user ${username}:`, JSON.stringify(finalResult));
    return finalResult;
  }
}
