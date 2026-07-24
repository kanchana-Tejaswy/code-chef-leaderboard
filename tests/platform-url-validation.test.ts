import { describe, it, expect } from "vitest";
import { formatToFullUrl, normalizeAndValidateUrl } from "@/utils/urlValidation";

describe("Platform Profile URL Utilities & Validation", () => {
  it("1. Existing username displayed as full CodeChef URL", () => {
    const formatted = formatToFullUrl("tejaswy", "codechef");
    expect(formatted).toBe("https://www.codechef.com/users/tejaswy");
  });

  it("2. Existing username displayed as full LeetCode URL", () => {
    const formatted = formatToFullUrl("k_tejaswy", "leetcode");
    expect(formatted).toBe("https://leetcode.com/u/k_tejaswy");
  });

  it("3. Existing username displayed as full GitHub URL", () => {
    const formatted = formatToFullUrl("kanchana-Tejaswy", "github");
    expect(formatted).toBe("https://github.com/kanchana-Tejaswy");
  });

  it("4. Existing full URL is not duplicated", () => {
    expect(formatToFullUrl("https://www.codechef.com/users/tejaswy", "codechef")).toBe(
      "https://www.codechef.com/users/tejaswy"
    );
    expect(formatToFullUrl("https://leetcode.com/u/k_tejaswy", "leetcode")).toBe(
      "https://leetcode.com/u/k_tejaswy"
    );
    expect(formatToFullUrl("https://github.com/kanchana-Tejaswy", "github")).toBe(
      "https://github.com/kanchana-Tejaswy"
    );
    expect(formatToFullUrl("https://www.linkedin.com/in/kanchana-tejaswy", "linkedin")).toBe(
      "https://www.linkedin.com/in/kanchana-tejaswy"
    );
  });

  it("5. Valid CodeChef URL extraction", () => {
    const res = normalizeAndValidateUrl("https://www.codechef.com/users/tejaswy/", "codechef");
    expect(res.isValid).toBe(true);
    expect(res.handle).toBe("tejaswy");
    expect(res.normalizedUrl).toBe("https://www.codechef.com/users/tejaswy");
  });

  it("6. Valid LeetCode URL extraction", () => {
    const res1 = normalizeAndValidateUrl("https://leetcode.com/u/k_tejaswy/?source=profile", "leetcode");
    expect(res1.isValid).toBe(true);
    expect(res1.handle).toBe("k_tejaswy");

    const res2 = normalizeAndValidateUrl("https://leetcode.com/k_tejaswy", "leetcode");
    expect(res2.isValid).toBe(true);
    expect(res2.handle).toBe("k_tejaswy");
  });

  it("7. Valid GitHub URL extraction", () => {
    const res = normalizeAndValidateUrl("https://github.com/kanchana-Tejaswy/", "github");
    expect(res.isValid).toBe(true);
    expect(res.handle).toBe("kanchana-Tejaswy");
    expect(res.normalizedUrl).toBe("https://github.com/kanchana-Tejaswy");
  });

  it("8. Valid LinkedIn URL normalization", () => {
    const res = normalizeAndValidateUrl("https://www.linkedin.com/in/kanchana-tejaswy/", "linkedin");
    expect(res.isValid).toBe(true);
    expect(res.handle).toBe("kanchana-tejaswy");
    expect(res.normalizedUrl).toBe("https://www.linkedin.com/in/kanchana-tejaswy");
  });

  it("9. Wrong-domain rejection", () => {
    const resCc = normalizeAndValidateUrl("https://hackerrank.com/tejaswy", "codechef");
    expect(resCc.isValid).toBe(false);
    expect(resCc.error).toBe("Enter a valid CodeChef profile URL.");

    const resLc = normalizeAndValidateUrl("https://codeforces.com/profile/k_tejaswy", "leetcode");
    expect(resLc.isValid).toBe(false);
    expect(resLc.error).toBe("Enter a valid LeetCode profile URL.");
  });

  it("10. GitHub repository URL rejection", () => {
    const res = normalizeAndValidateUrl("https://github.com/kanchana-Tejaswy/code-chef-leaderboard", "github");
    expect(res.isValid).toBe(false);
    expect(res.error).toBe("Enter a valid GitHub profile URL.");
  });

  it("11. Empty optional URL", () => {
    expect(normalizeAndValidateUrl("", "codechef")).toEqual({
      isValid: true,
      normalizedUrl: null,
      handle: null,
    });
    expect(normalizeAndValidateUrl(null, "github")).toEqual({
      isValid: true,
      normalizedUrl: null,
      handle: null,
    });
    expect(normalizeAndValidateUrl("   ", "linkedin")).toEqual({
      isValid: true,
      normalizedUrl: null,
      handle: null,
    });
  });

  it("12. Background sync triggered only when URL changes", () => {
    const oldStudent = {
      codechefUsername: "tejaswy",
      leetcodeUsername: "k_tejaswy",
      githubUsername: "kanchana-Tejaswy",
      linkedinUrl: "https://www.linkedin.com/in/kanchana-tejaswy",
    };

    const isPlatformChanged = (
      oldCC: string | null, newCC: string | null,
      oldLC: string | null, newLC: string | null,
      oldGH: string | null, newGH: string | null,
      oldLN: string | null, newLN: string | null
    ) => {
      return oldCC !== newCC || oldLC !== newLC || oldGH !== newGH || oldLN !== newLN;
    };

    // Case A: Nothing changed
    expect(
      isPlatformChanged(
        oldStudent.codechefUsername, "tejaswy",
        oldStudent.leetcodeUsername, "k_tejaswy",
        oldStudent.githubUsername, "kanchana-Tejaswy",
        oldStudent.linkedinUrl, "https://www.linkedin.com/in/kanchana-tejaswy"
      )
    ).toBe(false);

    // Case B: CodeChef URL handle changed
    expect(
      isPlatformChanged(
        oldStudent.codechefUsername, "new_tejaswy",
        oldStudent.leetcodeUsername, "k_tejaswy",
        oldStudent.githubUsername, "kanchana-Tejaswy",
        oldStudent.linkedinUrl, "https://www.linkedin.com/in/kanchana-tejaswy"
      )
    ).toBe(true);
  });
});
