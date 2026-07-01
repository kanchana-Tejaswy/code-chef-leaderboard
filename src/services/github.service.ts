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
   * Automatically extracts the GitHub username from a URL or raw string.
   */
  static extractUsername(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    
    // e.g. https://github.com/tejaswy/ -> tejaswy
    // or github.com/tejaswy -> tejaswy
    // or just tejaswy -> tejaswy
    const cleaned = trimmed
      .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0];
      
    return cleaned;
  }

  /**
   * Queries real-time, authenticated data from GitHub APIs and processes metrics.
   */
  static async fetchData(input: string): Promise<any> {
    const username = this.extractUsername(input);
    if (!username) {
      throw new Error("Invalid GitHub username or profile URL.");
    }

    // Comprehensive GraphQL Query to get profile info, contributions, pinned items, and paginated repos
    const query = `
      query ($username: String!, $cursor: String, $prQuery: String!, $prMergedQuery: String!, $prOpenQuery: String!, $issueQuery: String!, $issueClosedQuery: String!) {
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
          repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, orderBy: {field: PUSHED_AT, direction: DESC}) {
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
              defaultBranchRef {
                name
                target {
                  ... on Commit {
                    history(first: 1) {
                      totalCount
                      nodes {
                        oid
                        message
                        committedDate
                        author {
                          name
                          email
                        }
                      }
                    }
                  }
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
        }
        pullRequestsCreated: search(query: $prQuery, type: ISSUE, first: 0) {
          issueCount
        }
        pullRequestsMerged: search(query: $prMergedQuery, type: ISSUE, first: 0) {
          issueCount
        }
        pullRequestsOpen: search(query: $prOpenQuery, type: ISSUE, first: 0) {
          issueCount
        }
        issuesCreated: search(query: $issueQuery, type: ISSUE, first: 0) {
          issueCount
        }
        issuesClosed: search(query: $issueClosedQuery, type: ISSUE, first: 0) {
          issueCount
        }
      }
    `;

    // Query template for fetching subsequent pages of repositories if hasNextPage is true
    const nextPageQuery = `
      query ($username: String!, $cursor: String) {
        user(login: $username) {
          repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, orderBy: {field: PUSHED_AT, direction: DESC}) {
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
              defaultBranchRef {
                name
                target {
                  ... on Commit {
                    history(first: 1) {
                      totalCount
                      nodes {
                        oid
                        message
                        committedDate
                        author {
                          name
                          email
                        }
                      }
                    }
                  }
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
      cursor: null as string | null,
      prQuery: `author:${username} type:pr`,
      prMergedQuery: `author:${username} type:pr is:merged`,
      prOpenQuery: `author:${username} type:pr is:open`,
      issueQuery: `author:${username} type:issue`,
      issueClosedQuery: `author:${username} type:issue is:closed`
    };

    let data: any = null;
    try {
      data = await queryGitHubGraphQL(query, variables);
    } catch (err: any) {
      console.error("GraphQL execution failed or user profile is invalid:", err.message);
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
        const nextPageData = await queryGitHubGraphQL(nextPageQuery, {
          username,
          cursor: endCursor
        });
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
          useCache: true,
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

    const prCreatedCount = data.pullRequestsCreated?.issueCount || 0;
    const prMergedCount = data.pullRequestsMerged?.issueCount || 0;
    const prOpenCount = data.pullRequestsOpen?.issueCount || 0;
    const issuesCreatedCount = data.issuesCreated?.issueCount || 0;
    const issuesClosedCount = data.issuesClosed?.issueCount || 0;

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

    return {
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
  }
}
