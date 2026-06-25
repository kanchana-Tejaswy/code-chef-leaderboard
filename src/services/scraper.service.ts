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

    // 5. Problems Solved
    let problemsSolved = 0;
    const solvedHeader = $("h5:contains('Fully Solved')").first();
    if (solvedHeader.length > 0) {
      const match = solvedHeader.text().match(/\((\d+)\)/);
      if (match) {
        problemsSolved = parseInt(match[1], 10);
      }
    } else {
      const genericSolvedText = $("section.problems-solved").text() || $(".problems-solved").text() || "";
      const match = genericSolvedText.match(/Fully Solved\s*\((\d+)\)/i) || genericSolvedText.match(/Problems Solved\s*[:\-]?\s*(\d+)/i);
      if (match) {
        problemsSolved = parseInt(match[1], 10);
      } else {
        const totalSolvedSpan = $("h3:contains('Problems Solved')").first().text();
        const totalSolvedMatch = totalSolvedSpan.match(/:?\s*(\d+)/);
        if (totalSolvedMatch) {
          problemsSolved = parseInt(totalSolvedMatch[1], 10);
        }
      }
    }

    // 6. Contest Participation List
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
