import { describe, it, expect, vi, beforeEach } from "vitest";
import { StudentProfileService } from "../src/services/student-profile.service";
import { SyncService } from "../src/services/sync.service";
import { AccountStatus } from "@prisma/client";

// Mock dependencies
vi.mock("../src/lib/prisma", () => {
  const mockStudentMap = new Map<string, any>();
  const mockCodechefMap = new Map<string, any>();
  const mockLeetcodeMap = new Map<string, any>();

  const mockNormalizedMap = new Map<string, any>();

  return {
    prisma: {
      studentProfile: {
        findMany: vi.fn().mockImplementation(async (args) => {
          let list = Array.from(mockStudentMap.values());
          if (args?.where?.rollNumber?.in) {
            const set = new Set(args.where.rollNumber.in);
            list = list.filter((s) => set.has(s.rollNumber));
          }
          if (args?.where?.leaderboardEligible) {
            list = list.filter((s) => s.leaderboardEligible === true);
          }
          return list;
        }),
        findUnique: vi.fn().mockImplementation(async (args) => {
          return mockStudentMap.get(args.where.id) || null;
        }),
        create: vi.fn().mockImplementation(async (args) => {
          const newStudent = { ...args.data, createdAt: new Date(), updatedAt: new Date() };
          mockStudentMap.set(newStudent.id, newStudent);
          return newStudent;
        }),
        update: vi.fn().mockImplementation(async (args) => {
          const existing = mockStudentMap.get(args.where.id) || {};
          const updated = { ...existing, ...args.data, updatedAt: new Date() };
          mockStudentMap.set(args.where.id, updated);
          return updated;
        }),
        deleteMany: vi.fn().mockImplementation(async () => {
          mockStudentMap.clear();
          return { count: 0 };
        }),
      },
      codechefProfile: {
        findUnique: vi.fn().mockImplementation(async (args) => mockCodechefMap.get(args.where.studentId) || null),
        upsert: vi.fn().mockImplementation(async (args) => {
          mockCodechefMap.set(args.where.studentId, args.create);
          return args.create;
        }),
      },
      leetcodeProfile: {
        findUnique: vi.fn().mockImplementation(async (args) => mockLeetcodeMap.get(args.where.studentId) || null),
        upsert: vi.fn().mockImplementation(async (args) => {
          mockLeetcodeMap.set(args.where.studentId, args.create);
          return args.create;
        }),
      },
      unifiedProfile: {
        findUnique: vi.fn().mockImplementation(async () => null),
        upsert: vi.fn().mockImplementation(async (args) => args.create),
      },
      normalizedProfile: {
        findUnique: vi.fn().mockImplementation(async (args) => mockNormalizedMap.get(args.where.studentId) || null),
        upsert: vi.fn().mockImplementation(async (args) => {
          mockNormalizedMap.set(args.where.studentId, args.create);
          return args.create;
        }),
      },
      aiAnalysis: {
        findUnique: vi.fn().mockImplementation(async () => null),
        upsert: vi.fn().mockImplementation(async (args) => args.create),
      },
      leaderboardEntry: {
        findUnique: vi.fn().mockImplementation(async () => null),
        findMany: vi.fn().mockImplementation(async () => []),
        upsert: vi.fn().mockImplementation(async (args) => args.create),
        update: vi.fn().mockImplementation(async (args) => args.data),
      },
      syncJob: {
        create: vi.fn().mockImplementation(async () => ({ id: "job-1", status: "RUNNING" })),
        update: vi.fn().mockImplementation(async () => ({ id: "job-1", status: "COMPLETED" })),
      },
      syncLog: {
        create: vi.fn().mockImplementation(async () => ({})),
      },
      activityLog: {
        create: vi.fn().mockImplementation(async () => ({})),
      },
      $transaction: vi.fn().mockImplementation(async (arg) => {
        if (typeof arg === "function") {
          return arg({
            studentProfile: {
              create: async (a: any) => {
                const s = { ...a.data, createdAt: new Date(), updatedAt: new Date() };
                mockStudentMap.set(s.id, s);
                return s;
              },
            },
          });
        }
        return Promise.all(arg);
      }),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn().mockResolvedValue([]),
    },
  };
});

vi.mock("../src/services/codechef.service", () => ({
  CodechefService: {
    fetchData: vi.fn().mockImplementation(async (username: string) => {
      if (username === "invalid_user") throw new Error("404 User not found");
      return {
        username,
        fullName: "Test Coder",
        currentRating: 1500,
        highestRating: 1600,
        stars: 3,
        globalRank: 100,
        countryRank: 50,
        problemsSolved: 120,
      };
    }),
  },
}));

vi.mock("../src/services/leetcode.service", () => ({
  LeetcodeService: {
    fetchData: vi.fn().mockImplementation(async (username: string) => {
      if (username === "invalid_user") throw new Error("404 User not found");
      return {
        username,
        problemsSolved: 200,
        currentRating: 1750,
        globalRank: 12000,
        rawMetrics: { easySolvedCount: 100, mediumSolvedCount: 80, hardSolvedCount: 20 },
      };
    }),
  },
}));

