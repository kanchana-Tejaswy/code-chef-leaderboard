import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { checkPasswordLoginRateLimit } from "../src/services/auth-rate-limit.service";

describe("checkPasswordLoginRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to allow logins when the audit database is unavailable", async () => {
    (prisma.auditLog.findFirst as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    await expect(checkPasswordLoginRateLimit("target-id")).resolves.toEqual({ allowed: true });
  });
});
