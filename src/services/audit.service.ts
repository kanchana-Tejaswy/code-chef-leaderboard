import "server-only";
import { prisma } from "@/lib/prisma";

export const AuditAction = {
  ADMIN_BOOTSTRAPPED: "ADMIN_BOOTSTRAPPED",
  ADMIN_BOOTSTRAP_PREVIEWED: "ADMIN_BOOTSTRAP_PREVIEWED",
  USER_ACCESS_CREATED: "USER_ACCESS_CREATED",
  AUTH_USER_CREATED: "AUTH_USER_CREATED",
  AUTH_USER_LINKED: "AUTH_USER_LINKED",
  STUDENT_ACCOUNT_PROVISIONED: "STUDENT_ACCOUNT_PROVISIONED",
  STAFF_ACCOUNT_PROVISIONED: "STAFF_ACCOUNT_PROVISIONED",
  ACCESS_ACCOUNT_VIEWED: "ACCESS_ACCOUNT_VIEWED",
  STAFF_PROVISION_REQUESTED: "STAFF_PROVISION_REQUESTED",
  STAFF_PROVISIONED: "STAFF_PROVISIONED",
  STUDENT_PROVISION_PREVIEWED: "STUDENT_PROVISION_PREVIEWED",
  STUDENT_PROVISION_BATCH_STARTED: "STUDENT_PROVISION_BATCH_STARTED",
  STUDENT_PROVISION_BATCH_COMPLETED: "STUDENT_PROVISION_BATCH_COMPLETED",
  STUDENT_PROVISION_CONFLICT: "STUDENT_PROVISION_CONFLICT",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  ACCOUNT_RESTORED: "ACCOUNT_RESTORED",
  ACCOUNT_STATUS_CHANGE_REJECTED: "ACCOUNT_STATUS_CHANGE_REJECTED",
  ACCOUNT_CONFLICT: "ACCOUNT_CONFLICT",
  UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",
  FIRST_LOGIN_OTP_REQUESTED: "FIRST_LOGIN_OTP_REQUESTED",
  FIRST_LOGIN_OTP_REJECTED: "FIRST_LOGIN_OTP_REJECTED",
  FIRST_LOGIN_OTP_RATE_LIMITED: "FIRST_LOGIN_OTP_RATE_LIMITED",
  FIRST_LOGIN_OTP_VERIFIED: "FIRST_LOGIN_OTP_VERIFIED",
  FIRST_LOGIN_OTP_FAILED: "FIRST_LOGIN_OTP_FAILED",
  FIRST_LOGIN_SESSION_CREATED: "FIRST_LOGIN_SESSION_CREATED",
  FIRST_PASSWORD_SET: "FIRST_PASSWORD_SET",
  FIRST_PASSWORD_SET_FAILED: "FIRST_PASSWORD_SET_FAILED",
  ACCOUNT_ACTIVATED: "ACCOUNT_ACTIVATED",
  PASSWORD_LOGIN_SUCCESS: "PASSWORD_LOGIN_SUCCESS",
  PASSWORD_LOGIN_FAILED: "PASSWORD_LOGIN_FAILED",
  PASSWORD_LOGIN_RATE_LIMITED: "PASSWORD_LOGIN_RATE_LIMITED",
  SESSION_LOGOUT: "SESSION_LOGOUT",
  SESSION_MISMATCH: "SESSION_MISMATCH",
  ACCOUNT_STATE_CONFLICT: "ACCOUNT_STATE_CONFLICT",
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];

interface AuditEventParams {
  actorUserId?: string | null;
  action: AuditActionType | string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "otp",
  "token",
  "secret",
  "access_token",
  "refresh_token",
  "service_role_key",
  "authorization",
]);

function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
  if (!metadata) return undefined;

  const sanitized = { ...metadata };
  
  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    }
  }

  // Limit size to prevent bloating
  const str = JSON.stringify(sanitized);
  if (str.length > 5000) {
    return {
      _error: "Metadata too large and was truncated",
      truncated: str.substring(0, 1000) + "..."
    };
  }

  return sanitized;
}

export async function recordAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    const sanitizedMetadata = sanitizeMetadata(params.metadata);

    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: sanitizedMetadata || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      }
    });
  } catch (error) {
    // Log the internal logging failure safely
    console.error("[Audit Service] Failed to record audit event:", {
      error: error instanceof Error ? error.message : String(error),
      action: params.action,
      targetId: params.targetId,
    });
    // Do not throw to avoid crashing the main authentication operation
  }
}
