import * as dotenv from "dotenv";
import { resolve } from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "../src/lib/prisma";
import { UserRole, AccountStatus } from "@prisma/client";
import { normalizeEmail, normalizeStaffLoginId } from "../src/utils/normalization";
import { validateAdminPassword, promptHiddenPassword } from "./set-admin-password";
import { recordAuditEvent, AuditAction } from "../src/services/audit.service";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env.production") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

export interface ProvisionAdminOptions {
  email?: string;
  password?: string;
  confirmPassword?: string;
  supabaseClient?: SupabaseClient;
  inputStream?: NodeJS.ReadableStream;
  outputStream?: NodeJS.WritableStream;
}

export interface ProvisionAdminResult {
  success: boolean;
  message: string;
  status: "CREATED" | "ALREADY_EXISTS" | "FAILED" | "SKIPPED_INVALID";
  userAccessId?: string;
  authUserId?: string;
}

export async function processAdminAccountProvisioning(
  options: ProvisionAdminOptions = {}
): Promise<ProvisionAdminResult> {
  const inputStream = options.inputStream || process.stdin;
  const outputStream = options.outputStream || process.stdout;

  const rawEmail = options.email || process.env.NEW_ADMIN_EMAIL || "mohammedyounusshariff@aceec.ac.in";
  const email = normalizeEmail(rawEmail);

  if (!email) {
    const errorMsg = `Invalid email provided: "${rawEmail}"`;
    outputStream.write(`${errorMsg}\n`);
    return { success: false, message: errorMsg, status: "SKIPPED_INVALID" };
  }

  const loginId = normalizeStaffLoginId(email);
  if (!loginId) {
    const errorMsg = `Unable to generate login ID for email: "${email}"`;
    outputStream.write(`${errorMsg}\n`);
    return { success: false, message: errorMsg, status: "SKIPPED_INVALID" };
  }

  outputStream.write(`[Admin Provisioning] Checking existing accounts for: ${email}...\n`);

  // 1. Supabase Client Setup
  let supabase = options.supabaseClient;
  if (!supabase) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      const errorMsg = "Error: Missing Supabase Admin credentials (SUPABASE_SERVICE_ROLE_KEY).";
      outputStream.write(`${errorMsg}\n`);
      return { success: false, message: errorMsg, status: "FAILED" };
    }
    supabase = createClient(url, key);
  }

  // 2. Pre-Check: Check if account already exists in database UserAccess
  const existingUserAccess = await prisma.userAccess.findFirst({
    where: {
      OR: [
        { email },
        { loginId }
      ]
    }
  });

  // 3. Pre-Check: Check if account already exists in Supabase Auth
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    const errorMsg = `Error querying Supabase Auth: ${listErr.message}`;
    outputStream.write(`${errorMsg}\n`);
    return { success: false, message: errorMsg, status: "FAILED" };
  }

  const existingAuthUser = listData?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUserAccess || existingAuthUser) {
    const statusInfo = existingUserAccess
      ? `UserAccess ID: ${existingUserAccess.id}, Role: ${existingUserAccess.role}, Status: ${existingUserAccess.status}`
      : `Supabase Auth ID: ${existingAuthUser?.id}`;
    const infoMsg = `Account with email "${email}" already exists. (${statusInfo}). Stopping gracefully.`;
    outputStream.write(`${infoMsg}\n`);
    return {
      success: true,
      message: infoMsg,
      status: "ALREADY_EXISTS",
      userAccessId: existingUserAccess?.id,
      authUserId: existingUserAccess?.authUserId || existingAuthUser?.id
    };
  }

  // 4. Password Collection & Validation
  let password = options.password;
  let confirmPassword = options.confirmPassword;

  if (password === undefined) {
    password = await promptHiddenPassword("Enter temporary Admin password:", inputStream, outputStream);
  }
  if (confirmPassword === undefined) {
    confirmPassword = await promptHiddenPassword("Confirm temporary Admin password:", inputStream, outputStream);
  }

  if (password !== confirmPassword) {
    const errorMsg = "Error: Passwords do not match.";
    outputStream.write(`${errorMsg}\n`);
    return { success: false, message: errorMsg, status: "FAILED" };
  }

  const validation = validateAdminPassword(password);
  if (!validation.valid) {
    const errorMsg = `Error: ${validation.error}`;
    outputStream.write(`${errorMsg}\n`);
    return { success: false, message: errorMsg, status: "FAILED" };
  }

  // 5. Create Supabase Auth User
  outputStream.write(`Creating Supabase Auth account for ${email}...\n`);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData?.user) {
    const errorMsg = `Error creating Supabase Auth user: ${authError?.message || "Unknown error"}`;
    outputStream.write(`${errorMsg}\n`);
    return { success: false, message: errorMsg, status: "FAILED" };
  }

  const newAuthUserId = authData.user.id;
  outputStream.write(`Supabase Auth user created with ID: ${newAuthUserId}.\n`);

  // 6. Create UserAccess Record in PostgreSQL with Rollback Safety
  let createdUserAccess;
  try {
    createdUserAccess = await prisma.userAccess.create({
      data: {
        authUserId: newAuthUserId,
        email,
        loginId,
        role: UserRole.ADMIN,
        status: AccountStatus.ACTIVE,
        mustSetPassword: false,
        firstLoginCompleted: true,
        passwordSetAt: new Date(),
        approvedAt: new Date(),
      }
    });

    await recordAuditEvent({
      actorUserId: newAuthUserId,
      action: AuditAction.ADMIN_ACCOUNT_CREATED,
      targetType: "UserAccess",
      targetId: createdUserAccess.id,
      metadata: {
        email,
        role: UserRole.ADMIN,
        status: AccountStatus.ACTIVE,
      }
    });

    const successMsg = `Admin account successfully created for ${email}! (UserAccess ID: ${createdUserAccess.id})`;
    outputStream.write(`${successMsg}\n`);

    return {
      success: true,
      message: successMsg,
      status: "CREATED",
      userAccessId: createdUserAccess.id,
      authUserId: newAuthUserId,
    };
  } catch (dbErr: any) {
    outputStream.write(`Database write failed (${dbErr.message}). Initiating rollback...\n`);

    // Rollback Safety: Delete the newly created Supabase Auth user so no orphan account remains
    try {
      await supabase.auth.admin.deleteUser(newAuthUserId);
      outputStream.write(`[Rollback Complete] Deleted orphan Supabase Auth user ${newAuthUserId}.\n`);
    } catch (rollbackErr: any) {
      outputStream.write(`[Rollback Warning] Failed deleting orphan Supabase Auth user: ${rollbackErr.message}\n`);
    }

    const errorMsg = `Error creating database UserAccess record: ${dbErr.message}`;
    return { success: false, message: errorMsg, status: "FAILED" };
  }
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith("provision-admin-account.ts") ||
  process.argv[1].endsWith("provision-admin-account.js")
);

if (isMain) {
  processAdminAccountProvisioning()
    .then((res) => {
      if (!res.success) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
