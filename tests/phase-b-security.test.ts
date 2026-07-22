import { describe, it, expect, vi } from "vitest";
import { isPublicDemoWriteEnabled, isPublicDemoDeleteEnabled, canPerformWrite, canPerformDelete, hasValidCronSecret, getPublicDemoModeStatus } from "../src/lib/write-access";
import { NextRequest } from "next/server";

describe("Phase B Security - Write Access Hardening", () => {
  it("1. Public demo write is disabled by default in production", () => {
    const originalEnv = process.env.ALLOW_PUBLIC_DEMO_WRITES;
    delete process.env.ALLOW_PUBLIC_DEMO_WRITES;

    expect(isPublicDemoWriteEnabled()).toBe(false);
    expect(isPublicDemoDeleteEnabled()).toBe(false);
    expect(canPerformWrite()).toBe(false);
    expect(canPerformDelete()).toBe(false);

    const status = getPublicDemoModeStatus();
    expect(status.publicDemoWriteMode).toBe(false);
    expect(status.publicDemoDeleteMode).toBe(false);
    expect(status.publicDemoModeActive).toBe(false);

    if (originalEnv) process.env.ALLOW_PUBLIC_DEMO_WRITES = originalEnv;
  });

  it("2. Valid cron secret is accepted", () => {
    process.env.CRON_SECRET = "test_cron_secret_123";
    const req = new NextRequest("http://localhost/api/cron", {
      headers: { authorization: "Bearer test_cron_secret_123" }
    });

    expect(hasValidCronSecret(req)).toBe(true);
  });

  it("3. Invalid cron secret is rejected", () => {
    process.env.CRON_SECRET = "test_cron_secret_123";
    const req1 = new NextRequest("http://localhost/api/cron", {
      headers: { authorization: "Bearer wrong_secret" }
    });
    const req2 = new NextRequest("http://localhost/api/cron", {
      headers: { authorization: "Basic test_cron_secret_123" }
    });
    const req3 = new NextRequest("http://localhost/api/cron");

    expect(hasValidCronSecret(req1)).toBe(false);
    expect(hasValidCronSecret(req2)).toBe(false);
    expect(hasValidCronSecret(req3)).toBe(false);
  });
});
