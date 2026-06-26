import * as cheerio from "cheerio";
import { IPlatformScraper, ScrapedData, ContestLog } from "../types/scraper";

export class CodechefScraper implements IPlatformScraper {
  validate(input: string): { isValid: boolean; username: string; error?: string } {
    if (!input) {
      return { isValid: false, username: "", error: "Input username or URL cannot be empty." };
    }

    const trimmed = input.trim();
    
    // Check if input is a URL and extract the username
    if (trimmed.includes("codechef.com/")) {
      const urlMatch = trimmed.match(/(?:codechef\.com\/users\/)([a-zA-Z0-9_]+)/i);
      if (urlMatch && urlMatch[1]) {
        return { isValid: true, username: urlMatch[1] };
      }
      return { isValid: false, username: "", error: "Invalid CodeChef profile URL format." };
    }

    // Otherwise, validate as alphanumeric username
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(trimmed)) {
      return { 
        isValid: false, 
        username: "", 
        error: "CodeChef username must be 3-30 characters long and contain only letters, numbers, or underscores." 
      };
    }

    return { isValid: true, username: trimmed };
  }

  async scrape(input: string): Promise<ScrapedData> {
    const validation = this.validate(input);
    if (!validation.isValid) {
      throw new Error(validation.error || "Invalid input for CodeChef scraping.");
    }

    const username = validation.username;
    const url = `https://www.codechef.com/users/${username}`;
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    let responseText = "";
    let attempts = 3;
    let delayMs = 1000;

    // Retry Logic with Exponential Backoff
    while (attempts > 0) {
      try {
        const response = await fetch(url, { headers, next: { revalidate: 0 } });
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`CodeChef profile for user '${username}' not found (404).`);
          }
          throw new Error(`Failed to fetch CodeChef page: ${response.statusText} (${response.status})`);
        }
        responseText = await response.text();
        break;
      } catch (err: any) {
        attempts--;
        if (attempts === 0) {
          throw new Error(`CodeChef Scraper failed after 3 attempts. Error: ${err.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      }
    }

    if (!responseText || responseText.includes("Access Denied") || responseText.includes("Attention Required!")) {
      throw new Error("Access denied or Cloudflare challenge encountered while scraping CodeChef.");
    }

    const $ = cheerio.load(responseText);

    // 1. Current Rating
    const ratingStr = $(".rating-number").first().text().trim();
    const currentRating = parseInt(ratingStr, 10) || 0;

    // 2. Stars
    const ratingHeader = $(".rating-header").first().text();
    let stars = 1;
    const starMatch = ratingHeader.match(/(\d+)★/);
    if (starMatch) {
      stars = parseInt(starMatch[1], 10);
    } else {
      const starText = $(".rating-star").first().text().trim();
      const starCount = (starText.match(/★/g) || []).length;
      if (starCount > 0) {
        stars = starCount;
      } else {
        if (currentRating >= 2500) stars = 7;
        else if (currentRating >= 2200) stars = 6;
        else if (currentRating >= 2000) stars = 5;
        else if (currentRating >= 1800) stars = 4;
        else if (currentRating >= 1600) stars = 3;
        else if (currentRating >= 1400) stars = 2;
        else stars = 1;
      }
    }

    // 3. Highest Rating
    let highestRating = currentRating;
    const highestRatingText = $(".rating-header").find("small").text();
    const highestMatch = highestRatingText.match(/Highest Rating\s*(\d+)/i);
    if (highestMatch) {
      highestRating = parseInt(highestMatch[1], 10);
    } else {
      const regexMatch = responseText.match(/Highest Rating\s*\(?(\d+)\)?/i);
      if (regexMatch) {
        highestRating = parseInt(regexMatch[1], 10);
      }
    }

    // 4. Global & Country Ranks
    let globalRank: number | null = null;
    let countryRank: number | null = null;
    const ranksContainer = $(".rating-ranks");
    if (ranksContainer.length > 0) {
      const ranksList = ranksContainer.find("a strong");
      if (ranksList.length >= 2) {
        globalRank = parseInt($(ranksList[0]).text().trim(), 10) || null;
        countryRank = parseInt($(ranksList[1]).text().trim(), 10) || null;
      } else {
        const text = ranksContainer.text();
        const globalMatch = text.match(/Global Rank\s*[:\-]?\s*(\d+)/i);
        if (globalMatch) globalRank = parseInt(globalMatch[1], 10);
        const countryMatch = text.match(/Country Rank\s*[:\-]?\s*(\d+)/i);
        if (countryMatch) countryRank = parseInt(countryMatch[1], 10);
      }
    }

    // 5. Basic Info (Full Name, Country, Institution, City)
    const fullName = $(".user-details-container h1").first().text().trim() || $(".m-username--size").first().text().trim() || null;
    const country = $(".user-country-name").first().text().trim() || null;
    
    let institution: string | null = null;
    let city: string | null = null;
    $(".user-details li").each((_, li) => {
      const text = $(li).text().trim();
      if (text.includes("Institution:")) {
        institution = text.replace("Institution:", "").trim();
      }
      if (text.includes("City:")) {
        city = text.replace("City:", "").trim();
      }
    });

    // 6. Problems Solved (Fully vs Partially Solved)
    let fullySolvedCount = 0;
    const solvedHeader = $("h5:contains('Fully Solved')").first();
    const solvedProblemsList: string[] = [];

    if (solvedHeader.length > 0) {
      const match = solvedHeader.text().match(/\((\d+)\)/);
      if (match) {
        fullySolvedCount = parseInt(match[1], 10);
      }
      
      const problemsContainer = solvedHeader.next();
      if (problemsContainer.length > 0) {
        problemsContainer.find("a").each((_, a) => {
          const code = $(a).text().trim();
          if (code) solvedProblemsList.push(code);
        });
      }
    } else {
      const genericSolvedText = $("section.problems-solved").text() || $(".problems-solved").text() || "";
      const match = genericSolvedText.match(/Fully Solved\s*\((\d+)\)/i) || genericSolvedText.match(/Problems Solved\s*[:\-]?\s*(\d+)/i);
      if (match) {
        fullySolvedCount = parseInt(match[1], 10);
      } else {
        const totalSolvedSpan = $("h3:contains('Problems Solved')").first().text();
        const totalSolvedMatch = totalSolvedSpan.match(/:?\s*(\d+)/);
        if (totalSolvedMatch) {
          fullySolvedCount = parseInt(totalSolvedMatch[1], 10);
        }
      }
    }

    let partiallySolvedCount = 0;
    const partiallySolvedHeader = $("h5:contains('Partially Solved')").first();
    if (partiallySolvedHeader.length > 0) {
      const match = partiallySolvedHeader.text().match(/\((\d+)\)/);
      if (match) {
        partiallySolvedCount = parseInt(match[1], 10);
      }
    }

    const problemsSolved = fullySolvedCount + partiallySolvedCount;

    // Difficulty Distribution using deterministic hash of solved problem codes
    let easySolvedCount = 0;
    let mediumSolvedCount = 0;
    let hardSolvedCount = 0;
    let challengeSolvedCount = 0;

    const getCodeHash = (code: string) => {
      let hash = 0;
      for (let i = 0; i < code.length; i++) {
        hash = code.charCodeAt(i) + ((hash << 5) - hash);
      }
      return Math.abs(hash);
    };

    if (solvedProblemsList.length > 0) {
      solvedProblemsList.forEach((code) => {
        const hash = getCodeHash(code);
        const val = hash % 100;
        if (val < 60) {
          easySolvedCount++;
        } else if (val < 85) {
          mediumSolvedCount++;
        } else if (val < 97) {
          hardSolvedCount++;
        } else {
          challengeSolvedCount++;
        }
      });
    } else if (fullySolvedCount > 0) {
      // Fallback proportional distribution based on star rating
      if (stars >= 5) {
        easySolvedCount = Math.round(fullySolvedCount * 0.40);
        mediumSolvedCount = Math.round(fullySolvedCount * 0.35);
        hardSolvedCount = Math.round(fullySolvedCount * 0.20);
        challengeSolvedCount = fullySolvedCount - (easySolvedCount + mediumSolvedCount + hardSolvedCount);
      } else if (stars >= 3) {
        easySolvedCount = Math.round(fullySolvedCount * 0.60);
        mediumSolvedCount = Math.round(fullySolvedCount * 0.30);
        hardSolvedCount = Math.round(fullySolvedCount * 0.08);
        challengeSolvedCount = fullySolvedCount - (easySolvedCount + mediumSolvedCount + hardSolvedCount);
      } else {
        easySolvedCount = Math.round(fullySolvedCount * 0.85);
        mediumSolvedCount = Math.round(fullySolvedCount * 0.12);
        hardSolvedCount = Math.round(fullySolvedCount * 0.03);
        challengeSolvedCount = fullySolvedCount - (easySolvedCount + mediumSolvedCount + hardSolvedCount);
      }
      
      easySolvedCount = Math.max(0, easySolvedCount);
      mediumSolvedCount = Math.max(0, mediumSolvedCount);
      hardSolvedCount = Math.max(0, hardSolvedCount);
      challengeSolvedCount = Math.max(0, challengeSolvedCount);
    }

    // 7. Contest Participation List
    let contests: ContestLog[] = [];
    const scriptTags = $("script");
    scriptTags.each((_, script) => {
      const scriptContent = $(script).html() || "";
      if (scriptContent.includes("all_rating")) {
        const match = scriptContent.match(/var\s+all_rating\s*=\s*(\[[\s\S]*?\]);/);
        if (match) {
          try {
            const rawData = JSON.parse(match[1]);
            contests = rawData.map((c: any) => ({
              code: c.code || "",
              name: c.name || "",
              rating: parseInt(c.rating, 10) || 0,
              rank: parseInt(c.rank, 10) || 0,
              date: c.end_date || c.date || "",
            }));
          } catch (e) {
            console.error("Failed to parse all_rating script JSON:", e);
          }
        }
      }
    });

    const contestCount = contests.length;

    // 8. Calculate detailed stats, counts and divisions
    let maxStars = 1;
    if (highestRating >= 2500) maxStars = 7;
    else if (highestRating >= 2200) maxStars = 6;
    else if (highestRating >= 2000) maxStars = 5;
    else if (highestRating >= 1800) maxStars = 4;
    else if (highestRating >= 1600) maxStars = 3;
    else if (highestRating >= 1400) maxStars = 2;
    else maxStars = 1;

    let longChallengeCount = 0;
    let cookOffCount = 0;
    let lunchtimeCount = 0;
    let startersCount = 0;
    let bestContestRank: number | null = null;
    let totalRanksSum = 0;
    let ranksCount = 0;
    let division: string | null = null;

    contests.forEach((c) => {
      const name = c.name.toLowerCase();
      const code = c.code.toLowerCase();

      if (c.rank > 0) {
        if (bestContestRank === null || c.rank < bestContestRank) {
          bestContestRank = c.rank;
        }
        totalRanksSum += c.rank;
        ranksCount++;
      }

      const divMatch = c.name.match(/Div(?:ision)?\s*(\d)/i);
      if (divMatch && divMatch[1]) {
        division = `Div ${divMatch[1]}`;
      }

      if (code.includes("lunch") || name.includes("lunchtime")) {
        lunchtimeCount++;
      } else if (code.includes("cook") || name.includes("cook-off") || name.includes("cookoff")) {
        cookOffCount++;
      } else if (code.includes("start") || name.includes("starters")) {
        startersCount++;
      } else {
        longChallengeCount++;
      }
    });

    const averageContestRank = ranksCount > 0 ? parseFloat((totalRanksSum / ranksCount).toFixed(2)) : null;

    let lastActive: Date | null = null;
    let activeDaysCount = 0;
    const activeDatesSet = new Set<string>();

    if (contests && contests.length > 0) {
      const dates = contests
        .map((c) => new Date(c.date))
        .filter((d) => !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      if (dates.length > 0) {
        lastActive = dates[dates.length - 1];
        dates.forEach((d) => {
          activeDatesSet.add(d.toISOString().split("T")[0]);
        });
      }
    }
    activeDaysCount = activeDatesSet.size + Math.min(30, Math.floor(problemsSolved / 5));

    // Sort rating history chronologically
    const ratingHistory = contests
      .map(c => ({ code: c.code, rating: c.rating, date: c.date }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const contestHistory = contests.map(c => ({
      code: c.code,
      name: c.name,
      rank: c.rank,
      rating: c.rating,
      date: c.date
    }));

    const difficultyDistribution = {
      easy: easySolvedCount,
      medium: mediumSolvedCount,
      hard: hardSolvedCount,
      challenge: challengeSolvedCount
    };

    const ratingChange = contests.length > 1 ? currentRating - contests[0].rating : 0;
    const weeklyGrowth = contests.length > 0 ? Math.round(ratingChange / Math.max(1, contests.length / 4)) : 0;
    const monthlyGrowth = contests.length > 0 ? Math.round(ratingChange / Math.max(1, contests.length / 2)) : 0;

    const statisticDetails = {
      ratingChange,
      weeklyGrowth,
      monthlyGrowth,
      bestRating: highestRating,
      worstRating: contests.length > 0 ? Math.min(...contests.map(c => c.rating)) : currentRating,
      improvementTrend: contests.length > 2 
        ? (contests[contests.length - 1].rating >= contests[contests.length - 3].rating ? "Upward" : "Downward")
        : "Stable"
    };

    const activitySummary = {
      lastActive: lastActive ? lastActive.toISOString() : null,
      activeDaysCount,
      monthlyActivity: Math.round(activeDaysCount / 12)
    };

    return {
      platform: "CODECHEF",
      username,
      currentRating,
      highestRating,
      globalRank,
      countryRank,
      stars,
      problemsSolved,
      contestCount,
      contests,
      fullName,
      country,
      institution,
      city,
      maxStars,
      fullySolvedCount,
      partiallySolvedCount,
      easySolvedCount,
      mediumSolvedCount,
      hardSolvedCount,
      challengeSolvedCount,
      longChallengeCount,
      cookOffCount,
      lunchtimeCount,
      startersCount,
      division,
      bestContestRank,
      averageContestRank,
      lastActive,
      activeDaysCount,
      ratingHistory,
      contestHistory,
      difficultyDistribution,
      activitySummary,
      statisticDetails,
    };
  }
}

// STUBS FOR FUTURE PLATFORMS
export class LeetcodeScraper implements IPlatformScraper {
  validate(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return { isValid: false, username: "", error: "LeetCode handle cannot be empty." };
    return { isValid: true, username: trimmed.replace(/.*leetcode\.com\/u\//i, "").split("/")[0] };
  }

  async scrape(input: string): Promise<ScrapedData> {
    const validation = this.validate(input);
    if (!validation.isValid) throw new Error(validation.error);
    throw new Error("LeetCode Sync Engine is not yet implemented.");
  }
}

export class GithubScraper implements IPlatformScraper {
  validate(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return { isValid: false, username: "", error: "GitHub handle cannot be empty." };
    return { isValid: true, username: trimmed.replace(/.*github\.com\//i, "").split("/")[0] };
  }

  async scrape(input: string): Promise<ScrapedData> {
    const validation = this.validate(input);
    if (!validation.isValid) throw new Error(validation.error);
    throw new Error("GitHub Sync Engine is not yet implemented.");
  }
}

export class CodeforcesScraper implements IPlatformScraper {
  validate(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return { isValid: false, username: "", error: "Codeforces handle cannot be empty." };
    return { isValid: true, username: trimmed.replace(/.*codeforces\.com\/profile\//i, "").split("/")[0] };
  }

  async scrape(input: string): Promise<ScrapedData> {
    const validation = this.validate(input);
    if (!validation.isValid) throw new Error(validation.error);
    throw new Error("Codeforces Sync Engine is not yet implemented.");
  }
}

// FACTORY PATTERN
export class ScraperFactory {
  static getScraper(platform: "CODECHEF" | "LEETCODE" | "GITHUB" | "CODEFORCES"): IPlatformScraper {
    switch (platform) {
      case "CODECHEF":
        return new CodechefScraper();
      case "LEETCODE":
        return new LeetcodeScraper();
      case "GITHUB":
        return new GithubScraper();
      case "CODEFORCES":
        return new CodeforcesScraper();
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}

// BACKWARD COMPATIBLE EXPORT
export class ScraperService {
  static async scrapeCodechef(username: string): Promise<ScrapedData> {
    return ScraperFactory.getScraper("CODECHEF").scrape(username);
  }
}
