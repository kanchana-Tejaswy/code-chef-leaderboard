import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapHeaderToField, parseSpreadsheetBuffer } from "../src/utils/csvParser";
import { extractPlatformHandle, isMissingOrNA } from "../src/utils/urlValidation";
import { StudentProfileService } from "../src/services/student-profile.service";
import * as XLSX from "xlsx";

describe("Student CSV Bulk Import System Test Suite", () => {
  describe("1. Header & Data Normalization", () => {
    it("1. maps CSV header variations correctly", () => {
      expect(mapHeaderToField("Student Name")).toBe("name");
      expect(mapHeaderToField("Roll No")).toBe("rollNumber");
      expect(mapHeaderToField("Contact Number")).toBe("contactNumber");
      expect(mapHeaderToField("Year Of Study")).toBe("year");
      expect(mapHeaderToField("Branch")).toBe("branch");
      expect(mapHeaderToField("CGPA")).toBe("cgpa");
      expect(mapHeaderToField("Email ID")).toBe("email");
      expect(mapHeaderToField("LeetCode Profile URL")).toBe("leetcodeUsername");
      expect(mapHeaderToField("CodeChef Profile URL")).toBe("codechefUsername");
      expect(mapHeaderToField("Codeforces Profile URL")).toBe("codeforcesUsername");
      expect(mapHeaderToField("GitHub Profile URL")).toBe("githubUsername");
      expect(mapHeaderToField("LinkedIn Profile URL")).toBe("linkedinUrl");
    });

    it("2. handles CSV quoted values cleanly", () => {
      const csvStr = `"Student Name","Roll Number","Email ID"\n"Doe, John"," 21CS101 "," JOHN@EXAMPLE.COM "`;
      const wb = XLSX.read(csvStr, { type: "string" });
      const buf = XLSX.write(wb, { type: "array", bookType: "csv" });
      const rows = parseSpreadsheetBuffer(buf);

      expect(rows.length).toBe(1);
      const norm = StudentProfileService.normalizeInput(rows[0]);
      expect(norm.name).toBe("Doe, John");
      expect(norm.rollNumber).toBe("21CS101");
      expect(norm.email).toBe("john@example.com");
    });

    it("3. parses Excel binary buffer (.xlsx / .xls)", () => {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["Student Name", "Roll Number", "Email ID", "Year Of Study"],
        ["Alice Smith", "22IT505", "alice@example.com", 2],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

      const rows = parseSpreadsheetBuffer(buf);
      expect(rows.length).toBe(1);
      expect(rows[0].name).toBe("Alice Smith");
      expect(rows[0].rollNumber).toBe("22IT505");
    });

    it("4. normalizes roll numbers (trim + uppercase, preserve letters & numbers)", () => {
      const norm = StudentProfileService.normalizeInput({ rollNumber: "  21cs109  " });
      expect(norm.rollNumber).toBe("21CS109");
    });

    it("5. normalizes emails (trim + lowercase)", () => {
      const norm = StudentProfileService.normalizeInput({ email: "  ADMIN@ACE.EDU.IN  " });
      expect(norm.email).toBe("admin@ace.edu.in");
    });

    it("18. stores contact number as string without numeric conversion", () => {
      const norm = StudentProfileService.normalizeInput({ contactNumber: " +91-9876543210 " });
      expect(norm.contactNumber).toBe("+91-9876543210");
      expect(typeof norm.contactNumber).toBe("string");
    });

    it("19. accepts valid CGPA decimal between 0.0 and 10.0", () => {
      const norm = StudentProfileService.normalizeInput({ cgpa: "8.75" });
      expect(norm.cgpa).toBe(8.75);
    });

    it("20. rejects invalid CGPA out of 0-10 bounds", async () => {
      const evaluated = await StudentProfileService.evaluateRows([
        { name: "John", rollNumber: "21CS101", email: "john@ex.com", year: 3, cgpa: "12.5" },
      ]);
      expect(evaluated[0].classification).toBe("INVALID_CGPA");
      expect(evaluated[0].reasons[0]).toContain("CGPA must be a decimal");
    });

    it("21. rejects invalid academic year values", async () => {
      const evaluated = await StudentProfileService.evaluateRows([
        { name: "John", rollNumber: "21CS101", email: "john@ex.com", year: 5 },
      ]);
      expect(evaluated[0].classification).toBe("INVALID_YEAR");
    });
  });

  describe("2. Platform URL & Handle Normalization", () => {
    it("13 & 14. handles CodeChef URL extraction & missing values", () => {
      expect(extractPlatformHandle("https://www.codechef.com/users/coder_jane", "codechef")).toBe("coder_jane");
      expect(extractPlatformHandle("coder_jane", "codechef")).toBe("coder_jane");
      expect(extractPlatformHandle("N/A", "codechef")).toBeNull();
      expect(extractPlatformHandle("-", "codechef")).toBeNull();
    });

    it("15. handles missing LeetCode URL without stopping profile creation", () => {
      expect(extractPlatformHandle("", "leetcode")).toBeNull();
      expect(extractPlatformHandle("Not available", "leetcode")).toBeNull();
    });

    it("16. handles invalid GitHub URL", () => {
      expect(extractPlatformHandle("https://google.com/search?q=git", "github")).toBeNull();
    });

    it("17. normalizes Codeforces URLs and handles", () => {
      expect(extractPlatformHandle("https://codeforces.com/profile/tourist", "codeforces")).toBe("tourist");
      expect(extractPlatformHandle("tourist", "codeforces")).toBe("tourist");
    });
  });

  describe("3. Duplicate Skipping & Immutability Rules", () => {
    it("6. detects duplicate roll number inside file", async () => {
      const rows = [
        { name: "First", rollNumber: "21CS001", email: "first@ex.com", year: 3 },
        { name: "Second", rollNumber: "21CS001", email: "second@ex.com", year: 3 },
      ];
      const evaluated = await StudentProfileService.evaluateRows(rows);
      expect(evaluated[0].classification).toBe("INCOMPLETE");
      expect(evaluated[1].classification).toBe("DUPLICATE_ROLL_NUMBER");
    });

    it("7. detects duplicate email inside file", async () => {
      const rows = [
        { name: "First", rollNumber: "21CS001", email: "same@ex.com", year: 3 },
        { name: "Second", rollNumber: "21CS002", email: "same@ex.com", year: 3 },
      ];
      const evaluated = await StudentProfileService.evaluateRows(rows);
      expect(evaluated[0].classification).toBe("INCOMPLETE");
      expect(evaluated[1].classification).toBe("DUPLICATE_EMAIL");
    });

    it("26 & 27. rejects rollNumber and email edit attempts on existing profiles", () => {
      const existing = { rollNumber: "21CS101", email: "john@example.com" };

      const rollCheck = StudentProfileService.validateProfileEdit(existing, { rollNumber: "21CS999" });
      expect(rollCheck.valid).toBe(false);
      expect(rollCheck.error).toContain("Roll number is permanent");

      const emailCheck = StudentProfileService.validateProfileEdit(existing, { email: "newemail@example.com" });
      expect(emailCheck.valid).toBe(false);
      expect(emailCheck.error).toContain("Email address is permanent");
    });
  });

  describe("4. Eligibility & Ranking Isolation", () => {
    it("22 & 23 & 24. newly created incomplete profiles default to unranked and ineligible", () => {
      const norm = StudentProfileService.normalizeInput({
        name: "Incomplete Coder",
        rollNumber: "21CS999",
        email: "inc@ex.com",
        year: 3,
      });

      expect(norm.codechefUsername).toBeNull();
      expect(norm.leetcodeUsername).toBeNull();
      // Profile created with profileStatus INCOMPLETE, leaderboardEligible = false, dashboardEligible = false
    });
  });
});
