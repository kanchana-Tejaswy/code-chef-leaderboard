import "server-only";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus } from "@prisma/client";
import { createAdminClient } from "@/utils/supabase/admin";
import { recordAuditEvent, AuditAction } from "./audit.service";
import { normalizeEmail, normalizeRollNumber, normalizeStudentLoginId, normalizeStaffLoginId } from "@/utils/normalization";

export type ProvisionResultType = "CREATED" | "LINKED" | "ALREADY_PROVISIONED" | "SKIPPED_INVALID" | "CONFLICT" | "FAILED" | "PARTIAL_FAILURE";

export interface ProvisionResult {
  status: ProvisionResultType;
  message: string;
}

/**
 * Creates or locates a Supabase auth user by email.
 */
async function provisionAuthUser(email: string): Promise<{ authUserId: string; isNew: boolean } | null> {
  const adminClient = createAdminClient();

  // 1. Try to create the user
  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: false,
  });

  if (createData?.user && !createError) {
    return { authUserId: createData.user.id, isNew: true };
  }

  // 2. If it failed, it might be because the user already exists. We try to find them.
  // We use listUsers which supports searching or we can fetch a batch.
  // GoTrue API doesn't have a direct getUserByEmail, so we paginate listUsers.
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });
    if (listError || !listData?.users || listData.users.length === 0) {
      break;
    }

    const match = listData.users.find(u => u.email === email);
    if (match) {
      return { authUserId: match.id, isNew: false };
    }

    if (listData.users.length < perPage) {
      break;
    }
    page++;
  }

  console.error(`Failed to provision auth user for ${email}`, createError);
  return null;
}

export async function provisionStudentAccount(studentProfileId: string, dbClient: any = prisma): Promise<ProvisionResult> {
  try {
    const student = await dbClient.studentProfile.findUnique({
      where: { id: studentProfileId }
    });

    if (!student) {
      return { status: "FAILED", message: "Student profile not found" };
    }

    const email = student.email ? normalizeEmail(student.email) : null;
    const rollNumber = normalizeRollNumber(student.rollNumber || "");
    const loginId = rollNumber ? normalizeStudentLoginId(rollNumber) : null;

    if (!rollNumber || !loginId) {
      return { status: "SKIPPED_INVALID", message: "Student has invalid roll number" };
    }

    // Check for existing UserAccess conflicts
    const existingByProfile = await dbClient.userAccess.findUnique({ where: { studentProfileId } });
    const existingByLogin = await dbClient.userAccess.findUnique({ where: { loginId } });

    if (existingByProfile && existingByProfile.authUserId) {
      return { status: "ALREADY_PROVISIONED", message: "Student already provisioned" };
    }

    if (existingByLogin && existingByLogin.studentProfileId !== studentProfileId) {
      await recordAuditEvent({
        action: AuditAction.ACCOUNT_CONFLICT,
        targetType: "StudentProfile",
        targetId: studentProfileId,
        metadata: { reason: "Login ID conflict" }
      });
      return { status: "CONFLICT", message: "Login ID is already in use" };
    }

    const authEmail = email || `${loginId.toLowerCase()}@student.aceec.ac.in`;
    const adminClient = createAdminClient();

    // Provision or locate Supabase Auth user with initial password = loginId (normalized roll number)
    let authUserId: string | null = null;
    let isNewAuthUser = false;

    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password: loginId, // Initial password = normalized roll number
      email_confirm: true,
      user_metadata: { role: UserRole.STUDENT, rollNumber: loginId }
    });

    if (createData?.user && !createError) {
      authUserId = createData.user.id;
      isNewAuthUser = true;
    } else {
      // Find existing auth user by email
      const { data: listData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = listData?.users?.find(u => u.email === authEmail);
      if (match) {
        authUserId = match.id;
      }
    }

    if (!authUserId) {
      return { status: "FAILED", message: "Failed to create or locate Supabase auth user" };
    }

    // Create or update UserAccess record using dbClient
    try {
      const executeUserAccessUpsert = async (tx: any) => {
        await tx.userAccess.upsert({
          where: { loginId },
          update: {
            authUserId,
            email: email || undefined,
            role: UserRole.STUDENT,
            status: AccountStatus.ACTIVE,
            studentProfileId,
            departmentId: student.department || null,
          },
          create: {
            authUserId,
            email: email || null,
            loginId,
            role: UserRole.STUDENT,
            status: AccountStatus.ACTIVE,
            studentProfileId,
            departmentId: student.department || null,
            mustSetPassword: true,
            firstLoginCompleted: false,
          }
        });
      };

      if ((dbClient as any)?._isTransaction) {
        await executeUserAccessUpsert(dbClient);
      } else {
        await prisma.$transaction(async (tx) => executeUserAccessUpsert(tx));
      }
    } catch (txError) {
      await recordAuditEvent({
        action: AuditAction.ACCOUNT_CONFLICT,
        targetType: "StudentProfile",
        targetId: studentProfileId,
        metadata: { reason: "Prisma write failed after Supabase user was ready", error: String(txError) }
      });
      return { status: "PARTIAL_FAILURE", message: "PARTIAL_FAILURE: Auth user ready but database write failed" };
    }

    await recordAuditEvent({
      action: isNewAuthUser ? AuditAction.AUTH_USER_CREATED : AuditAction.AUTH_USER_LINKED,
      targetType: "StudentProfile",
      targetId: studentProfileId,
    });
    
    await recordAuditEvent({
      action: AuditAction.STUDENT_ACCOUNT_PROVISIONED,
      targetType: "StudentProfile",
      targetId: studentProfileId,
    });

    return { status: isNewAuthUser ? "CREATED" : "LINKED", message: "Successfully provisioned student account" };

  } catch (err) {
    console.error("Failed to provision student:", err);
    return { status: "FAILED", message: "Internal error during provisioning" };
  }
}

