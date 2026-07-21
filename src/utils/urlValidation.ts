export function normalizeAndValidateUrl(
  url: string | null | undefined,
  platform: "github" | "linkedin"
): { isValid: boolean; normalizedUrl: string | null; error?: string } {
  if (!url || typeof url !== "string" || !url.trim()) {
    return { isValid: true, normalizedUrl: null };
  }

  let trimmed = url.trim();

  // Basic security checks to prevent XSS and other unsafe protocols
  if (/^(javascript:|data:|file:|vbscript:)/i.test(trimmed)) {
    return {
      isValid: false,
      normalizedUrl: null,
      error: `Invalid ${platform} URL protocol.`,
    };
  }

  // If it's just a username (no slashes, no dots), construct the URL
  if (!trimmed.includes(".") && !trimmed.includes("/")) {
    if (platform === "github") {
      trimmed = `https://github.com/${trimmed}`;
    } else if (platform === "linkedin") {
      trimmed = `https://linkedin.com/in/${trimmed}`;
    }
  }

  // Prepend https:// if no protocol is present
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsedUrl = new URL(trimmed);

    // Force https
    if (parsedUrl.protocol !== "https:") {
      parsedUrl.protocol = "https:";
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    // Clean up extra slashes inside path and at the end
    const pathname = parsedUrl.pathname.replace(/\/+$/, "");

    if (platform === "github") {
      if (hostname !== "github.com" && hostname !== "www.github.com") {
        return {
          isValid: false,
          normalizedUrl: null,
          error: "GitHub URL must be a valid github.com domain.",
        };
      }

      const parts = pathname.split("/").filter(Boolean);
      if (parts.length === 0) {
        return {
          isValid: false,
          normalizedUrl: null,
          error: "GitHub URL must include a username.",
        };
      }
      if (parts.length > 1) {
        return {
          isValid: false,
          normalizedUrl: null,
          error:
            "GitHub URL must be a profile URL, not a repository or subpage.",
        };
      }
    } else if (platform === "linkedin") {
      if (!hostname.includes("linkedin.com")) {
        return {
          isValid: false,
          normalizedUrl: null,
          error: "LinkedIn URL must be a valid linkedin.com domain.",
        };
      }

      const parts = pathname.split("/").filter(Boolean);
      if (
        parts.length === 0 ||
        (parts[0] !== "in" && parts[0] !== "pub" && parts[0] !== "profile")
      ) {
        return {
          isValid: false,
          normalizedUrl: null,
          error:
            "LinkedIn URL must be a profile URL (e.g., /in/username). Company/post URLs are not allowed.",
        };
      }
      if (parts.length > 2) {
        return {
          isValid: false,
          normalizedUrl: null,
          error:
            "LinkedIn URL must be a personal profile URL, not a subpage.",
        };
      }
    }

    // Return the cleanly formatted string (URL for LinkedIn, Username for GitHub)
    if (platform === "github") {
      const parts = pathname.split("/").filter(Boolean);
      return {
        isValid: true,
        normalizedUrl: parts[0],
      };
    }

    return {
      isValid: true,
      normalizedUrl: `${parsedUrl.origin}${parsedUrl.pathname}`,
    };
  } catch (e) {
    return {
      isValid: false,
      normalizedUrl: null,
      error: `Invalid ${platform} URL format.`,
    };
  }
}

export function extractUsername(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsedUrl = new URL(url);
    const parts = parsedUrl.pathname.split("/").filter(Boolean);
    if (parsedUrl.hostname.includes("github.com")) {
      return parts.length > 0 ? parts[0] : null;
    }
    if (parsedUrl.hostname.includes("linkedin.com")) {
      return parts.length > 1 ? parts[1] : null;
    }
    return null;
  } catch (e) {
    // If it's not a URL, it might just be the username string stored directly in the database (old data)
    return url;
  }
}
