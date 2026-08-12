import { describe, it, expect } from "vitest";
import { normalizeRoll, getCohortYears } from "../scripts/academic/student-enrollment-dry-run";

describe("Phase 4.1.1 Normalization and Cohort Mapping Tests", () => {
  
  describe("normalizeRoll", () => {
    it("normalizes uppercase and trims whitespace", () => {
      const res = normalizeRoll("  23ag1a05c6  ");
      expect(res.normalized).toBe("23AG1A05C6");
      expect(res.isNormalized).toBe(true);
    });

    it("normalizes Letter-O to Digit-0 in JNTU roll numbers", () => {
      const res = normalizeRoll("23AG1AO5G1");
      expect(res.normalized).toBe("23AG1A05G1");
      expect(res.isNormalized).toBe(true);
    });

    it("normalizes typos with hyphens", () => {
      const res = normalizeRoll("24AG1A-05J6");
      expect(res.normalized).toBe("24AG1A05J6");
      expect(res.isNormalized).toBe(true);
    });

    it("normalizes special known cases (Kosana Lavanya)", () => {
      const res = normalizeRoll("23AGIA05G0");
      expect(res.normalized).toBe("23AG1A05G0");
      expect(res.isNormalized).toBe(true);
    });

    it("rejects invalid length or formats", () => {
      const res = normalizeRoll("23AG1A17229"); // 11 characters
      expect(res.normalized).toBeNull();
      
      const res2 = normalizeRoll("22CS999"); // Test student format
      expect(res2.normalized).toBeNull();
    });
  });

  describe("getCohortYears", () => {
    it("correctly maps regular entry (1A) cohorts", () => {
      const cohort = getCohortYears("23AG1A05C6");
      expect(cohort).toEqual({
        startYear: 2023,
        endYear: 2027,
        code: "2023-2027"
      });
    });

    it("correctly maps lateral entry (5A) cohorts", () => {
      const cohort = getCohortYears("24AG5A6706");
      expect(cohort).toEqual({
        startYear: 2024,
        endYear: 2027,
        code: "2024-2027"
      });
    });
  });
});
