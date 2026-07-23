import "server-only";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { UserRole, AccountStatus, UserAccess } from "@prisma/client";
import { redirect } from "next/navigation";

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

  if (!userAccess) return null;

  // Security Check: Ensure session email matches DB email (when DB email exists, mainly staff)
  if (userAccess.email && user.email?.toLowerCase() !== userAccess.email.toLowerCase()) {
    return null;
  }

  return userAccess;
}

/**
 * Ensures an authenticated user exists and returns their UserAccess.
 * Used by API routes (throws AuthError for 401 JSON).
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
 * Used by API routes (throws AuthError for 401/403 JSON).
 */
export async function requireActiveUser(): Promise<UserAccess> {
  const access = await requireAuthenticatedUser();
  if (access.status === AccountStatus.PENDING) {
    throw new AuthError("Password setup required", "PENDING_ACCOUNT");
  }
  if (access.status !== AccountStatus.ACTIVE) {
    throw new AuthError("Account is not active", "INACTIVE_ACCOUNT");
  }
  return access;
}

/**
 * Ensures the authenticated user is ACTIVE and has one of the allowed roles.
 * Used by API routes (throws AuthError for 403 JSON).
 */
export async function requireRole(...roles: UserRole[]): Promise<UserAccess> {
  const access = await requireActiveUser();
  if (!roles.includes(access.role)) {
    throw new AuthError("Forbidden", "FORBIDDEN_ROLE");
  }
  return access;
}

/**
 * Ensures the user is an ADMIN (API Routes).
 */
export async function requireAdmin(): Promise<UserAccess> {
  return requireRole(UserRole.ADMIN);
}

/**
 * Ensures the user is an ADMIN, GK_SIR, or HOD (API Routes).
 */
export async function requireStaffReadAccess(): Promise<UserAccess> {
  return requireRole(UserRole.ADMIN, UserRole.GK_SIR, UserRole.HOD);
}

/**
 * Ensures the user is a STUDENT and owns the specified profile (API Routes).
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
 * General student profile read access check (API Routes).
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

export function getRoleHomePath(access: UserAccess | null): string {
  if (!access) {
    return "/login";
  }
  if (access.status !== AccountStatus.ACTIVE) {
    return "/login";
  }
  switch (access.role) {
    case UserRole.ADMIN:
      return "/dashboard";
    case UserRole.GK_SIR:
    case UserRole.HOD:
      return "/leaderboard";
    case UserRole.STUDENT:
      return access.studentProfileId ? `/student/${access.studentProfileId}` : "/login";
    default:
      return "/login";
  }
}

export async function requireDashboardAccess(): Promise<UserAccess> {
  return requireAdmin();
}

export async function requireLeaderboardAccess(): Promise<UserAccess> {
  return requireRole(UserRole.ADMIN, UserRole.GK_SIR, UserRole.HOD, UserRole.STUDENT);
}

export async function requireDepartmentScope(): Promise<string | null> {
  const access = await requireActiveUser();
  if (access.role === UserRole.HOD) {
    if (!access.departmentId) {
      throw new AuthError("HOD missing department ID", "MISSING_DEPARTMENT");
    }
    return access.departmentId;
  }
  return null;
}

export async function requireStudentWriteAccess(): Promise<UserAccess> {
  return requireAdmin();
}

export async function requireRefreshAccess(): Promise<UserAccess> {
  return requireAdmin();
}

export async function requireProfileEditAccess(studentProfileId: string): Promise<UserAccess> {
  return requireAdmin();
}

// -----------------------------------------------------------------------------
// PAGE AUTH HELPERS (Used strictly by Server Component Layouts & Pages)
// -----------------------------------------------------------------------------

export async function requireAuthenticatedPageUser(): Promise<UserAccess> {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  const access = await prisma.userAccess.findUnique({
    where: { authUserId: user.id }
  });

  if (!access) {
    redirect("/login?error=unauthorized");
  }

  if (access.email && user.email?.toLowerCase() !== access.email.toLowerCase()) {
    redirect("/login?error=session_mismatch");
  }

  return access;
}

export async function requireActivePageUser(): Promise<UserAccess> {
  const access = await requireAuthenticatedPageUser();

  if (access.status === AccountStatus.SUSPENDED) {
    redirect("/login?error=account_suspended");
  }
  if (access.status === AccountStatus.DISABLED) {
    redirect("/login?error=account_disabled");
  }
  if (access.status === AccountStatus.PENDING || access.mustSetPassword) {
    redirect("/login?error=account_pending");
  }
  if (access.status !== AccountStatus.ACTIVE) {
    redirect("/login?error=inactive_account");
  }

  return access;
}

export async function requirePageRole(...roles: UserRole[]): Promise<UserAccess> {
  const access = await requireActivePageUser();
  if (!roles.includes(access.role)) {
    redirect(getRoleHomePath(access));
  }
  return access;
}

export async function requireAdminPageAccess(): Promise<UserAccess> {
  return requirePageRole(UserRole.ADMIN);
}

export async function requireStaffReadPageAccess(): Promise<UserAccess> {
  return requirePageRole(UserRole.ADMIN, UserRole.GK_SIR, UserRole.HOD);
}

export async function requireDashboardPageAccess(): Promise<UserAccess> {
  return requireAdminPageAccess();
}

export async function requireLeaderboardPageAccess(): Promise<UserAccess> {
  return requirePageRole(UserRole.ADMIN, UserRole.GK_SIR, UserRole.HOD, UserRole.STUDENT);
}

export async function requireStudentProfileReadPageAccess(studentProfileId: string): Promise<UserAccess> {
  const access = await requireActivePageUser();

  if (access.role === UserRole.ADMIN || access.role === UserRole.GK_SIR) {
    return access;
  }

  if (access.role === UserRole.HOD) {
    if (!access.departmentId) {
      redirect("/login?error=missing_department");
    }
    const targetStudent = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId }
    });
    if (!targetStudent || targetStudent.department !== access.departmentId) {
      redirect("/leaderboard");
    }
    return access;
  }

  if (access.role === UserRole.STUDENT) {
    if (access.studentProfileId !== studentProfileId) {
      redirect(getRoleHomePath(access));
    }
    return access;
  }

  redirect("/login");
}
