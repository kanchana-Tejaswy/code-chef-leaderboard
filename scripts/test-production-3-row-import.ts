import * as fs from "fs";
import * as path from "path";

// Load environment variables
const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf-8");
let supabaseUrl = "";
let anonKey = "";

envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=") || trimmed.startsWith("SUPABASE_URL=")) {
    supabaseUrl = trimmed.split("=")[1].trim().replace(/^["']|["']$/g, "");
  }
  if (trimmed.startsWith("SUPABASE_ANON_KEY=") || trimmed.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) {
    const val = trimmed.split("=")[1].trim().replace(/^["']|["']$/g, "");
    if (val) anonKey = val;
  }
});

if (!supabaseUrl) supabaseUrl = "https://mdvwpcntaetchvnlvvpo.supabase.co";

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function runProduction3RowSafetyImport() {
  console.log("=== RUNNING PRODUCTION 3-ROW SAFETY IMPORT TEST ===");
  console.log(`Targeting Supabase Cloud Project: ${supabaseUrl}`);

  // Step 1: Duplicate check against existing profile 22CS999
  console.log("\n1. Verifying existing profile '22CS999' in production database...");
  const dupRes = await fetch(`${supabaseUrl}/rest/v1/student_profiles?roll_number=eq.22CS999`, { headers });
  const dupData = await dupRes.json();
  console.log(`Found ${dupData.length} existing record for roll 22CS999:`, dupData[0]?.name || "None");

  // Step 2: Insert 1 Valid and 1 Incomplete student
  console.log("\n2. Inserting 1 Valid profile (99TEST001) and 1 Incomplete profile (99TEST002)...");
  
  const now = new Date().toISOString();

  const validProfile = {
    id: "99000000-0000-0000-0000-000000000001",
    name: "Test Coder Valid",
    roll_number: "99TEST001",
    email: "test.valid@ace.edu.in",
    contact_number: "9876543210",
    year: 3,
    branch: "CSE",
    department: "CSE",
    section: "A",
    cgpa: 8.5,
    codechef_username: "test_valid_cc",
    leetcode_username: null,
    github_username: null,
    codeforces_username: null,
    linkedin_url: null,
    profile_picture_url: null,
    verification_status: "UNABLE_TO_VERIFY",
    profile_status: "ACTIVE",
    leaderboard_eligible: true,
    dashboard_eligible: true,
    created_at: now,
    updated_at: now,
  };

  const incompleteProfile = {
    id: "99000000-0000-0000-0000-000000000002",
    name: "Test Coder Incomplete",
    roll_number: "99TEST002",
    email: "test.incomplete@ace.edu.in",
    contact_number: "9876543211",
    year: 2,
    branch: "ECE",
    department: "ECE",
    section: "A",
    cgpa: 9.1,
    codechef_username: null,
    leetcode_username: null,
    github_username: null,
    codeforces_username: null,
    linkedin_url: null,
    profile_picture_url: null,
    verification_status: "UNABLE_TO_VERIFY",
    profile_status: "INCOMPLETE",
    leaderboard_eligible: false,
    dashboard_eligible: false,
    created_at: now,
    updated_at: now,
  };

  const insertRes = await fetch(`${supabaseUrl}/rest/v1/student_profiles`, {
    method: "POST",
    headers,
    body: JSON.stringify([validProfile, incompleteProfile]),
  });

  if (insertRes.ok) {
    const inserted = await insertRes.json();
    console.log(`Successfully inserted ${inserted.length} test rows!`);
  } else {
    console.error("Insertion failed:", insertRes.status, await insertRes.text());
    return;
  }

  // Step 3: Reread and verify all 3 test rows
  console.log("\n3. Rereading and verifying inserted rows from production database...");
  const readRes = await fetch(
    `${supabaseUrl}/rest/v1/student_profiles?roll_number=in.(99TEST001,99TEST002,22CS999)&select=*`,
    { headers }
  );
  const readData: any[] = await readRes.json();
  console.log(`Retrieved ${readData.length} records from database:`);
  readData.forEach((row) => {
    console.log(`  - Roll: ${row.roll_number} | Name: ${row.name} | Status: ${row.profile_status} | LeaderboardEligible: ${row.leaderboard_eligible} | DashboardEligible: ${row.dashboard_eligible}`);
  });

  // Step 4: Verify duplicate row 22CS999 was NOT altered
  const existingRow = readData.find((r) => r.roll_number === "22CS999");
  if (existingRow && existingRow.name === "Test Dev student") {
    console.log("\n[VERIFIED] Existing duplicate profile 22CS999 was completely UNTOUCHED!");
  }

  // Step 5: Clean up temporary test profiles 99TEST001 and 99TEST002
  console.log("\n5. Cleaning up temporary test profiles (99TEST001, 99TEST002)...");
  const delRes = await fetch(`${supabaseUrl}/rest/v1/student_profiles?roll_number=in.(99TEST001,99TEST002)`, {
    method: "DELETE",
    headers,
  });

  if (delRes.ok) {
    console.log("Cleanup succeeded! Database restored to clean state.");
  } else {
    console.error("Cleanup error:", delRes.status, await delRes.text());
  }
}

runProduction3RowSafetyImport().catch(console.error);
