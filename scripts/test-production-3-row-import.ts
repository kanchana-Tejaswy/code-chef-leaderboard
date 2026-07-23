import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env.production") });
dotenv.config({ path: resolve(process.cwd(), ".env"), override: true });

import { StudentProfileService } from "../src/services/student-profile.service";
import { prisma } from "../src/lib/prisma";

async function runProduction3RowTestImport() {
  console.log("=== Running 3-Row Production Safety Test Import ===");

  const sampleRows = [
    {
      name: "Test Coder Alpha",
      rollNumber: "99TEST001",
      email: "test.alpha@ace.edu.in",
      contactNumber: "9876543210",
      year: 3,
      branch: "CSE",
      department: "CSE",
      cgpa: 8.5,
      codechefUsername: "test_alpha_cc",
    },
    {
      name: "Test Coder Beta",
      rollNumber: "99TEST002",
      email: "test.beta@ace.edu.in",
      contactNumber: "9876543211",
      year: 2,
      branch: "ECE",
      department: "ECE",
      cgpa: 9.1,
      leetcodeUsername: "test_beta_lc",
    },
    {
      name: "Test Coder Gamma",
      rollNumber: "99TEST003",
      email: "test.gamma@ace.edu.in",
      contactNumber: "9876543212",
      year: 4,
      branch: "IT",
      department: "IT",
      cgpa: 7.9,
      codeforcesUsername: "test_gamma_cf",
    },
  ];

  // 1. Preview Phase
  console.log("\n1. Running Preview Phase...");
  const previewEval = await StudentProfileService.evaluateRows(sampleRows);
  console.log(`Preview Evaluated ${previewEval.length} rows.`);
  previewEval.forEach((row, i) => {
    console.log(`  Row ${i + 1}: ${row.normalized.name} (${row.normalized.rollNumber}) -> Status: ${row.classification}`);
  });

  // 2. Import Execution
  console.log("\n2. Executing Import Phase...");
  const importResult = await StudentProfileService.processBulkCsvImport(sampleRows);
  console.log("Import Summary Result:", JSON.stringify(importResult.summary, null, 2));

  // 3. Verify Created Profiles
  console.log("\n3. Verifying Created Profiles...");
  const createdProfiles = await prisma.studentProfile.findMany({
    where: {
      rollNumber: { in: ["99TEST001", "99TEST002", "99TEST003"] },
    },
  });

  console.log(`Found ${createdProfiles.length} test profiles in Database.`);
  createdProfiles.forEach((p) => {
    console.log(`  - ID: ${p.id} | Name: ${p.name} | Roll: ${p.rollNumber} | Status: ${p.profileStatus} | LeaderboardEligible: ${p.leaderboardEligible} | DashboardEligible: ${p.dashboardEligible}`);
  });

  // 4. Duplicate Re-Import Test (Must skip without updating)
  console.log("\n4. Testing Duplicate Re-Import Safety (Must SKIP without updating)...");
  const reImportResult = await StudentProfileService.processBulkCsvImport(sampleRows);
  console.log("Re-Import Duplicate Skip Result:", JSON.stringify(reImportResult.summary, null, 2));

  if (
    reImportResult.summary.createdCount === 0 &&
    (reImportResult.summary.skippedDuplicateRollCount > 0 || reImportResult.summary.skippedDuplicateEmailCount > 0)
  ) {
    console.log("\nSUCCESS: All duplicate rows were safely skipped without overwriting existing data!");
  } else {
    console.error("\nERROR: Duplicate test failed!");
  }

  // Cleanup test profiles to leave DB clean
  console.log("\n5. Cleaning up test profiles...");
  await prisma.studentProfile.deleteMany({
    where: {
      rollNumber: { in: ["99TEST001", "99TEST002", "99TEST003"] },
    },
  });
  console.log("Test profiles cleaned up successfully.");
}

runProduction3RowTestImport()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
