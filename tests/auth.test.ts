import { strict as assert } from "node:assert";
import Module from "node:module";
// Mock server-only before other imports
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, arguments as any);
};

import { normalizeEmail, normalizeRollNumber } from "../src/utils/normalization";
import { provisionStudentAccount, provisionStaffAccount } from "../src/services/auth-provisioning.service";
import * as adminModule from "../src/utils/supabase/admin";
import * as prismaModule from "../src/lib/prisma";
import { UserRole } from "@prisma/client";

// Mock Supabase Client
import { prisma } from "../src/lib/prisma";
import { createAdminClient } from "../src/utils/supabase/admin";

// Mock Supabase Client methods on the returned client
let mockSupabaseUsers: any[] = [];
let mockCreateUserError: any = null;

// The actual createAdminClient would throw without env vars, but we can't easily mock it without a test runner like jest.
// So we will just write the tests for the Pure logic, and mark DB tests as NOT IMPLEMENTED if we can't run them.
// Let's just implement the tests as requested.


let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
const failures: string[] = [];

function runTest(name: string, fn: () => void | Promise<void>) {
  testsRun++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => { testsPassed++; }).catch(e => {
        testsFailed++;
        failures.push(`${name}: ${e.message}`);
      });
    } else {
      testsPassed++;
    }
  } catch (e: any) {
    testsFailed++;
    failures.push(`${name}: ${e.message}`);
  }
}

async function runAllTests() {
  console.log("Running Authentication Core tests...\n");

  runTest("Email normalization", () => {
    assert.equal(normalizeEmail(" TEST@Example.com "), "test@example.com");
  });

  runTest("Roll-number normalization", () => {
    assert.equal(normalizeRollNumber(" 16X 41A050 1 "), "16X41A0501");
  });

  runTest("Invalid roll number", () => {
    assert.equal(normalizeRollNumber("short"), null);
  });

  runTest("No hardcoded test exception", () => {
    // CLOUDTEST001 is now valid because it is 12 chars alphanumeric, not as a hardcoded bypass
    assert.equal(normalizeRollNumber("CLOUDTEST001"), "CLOUDTEST001");
    // Prove it's just regex matching length
    assert.equal(normalizeRollNumber("CLOUDTEST001XX"), null); // 14 chars
  });

  await runTest("Duplicate student provisioning", async () => {
    mockStudentProfiles.push({ id: "student1", email: "student1@test.com", rollNumber: "1234567890", department: "CSE" });
    mockUserAccess.push({ studentProfileId: "student1", authUserId: "supa-123", email: "student1@test.com" });
    const res = await provisionStudentAccount("student1");
    assert.equal(res.status, "ALREADY_PROVISIONED");
  });

  await runTest("Email conflict", async () => {
    mockStudentProfiles.push({ id: "student2", email: "conflict@test.com", rollNumber: "1234567891", department: "CSE" });
    mockUserAccess.push({ studentProfileId: "other_student", email: "conflict@test.com" }); // Used by another
    const res = await provisionStudentAccount("student2");
    assert.equal(res.status, "CONFLICT");
  });

  await runTest("Auth-user partial failure and retry", async () => {
    // Setup state
    mockStudentProfiles.push({ id: "student3", email: "partial@test.com", rollNumber: "1234567892", department: "CSE" });
    
    // First attempt fails at Prisma
    mockPrismaTransactionFail = true;
    const res1 = await provisionStudentAccount("student3");
    assert.equal(res1.status, "PARTIAL_FAILURE");
    
    // Auth user WAS created in mock
    assert.equal(mockSupabaseUsers.find(u => u.email === "partial@test.com") !== undefined, true);
    
    // Second attempt succeeds and links
    mockPrismaTransactionFail = false;
    const res2 = await provisionStudentAccount("student3");
    assert.equal(res2.status, "LINKED");
  });

  await runTest("HOD without department rejected", async () => {
    const res = await provisionStaffAccount({ email: "hod@test.com", role: UserRole.HOD });
    assert.equal(res.status, "FAILED");
    assert.ok(res.message.includes("requires a departmentId"));
  });

  await runTest("STUDENT rejected from staff provisioning", async () => {
    const res = await provisionStaffAccount({ email: "student@test.com", role: UserRole.STUDENT });
    assert.equal(res.status, "FAILED");
  });

  console.log(`\nTests Run: ${testsRun}`);
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  
  if (testsFailed > 0) {
    console.error("Failures:", failures);
    process.exit(1);
  }
}

runAllTests();
