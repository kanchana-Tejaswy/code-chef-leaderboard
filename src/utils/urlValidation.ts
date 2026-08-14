export function isMissingOrNA(val: string | null | undefined): boolean {
  if (!val || typeof val !== "string") return true;
  const trimmed = val.trim().toLowerCase();
  if (
    !trimmed ||
    trimmed === "-" ||
    trimmed === "na" ||
    trimmed === "n/a" ||
    trimmed === "not available" ||
    trimmed === "not_available" ||
    trimmed === "null" ||
    trimmed === "undefined" ||
    trimmed === "none"
  ) {
    return true;
  }
  return false;
}

export type PlatformType = "codechef" | "leetcode" | "github" | "linkedin" | "codeforces" | "hackerrank" | "hackerearth";

/**
 * Converts an existing raw username or URL into a complete platform profile URL for UI input display.
 */
export function formatToFullUrl(
  input: string | null | undefined,
  platform: PlatformType
): string {
  if (isMissingOrNA(input)) return "";
  const trimmed = input!.trim();

  // Basic security check
  if (/^(javascript:|data:|file:|vbscript:)/i.test(trimmed)) {
    return "";
  }

  // If already contains domain or URL scheme, return clean URL without duplicating domain
  if (/^https?:\/\//i.test(trimmed) || /^(www\.)?(codechef\.com|leetcode\.com|github\.com|linkedin\.com|codeforces\.com)/i.test(trimmed)) {
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  // Otherwise, treat as raw username handle and prepend platform base URL
  switch (platform) {
    case "codechef":
      return `https://www.codechef.com/users/${trimmed}`;
    case "leetcode":
      return `https://leetcode.com/u/${trimmed}`;
    case "github":
      return `https://github.com/${trimmed}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${trimmed}`;
    case "codeforces":
      return `https://codeforces.com/profile/${trimmed}`;
    case "hackerrank":
      return `https://www.hackerrank.com/profile/${trimmed}`;
    case "hackerearth":
      return `https://www.hackerearth.com/@${trimmed}`;
    default:
      return trimmed;
  }
}

/**
 * Extracts platform handle and validates platform profile URLs for student profile edit form.
 */
export function normalizeAndValidateUrl(
  url: string | null | undefined,
  platform: PlatformType
): { isValid: boolean; normalizedUrl: string | null; handle: string | null; error?: string } {
  if (isMissingOrNA(url)) {
    return { isValid: true, normalizedUrl: null, handle: null };
  }

  let trimmed = url!.trim();

  // Basic security checks
  if (/^(javascript:|data:|file:|vbscript:)/i.test(trimmed)) {
    return {
      isValid: false,
      normalizedUrl: null,
      handle: null,
      error: getPlatformErrorMessage(platform),
    };
  }

  // Prepend https:// if user entered domain without protocol (e.g., codechef.com/users/handle)
  if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  // Must be a full URL (plain text usernames without domain/protocol are rejected in edit form)
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      isValid: false,
      normalizedUrl: null,
      handle: null,
      error: getPlatformErrorMessage(platform),
    };
  }

  try {
    const parsedUrl = new URL(trimmed);
    const host = parsedUrl.hostname.toLowerCase();
    const parts = parsedUrl.pathname.split("/").filter(Boolean);

    if (platform === "codechef") {
      if ((host === "codechef.com" || host === "www.codechef.com" || host.endsWith(".codechef.com")) && parts[0] === "users" && parts[1]) {
        const handle = parts[1];
        if (isValidHandle(handle)) {
          return {
            isValid: true,
            normalizedUrl: `https://www.codechef.com/users/${handle}`,
            handle,
          };
        }
      }
      return { isValid: false, normalizedUrl: null, handle: null, error: getPlatformErrorMessage("codechef") };
    }

    if (platform === "leetcode") {
      if (host === "leetcode.com" || host === "www.leetcode.com" || host.endsWith(".leetcode.com")) {
        const reservedLc = new Set(["problems", "contest", "explore", "discuss", "assessment", "store", "company", "developer", "jobs", "terms", "privacy"]);
        let handle: string | null = null;
        if (parts[0] === "u" && parts[1]) {
          handle = parts[1];
        } else if (parts.length === 1 && !reservedLc.has(parts[0].toLowerCase())) {
          handle = parts[0];
        }

        if (handle && isValidHandle(handle)) {
          return {
            isValid: true,
            normalizedUrl: `https://leetcode.com/u/${handle}`,
            handle,
          };
        }
      }
      return { isValid: false, normalizedUrl: null, handle: null, error: getPlatformErrorMessage("leetcode") };
    }

    if (platform === "github") {
      if (host === "github.com" || host === "www.github.com" || host.endsWith(".github.com")) {
        const reservedGh = new Set(["settings", "organizations", "orgs", "features", "pricing", "explore", "topics", "trending", "collections", "events", "sponsors", "readme", "about", "contact"]);
        // Must be exactly 1 path part (rejects repos like github.com/user/repo)
        if (parts.length === 1 && !reservedGh.has(parts[0].toLowerCase())) {
          const handle = parts[0];
          if (isValidHandle(handle)) {
            return {
              isValid: true,
              normalizedUrl: `https://github.com/${handle}`,
              handle,
            };
          }
        }
      }
      return { isValid: false, normalizedUrl: null, handle: null, error: getPlatformErrorMessage("github") };
    }

    if (platform === "linkedin") {
      if (host === "linkedin.com" || host === "www.linkedin.com" || host.endsWith(".linkedin.com")) {
        if (parts[0] === "in" && parts[1]) {
          const handle = parts[1];
          if (isValidHandle(handle)) {
            return {
              isValid: true,
              normalizedUrl: `https://www.linkedin.com/in/${handle}`,
              handle,
            };
          }
        }
      }
      return { isValid: false, normalizedUrl: null, handle: null, error: getPlatformErrorMessage("linkedin") };
    }

    if (platform === "codeforces") {
      if (host === "codeforces.com" || host === "www.codeforces.com" || host.endsWith(".codeforces.com")) {
        if (parts[0] === "profile" && parts[1]) {
          const handle = parts[1];
          if (isValidHandle(handle)) {
            return {
              isValid: true,
              normalizedUrl: `https://codeforces.com/profile/${handle}`,
              handle,
            };
          }
        }
      }
      return { isValid: false, normalizedUrl: null, handle: null, error: getPlatformErrorMessage("codeforces") };
    }

    if (platform === "hackerrank") {
      if (host === "hackerrank.com" || host === "www.hackerrank.com" || host.endsWith(".hackerrank.com")) {
        let handle: string | null = null;
        if (parts[0] === "profile" && parts[1]) {
          handle = parts[1];
        } else if (parts.length === 1) {
          handle = parts[0];
        }
        if (handle && isValidHandle(handle)) {
          return {
            isValid: true,
            normalizedUrl: `https://www.hackerrank.com/profile/${handle}`,
            handle,
          };
        }
      }
      return { isValid: false, normalizedUrl: null, handle: null, error: getPlatformErrorMessage("hackerrank") };
    }

    if (platform === "hackerearth") {
      if (host === "hackerearth.com" || host === "www.hackerearth.com" || host.endsWith(".hackerearth.com")) {
        let handle: string | null = null;
        if (parts[0] === "users" && parts[1]) {
          handle = parts[1];
        } else if (parts[0].startsWith("@")) {
          handle = parts[0].slice(1);
        } else if (parts.length === 1) {
          handle = parts[0];
        }
        if (handle && isValidHandle(handle)) {
          return {
            isValid: true,
            normalizedUrl: `https://www.hackerearth.com/@${handle}`,
            handle,
          };
        }
      }
      return { isValid: false, normalizedUrl: null, handle: null, error: getPlatformErrorMessage("hackerearth") };
    }
  } catch {
    // URL parsing failed
  }

  return {
    isValid: false,
    normalizedUrl: null,
    handle: null,
    error: getPlatformErrorMessage(platform),
  };
}

