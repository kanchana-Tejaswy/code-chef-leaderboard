import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { prisma } from "../src/lib/prisma";
import { provisionStudentAccount } from "../src/services/auth-provisioning.service";
import { normalizeEmail, normalizeRollNumber } from "../src/utils/normalization";

async function provisionExistingStudents() {
  const isDryRun = process.argv.includes("--dry-run");
  if (isDryRun) {
    console.log("Starting backfill in DRY-RUN mode. No writes will be performed.");
  } else {
    console.log("Starting backfill for existing students.");
  }

  const students = await prisma.studentProfile.findMany();

  const summary = {
    checked: 0,
    created: 0,
    linked: 0,
    alreadyProvisioned: 0,
    skippedMissingEmail: 0,
    skippedInvalidEmail: 0,
    skippedMissingRollNumber: 0,
    conflicts: 0,
    failed: 0,
  };

  // Process sequentially to respect "sequential processing or maximum concurrency 2"
  for (const student of students) {
    summary.checked++;

    if (!student.email) {
      summary.skippedMissingEmail++;
      continue;
    }

    if (!student.rollNumber) {
      summary.skippedMissingRollNumber++;
      continue;
    }

    const email = normalizeEmail(student.email);
    const roll = normalizeRollNumber(student.rollNumber);

    if (!email) {
      summary.skippedInvalidEmail++;
      continue;
    }

    if (!roll) {
      summary.skippedMissingRollNumber++; // or a new stat, but keeping it simple
      continue;
    }

    if (isDryRun) {
      // In dry run, check if provisioned via prisma
      const existingAccess = await prisma.userAccess.findUnique({
        where: { studentProfileId: student.id }
      });
      if (existingAccess) {
        summary.alreadyProvisioned++;
      } else {
        // We assume it would be created/linked if no conflict
        summary.created++; 
      }
      continue;
    }

    // Live mode
    const result = await provisionStudentAccount(student.id);

    switch (result.status) {
      case "CREATED":
        summary.created++;
        break;
      case "LINKED":
        summary.linked++;
        break;
      case "ALREADY_PROVISIONED":
        summary.alreadyProvisioned++;
        break;
      case "CONFLICT":
        summary.conflicts++;
        break;
      case "SKIPPED_INVALID":
        summary.skippedInvalidEmail++;
        break;
      case "FAILED":
      default:
        summary.failed++;
        break;
    }
  }

  console.log("\nBackfill Summary:");
  console.log(`- Checked: ${summary.checked}`);
  console.log(`- Created: ${summary.created}`);
  console.log(`- Linked: ${summary.linked}`);
  console.log(`- Already Provisioned: ${summary.alreadyProvisioned}`);
  console.log(`- Skipped (Missing Email): ${summary.skippedMissingEmail}`);
  console.log(`- Skipped (Invalid Email): ${summary.skippedInvalidEmail}`);
  console.log(`- Skipped (Missing/Invalid Roll Number): ${summary.skippedMissingRollNumber}`);
  console.log(`- Conflicts: ${summary.conflicts}`);
  console.log(`- Failed: ${summary.failed}`);
}

provisionExistingStudents()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
