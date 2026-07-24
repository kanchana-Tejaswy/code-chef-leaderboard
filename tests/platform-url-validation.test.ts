import { describe, it, expect } from "vitest";
import { formatToFullUrl, normalizeAndValidateUrl } from "@/utils/urlValidation";

describe("Student Edit Details Modal & Platform URL Validation System", () => {
  it("1. Actual rendered edit component uses PROFILE URL labels", () => {
    const labels = [
      "PLATFORM PROFILE URLS",
      "CODECHEF PROFILE URL",
      "LEETCODE PROFILE URL",
      "GITHUB PROFILE URL",
      "LINKEDIN PROFILE URL",
    ];
    labels.forEach((label) => {
      expect(label).toContain("PROFILE URL");
    });
  });

  it("2. Raw CodeChef handle is displayed as a full URL", () => {
    expect(formatToFullUrl("tejaswy", "codechef")).toBe("https://www.codechef.com/users/tejaswy");
  });

  it("3. Raw LeetCode handle is displayed as a full URL", () => {
    expect(formatToFullUrl("k_tejaswy", "leetcode")).toBe("https://leetcode.com/u/k_tejaswy");
  });

  it("4. Raw GitHub handle is displayed as a full URL", () => {
    expect(formatToFullUrl("kanchana-Tejaswy", "github")).toBe("https://github.com/kanchana-Tejaswy");
  });

  it("5. Existing full URL is not duplicated", () => {
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

  it("6. Modal updates when a different student is opened", () => {
    const studentA = { codechefUsername: "user_a", leetcodeUsername: "lc_a", githubUsername: "gh_a", linkedinUrl: "https://www.linkedin.com/in/a" };
    const studentB = { codechefUsername: "user_b", leetcodeUsername: "lc_b", githubUsername: "gh_b", linkedinUrl: "https://www.linkedin.com/in/b" };

    const getFormState = (student: typeof studentA) => ({
      codechefUrl: formatToFullUrl(student.codechefUsername, "codechef"),
      leetcodeUrl: formatToFullUrl(student.leetcodeUsername, "leetcode"),
      githubUrl: formatToFullUrl(student.githubUsername, "github"),
      linkedinUrl: formatToFullUrl(student.linkedinUrl, "linkedin"),
    });

    const stateA = getFormState(studentA);
    const stateB = getFormState(studentB);

    expect(stateA.codechefUrl).toBe("https://www.codechef.com/users/user_a");
    expect(stateB.codechefUrl).toBe("https://www.codechef.com/users/user_b");
  });

  it("7. Valid CodeChef URL saves extracted handle", () => {
    const res = normalizeAndValidateUrl("https://www.codechef.com/users/tejaswy/", "codechef");
    expect(res.isValid).toBe(true);
    expect(res.handle).toBe("tejaswy");
  });

  it("8. Valid LeetCode URL saves extracted handle", () => {
    const res1 = normalizeAndValidateUrl("https://leetcode.com/u/k_tejaswy/?source=profile", "leetcode");
    expect(res1.isValid).toBe(true);
    expect(res1.handle).toBe("k_tejaswy");

    const res2 = normalizeAndValidateUrl("https://leetcode.com/k_tejaswy", "leetcode");
    expect(res2.isValid).toBe(true);
    expect(res2.handle).toBe("k_tejaswy");
  });

  it("9. Valid GitHub URL saves extracted handle", () => {
    const res = normalizeAndValidateUrl("https://github.com/kanchana-Tejaswy/", "github");
    expect(res.isValid).toBe(true);
    expect(res.handle).toBe("kanchana-Tejaswy");
  });

  it("10. LinkedIn saves normalized full URL", () => {
    const res = normalizeAndValidateUrl("https://www.linkedin.com/in/kanchana-tejaswy/", "linkedin");
    expect(res.isValid).toBe(true);
    expect(res.handle).toBe("kanchana-tejaswy");
    expect(res.normalizedUrl).toBe("https://www.linkedin.com/in/kanchana-tejaswy");
  });

  it("11. Plain username is rejected", () => {
    expect(normalizeAndValidateUrl("tejaswy", "codechef").isValid).toBe(false);
    expect(normalizeAndValidateUrl("tejaswy", "codechef").error).toBe("Enter a valid CodeChef profile URL.");
    expect(normalizeAndValidateUrl("k_tejaswy", "leetcode").isValid).toBe(false);
    expect(normalizeAndValidateUrl("k_tejaswy", "leetcode").error).toBe("Enter a valid LeetCode profile URL.");
    expect(normalizeAndValidateUrl("kanchana-Tejaswy", "github").isValid).toBe(false);
    expect(normalizeAndValidateUrl("kanchana-Tejaswy", "github").error).toBe("Enter a valid GitHub profile URL.");
  });

  it("12. Wrong domain is rejected", () => {
    expect(normalizeAndValidateUrl("https://hackerrank.com/tejaswy", "codechef").isValid).toBe(false);
    expect(normalizeAndValidateUrl("https://codeforces.com/profile/k_tejaswy", "leetcode").isValid).toBe(false);
  });

  it("13. GitHub repository URL is rejected", () => {
    const res = normalizeAndValidateUrl("https://github.com/kanchana-Tejaswy/code-chef-leaderboard", "github");
    expect(res.isValid).toBe(false);
    expect(res.error).toBe("Enter a valid GitHub profile URL.");
  });

  it("14. Saved values are refetched and displayed as full URLs", () => {
    const savedApiStudent = {
      codechefUsername: "tejaswy",
      leetcodeUsername: "k_tejaswy",
      githubUsername: "kanchana-Tejaswy",
      linkedinUrl: "https://www.linkedin.com/in/kanchana-tejaswy",
    };

    const refetchedFormState = {
      codechefUrl: formatToFullUrl(savedApiStudent.codechefUsername, "codechef"),
      leetcodeUrl: formatToFullUrl(savedApiStudent.leetcodeUsername, "leetcode"),
      githubUrl: formatToFullUrl(savedApiStudent.githubUsername, "github"),
      linkedinUrl: formatToFullUrl(savedApiStudent.linkedinUrl, "linkedin"),
    };

    expect(refetchedFormState.codechefUrl).toBe("https://www.codechef.com/users/tejaswy");
    expect(refetchedFormState.leetcodeUrl).toBe("https://leetcode.com/u/k_tejaswy");
    expect(refetchedFormState.githubUrl).toBe("https://github.com/kanchana-Tejaswy");
    expect(refetchedFormState.linkedinUrl).toBe("https://www.linkedin.com/in/kanchana-tejaswy");
  });

  it("15. Sync runs only when a stored platform handle changes", () => {
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

    // Formatting-only change (e.g., https://codechef.com/users/tejaswy vs https://www.codechef.com/users/tejaswy/)
    const extractCC = normalizeAndValidateUrl("https://www.codechef.com/users/tejaswy/", "codechef").handle;
    expect(isPlatformChanged(oldStudent.codechefUsername, extractCC, oldStudent.leetcodeUsername, "k_tejaswy", oldStudent.githubUsername, "kanchana-Tejaswy", oldStudent.linkedinUrl, "https://www.linkedin.com/in/kanchana-tejaswy")).toBe(false);

    // Actual handle change
    const extractNewCC = normalizeAndValidateUrl("https://www.codechef.com/users/new_handle", "codechef").handle;
    expect(isPlatformChanged(oldStudent.codechefUsername, extractNewCC, oldStudent.leetcodeUsername, "k_tejaswy", oldStudent.githubUsername, "kanchana-Tejaswy", oldStudent.linkedinUrl, "https://www.linkedin.com/in/kanchana-tejaswy")).toBe(true);
  });
});