describe("StudentProfile Status Verification & Eligibility Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Newly created profile with valid-looking platform URLs defaults to PENDING_VERIFICATION and ineligible", async () => {
    const data = StudentProfileService.normalizeInput({
      name: "Pending Coder",
      rollNumber: "21CS001",
      email: "pending@ace.edu.in",
      year: 3,
      codechefUsername: "https://www.codechef.com/users/pending_cc",
    });

    const res = await StudentProfileService.createProfile(data);
    expect(res.success).toBe(true);
    expect(res.profile.profileStatus).toBe("PENDING_VERIFICATION");
    expect(res.profile.leaderboardEligible).toBe(false);
    expect(res.profile.dashboardEligible).toBe(false);
    expect(res.profile.profileStatus).not.toBe("ACTIVE");
  });

  it("2. Newly created profile with NO platform URLs defaults to INCOMPLETE and ineligible", async () => {
    const data = StudentProfileService.normalizeInput({
      name: "Incomplete Coder",
      rollNumber: "21CS002",
      email: "incomplete@ace.edu.in",
      year: 2,
    });

    const res = await StudentProfileService.createProfile(data);
    expect(res.success).toBe(true);
    expect(res.profile.profileStatus).toBe("INCOMPLETE");
    expect(res.profile.leaderboardEligible).toBe(false);
    expect(res.profile.dashboardEligible).toBe(false);
    expect(res.profile.profileStatus).not.toBe("ACTIVE");
  });

  it("3. Successfully scraped platform transitions profile to VERIFIED and eligible", async () => {
    const data = StudentProfileService.normalizeInput({
      name: "Verified Coder",
      rollNumber: "21CS003",
      email: "verified@ace.edu.in",
      year: 4,
      codechefUsername: "valid_cc_user",
    });

    const createdRes = await StudentProfileService.createProfile(data);
    const studentId = createdRes.profile.id;

    const syncRes = await SyncService.syncStudent(studentId, "ADMIN_FORCE", true);
    if (!syncRes.success) console.error("Sync test error:", syncRes.error);
    expect(syncRes.success).toBe(true);

    const { prisma } = await import("../src/lib/prisma");
    const updated = await prisma.studentProfile.findUnique({ where: { id: studentId } });

    expect(updated?.profileStatus).toBe("VERIFIED");
    expect(updated?.leaderboardEligible).toBe(true);
    expect(updated?.dashboardEligible).toBe(true);
    expect(updated?.profileStatus).not.toBe("ACTIVE");
  });

  it("4. Failed platform scrape transitions profile to INVALID and ineligible", async () => {
    const data = StudentProfileService.normalizeInput({
      name: "Invalid Coder",
      rollNumber: "21CS004",
      email: "invalid@ace.edu.in",
      year: 1,
      codechefUsername: "invalid_user",
      leetcodeUsername: "invalid_user",
    });

    const createdRes = await StudentProfileService.createProfile(data);
    const studentId = createdRes.profile.id;

    await SyncService.syncStudent(studentId, "ADMIN_FORCE", true);

    const { prisma } = await import("../src/lib/prisma");
    const updated = await prisma.studentProfile.findUnique({ where: { id: studentId } });

    expect(updated?.profileStatus).toBe("INVALID");
    expect(updated?.leaderboardEligible).toBe(false);
    expect(updated?.dashboardEligible).toBe(false);
    expect(updated?.profileStatus).not.toBe("ACTIVE");
  });

  it("5. Never uses ACTIVE as a StudentProfile profileStatus value", async () => {
    const validData = StudentProfileService.normalizeInput({
      name: "Check Active",
      rollNumber: "21CS005",
      email: "checkactive@ace.edu.in",
      year: 3,
      codechefUsername: "cc_user",
    });

    const createdRes = await StudentProfileService.createProfile(validData);
    expect(createdRes.profile.profileStatus).not.toBe("ACTIVE");

    await SyncService.syncStudent(createdRes.profile.id, "ADMIN_FORCE", true);

    const { prisma } = await import("../src/lib/prisma");
    const synced = await prisma.studentProfile.findUnique({ where: { id: createdRes.profile.id } });
    expect(synced?.profileStatus).not.toBe("ACTIVE");
    expect(["INCOMPLETE", "PENDING_VERIFICATION", "VERIFIED", "INVALID"]).toContain(synced?.profileStatus);
  });

  it("6. Preserves UserAccess AccountStatus values (ACTIVE, PENDING, SUSPENDED, DISABLED)", () => {
    expect(AccountStatus.ACTIVE).toBe("ACTIVE");
    expect(AccountStatus.PENDING).toBe("PENDING");
    expect(AccountStatus.SUSPENDED).toBe("SUSPENDED");
    expect(AccountStatus.DISABLED).toBe("DISABLED");
  });
});
