import { IPlatformScraper, ScrapedData } from "../types/scraper";
import { CodechefService } from "./codechef.service";
import { LeetcodeService } from "./leetcode.service";

export class CodechefScraper implements IPlatformScraper {
  validate(input: string): { isValid: boolean; username: string; error?: string } {
    return CodechefService.validate(input);
  }

  async scrape(input: string): Promise<ScrapedData> {
    return CodechefService.fetchData(input);
  }
}

export class LeetcodeScraper implements IPlatformScraper {
  validate(input: string): { isValid: boolean; username: string; error?: string } {
    return LeetcodeService.validate(input);
  }

  async scrape(input: string): Promise<ScrapedData> {
    return LeetcodeService.fetchData(input);
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

  static async scrapeLeetcode(username: string): Promise<ScrapedData> {
    return ScraperFactory.getScraper("LEETCODE").scrape(username);
  }

}
