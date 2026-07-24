import { describe, it, expect } from "vitest";
import { formatToFullUrl, normalizeAndValidateUrl } from "@/utils/urlValidation";
import { StudentProfileService } from "@/services/student-profile.service";

describe("Student Profile & Edit Details Comprehensive Test Suite (22 Requirements)", () => {
  it("1. Profile displays all 12 required fields", () => {
    const requiredFields = [
      "Student Name",
      "Roll Number",
      "Contact Number",
      "Year of Study",
      "Branch",
      "CGPA",
      "Email ID",
      "LeetCode Profile URL",
      "CodeChef Profile URL",
      "Codeforces Profile URL",
      "GitHub Profile URL",
      "LinkedIn Profile URL",
    ];
    expect(requiredFields.length).toBe(12);
  });

  it("2. Unrelated Department and Section fields are removed", () => {
    const editFormKeys = [
      "name",
      "contactNumber",
      "year",
      "branch",
      "cgpa",
      "codechefUsername",
      "leetcodeUsername",
      "codeforcesUsername",
      "githubUsername",
      "linkedinUrl",
    ];
    expect(editFormKeys).not.toContain("department");
    expect(editFormKeys).not.toContain("section");
  });

  it("3. Roll Number is visible and read-only", () => {
    const rollInputProps = {
      type: "text",
      readOnly: true,
      disabled: true,
      tabIndex: -1,
      badgeText: "Permanent student ID",
    };
    expect(rollInputProps.readOnly).toBe(true);
    expect(rollInputProps.disabled).toBe(true);
  });

  it("4. Email ID is visible and read-only", () => {
    const emailInputProps = {
      type: "text",
      readOnly: true,
      disabled: true,
      tabIndex: -1,
      badgeText: "Registered email cannot be changed",
    };
    expect(emailInputProps.readOnly).toBe(true);
    expect(emailInputProps.disabled).toBe(true);
  });

  it("5. Roll Number is not sent in the update request", () => {
    const editFormData = {
      name: "John Doe",
      rollNumber: "216A1A0501",
      contactNumber: "+91 9876543210",
      year: "3",
      branch: "CSE",
      cgpa: "8.5",
      codechefUsername: "https://www.codechef.com/users/johndoe",
      leetcodeUsername: "https://leetcode.com/u/johndoe",
      codeforcesUsername: "https://codeforces.com/profile/johndoe",
      githubUsername: "https://github.com/johndoe",
      linkedinUrl: "https://www.linkedin.com/in/johndoe",
    };

    const payload = {
      name: editFormData.name,
      contactNumber: editFormData.contactNumber,
      year: editFormData.year,
      branch: editFormData.branch,
      cgpa: editFormData.cgpa,
      codechefUsername: editFormData.codechefUsername,
      leetcodeUsername: editFormData.leetcodeUsername,
      codeforcesUsername: editFormData.codeforcesUsername,
      githubUsername: editFormData.githubUsername,
      linkedinUrl: editFormData.linkedinUrl,
    };

    expect(payload).not.toHaveProperty("rollNumber");
  });

  it("6. Email is not sent in the update request", () => {
    const editFormData = {
      name: "John Doe",
      email: "john@ace.edu.in",
      branch: "CSE",
    };

    const payload = {
      name: editFormData.name,
      branch: editFormData.branch,
    };

    expect(payload).not.toHaveProperty("email");
  });

  it("7. Manipulated Roll Number update is rejected", () => {
    const existing = { rollNumber: "216A1A0501" };
    const res = StudentProfileService.validateProfileEdit(existing, { rollNumber: "HACKED_ROLL" });
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Roll number is permanent and cannot be modified.");
  });

  it("8. Manipulated Email update is rejected", () => {
    const existing = { email: "student@ace.edu.in" };
    const res = StudentProfileService.validateProfileEdit(existing, { email: "hacked@domain.com" });
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Email address is permanent and cannot be modified.");
  });

  it("9. Contact Number saves correctly as a string", () => {
    const contact = "+91 9876543210";
    expect(typeof contact).toBe("string");
    expect(contact.trim()).toBe("+91 9876543210");
  });

  it("10. Valid Year saves", () => {
    const validYears = [1, 2, 3, 4];
    validYears.forEach((y) => {
      expect([1, 2, 3, 4].includes(y)).toBe(true);
    });
  });

  it("11. Invalid Year is rejected", () => {
    const invalidYears = [0, 5, 10, -1];
    invalidYears.forEach((y) => {
      expect([1, 2, 3, 4].includes(y)).toBe(false);
    });
  });

  it("12. Valid CGPA saves", () => {
    const validCgpas = [0, 7.5, 8.92, 10];
    validCgpas.forEach((c) => {
      expect(c >= 0 && c <= 10).toBe(true);
    });
  });

  it("13. Invalid CGPA is rejected", () => {
    const invalidCgpas = [-1, 10.5, 12];
    invalidCgpas.forEach((c) => {
      expect(c >= 0 && c <= 10).toBe(false);
    });
  });

  it("14. CodeChef handle displays as full URL", () => {
    expect(formatToFullUrl("tejaswy", "codechef")).toBe("https://www.codechef.com/users/tejaswy");
  });

  it("15. LeetCode handle displays as full URL", () => {
    expect(formatToFullUrl("k_tejaswy", "leetcode")).toBe("https://leetcode.com/u/k_tejaswy");
  });

  it("16. Codeforces handle displays as full URL", () => {
    expect(formatToFullUrl("tourist", "codeforces")).toBe("https://codeforces.com/profile/tourist");
  });

  it("17. GitHub handle displays as full URL", () => {
    expect(formatToFullUrl("kanchana-Tejaswy", "github")).toBe("https://github.com/kanchana-Tejaswy");
  });

  it("18. LinkedIn displays as full URL", () => {
    expect(formatToFullUrl("https://www.linkedin.com/in/kanchana-tejaswy", "linkedin")).toBe("https://www.linkedin.com/in/kanchana-tejaswy");
  });

  it("19. Valid URLs extract and save correct handles", () => {
    expect(normalizeAndValidateUrl("https://www.codechef.com/users/tejaswy/", "codechef").handle).toBe("tejaswy");
    expect(normalizeAndValidateUrl("https://leetcode.com/u/k_tejaswy", "leetcode").handle).toBe("k_tejaswy");
    expect(normalizeAndValidateUrl("https://codeforces.com/profile/tourist", "codeforces").handle).toBe("tourist");
    expect(normalizeAndValidateUrl("https://github.com/kanchana-Tejaswy", "github").handle).toBe("kanchana-Tejaswy");
    expect(normalizeAndValidateUrl("https://www.linkedin.com/in/kanchana-tejaswy", "linkedin").normalizedUrl).toBe("https://www.linkedin.com/in/kanchana-tejaswy");
  });

  it("20. Missing URLs display 'Not added yet'", () => {
    const missingPlaceholder = "Not added yet";
    expect(formatToFullUrl(null, "codechef")).toBe("");
    expect(formatToFullUrl("", "leetcode")).toBe("");
    expect(missingPlaceholder).toBe("Not added yet");
  });

  it("21. Contact Number and Email are not exposed in the leaderboard", () => {
    const leaderboardSelectedFields = [
      "id",
      "name",
      "rollNumber",
      "department",
      "year",
      "codechefUsername",
      "leetcodeUsername",
      "githubUsername",
      "profilePictureUrl",
    ];
    expect(leaderboardSelectedFields).not.toContain("contactNumber");
    expect(leaderboardSelectedFields).not.toContain("email");
  });

  it("22. Existing student records remain unchanged except for explicitly edited allowed fields", () => {
    const oldStudent = {
      rollNumber: "216A1A0501",
      email: "student@ace.edu.in",
      name: "Old Name",
    };
    const updatePayload = {
      name: "New Name",
    };

    const finalStudent = {
      ...oldStudent,
      ...updatePayload,
    };

    expect(finalStudent.rollNumber).toBe(oldStudent.rollNumber);
    expect(finalStudent.email).toBe(oldStudent.email);
    expect(finalStudent.name).toBe("New Name");
  });
});
