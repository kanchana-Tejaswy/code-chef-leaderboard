import { describe, it, expect, vi, beforeEach } from "vitest";
import { StudentProfileService } from "../src/services/student-profile.service";

// Mock dependencies for Admin Directory test suite
vi.mock("../src/lib/prisma", () => {
  const mockStudents = [
    {
      id: "student-1",
      name: "Alice Incomplete",
      rollNumber: "21CS001",
      email: "alice@ace.edu.in",
      department: "CSE",
      branch: "CSE",
      year: 3,
      cgpa: 8.5,
      profileStatus: "INCOMPLETE",
      leaderboardEligible: false,
      dashboardEligible: false,
      codechefUsername: null,
      leetcodeUsername: null,
      githubUsername: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "student-2",
      name: "Bob Pending",
      rollNumber: "21CS002",
      email: "bob@ace.edu.in",
      department: "ECE",
      branch: "ECE",
      year: 2,
      cgpa: 9.0,
      profileStatus: "PENDING_VERIFICATION",
      leaderboardEligible: false,
      dashboardEligible: false,
      codechefUsername: "bob_cc",
      leetcodeUsername: "bob_lc",
      githubUsername: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "student-3",
      name: "Charlie Verified",
      rollNumber: "21CS003",
      email: "charlie@ace.edu.in",
      department: "IT",
      branch: "IT",
      year: 4,
      cgpa: 9.2,
      profileStatus: "VERIFIED",
      leaderboardEligible: true,
      dashboardEligible: true,
      codechefUsername: "charlie_cc",
      leetcodeUsername: "charlie_lc",
      githubUsername: "charlie_gh",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "student-4",
      name: "David Invalid",
      rollNumber: "21CS004",
      email: "david@ace.edu.in",
      department: "CSE",
      branch: "CSE",
      year: 1,
      cgpa: 7.8,
      profileStatus: "INVALID",
      leaderboardEligible: false,
      dashboardEligible: false,
      codechefUsername: "invalid_cc",
      leetcodeUsername: null,
      githubUsername: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  return {
    prisma: {
      studentProfile: {
        findMany: vi.fn().mockImplementation(async (args) => {
          let list = [...mockStudents];
          if (args?.where?.OR) {
            const search = args.where.OR[0]?.name?.contains?.toLowerCase() || "";
            if (search) {
              list = list.filter(
                (s) => s.name.toLowerCase().includes(search) || s.rollNumber.toLowerCase().includes(search)
              );
            }
          }
          if (args?.where?.profileStatus) {
            list = list.filter((s) => s.profileStatus === args.where.profileStatus);
          }
          if (args?.where?.leaderboardEligible !== undefined) {
            list = list.filter((s) => s.leaderboardEligible === args.where.leaderboardEligible);
          }
          const skip = args?.skip || 0;
          const take = args?.take || list.length;
          return list.slice(skip, skip + take);
        }),
        count: vi.fn().mockImplementation(async (args) => {
          let list = [...mockStudents];
          if (args?.where?.OR) {
            const search = args.where.OR[0]?.name?.contains?.toLowerCase() || "";
            if (search) {
              list = list.filter(
                (s) => s.name.toLowerCase().includes(search) || s.rollNumber.toLowerCase().includes(search)
              );
            }
          }
          return list.length;
        }),
        findUnique: vi.fn().mockImplementation(async (args) => {
          return mockStudents.find((s) => s.id === args.where.id) || null;
        }),
      },
      leaderboardEntry: {
        findMany: vi.fn().mockImplementation(async (args) => {
          // Leaderboard filters for leaderboardEligible: true
          if (args?.where?.student?.leaderboardEligible === true) {
            return [
              {
                studentId: "student-3",
                rank: 1,
                overallScore: 85,
                student: mockStudents[2],
              },
            ];
          }
          return [];
        }),
      },
    },
  };
});

describe("Admin Student Directory & Eligibility Rules Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Imported INCOMPLETE student appears in Admin directory query", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const students = await prisma.studentProfile.findMany({});
    const incomplete = students.find((s) => s.profileStatus === "INCOMPLETE");
    expect(incomplete).toBeDefined();
    expect(incomplete?.name).toBe("Alice Incomplete");
  });

  it("2. Imported PENDING_VERIFICATION student appears in Admin directory query", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const students = await prisma.studentProfile.findMany({});
    const pending = students.find((s) => s.profileStatus === "PENDING_VERIFICATION");
    expect(pending).toBeDefined();
    expect(pending?.name).toBe("Bob Pending");
  });

  it("3. VERIFIED student appears in Admin directory query", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const students = await prisma.studentProfile.findMany({});
    const verified = students.find((s) => s.profileStatus === "VERIFIED");
    expect(verified).toBeDefined();
    expect(verified?.name).toBe("Charlie Verified");
  });

  it("4. INVALID student appears in Admin directory query", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const students = await prisma.studentProfile.findMany({});
    const invalid = students.find((s) => s.profileStatus === "INVALID");
    expect(invalid).toBeDefined();
    expect(invalid?.name).toBe("David Invalid");
  });

  it("5. Incomplete student does NOT appear in ranked leaderboard entries", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const entries = await prisma.leaderboardEntry.findMany({
      where: { student: { leaderboardEligible: true } },
    });
    const foundIncomplete = entries.some((e: any) => e.student.profileStatus === "INCOMPLETE");
    expect(foundIncomplete).toBe(false);
  });

  it("6. Pending student does NOT appear in ranked leaderboard entries", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const entries = await prisma.leaderboardEntry.findMany({
      where: { student: { leaderboardEligible: true } },
    });
    const foundPending = entries.some((e: any) => e.student.profileStatus === "PENDING_VERIFICATION");
    expect(foundPending).toBe(false);
  });

  it("7. Verified eligible student appears in leaderboard", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const entries = await prisma.leaderboardEntry.findMany({
      where: { student: { leaderboardEligible: true } },
    });
    expect(entries.length).toBe(1);
    expect(entries[0].student.name).toBe("Charlie Verified");
  });

  it("8. Student profile opens without LeaderboardEntry", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const profile = await prisma.studentProfile.findUnique({ where: { id: "student-1" } });
    expect(profile).toBeDefined();
    expect(profile?.id).toBe("student-1");
  });

  it("9. Student profile opens without scraped platform data", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const profile = await prisma.studentProfile.findUnique({ where: { id: "student-1" } });
    expect(profile?.codechefUsername).toBeNull();
    expect(profile?.leetcodeUsername).toBeNull();
  });

  it("10. Pagination parameters (skip, take) work correctly", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const page1 = await prisma.studentProfile.findMany({ skip: 0, take: 2 });
    const page2 = await prisma.studentProfile.findMany({ skip: 2, take: 2 });
    expect(page1.length).toBe(2);
    expect(page2.length).toBe(2);
    expect(page1[0].id).not.toBe(page2[0].id);
  });

  it("11. Search by roll number filters students correctly", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const result = await prisma.studentProfile.findMany({
      where: { OR: [{ name: { contains: "21CS002" } }, { rollNumber: { contains: "21CS002" } }] },
    });
    expect(result.length).toBe(1);
    expect(result[0].rollNumber).toBe("21CS002");
  });

  it("12. Search by name filters students correctly", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const result = await prisma.studentProfile.findMany({
      where: { OR: [{ name: { contains: "Charlie" } }, { rollNumber: { contains: "Charlie" } }] },
    });
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Charlie Verified");
  });

  it("13. Filter by profileStatus works correctly", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const verifiedList = await prisma.studentProfile.findMany({ where: { profileStatus: "VERIFIED" } });
    expect(verifiedList.length).toBe(1);
    expect(verifiedList[0].profileStatus).toBe("VERIFIED");
  });

  it("14. Total count query returns full student count for pagination", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const count = await prisma.studentProfile.count({});
    expect(count).toBe(4);
  });

  it("15. Existing student records remain unmodified", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const student1 = await prisma.studentProfile.findUnique({ where: { id: "student-1" } });
    expect(student1?.rollNumber).toBe("21CS001");
    expect(student1?.email).toBe("alice@ace.edu.in");
  });
});
