import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env
const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf-8");
let supabaseUrl = "";
let serviceKey = "";

envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=") || trimmed.startsWith("SUPABASE_URL=")) {
    supabaseUrl = trimmed.split("=")[1].trim().replace(/^["']|["']$/g, "");
  }
  if (trimmed.startsWith("SUPABASE_ANON_KEY=") || trimmed.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) {
    const val = trimmed.split("=")[1].trim().replace(/^["']|["']$/g, "");
    if (val) serviceKey = val;
  }
});

if (!supabaseUrl) supabaseUrl = "https://mdvwpcntaetchvnlvvpo.supabase.co";

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

function maskRoll(roll: string | null) {
  if (!roll) return "N/A";
  if (roll.length <= 4) return "****";
  return "*".repeat(roll.length - 4) + roll.slice(-4);
}

async function inspectProductionData() {
  console.log("=== PHASE 1 — PRODUCTION DATABASE INSPECTION ===");
  console.log(`Supabase URL: ${supabaseUrl}`);

  // Fetch total profiles
  const res = await fetch(`${supabaseUrl}/rest/v1/student_profiles?select=id,name,roll_number,profile_status,leaderboard_eligible,dashboard_eligible,created_at&order=created_at.desc`, {
    headers,
  });

  if (!res.ok) {
    console.error("Failed to fetch student profiles:", res.status, await res.text());
    return;
  }

  const students: any[] = await res.json();
  console.log(`\nTotal StudentProfile Count: ${students.length}`);

  // Group by profile_status
  const statusCounts: Record<string, number> = {};
  let leaderboardEligibleCount = 0;
  let dashboardEligibleCount = 0;

  students.forEach((s) => {
    const st = s.profile_status || "UNKNOWN";
    statusCounts[st] = (statusCounts[st] || 0) + 1;

    if (s.leaderboard_eligible === true) leaderboardEligibleCount++;
    if (s.dashboard_eligible === true) dashboardEligibleCount++;
  });

  console.log("\nCounts Grouped by Profile Status:");
  Object.entries(statusCounts).forEach(([st, cnt]) => {
    console.log(`  - ${st}: ${cnt}`);
  });

  console.log(`\nCount with leaderboard_eligible = true: ${leaderboardEligibleCount}`);
  console.log(`Count with dashboard_eligible = true: ${dashboardEligibleCount}`);

  console.log("\nLatest 10 Imported Profiles:");
  const latest10 = students.slice(0, 10);

  // Check corresponding LeaderboardEntry records
  const lbRes = await fetch(`${supabaseUrl}/rest/v1/leaderboard_entries?select=student_id`, { headers });
  const lbEntries: any[] = lbRes.ok ? await lbRes.json() : [];
  const lbSet = new Set(lbEntries.map((l) => l.student_id));

  latest10.forEach((s, idx) => {
    const hasLb = lbSet.has(s.id);
    console.log(
      `  ${idx + 1}. Roll: ${maskRoll(s.roll_number)} | Status: ${s.profile_status || "N/A"} | LeaderboardEligible: ${s.leaderboard_eligible} | DashboardEligible: ${s.dashboard_eligible} | HasLeaderboardEntry: ${hasLb} | CreatedAt: ${s.created_at}`
    );
  });
}

inspectProductionData().catch(console.error);
