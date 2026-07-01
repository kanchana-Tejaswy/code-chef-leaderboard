import { ScrapedData } from "../types/scraper";

export class LeetcodeService {
  /**
   * Extracts the LeetCode username from a URL or raw handle.
   */
  static extractUsername(input: string): string {
    if (!input) return "";
    const trimmed = input.trim();
    const username = trimmed.replace(/.*leetcode\.com\/u\//i, "").split("/")[0].split("?")[0].split("#")[0];
    return username;
  }

  /**
   * Real-time GraphQL client fetching LeetCode profile details.
   */
  static async fetchData(input: string): Promise<ScrapedData> {
    const username = this.extractUsername(input);
    if (!username) {
      throw new Error("Invalid LeetCode username or profile URL.");
    }

    const url = "https://leetcode.com/graphql";
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };

    // Define GraphQL Queries
    const profileQuery = `
      query userProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile {
            reputation
            ranking
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
          contest {
            title
            startTime
          }
        }
      }
    `;

    // Execute queries in parallel
    const [profileRes, calendarRes, tagsRes, contestRes] = await Promise.all([
      fetch(url, { method: "POST", headers, body: JSON.stringify({ query: profileQuery, variables: { username } }) }),
      fetch(url, { method: "POST", headers, body: JSON.stringify({ query: calendarQuery, variables: { username } }) }),
      fetch(url, { method: "POST", headers, body: JSON.stringify({ query: tagsQuery, variables: { username } }) }),
      fetch(url, { method: "POST", headers, body: JSON.stringify({ query: contestQuery, variables: { username } }) })
    ]);

    if (!profileRes.ok) {
      throw new Error(`Failed to fetch LeetCode profile: ${profileRes.statusText}`);
    }
    
    const profileData = await profileRes.json();
    const calendarData = await calendarRes.json();
    const calendarJsonPayload = await calendarRes.clone().json().catch(() => ({}));
    const tagsData = await tagsRes.json();
    const contestData = await contestRes.json();

    const matchedUser = profileData.data?.matchedUser;
    if (!matchedUser) {
      throw new Error(`LeetCode profile for "${username}" not found.`);
    }

    const userCalendar = calendarData.data?.matchedUser?.userCalendar || {};
    const tagProblemCounts = tagsData.data?.matchedUser?.tagProblemCounts || {};
    const userContestRanking = contestData.data?.userContestRanking;
    const contestHistoryRaw = contestData.data?.userContestRankingHistory || [];

    // Calculate Problems Solved
    const acSubmissionNum = matchedUser.submitStats?.acSubmissionNum || [];
    const totalSubmissionNum = matchedUser.submitStats?.totalSubmissionNum || [];

    const allSolved = acSubmissionNum.find((q: any) => q.difficulty === "All")?.count || 0;
    const easySolved = acSubmissionNum.find((q: any) => q.difficulty === "Easy")?.count || 0;
    const mediumSolved = acSubmissionNum.find((q: any) => q.difficulty === "Medium")?.count || 0;
    const hardSolved = acSubmissionNum.find((q: any) => q.difficulty === "Hard")?.count || 0;

    const allTotalSubs = totalSubmissionNum.find((q: any) => q.difficulty === "All")?.submissions || 1;
    const allAcSubs = acSubmissionNum.find((q: any) => q.difficulty === "All")?.submissions || 0;
    const acceptanceRate = Math.round((allAcSubs / allTotalSubs) * 100);

    // Parse Heatmap calendar from submissionCalendar
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

    // Weekly Activity: Mon - Sun count
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

    // Skill Radar Proficiency Matrix
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

    // Tag distribution values
    const tagDistribution = [
      { name: "Dynamic Programming", value: advanced.find((t: any) => t.tagSlug === "dynamic-programming")?.problemsSolved || 0 },
      { name: "Arrays", value: fundamental.find((t: any) => t.tagSlug === "array")?.problemsSolved || 0 },
      { name: "Strings", value: fundamental.find((t: any) => t.tagSlug === "string")?.problemsSolved || 0 },
      { name: "Trees", value: intermediate.find((t: any) => t.tagSlug === "tree")?.problemsSolved || 0 },
      { name: "Math", value: intermediate.find((t: any) => t.tagSlug === "math")?.problemsSolved || 0 },
      { name: "Greedy", value: intermediate.find((t: any) => t.tagSlug === "greedy")?.problemsSolved || 0 }
    ].filter((t) => t.value > 0);

    // Contest history mappings
    const attendedContests = contestHistoryRaw.filter((h: any) => h.attended);
    const ratingHistory = attendedContests.slice(-10).map((h: any) => ({
      contest: h.contest?.title || "Contest",
      rating: Math.round(h.rating)
    }));

    const contestHistory = attendedContests.slice(-8).map((h: any) => ({
      contest: h.contest?.title || "Contest",
      rank: h.ranking,
      rating: Math.round(h.rating)
    }));

    const contestRating = userContestRanking?.rating || 0;
    const globalRank = userContestRanking?.globalRanking || null;
    const countryRank = null;

    const consistencyScore = Math.min(100, Math.round((userCalendar.totalActiveDays || 0) * 1.5));

    return {
      platform: "LEETCODE",
      username,
      currentRating: Math.round(contestRating),
      highestRating: Math.round(Math.max(contestRating, ...ratingHistory.map((r: any) => r.rating))),
      globalRank,
      countryRank,
      stars: contestRating >= 2200 ? 6 : contestRating >= 2000 ? 5 : contestRating >= 1800 ? 4 : contestRating >= 1600 ? 3 : 2,
      problemsSolved: allSolved,
      contestCount: userContestRanking?.attendedContestsCount || 0,
      contests: [],
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
        ratingHistory,
        contestHistory
      }
    };
  }
}
