import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthError } from "@/lib/auth";

vi.mock("server-only", () => ({}));

// Mock Auth
vi.mock("@/lib/auth", () => {
  return {
    AuthError: class extends Error {
      code: string;
      constructor(message: string, code: string) {
        super(message);
        this.name = "AuthError";
        this.code = code;
      }
    },
    requireAdmin: vi.fn(),
    requireStaffReadAccess: vi.fn(),
  };
});

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cohort: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    department: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    classSection: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    }
  }
}));

import { requireAdmin, requireStaffReadAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET as getCohorts, POST as postCohort } from "@/app/api/admin/academic/cohorts/route";
import { PATCH as patchCohort } from "@/app/api/admin/academic/cohorts/[id]/route";
import { GET as getDepts, POST as postDept } from "@/app/api/admin/academic/departments/route";
import { PATCH as patchDept } from "@/app/api/admin/academic/departments/[id]/route";
import { GET as getSections, POST as postSection } from "@/app/api/admin/academic/sections/route";
import { PATCH as patchSection } from "@/app/api/admin/academic/sections/[id]/route";

describe("Academic Registry CRUD & Permissions Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. ADMIN Permission writes successfully
  it("ADMIN can create a Cohort successfully", async () => {
    (requireAdmin as any).mockResolvedValue({ id: "admin-id", role: "ADMIN" });
    (prisma.cohort.findUnique as any).mockResolvedValue(null);
    (prisma.cohort.create as any).mockResolvedValue({
      id: "cohort-uuid",
      code: "2024-2028",
      startYear: 2024,
      endYear: 2028,
      status: "ACTIVE"
    });

    const req = new Request("http://localhost/api/admin/academic/cohorts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "2024-2028", startYear: 2024, endYear: 2028 })
    });

    const res = await postCohort(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.cohort.code).toBe("2024-2028");
  });

  // 2. GK_SIR has read-only access (GET allowed, POST denied)
  it("GK_SIR can read cohorts but is forbidden from writing", async () => {
    (requireStaffReadAccess as any).mockResolvedValue({ id: "gksir-id", role: "GK_SIR" });
    (requireAdmin as any).mockRejectedValue(new AuthError("Forbidden", "FORBIDDEN_ROLE"));
    
    (prisma.cohort.findMany as any).mockResolvedValue([
      { id: "c1", code: "2024-2028" }
    ]);
    (prisma.cohort.count as any).mockResolvedValue(1);

    // Read check
    const getReq = new Request("http://localhost/api/admin/academic/cohorts");
    const getRes = await getCohorts(getReq);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.cohorts.length).toBe(1);

    // Write check
    const postReq = new Request("http://localhost/api/admin/academic/cohorts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "2024-2028", startYear: 2024, endYear: 2028 })
    });
    const postRes = await postCohort(postReq);
    expect(postRes.status).toBe(403);
  });

  // 3. HOD scoping read access
  it("HOD query results are scoped to their assigned department", async () => {
    (requireStaffReadAccess as any).mockResolvedValue({ id: "hod-id", role: "HOD", departmentId: "CSE" });
    
    (prisma.department.findFirst as any).mockResolvedValue({ id: "cse-uuid", code: "CSE" });
    (prisma.classSection.findMany as any).mockResolvedValue([
      { id: "sec1", name: "CSE-A", departmentId: "cse-uuid" }
    ]);
    (prisma.classSection.count as any).mockResolvedValue(1);

    const req = new Request("http://localhost/api/admin/academic/sections");
    const res = await getSections(req);
    expect(res.status).toBe(200);
    
    // Verify that the findMany query filter targeted the HOD's department id
    expect(prisma.classSection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          departmentId: "cse-uuid"
        })
      })
    );
  });

  // 4. STUDENT is denied access
  it("STUDENT role is completely denied from accessing endpoints", async () => {
    (requireStaffReadAccess as any).mockRejectedValue(new AuthError("Forbidden", "FORBIDDEN_ROLE"));
    
    const req = new Request("http://localhost/api/admin/academic/cohorts");
    const res = await getCohorts(req);
    expect(res.status).toBe(403);
  });

  // 5. Duplicate Validation
  it("Rejects duplicate cohort year combinations", async () => {
    (requireAdmin as any).mockResolvedValue({ id: "admin-id", role: "ADMIN" });
    (prisma.cohort.findUnique as any).mockImplementation((args: any) => {
      // Return existing record when checking combination
      if (args.where.startYear_endYear) {
        return Promise.resolve({ id: "existing-combo-id" });
      }
      return Promise.resolve(null);
    });

    const req = new Request("http://localhost/api/admin/academic/cohorts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "2024-2028", startYear: 2024, endYear: 2028 })
    });

    const res = await postCohort(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("combination");
  });

  // 6. Archived parent validation
  it("Rejects creating a class section under an archived cohort", async () => {
    (requireAdmin as any).mockResolvedValue({ id: "admin-id", role: "ADMIN" });
    
    // Mock cohort as archived
    (prisma.cohort.findUnique as any).mockResolvedValue({
      id: "cohort-uuid",
      code: "2024-2028",
      status: "ARCHIVED"
    });

    const req = new Request("http://localhost/api/admin/academic/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cohortId: "cohort-uuid",
        departmentId: "dept-uuid",
        name: "CSE-A"
      })
    });

    const res = await postSection(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("archived cohort");
  });

  // 7. Invalid relationship values (StartYear >= EndYear)
  it("Rejects cohort if startYear is not earlier than endYear", async () => {
    (requireAdmin as any).mockResolvedValue({ id: "admin-id", role: "ADMIN" });

    const req = new Request("http://localhost/api/admin/academic/cohorts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "2028-2024", startYear: 2028, endYear: 2024 })
    });

    const res = await postCohort(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("earlier than end year");
  });
});
