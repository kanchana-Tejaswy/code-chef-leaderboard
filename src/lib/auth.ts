import "server-only";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus, UserAccess } from "@prisma/client";

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Returns the underlying Supabase Auth user.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return user;
}

/**
 * Returns the UserAccess record for the currently authenticated user.
 */
export async function getAuthenticatedUserAccess(): Promise<UserAccess | null> {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const userAccess = await prisma.userAccess.findUnique({
    where: { authUserId: user.id }
  });

  return userAccess;
}

/**
 * Ensures an authenticated user exists and returns their UserAccess.
 */
export async function requireAuthenticatedUser(): Promise<UserAccess> {
  const access = await getAuthenticatedUserAccess();
  if (!access) {
    throw new AuthError("Unauthorized", "UNAUTHORIZED");
  }
  return access;
}

/**
 * Ensures the authenticated user exists and is ACTIVE.
 */
export async function requireActiveUser(): Promise<UserAccess> {
  const access = await requireAuthenticatedUser();
  if (access.status !== AccountStatus.ACTIVE) {
    throw new AuthError("Account is not active", "INACTIVE_ACCOUNT");
  }
  return access;
}

/**
 * Ensures the authenticated user is ACTIVE and has one of the allowed roles.
 */
export async function requireRole(...roles: UserRole[]): Promise<UserAccess> {
  const access = await requireActiveUser();
  if (!roles.includes(access.role)) {
    throw new AuthError("Forbidden", "FORBIDDEN_ROLE");
  }
  return access;
}

/**
 * Ensures the user is an ADMIN.
 */
export async function requireAdmin(): Promise<UserAccess> {
  return requireRole(UserRole.ADMIN);
}

/**
 * Ensures the user is an ADMIN, GK_SIR, or HOD.
 */
export async function requireStaffReadAccess(): Promise<UserAccess> {
  return requireRole(UserRole.ADMIN, UserRole.GK_SIR, UserRole.HOD);
}

/**
 * Ensures the user is a STUDENT and owns the specified profile.
 */
export async function requireOwnStudentProfile(studentProfileId: string): Promise<UserAccess> {
  const access = await requireActiveUser();
  if (access.role !== UserRole.STUDENT) {
    throw new AuthError("Must be a student", "NOT_A_STUDENT");
  }
  if (access.studentProfileId !== studentProfileId) {
    throw new AuthError("Forbidden: Not your profile", "FORBIDDEN_PROFILE");
  }
  return access;
}

/**
 * General student profile read access check.
 * - ADMIN / GK_SIR: full access
 * - HOD: access only if department matches
 * - STUDENT: access only if it's their own profile
 */
export async function requireStudentProfileReadAccess(studentProfileId: string): Promise<UserAccess> {
  const access = await requireActiveUser();

  if (access.role === UserRole.ADMIN || access.role === UserRole.GK_SIR) {
    return access;
  }

  if (access.role === UserRole.HOD) {
    if (!access.departmentId) {
      throw new AuthError("HOD missing department ID", "MISSING_DEPARTMENT");
    }
    const targetStudent = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId }
    });
    if (!targetStudent) {
      throw new AuthError("Student not found", "NOT_FOUND");
    }
    if (targetStudent.department !== access.departmentId) {
      throw new AuthError("Forbidden: Student is not in your department", "FORBIDDEN_DEPARTMENT");
    }
    return access;
  }

  if (access.role === UserRole.STUDENT) {
    if (access.studentProfileId !== studentProfileId) {
      throw new AuthError("Forbidden: Not your profile", "FORBIDDEN_PROFILE");
    }
    return access;
  }

  throw new AuthError("Forbidden", "FORBIDDEN");
}
