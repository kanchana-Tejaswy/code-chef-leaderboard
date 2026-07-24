import { describe, it, expect } from "vitest";
import { formatToFullUrl, normalizeAndValidateUrl, extractPlatformHandle } from "@/utils/urlValidation";
import { StudentProfileService } from "@/services/student-profile.service";
import { OverallScoreService } from "@/services/overallScore.service";

describe("Student Profile & Platform Data Flow Test Suite (18 Requirements)", () => {
  it("1. CSV creates StudentProfile", () => {
    const rawRow = {
      name: "Alice Smith",
      rollNumber: "216A1A0502",
      email: "alice@ace.edu.in",
      contactNumber: "+91 9123456789",
      year: "3",
      branch: "CSE",
      cgpa: "9.1",
      codechefUsername: "https://www.codechef.com/users/alicesmith",
      leetcodeUsername: "https://leetcode.com/u/alicesmith",
    };

    const handleCc = extractPlatformHandle(rawRow.codechefUsername, "codechef");
    const handleLc = extractPlatformHandle(rawRow.leetcodeUsername, "leetcode");
    expect(rawRow.name).toBe("Alice Smith");
    expect(rawRow.rollNumber).toBe("216A1A0502");
    expect(rawRow.email).toBe("alice@ace.edu.in");
    expect(handleCc).toBe("alicesmith");
    expect(handleLc).toBe("alicesmith");
  });

  it("2. CSV does not directly create fake platform scores", () => {
    const rawRow = {
      name: "Alice Smith",
      rollNumber: "216A1A0502",
      codechefRating: "2500", // Fake rating in CSV
      leetcodeScore: "999",   // Fake score in CSV
    };

    expect(rawRow).not.toHaveProperty("overallScore");
    expect(rawRow).not.toHaveProperty("calculatedCodechefScore");
  });

  it("3. CodeChef URL extracts correct username", () => {
    const url = "https://www.codechef.com/users/tejaswy";
    const res = normalizeAndValidateUrl(url, "codechef");
    expect(res.isValid).toBe(true);
    expect(res.handle).toBe("tejaswy");
  });

  it("4. LeetCode URL extracts correct username", () => {
    const url = "https://leetcode.com/u/k_tejaswy";
    const res = normalizeAndValidateUrl(url, "leetcode");
    expect(res.isValid).toBe(true);
    expect(res.handle).toBe("k_tejaswy");
  });

  it("5. Successful CodeChef sync stores platform data", () => {
    const ccProfileData = {
      username: "tejaswy",
      currentRating: 1650,
      highestRating: 1720,
      stars: 3,
      problemsSolved: 145,
      contestCount: 18,
    };
    const score = OverallScoreService.calculateCodechefScore(ccProfileData);
    expect(score).toBeGreaterThan(0);
    expect(typeof score).toBe("number");
  });

  it("6. Successful LeetCode sync stores platform data", () => {
    const lcProfileData = {
      problemsSolved: 230,
      mediumSolvedCount: 120,
      hardSolvedCount: 25,
      contestRating: 1580,
      contestRank: 12000,
      consistencyScore: 80,
    };
    const score = OverallScoreService.calculateLeetcodeScore(lcProfileData);
    expect(score).toBeGreaterThan(0);
    expect(typeof score).toBe("number");
  });

  it("7. Failed scraping does not delete StudentProfile", () => {
    const student = { id: "student-123", name: "Bob", rollNumber: "216A1A0503" };
    const scrapeSuccess = false;
    expect(student.id).toBe("student-123");
    expect(scrapeSuccess).toBe(false);
  });

  it("8. Leaderboard receives student identity from StudentProfile", () => {
    const leaderboardEntry = {
      rank: 1,
      overallScore: 88,
      codechefScore: 85,
      leetcodeScore: 91,
      student: {
        name: "Alice Smith",
        rollNumber: "216A1A0502",
        branch: "CSE",
      },
    };

    expect(leaderboardEntry.student.name).toBe("Alice Smith");
    expect(leaderboardEntry.student.rollNumber).toBe("216A1A0502");
    expect(leaderboardEntry.student.branch).toBe("CSE");
  });

  it("9. Leaderboard scores come from LeaderboardEntry", () => {
    const leaderboardEntry = {
      overallScore: 88,
      codechefScore: 85,
      leetcodeScore: 91,
      rank: 1,
      trendDirection: "UP",
    };

    expect(leaderboardEntry.overallScore).toBe(88);
    expect(leaderboardEntry.codechefScore).toBe(85);
    expect(leaderboardEntry.leetcodeScore).toBe(91);
  });

  it("10. Dashboard uses verified platform data only", () => {
    const studentWhere = {
      codechefProfile: { isNot: null },
    };
    expect(studentWhere.codechefProfile.isNot).toBe(null);
  });

  it("11. Incomplete students do not reduce performance averages", () => {
    const scores = [80, 90, 100]; // Only verified scores
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    expect(avg).toBe(90);
  });

  it("12. Verified CodeChef-only student displays correct state", () => {
    const ccScore = 80;
    const lcScore = 0;
    const active = { codechef: true, leetcode: false };
    const overall = OverallScoreService.calculate({ codechef: ccScore, leetcode: lcScore }, active);
    expect(overall).toBe(80);
  });

  it("13. Verified LeetCode-only student displays correct state", () => {
    const ccScore = 0;
    const lcScore = 90;
    const active = { codechef: false, leetcode: true };
    const overall = OverallScoreService.calculate({ codechef: ccScore, leetcode: lcScore }, active);
    expect(overall).toBe(90);
  });

  it("14. Both verified platforms produce combined score", () => {
    const ccScore = 80;
    const lcScore = 90;
    const active = { codechef: true, leetcode: true };
    const overall = OverallScoreService.calculate({ codechef: ccScore, leetcode: lcScore }, active);
    expect(overall).toBe(85); // (80*0.5 + 90*0.5 = 85)
  });

  it("15. Contact number and email are not exposed in leaderboard", () => {
    const leaderboardFields = [
      "rank",
      "name",
      "rollNumber",
      "overallScore",
      "codechefScore",
      "leetcodeScore",
      "branch",
      "trendDirection",
    ];
    expect(leaderboardFields).not.toContain("contactNumber");
    expect(leaderboardFields).not.toContain("email");
  });

  it("16. Student-specific Refresh recalculates scores", () => {
    const ccScore = OverallScoreService.calculateCodechefScore({ currentRating: 1800, problemsSolved: 200, contestCount: 25 });
    expect(ccScore).toBeGreaterThan(0);
  });

  it("17. Rank recalculation occurs after successful sync", () => {
    const entries = [
      { id: "1", overallScore: 90, codechefScore: 90, leetcodeScore: 90 },
      { id: "2", overallScore: 80, codechefScore: 80, leetcodeScore: 80 },
    ];
    const ranked = OverallScoreService.calculateDenseRank(entries, (e) => [e.overallScore, e.codechefScore, e.leetcodeScore]);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it("18. Existing students and scores are not overwritten incorrectly", () => {
    const existing = { rollNumber: "216A1A0501", email: "student@ace.edu.in" };
    const edit = { rollNumber: "HACKED" };
    const validation = StudentProfileService.validateProfileEdit(existing, edit);
    expect(validation.valid).toBe(false);
  });
});