interface StaffProvisionParams {
  email: string;
  role: UserRole;
  departmentId?: string | null;
  approvedBy?: string;
}

export async function provisionStaffAccount(params: StaffProvisionParams): Promise<ProvisionResult> {
  try {
    const { email: rawEmail, role, departmentId, approvedBy } = params;

    if (role === UserRole.STUDENT) {
      return { status: "FAILED", message: "Cannot provision a STUDENT via staff provisioning" };
    }

    if (role === UserRole.HOD && !departmentId) {
      return { status: "FAILED", message: "HOD requires a departmentId" };
    }

    const email = normalizeEmail(rawEmail);
    if (!email) {
      return { status: "SKIPPED_INVALID", message: "Invalid email" };
    }
    
    const loginId = normalizeStaffLoginId(email);
    if (!loginId) {
      return { status: "SKIPPED_INVALID", message: "Invalid login ID" };
    }

    const existingByEmail = await prisma.userAccess.findUnique({ where: { email } });
    if (existingByEmail) {
      if (existingByEmail.role !== role) {
        return { status: "CONFLICT", message: "User exists with a different role" };
      }
      if (existingByEmail.authUserId) {
        return { status: "ALREADY_PROVISIONED", message: "Staff account already provisioned" };
      }
    }

    const authRes = await provisionAuthUser(email);
    if (!authRes) {
      return { status: "FAILED", message: "Failed to create or locate Supabase user" };
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.userAccess.upsert({
          where: { email },
          update: {
            authUserId: authRes.authUserId,
            loginId,
            role,
            status: AccountStatus.PENDING,
            departmentId: departmentId || null,
            mustSetPassword: true,
            firstLoginCompleted: false,
            approvedAt: new Date(),
            approvedBy: approvedBy || null,
          },
          create: {
            authUserId: authRes.authUserId,
            email,
            loginId,
            role,
            status: AccountStatus.PENDING,
            departmentId: departmentId || null,
            mustSetPassword: true,
            firstLoginCompleted: false,
            approvedAt: new Date(),
            approvedBy: approvedBy || null,
          }
        });
      });
    } catch (txError) {
      await recordAuditEvent({
        action: AuditAction.ACCOUNT_CONFLICT,
        targetType: "UserAccess",
        metadata: { reason: "Prisma write failed after Supabase staff user was ready", error: String(txError) }
      });
      return { status: "PARTIAL_FAILURE", message: "PARTIAL_FAILURE: Auth user ready but database write failed" };
    }

    await recordAuditEvent({
      action: authRes.isNew ? AuditAction.AUTH_USER_CREATED : AuditAction.AUTH_USER_LINKED,
      targetType: "UserAccess",
      metadata: { email },
    });
    
    await recordAuditEvent({
      action: AuditAction.STAFF_ACCOUNT_PROVISIONED,
      targetType: "UserAccess",
      metadata: { email, role, departmentId },
    });

    return { status: authRes.isNew ? "CREATED" : "LINKED", message: "Successfully provisioned staff account" };

  } catch (err) {
    console.error("Failed to provision staff:", err);
    return { status: "FAILED", message: "Internal error during provisioning" };
  }
}
