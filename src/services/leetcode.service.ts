import { ScrapedData } from "../types/scraper";
import { prisma } from "../lib/prisma";

export class LeetcodeService {
  /**
   * Validates LeetCode username or URL.
   */
  static validate(input: string): { isValid: boolean; username: string; error?: string } {
    if (!input) {
      return { isValid: false, username: "", error: "Input username or URL cannot be empty." };
    }

    const trimmed = input.trim();
    
    // Check if input is a URL and extract the username
    if (trimmed.includes("leetcode.com/")) {
      const urlMatch = trimmed.match(/(?:leetcode\.com\/(?:u\/)?)([a-zA-Z0-9_\-]+)\/?/i);
      if (urlMatch && urlMatch[1]) {
        return { isValid: true, username: urlMatch[1] };
      }
      return { isValid: false, username: "", error: "Invalid LeetCode profile URL format." };
    }

    // Otherwise, validate as alphanumeric with underscore/hyphen username
    const usernameRegex = /^[a-zA-Z0-9_\-]{3,30}$/;
    if (!usernameRegex.test(trimmed)) {
      return { 
        isValid: false, 
        username: "", 
        error: "LeetCode username must be 3-30 characters long and contain only letters, numbers, underscores, or hyphens." 
      };
    }

    return { isValid: true, username: trimmed };
  }

  /**
   * Extracts the LeetCode username from a URL or raw handle.
   */
  static extractUsername(input: string): string {
    const validation = this.validate(input);
    return validation.isValid ? validation.username : "";
  }

  /**
   * Real-time GraphQL client fetching LeetCode profile details.
   */
  static async fetchData(input: string): Promise<ScrapedData> {
    const validation = this.validate(input);
    if (!validation.isValid) {
      console.error(`[LeetCode Scraper] Username validation failed: ${validation.error}`);
      throw new Error(validation.error || "Invalid LeetCode username or profile URL.");
    }
    const username = validation.username;

    const url = "https://leetcode.com/graphql";
    console.log(`[LeetCode Scraper] Querying LeetCode GraphQL API at: ${url}`);
    
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://leetcode.com"
    };

    // Define GraphQL Queries
    const profileQuery = `
      query userProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            realName
            userAvatar
            company
            school
            countryName
            reputation
            ranking
            aboutMe
          }
          badges {
            id
            displayName
            icon
          }
          submitStats {
            acSubmissionNum {
              difficulty
              count
              submissions
            }
            totalSubmissionNum {
              difficulty
              count
              submissions
            }
          }
        }
      }
    `;

    const calendarQuery = `
      query userCalendarQuery($username: String!) {
        matchedUser(username: $username) {
          userCalendar {
            activeYears
            streak
            totalActiveDays
            submissionCalendar
          }
        }
      }
    `;

    const tagsQuery = `
      query userTags($username: String!) {
        matchedUser(username: $username) {
          tagProblemCounts {
            advanced {
              tagName
              tagSlug
              problemsSolved
            }
            intermediate {
              tagName
              tagSlug
              problemsSolved
            }
            fundamental {
              tagName
              tagSlug
              problemsSolved
            }
          }
        }
      }
    `;

    const contestQuery = `
      query userContest($username: String!) {
        userContestRanking(username: $username) {
          attendedContestsCount
          rating
          globalRanking
          topPercentage
        }
        userContestRankingHistory(username: $username) {
          attended
          rating
          ranking
          problemsSolved
          finishTimeInSeconds
          contest {
            title
            startTime
          }
        }
      }
    `;

    const submissionsQuery = `
      query recentSubmissions($username: String!, $limit: Int) {
        recentSubmissionList(username: $username, limit: $limit) {
          title
          titleSlug
          timestamp
          statusDisplay
          lang
        }
      }
    `;

    let attempts = 3;
    let delayMs = 1000;
    let profileData: any = null;
    let calendarData: any = null;
    let tagsData: any = null;
    let contestData: any = null;
    let submissionsData: any = null;

