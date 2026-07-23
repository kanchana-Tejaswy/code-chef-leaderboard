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

export function extractPlatformHandle(
  input: string | null | undefined,
  platform: "codechef" | "leetcode" | "codeforces" | "github" | "linkedin"
): string | null {
  if (isMissingOrNA(input)) return null;

  let trimmed = input!.trim();

  // Basic security checks to prevent XSS / dangerous schemes
  if (/^(javascript:|data:|file:|vbscript:)/i.test(trimmed)) {
    return null;
  }

  // Prepend https:// if it looks like a domain without scheme (e.g., codeforces.com/profile/user)
  if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsedUrl = new URL(trimmed);
      const host = parsedUrl.hostname.toLowerCase();
      const parts = parsedUrl.pathname.split("/").filter(Boolean);

      if (platform === "codechef") {
        if (host.includes("codechef.com")) {
          if (parts[0] === "users" && parts[1]) return parts[1];
          if (parts.length > 0) return parts[0];
        }
        return null;
      }

      if (platform === "leetcode") {
        if (host.includes("leetcode.com")) {
          if (parts[0] === "u" && parts[1]) return parts[1];
          if (parts.length > 0) return parts[0];
        }
        return null;
      }

      if (platform === "codeforces") {
        if (host.includes("codeforces.com")) {
          if (parts[0] === "profile" && parts[1]) return parts[1];
          if (parts.length > 0) return parts[0];
        }
        return null;
      }

      if (platform === "github") {
        if (host.includes("github.com")) {
          if (parts.length === 1) return parts[0];
        }
        return null;
      }

      if (platform === "linkedin") {
        if (host.includes("linkedin.com")) {
          return `https://www.linkedin.com${parsedUrl.pathname.replace(/\/+$/, "")}`;
        }
        return null;
      }
    } catch {
      return null;
    }
  }

  // If it's a raw username (no slashes/dots)
  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    if (platform === "linkedin") {
      return `https://www.linkedin.com/in/${trimmed}`;
    }
    // Clean handles (letters, numbers, underscores, hyphens)
    if (/^[a-zA-Z0-9_\-]+$/.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

export function normalizeAndValidateUrl(
  url: string | null | undefined,
  platform: "github" | "linkedin"
): { isValid: boolean; normalizedUrl: string | null; error?: string } {
  if (isMissingOrNA(url)) {
    return { isValid: true, normalizedUrl: null };
  }

  const handle = extractPlatformHandle(url, platform);
  if (!handle) {
    return {
      isValid: false,
      normalizedUrl: null,
      error: `Invalid ${platform} URL format or domain.`,
    };
  }

  return {
    isValid: true,
    normalizedUrl: handle,
  };
}

export function extractUsername(url: string | null | undefined): string | null {
  if (isMissingOrNA(url)) return null;
  return extractPlatformHandle(url, "github") || extractPlatformHandle(url, "codechef") || extractPlatformHandle(url, "leetcode") || extractPlatformHandle(url, "codeforces") || url!.trim();
}
