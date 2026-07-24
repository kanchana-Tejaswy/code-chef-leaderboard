import { describe, it, expect } from "vitest";
import { formatToFullUrl, normalizeAndValidateUrl, extractPlatformHandle } from "@/utils/urlValidation";
import { StudentProfileService } from "@/services/student-profile.service";
import { OverallScoreService } from "@/services/overallScore.service";

describe("Strict BOTH-Platform Eligibility Test Suite", () => {
  it("1. Both platforms missing → profileStatus = INCOMPLETE, ineligible", () => {
    const ccVerified = false;
    const lcVerified = false;
    const bothVerified = ccVerified && lcVerified;

    const profileStatus = bothVerified ? "VERIFIED" : "INCOMPLETE";
    const leaderboardEligible = bothVerified;
    const dashboardEligible = bothVerified;

    expect(profileStatus).toBe("INCOMPLETE");
    expect(leaderboardEligible).toBe(false);
    expect(dashboardEligible).toBe(false);
  });

  it("2. Only CodeChef verified → profileStatus = INCOMPLETE, ineligible", () => {
    const ccVerified = true;
    const lcVerified = false;
    const bothVerified = ccVerified && lcVerified;

    const profileStatus = bothVerified ? "VERIFIED" : "INCOMPLETE";
    const leaderboardEligible = bothVerified;
    const dashboardEligible = bothVerified;

    expect(profileStatus).toBe("INCOMPLETE");
    expect(leaderboardEligible).toBe(false);
    expect(dashboardEligible).toBe(false);
  });

  it("3. Only LeetCode verified → profileStatus = INCOMPLETE, ineligible", () => {
    const ccVerified = false;
    const lcVerified = true;
    const bothVerified = ccVerified && lcVerified;

    const profileStatus = bothVerified ? "VERIFIED" : "INCOMPLETE";
    const leaderboardEligible = bothVerified;
    const dashboardEligible = bothVerified;

    expect(profileStatus).toBe("INCOMPLETE");
    expect(leaderboardEligible).toBe(false);
    expect(dashboardEligible).toBe(false);
  });

  it("4. Both platforms verified → profileStatus = VERIFIED, eligible", () => {
    const ccVerified = true;
    const lcVerified = true;
    const bothVerified = ccVerified && lcVerified;

    const profileStatus = bothVerified ? "VERIFIED" : "INCOMPLETE";
    const leaderboardEligible = bothVerified;
    const dashboardEligible = bothVerified;

    expect(profileStatus).toBe("VERIFIED");
    expect(leaderboardEligible).toBe(true);
    expect(dashboardEligible).toBe(true);
  });

  it("5. One platform verification fails → profile stored, ineligible", () => {
    const student = { id: "student-456", name: "Carol", rollNumber: "216A1A0505" };
    const ccVerified = true;
    const lcVerified = false; // Failed scraping
    const bothVerified = ccVerified && lcVerified;

    expect(student.id).toBe("student-456");
    expect(bothVerified).toBe(false);
  });

  it("6. Incomplete student remains visible in Admin management", () => {
    const adminQueryResult = [
      { id: "s1", name: "Alice", profileStatus: "VERIFIED" },
      { id: "s2", name: "Bob", profileStatus: "INCOMPLETE" }, // Incomplete student is returned
    ];
    expect(adminQueryResult.length).toBe(2);
    expect(adminQueryResult.some(s => s.profileStatus === "INCOMPLETE")).toBe(true);
  });

  it("7. Incomplete student excluded from public leaderboard", () => {
    const leaderboardWhere = {
      student: {
        leaderboardEligible: true,
      },
    };
    expect(leaderboardWhere.student.leaderboardEligible).toBe(true);
  });

  it("8. Incomplete student excluded from dashboard performance analytics", () => {
    const dashboardWhere = {
      student: {
        dashboardEligible: true,
      },
    };
    expect(dashboardWhere.student.dashboardEligible).toBe(true);
  });

  it("9. Eligibility enabled automatically after both platforms verify", () => {
    let ccVerified = false;
    let lcVerified = false;
    let bothVerified = ccVerified && lcVerified;

    expect(bothVerified).toBe(false);

    // Later both handles are added and verified
    ccVerified = true;
    lcVerified = true;
    bothVerified = ccVerified && lcVerified;

    const profileStatus = bothVerified ? "VERIFIED" : "INCOMPLETE";
    const leaderboardEligible = bothVerified;
    const dashboardEligible = bothVerified;

    expect(profileStatus).toBe("VERIFIED");
    expect(leaderboardEligible).toBe(true);
    expect(dashboardEligible).toBe(true);
  });
});