function getPlatformErrorMessage(platform: PlatformType): string {
  switch (platform) {
    case "codechef":
      return "Enter a valid CodeChef profile URL.";
    case "leetcode":
      return "Enter a valid LeetCode profile URL.";
    case "github":
      return "Enter a valid GitHub profile URL.";
    case "linkedin":
      return "Enter a valid LinkedIn profile URL.";
    case "codeforces":
      return "Enter a valid Codeforces profile URL.";
    case "hackerrank":
      return "Enter a valid HackerRank profile URL.";
    case "hackerearth":
      return "Enter a valid HackerEarth profile URL.";
    default:
      return "Enter a valid profile URL.";
  }
}

function isValidHandle(handle: string): boolean {
  return /^[a-zA-Z0-9_\-]+$/.test(handle);
}

export function extractPlatformHandle(
  input: string | null | undefined,
  platform: PlatformType
): string | null {
  if (isMissingOrNA(input)) return null;
  const trimmed = input!.trim();
  if (/^(javascript:|data:|file:|vbscript:)/i.test(trimmed)) return null;

  const urlRes = normalizeAndValidateUrl(input, platform);
  if (urlRes.isValid && urlRes.handle) {
    return urlRes.handle;
  }

  // Fallback for CSV parser / raw handles without domain/slashes
  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    if (platform === "linkedin") {
      return `https://www.linkedin.com/in/${trimmed}`;
    }
    if (isValidHandle(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

export function extractUsername(url: string | null | undefined): string | null {
  if (isMissingOrNA(url)) return null;
  for (const plat of ["github", "codechef", "leetcode", "codeforces", "hackerrank", "hackerearth"] as PlatformType[]) {
    const handle = extractPlatformHandle(url, plat);
    if (handle) return handle;
  }
  return url!.trim();
}
