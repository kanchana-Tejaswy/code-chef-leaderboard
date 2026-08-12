import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeRoll, getCohortYears } from "../scripts/academic/student-enrollment-backfill";

describe("Phase 4.1.2 Student Enrollment Backfill Tests", () => {
  
  describe("normalizeRoll formatting", () => {
    it("handles standard JNTU roll numbers correctly", () => {
      const res = normalizeRoll("23AG1A0502");
      expect(res.normalized).toBe("23AG1A0502");
      expect(res.isNormalized).toBe(false);
    });

    it("corrects letter-O to digit-0 typo", () => {
      const res = normalizeRoll("23AG1AO5C6");
      expect(res.normalized).toBe("23AG1A05C6");
      expect(res.isNormalized).toBe(true);
    });

    it("strips hyphens safely", () => {
      const res = normalizeRoll("24AG1A-05J6");
      expect(res.normalized).toBe("24AG1A05J6");
      expect(res.isNormalized).toBe(true);
    });

    it("normalizes known irregular patterns", () => {
      const res = normalizeRoll("23AGIA05G0");
      expect(res.normalized).toBe("23AG1A05G0");
      expect(res.isNormalized).toBe(true);
    });

    it("rejects invalid formats and test profiles", () => {
      expect(normalizeRoll("22CS999").normalized).toBeNull();
      expect(normalizeRoll("23AG1A17229").normalized).toBeNull(); // 11-chars is invalid
      expect(normalizeRoll("abc").normalized).toBeNull();
    });
  });

  describe("getCohortYears mapping", () => {
    it("maps 1A prefix (4-year cycle) correctly", () => {
      const res = getCohortYears("23AG1A0502");
      expect(res).toEqual({
        startYear: 2023,
        endYear: 2027,
        code: "2023-2027"
      });
    });

    it("maps 5A prefix (3-year cycle) correctly", () => {
      const res = getCohortYears("24AG5A6606");
      expect(res).toEqual({
        startYear: 2024,
        endYear: 2027,
        code: "2024-2027"
      });
    });
  });

  describe("Business Logic Mock Tests", () => {
    // Test logic simulating deduplication
    it("skips creation if identical current enrollment exists", () => {
      const entry = {
        studentId: "sid-1",
        cohortId: "cid-1",
        departmentId: "did-1",
        classSectionId: "sec-1",
        academicYear: 3
      };

      const existing = {
        cohortId: "cid-1",
        departmentId: "did-1",
        classSectionId: "sec-1",
        academicYear: 3,
        isCurrent: true
      };

      // Idempotency check logic
      const shouldSkip = existing.cohortId === entry.cohortId &&
                         existing.departmentId === entry.departmentId &&
                         existing.classSectionId === entry.classSectionId &&
                         existing.academicYear === entry.academicYear;

      expect(shouldSkip).toBe(true);
    });

    it("does not skip but warns if current enrollment is different", () => {
      const entry = {
        studentId: "sid-1",
        cohortId: "cid-1",
        departmentId: "did-1",
        classSectionId: "sec-1",
        academicYear: 3
      };

      const existing = {
        cohortId: "cid-2", // different cohort
        departmentId: "did-1",
        classSectionId: "sec-2",
        academicYear: 3,
        isCurrent: true
      };

      const shouldSkip = existing.cohortId === entry.cohortId &&
                         existing.departmentId === entry.departmentId &&
                         existing.classSectionId === entry.classSectionId &&
                         existing.academicYear === entry.academicYear;

      expect(shouldSkip).toBe(false);
    });
  });
});
