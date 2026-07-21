import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { UserRole } from "@prisma/client";
import { provisionStaffAccount } from "../src/services/auth-provisioning.service";
import { recordAuditEvent, AuditAction } from "../src/services/audit.service";
import { normalizeEmail } from "../src/utils/normalization";
import { prisma } from "../src/lib/prisma";

async function bootstrapAdmin() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isExecute = args.includes("--execute");
  const hasConfirmation = args.includes("--confirmation=BOOTSTRAP_FIRST_ADMIN");

  if (!isDryRun && (!isExecute || !hasConfirmation)) {
    console.error("Safety Error: You must specify either --dry-run or --execute --confirmation=BOOTSTRAP_FIRST_ADMIN");
    process.exit(1);
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  
  if (!email) {
    console.error("BOOTSTRAP_ADMIN_EMAIL is not set in the environment.");
    process.exit(1);
  }

  const normalized = normalizeEmail(email);
  if (!normalized) {
    console.error(`BOOTSTRAP_ADMIN_EMAIL "${email}" is invalid.`);
    process.exit(1);
  }

  // Refuse to overwrite a non-ADMIN account
  const existing = await prisma.userAccess.findUnique({
    where: { email: normalized }
  });

  if (existing && existing.role !== UserRole.ADMIN) {
    console.error(`Account with email ${normalized} already exists and is NOT an ADMIN.`);
    process.exit(1);
  }

  if (isDryRun) {
    console.log(`[DRY-RUN] Admin bootstrap preview for ${normalized}`);
    if (existing) {
      console.log(`[DRY-RUN] Account already exists. Status: ${existing.status}`);
    } else {
      console.log(`[DRY-RUN] Account would be provisioned as ADMIN`);
    }
    await recordAuditEvent({
      action: AuditAction.ADMIN_BOOTSTRAP_PREVIEWED,
      metadata: { email: normalized, status: existing ? "EXISTS" : "WILL_CREATE" }
    });
    return;
  }

  console.log(`[LIVE] Bootstrapping Admin for ${normalized}`);
  const result = await provisionStaffAccount({
    email: normalized,
    role: UserRole.ADMIN,
  });

  if (result.status === "FAILED" || result.status === "CONFLICT" || result.status === "SKIPPED_INVALID") {
    console.error(`Failed to bootstrap admin: ${result.message}`);
    process.exit(1);
  }

  if (result.status === "CREATED" || result.status === "LINKED") {
    await recordAuditEvent({
      action: AuditAction.ADMIN_BOOTSTRAPPED,
      metadata: { email: normalized, result: result.status }
    });
    console.log(`Admin account successfully bootstrapped (${result.status}) for ${normalized}`);
  } else {
    console.log(`Admin account status for ${normalized}: ${result.status}`);
  }
}

bootstrapAdmin()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
