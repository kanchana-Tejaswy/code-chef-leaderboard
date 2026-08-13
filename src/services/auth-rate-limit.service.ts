import "server-only";
import { prisma } from "@/lib/prisma";
import { AuditAction } from "./audit.service";
import crypto from "crypto";

async function safeAuditLookup<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[Auth Rate Limit] Audit lookup failed, falling back gracefully:", message);
    return fallback;
  }
}

export const RATE_LIMIT_CONFIG = {
  OTP_REQUEST_COOLDOWN_SECONDS: 60,
  OTP_REQUEST_MAX_PER_HOUR: 5,
  OTP_VERIFY_MAX_FAILED_PER_15_MIN: 5,
  PASSWORD_LOGIN_MAX_FAILED_PER_15_MIN: 5,
} as const;

export function hashIdentifier(identifier: string): string {
  return crypto.createHash("sha256").update(identifier).digest("hex");
}

export async function checkOtpRequestRateLimit(
  targetId: string,
  isKnownAccount: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  // targetId will be UserAccess.id if known, or SHA-256 hash if unknown.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const cooldownAgo = new Date(Date.now() - RATE_LIMIT_CONFIG.OTP_REQUEST_COOLDOWN_SECONDS * 1000);

  // 1. Check if an OTP was requested within the cooldown period
  const recentRequest = await safeAuditLookup(
    () => prisma.auditLog.findFirst({
      where: {
        action: AuditAction.FIRST_LOGIN_OTP_REQUESTED,
        targetId: targetId,
        createdAt: { gte: cooldownAgo },
      },
      select: { id: true },
    }),
    null
  );

  if (recentRequest) {
    return { allowed: false, reason: "COOLDOWN_ACTIVE" };
  }

  // 2. Check total requests in the last hour
  const hourlyCount = await safeAuditLookup(
    () => prisma.auditLog.count({
      where: {
        action: AuditAction.FIRST_LOGIN_OTP_REQUESTED,
        targetId: targetId,
        createdAt: { gte: oneHourAgo },
      },
    }),
    0
  );

  if (hourlyCount >= RATE_LIMIT_CONFIG.OTP_REQUEST_MAX_PER_HOUR) {
    return { allowed: false, reason: "HOURLY_LIMIT_EXCEEDED" };
  }

  return { allowed: true };
}

export async function checkOtpVerifyRateLimit(
  targetId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

  // Get the most recent successful verification
  const lastSuccess = await safeAuditLookup(
    () => prisma.auditLog.findFirst({
      where: {
        action: AuditAction.FIRST_LOGIN_OTP_VERIFIED,
        targetId: targetId,
        createdAt: { gte: fifteenMinsAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    null
  );

  // Count failed attempts since the last success (or since 15 mins ago)
  const failedCount = await safeAuditLookup(
    () => prisma.auditLog.count({
      where: {
        action: AuditAction.FIRST_LOGIN_OTP_FAILED,
        targetId: targetId,
        createdAt: {
          gte: lastSuccess ? lastSuccess.createdAt : fifteenMinsAgo,
        },
      },
    }),
    0
  );

  if (failedCount >= RATE_LIMIT_CONFIG.OTP_VERIFY_MAX_FAILED_PER_15_MIN) {
    return { allowed: false, reason: "MAX_FAILED_ATTEMPTS_EXCEEDED" };
  }

  return { allowed: true };
}

export async function checkPasswordLoginRateLimit(
  targetId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

  // Get the most recent successful password login
  const lastSuccess = await safeAuditLookup(
    () => prisma.auditLog.findFirst({
      where: {
        action: AuditAction.PASSWORD_LOGIN_SUCCESS,
        targetId: targetId,
        createdAt: { gte: fifteenMinsAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    null
  );

  // Count failed attempts since the last success (or since 15 mins ago)
  const failedCount = await safeAuditLookup(
    () => prisma.auditLog.count({
      where: {
        action: AuditAction.PASSWORD_LOGIN_FAILED,
        targetId: targetId,
        createdAt: {
          gte: lastSuccess ? lastSuccess.createdAt : fifteenMinsAgo,
        },
      },
    }),
    0
  );

  if (failedCount >= RATE_LIMIT_CONFIG.PASSWORD_LOGIN_MAX_FAILED_PER_15_MIN) {
    return { allowed: false, reason: "MAX_FAILED_ATTEMPTS_EXCEEDED" };
  }

  return { allowed: true };
}
