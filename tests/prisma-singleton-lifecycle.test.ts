import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

describe("Prisma Client Singleton & Lifecycle Tests", () => {
  it("Resolves repeated property access to the exact same PrismaClient instance", () => {
    const client1 = (prisma as any).studentProfile;
    const client2 = (prisma as any).studentProfile;
    const cohortClient1 = (prisma as any).cohort;
    const cohortClient2 = (prisma as any).cohort;

    expect(client1).toBeDefined();
    expect(client1).toBe(client2);
    expect(cohortClient1).toBeDefined();
    expect(cohortClient1).toBe(cohortClient2);
  });

  it("Executes property access on the same underlying client instance", () => {
    const p1 = (prisma as any).studentProfile;
    const p2 = (prisma as any).studentProfile;
    
    // Check that model properties reference the identical model object
    expect(p1).toBe(p2);
  });
});