    let attemptIndex = 0;
    // Retry Logic with Exponential Backoff
    while (attempts > 0) {
      attemptIndex++;
      try {
        console.log(`[LeetCode Scraper] Fetching LeetCode profile for ${username}. Attempt ${attemptIndex}/3`);
        
        const safeFetch = async (query: string, vars: any, fallback: any = {}) => {
          try {
            const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ query, variables: vars }), next: { revalidate: 0 } });
            if (!res.ok) return fallback;
            return await res.json();
          } catch (e) {
            console.error(`[LeetCode Scraper] Auxiliary query failed: ${e}`);
            return fallback;
          }
        };

        const profileRes = await fetch(url, { method: "POST", headers, body: JSON.stringify({ query: profileQuery, variables: { username } }), next: { revalidate: 0 } });
        
        console.log(`[LeetCode Scraper] Main profile query status: (${profileRes.status})`);

        if (!profileRes.ok) {
          if (profileRes.status === 404) {
            throw new Error(`User not found (404)`);
          }
          throw new Error(`Profile query failed with status: ${profileRes.statusText} (${profileRes.status})`);
        }

        profileData = await profileRes.json();
        
        // Fetch auxiliary data safely
        [calendarData, tagsData, contestData, submissionsData] = await Promise.all([
          safeFetch(calendarQuery, { username }),
          safeFetch(tagsQuery, { username }),
          safeFetch(contestQuery, { username }),
          safeFetch(submissionsQuery, { username, limit: 15 })
        ]);

        // Check if user exists on LeetCode
        if (!profileData?.data?.matchedUser) {
          throw new Error(`User not found (null matchedUser)`);
        }

        await prisma.fetchLog.create({
          data: {
            platform: "LEETCODE",
            username,
            status: "SUCCESS",
            retryCount: attemptIndex - 1
          }
        }).catch(err => console.error("Error creating fetch log:", err));

        break;
      } catch (err: any) {
        attempts--;

        await prisma.fetchLog.create({
          data: {
            platform: "LEETCODE",
            username,
            status: "FAILURE",
            error: err.message,
            retryCount: attemptIndex - 1
          }
        }).catch(e => console.error("Error creating fetch log:", e));

        if (err.message.includes("User not found")) {
          console.error(`[LeetCode Scraper] Profile for user '${username}' not found on LeetCode.`);
          throw new Error(`LeetCode profile for user '${username}' not found.`);
        }
        console.warn(`[LeetCode Scraper] Attempt failed: ${err.message}. ${attempts} attempts remaining.`);
        if (attempts === 0) {
          throw new Error(`LeetCode Scraper failed after 3 attempts. Error: ${err.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      }
    }

    console.log(`[LeetCode Scraper] Parsing responses and extracting metrics...`);

    const matchedUser = profileData.data.matchedUser;
    const userCalendar = calendarData.data?.matchedUser?.userCalendar || {};
    const tagProblemCounts = tagsData.data?.matchedUser?.tagProblemCounts || {};
    const userContestRanking = contestData.data?.userContestRanking;
    const contestHistoryRaw = contestData.data?.userContestRankingHistory || [];
    const recentSubmissions: any[] = [];

    // Profile Details
    const fullName = matchedUser.profile?.realName || null;
    const country = matchedUser.profile?.countryName || null;
    const institution = matchedUser.profile?.school || null;
    const city = matchedUser.profile?.company || null;

    // Problems Solved Stats
    const acSubmissionNum = matchedUser.submitStats?.acSubmissionNum || [];
    const totalSubmissionNum = matchedUser.submitStats?.totalSubmissionNum || [];

    const allSolved = acSubmissionNum.find((q: any) => q.difficulty === "All")?.count || 0;
    const easySolved = acSubmissionNum.find((q: any) => q.difficulty === "Easy")?.count || 0;
    const mediumSolved = acSubmissionNum.find((q: any) => q.difficulty === "Medium")?.count || 0;
    const hardSolved = acSubmissionNum.find((q: any) => q.difficulty === "Hard")?.count || 0;

    const allTotalSubs = totalSubmissionNum.find((q: any) => q.difficulty === "All")?.submissions || 1;
    const allAcSubs = acSubmissionNum.find((q: any) => q.difficulty === "All")?.submissions || 0;
    const acceptanceRate = Math.round((allAcSubs / allTotalSubs) * 100);

    // Heatmap Calendar
    const heatmap: Record<string, number> = {};
    if (userCalendar.submissionCalendar) {
      try {
        const calendarJson = JSON.parse(userCalendar.submissionCalendar);
        Object.keys(calendarJson).forEach((ts) => {
          const date = new Date(parseInt(ts, 10) * 1000);
          const dateStr = date.toISOString().split("T")[0];
          heatmap[dateStr] = calendarJson[ts];
        });
      } catch (e) {
        console.error("Failed to parse LeetCode submissionCalendar:", e);
      }
    }

    // Mon - Sun weekly counts
    const weeklyActivity = [0, 0, 0, 0, 0, 0, 0];
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    Object.keys(heatmap).forEach((dateStr) => {
      const dObj = new Date(dateStr);
      if (dObj.getTime() > oneMonthAgo) {
        const dayIndex = dObj.getDay();
        const mappedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        weeklyActivity[mappedIndex] += heatmap[dateStr];
      }
    });

    // Radar / Distribution (Tags solved)
    const advanced = tagProblemCounts.advanced || [];
    const intermediate = tagProblemCounts.intermediate || [];
    const fundamental = tagProblemCounts.fundamental || [];

    const skillRadar = [
      { subject: "Dynamic Programming", A: Math.min(100, (advanced.find((t: any) => t.tagSlug === "dynamic-programming")?.problemsSolved || 0) * 4) },
      { subject: "Arrays & Strings", A: Math.min(100, (fundamental.find((t: any) => t.tagSlug === "array")?.problemsSolved || 0) * 2) },
      { subject: "Trees & Graphs", A: Math.min(100, (intermediate.find((t: any) => t.tagSlug === "tree")?.problemsSolved || 0) * 3) },
      { subject: "Greedy Algorithms", A: Math.min(100, (intermediate.find((t: any) => t.tagSlug === "greedy")?.problemsSolved || 0) * 4) },
      { subject: "Math & Geometry", A: Math.min(100, (intermediate.find((t: any) => t.tagSlug === "math")?.problemsSolved || 0) * 4) },
      { subject: "Sorting & Search", A: Math.min(100, (fundamental.find((t: any) => t.tagSlug === "sorting")?.problemsSolved || 0) * 3) }
    ];

    const tagDistribution = [
      { name: "Dynamic Programming", value: advanced.find((t: any) => t.tagSlug === "dynamic-programming")?.problemsSolved || 0 },
      { name: "Arrays", value: fundamental.find((t: any) => t.tagSlug === "array")?.problemsSolved || 0 },
      { name: "Strings", value: fundamental.find((t: any) => t.tagSlug === "string")?.problemsSolved || 0 },
      { name: "Trees", value: intermediate.find((t: any) => t.tagSlug === "tree")?.problemsSolved || 0 },
      { name: "Math", value: intermediate.find((t: any) => t.tagSlug === "math")?.problemsSolved || 0 },
      { name: "Greedy", value: intermediate.find((t: any) => t.tagSlug === "greedy")?.problemsSolved || 0 }
    ].filter((t) => t.value > 0);

    // Contests History
    const attendedContests = contestHistoryRaw.filter((h: any) => h.attended);
    const ratingHistory = attendedContests.map((h: any) => ({
      contest: h.contest?.title || "Contest",
      rating: Math.round(h.rating)
    }));

    const contestHistory = attendedContests.map((h: any) => ({
      contest: h.contest?.title || "Contest",
      rank: h.ranking,
      rating: Math.round(h.rating),
      problemsSolved: h.problemsSolved || null,
      finishTimeInSeconds: h.finishTimeInSeconds || null
    }));

    const contestRating = userContestRanking?.rating ?? null;
    const contestGlobalRanking = userContestRanking?.globalRanking ?? null;
    const profileRanking = matchedUser.profile?.ranking ?? null;
    const countryRank = null;

    const consistencyScore = Math.min(100, Math.round((userCalendar.totalActiveDays || 0) * 1.5));
    const activeDaysCount = userCalendar.totalActiveDays || 0;
    const streak = userCalendar.streak || 0;

    // Badges details
    const badges = (matchedUser.badges || []).map((b: any) => ({
      id: b.id,
      name: b.displayName,
      icon: b.icon
    }));

    const difficultyDistribution = {
      easy: easySolved,
      medium: mediumSolved,
      hard: hardSolved,
      challenge: 0
    };

    const finalResult: ScrapedData = {
      platform: "LEETCODE",
      username,
      currentRating: contestRating !== null ? Math.round(contestRating) : null,
      highestRating: ratingHistory.length > 0 ? Math.round(Math.max(contestRating || 0, ...ratingHistory.map((r: any) => r.rating))) : (contestRating !== null ? Math.round(contestRating) : null),
      globalRank: contestGlobalRanking,
      countryRank,
      stars: contestRating !== null ? (contestRating >= 2200 ? 6 : contestRating >= 2000 ? 5 : contestRating >= 1800 ? 4 : contestRating >= 1600 ? 3 : 2) : null,
      problemsSolved: allSolved,
      contestCount: userContestRanking?.attendedContestsCount || 0,
      contests: [],
      fullName,
      country,
      institution,
      city,
      fullySolvedCount: allSolved,
      partiallySolvedCount: 0,
      easySolvedCount: easySolved,
      mediumSolvedCount: mediumSolved,
      hardSolvedCount: hardSolved,
      challengeSolvedCount: 0,
      activeDaysCount,
      ratingHistory,
      contestHistory,
      difficultyDistribution,
      activitySummary: heatmap,
      statisticDetails: {
        stars: contestRating !== null ? (contestRating >= 2200 ? 6 : contestRating >= 2000 ? 5 : contestRating >= 1800 ? 4 : contestRating >= 1600 ? 3 : 2) : null,
        currentRating: contestRating !== null ? Math.round(contestRating) : null,
        highestRating: ratingHistory.length > 0 ? Math.round(Math.max(contestRating || 0, ...ratingHistory.map((r: any) => r.rating))) : (contestRating !== null ? Math.round(contestRating) : null),
        problemsSolved: allSolved,
        easySolved,
        mediumSolved,
        hardSolved,
        acceptanceRate,
        streak,
        badges,
        recentSubmissions
      },
      rawMetrics: {
        easySolvedCount: easySolved,
        mediumSolvedCount: mediumSolved,
        hardSolvedCount: hardSolved,
        acceptanceRate,
        weeklyActivity,
        skillRadar,
        tagDistribution,
        consistencyScore,
        heatmap,
        ratingHistory: ratingHistory.slice(-10),
        contestHistory: contestHistory.slice(-8),
        recentSubmissions,
        badges,
        streak,
        profileRanking,
        contestsAttended: userContestRanking?.attendedContestsCount || 0
      }
    };

    console.log(`[LeetCode Scraper] Extraction and normalization finished. Returning final object for user ${username}:`, JSON.stringify(finalResult));
    return finalResult;
  }
}
