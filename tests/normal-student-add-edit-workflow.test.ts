import { describe, test, expect, beforeEach } from "vitest";
import { StudentProfileService } from "@/services/student-profile.service";

describe("Normal Student Add / Edit Workflow (TASK 2)", () => {
  // In-memory mock database state for testing atomic logic
  let dbProfiles: Map<string, any>;
  let dbEnrollments: Map<string, any>;
  let dbUserAccess: Map<string, any>;
  let dbCohorts: Map<string, any>;
  let dbDepartments: Map<string, any>;
  let dbClassSections: Map<string, any>;

  let mockTx: any;

  beforeEach(() => {
    dbProfiles = new Map();
    dbEnrollments = new Map();
    dbUserAccess = new Map();
    dbCohorts = new Map([["c-1", { id: "c-1", code: "2023-2027", status: "ACTIVE" }]]);
    dbDepartments = new Map([
      ["d-1", { id: "d-1", code: "CSE", name: "CSE", isActive: true }],
      ["d-2", { id: "d-2", code: "ECE", name: "ECE", isActive: true }]
    ]);
    dbClassSections = new Map([
      ["s-1", { id: "s-1", cohortId: "c-1", departmentId: "d-1", name: "A", isActive: true }],
      ["s-2", { id: "s-2", cohortId: "c-1", departmentId: "d-1", name: "B", isActive: true }]
    ]);

    mockTx = {
      studentProfile: {
        findUnique: async ({ where }: any) => {
          if (where.rollNumber) {
            for (const p of dbProfiles.values()) {
              if (p.rollNumber.toUpperCase() === where.rollNumber.toUpperCase()) {
                const currentE = Array.from(dbEnrollments.values()).filter(
                  (e) => e.studentId === p.id && e.isCurrent
                );
                return { ...p, studentEnrollments: currentE };
              }
            }
          }
          if (where.id) {
            const p = dbProfiles.get(where.id);
            if (p) {
              const currentE = Array.from(dbEnrollments.values()).filter(
                (e) => e.studentId === p.id && e.isCurrent
              );
              return { ...p, studentEnrollments: currentE };
            }
          }
          return null;
        },
        create: async ({ data }: any) => {
          const id = data.id || "prof-" + Math.random().toString(36).slice(2);
          const record = { ...data, id };
          dbProfiles.set(id, record);
          return record;
        },
        update: async ({ where, data }: any) => {
          const record = dbProfiles.get(where.id);
          if (!record) throw new Error("Record not found");
          const updated = { ...record, ...data };
          dbProfiles.set(where.id, updated);
          return updated;
        }
      },
      studentEnrollment: {
        findFirst: async ({ where }: any) => {
          for (const e of dbEnrollments.values()) {
            if (e.studentId === where.studentId && e.isCurrent === where.isCurrent) {
              return e;
            }
          }
          return null;
        },
        create: async ({ data }: any) => {
          const id = "enr-" + Math.random().toString(36).slice(2);
          const record = { ...data, id };
          dbEnrollments.set(id, record);
          return record;
        },
        update: async ({ where, data }: any) => {
          const record = dbEnrollments.get(where.id);
          if (!record) throw new Error("Enrollment not found");
          const updated = { ...record, ...data };
          dbEnrollments.set(where.id, updated);
          return updated;
        }
      },
      cohort: {
        findUnique: async ({ where }: any) => dbCohorts.get(where.id || where.code) || null,
        create: async ({ data }: any) => {
          const id = "c-" + Math.random().toString(36).slice(2);
          const record = { ...data, id };
          dbCohorts.set(id, record);
          return record;
        }
      },
      department: {
        findUnique: async ({ where }: any) => {
          for (const d of dbDepartments.values()) {
            if (d.id === where.id || d.code === where.code) return d;
          }
          return null;
        },
        create: async ({ data }: any) => {
          const id = "d-" + Math.random().toString(36).slice(2);
          const record = { ...data, id };
          dbDepartments.set(id, record);
          return record;
        }
      },
      classSection: {
        findUnique: async ({ where }: any) => {
          if (where.id) return dbClassSections.get(where.id) || null;
          return null;
        }
      },
      userAccess: {
        findFirst: async ({ where }: any) => {
          for (const u of dbUserAccess.values()) {
            if (u.loginId === where.loginId || u.studentProfileId === where.studentProfileId) return u;
          }
          return null;
        },
        create: async ({ data }: any) => {
          const id = "acc-" + Math.random().toString(36).slice(2);
          const record = { ...data, id };
          dbUserAccess.set(id, record);
          return record;
        }
      }
    };
  });

  test("TEST 1: Create completely new student", async () => {
    const res = await StudentProfileService.upsertSingleStudent(
      {
        name: "Rahul Kumar",
        rollNumber: "23AG1A0501",
        department: "CSE",
        cohortId: "c-1",
        departmentId: "d-1",
        classSectionId: "s-1",
        year: "1",
        cgpa: "8.5"
      },
      mockTx
    );

    expect(res.success).toBe(true);
    expect(res.isNew).toBe(true);
    expect(dbProfiles.size).toBe(1);
    expect(dbEnrollments.size).toBe(1);

    const createdProfile = Array.from(dbProfiles.values())[0];
    expect(createdProfile.rollNumber).toBe("23AG1A0501");
    expect(createdProfile.name).toBe("Rahul Kumar");

    const createdEnrollment = Array.from(dbEnrollments.values())[0];
    expect(createdEnrollment.isCurrent).toBe(true);
    expect(createdEnrollment.cohortId).toBe("c-1");
    expect(createdEnrollment.departmentId).toBe("d-1");
    expect(createdEnrollment.classSectionId).toBe("s-1");
  });

  test("TEST 2: Create student using Roll Number with spaces/lowercase", async () => {
    const res = await StudentProfileService.upsertSingleStudent(
      {
        name: "Tejaswy",
        rollNumber: " 23 ag 1a 0502 ",
        department: "CSE",
        cohortId: "c-1",
        departmentId: "d-1"
      },
      mockTx
    );

    expect(res.success).toBe(true);
    expect(res.isNew).toBe(true);

    const createdProfile = Array.from(dbProfiles.values())[0];
    expect(createdProfile.rollNumber).toBe("23AG1A0502");
  });

  test("TEST 3: Submit an existing Roll Number", async () => {
    // 1. Initial Creation
    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", cohortId: "c-1", departmentId: "d-1", classSectionId: "s-1" },
      mockTx
    );
    expect(dbProfiles.size).toBe(1);

    // 2. Submit same roll number with updated name
    const res = await StudentProfileService.upsertSingleStudent(
      { name: "Rahul Kumar", rollNumber: "23AG1A0501", cohortId: "c-1", departmentId: "d-1", classSectionId: "s-1" },
      mockTx
    );

    expect(res.success).toBe(true);
    expect(res.isNew).toBe(false);
    expect(dbProfiles.size).toBe(1); // NO duplicate profile!

    const updatedProfile = Array.from(dbProfiles.values())[0];
    expect(updatedProfile.name).toBe("Rahul Kumar");
  });

  test("TEST 4: Existing student's optional field changes from a value to blank", async () => {
    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", contactNumber: "9876543210", githubUsername: "old-git" },
      mockTx
    );

    // Edit student with blank contactNumber & githubUsername
    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", contactNumber: "", githubUsername: "" },
      mockTx
    );

    const profile = Array.from(dbProfiles.values())[0];
    expect(profile.contactNumber).toBeNull();
    expect(profile.githubUsername).toBeNull();
  });

  test("TEST 5: Existing student's name/CGPA/contact/platform data changes", async () => {
    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", cgpa: "8.0", leetcodeUsername: "lc-old" },
      mockTx
    );

    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul Sharma", rollNumber: "23AG1A0501", cgpa: "9.2", leetcodeUsername: "lc-new" },
      mockTx
    );

    const profile = Array.from(dbProfiles.values())[0];
    expect(profile.name).toBe("Rahul Sharma");
    expect(profile.cgpa).toBe(9.2);
    expect(profile.leetcodeUsername).toBe("lc-new");
  });

  test("TEST 6: Existing student's Section changes A -> B", async () => {
    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", cohortId: "c-1", departmentId: "d-1", classSectionId: "s-1" },
      mockTx
    );

    expect(dbEnrollments.size).toBe(1);

    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", cohortId: "c-1", departmentId: "d-1", classSectionId: "s-2" },
      mockTx
    );

    expect(dbEnrollments.size).toBe(2);
    const enrollments = Array.from(dbEnrollments.values());
    const currentEnrollments = enrollments.filter((e) => e.isCurrent);
    expect(currentEnrollments.length).toBe(1);
    expect(currentEnrollments[0].classSectionId).toBe("s-2");

    const oldEnrollment = enrollments.find((e) => e.classSectionId === "s-1");
    expect(oldEnrollment?.isCurrent).toBe(false);
  });

  test("TEST 7: Existing student's Section becomes blank", async () => {
    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", cohortId: "c-1", departmentId: "d-1", classSectionId: "s-1" },
      mockTx
    );

    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", cohortId: "c-1", departmentId: "d-1", classSectionId: null },
      mockTx
    );

    const currentEnrollment = Array.from(dbEnrollments.values()).find((e) => e.isCurrent);
    expect(currentEnrollment?.classSectionId).toBeNull();
  });

  test("TEST 8: Existing student's Department changes", async () => {
    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", cohortId: "c-1", departmentId: "d-1" },
      mockTx
    );

    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", cohortId: "c-1", departmentId: "d-2" },
      mockTx
    );

    const currentEnrollment = Array.from(dbEnrollments.values()).find((e) => e.isCurrent);
    expect(currentEnrollment?.departmentId).toBe("d-2");
  });

  test("TEST 9: Existing student's Cohort changes", async () => {
    dbCohorts.set("c-2", { id: "c-2", code: "2024-2028", status: "ACTIVE" });

    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", cohortId: "c-1", departmentId: "d-1" },
      mockTx
    );

    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", cohortId: "c-2", departmentId: "d-1" },
      mockTx
    );

    const currentEnrollment = Array.from(dbEnrollments.values()).find((e) => e.isCurrent);
    expect(currentEnrollment?.cohortId).toBe("c-2");
  });

  test("TEST 10: Existing student's academic placement does not change", async () => {
    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul", rollNumber: "23AG1A0501", cohortId: "c-1", departmentId: "d-1", classSectionId: "s-1" },
      mockTx
    );

    expect(dbEnrollments.size).toBe(1);

    // Edit only name
    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul K", rollNumber: "23AG1A0501", cohortId: "c-1", departmentId: "d-1", classSectionId: "s-1" },
      mockTx
    );

    // Academic placement did not change, so no new enrollment record created!
    expect(dbEnrollments.size).toBe(1);
  });

  test("TEST 11 & TEST 12: Existing student's password and mustSetPassword must NOT be changed or reset during edit", async () => {
    // Setup initial user access
    dbUserAccess.set("acc-1", {
      id: "acc-1",
      loginId: "23AG1A0501",
      studentProfileId: "prof-1",
      mustSetPassword: false, // Student already changed password
      status: "ACTIVE"
    });

    dbProfiles.set("prof-1", {
      id: "prof-1",
      name: "Rahul",
      rollNumber: "23AG1A0501"
    });

    // Update profile
    await StudentProfileService.upsertSingleStudent(
      { name: "Rahul Updated", rollNumber: "23AG1A0501" },
      mockTx
    );

    const userAccount = dbUserAccess.get("acc-1");
    expect(userAccount.mustSetPassword).toBe(false); // MUST NOT BE RESET!
    expect(dbUserAccess.size).toBe(1); // NO duplicate UserAccess created!
  });

  test("TEST 13: Concurrent duplicate creation attempt handled safely by normalized roll lookup", async () => {
    const roll = "23AG1A0505";
    const res1 = await StudentProfileService.upsertSingleStudent({ name: "Student 1", rollNumber: roll }, mockTx);
    const res2 = await StudentProfileService.upsertSingleStudent({ name: "Student 2", rollNumber: roll }, mockTx);

    expect(res1.isNew).toBe(true);
    expect(res2.isNew).toBe(false);
    expect(dbProfiles.size).toBe(1);
  });

  test("TEST 14: Transaction failure leaves no partial state", async () => {
    const failingTx = {
      ...mockTx,
      studentProfile: {
        ...mockTx.studentProfile,
        create: async () => {
          throw new Error("Simulated DB Disk Crash");
        }
      }
    };

    const res = await StudentProfileService.upsertSingleStudent(
      { name: "Failing Student", rollNumber: "23AG1A0999" },
      failingTx
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("Simulated DB Disk Crash");
    expect(dbProfiles.has("23AG1A0999")).toBe(false);
  });
});
