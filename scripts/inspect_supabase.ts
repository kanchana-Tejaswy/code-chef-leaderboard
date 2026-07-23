import * as fs from "fs";
import * as path from "path";

const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf-8");
let supabaseUrl = "";
let serviceKey = "";

envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed.startsWith("SUPABASE_URL=") || trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = trimmed.split("=")[1].trim().replace(/^["']|["']$/g, "");
  }
  if (trimmed.startsWith("SUPABASE_ANON_KEY=") || trimmed.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) {
    const val = trimmed.split("=")[1].trim().replace(/^["']|["']$/g, "");
    if (val) serviceKey = val;
  }
});

if (!supabaseUrl) supabaseUrl = "https://mdvwpcntaetchvnlvvpo.supabase.co";

console.log("Supabase URL:", supabaseUrl);
console.log("Anon/Service Key length:", serviceKey ? serviceKey.length : 0);

async function inspectSchema() {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(`${supabaseUrl}/rest/v1/student_profiles?select=*&limit=5`, {
    headers,
  });

  if (res.ok) {
    const data = await res.json();
    console.log("\n=== COLUMNS IN PRODUCTION student_profiles TABLE ===");
    if (data.length > 0) {
      const keys = Object.keys(data[0]);
      console.log("Total columns:", keys.length);
      console.log("All columns:", keys);

      const verifiedCols = ["contact_number", "cgpa", "codeforces_username", "profile_status", "leaderboard_eligible", "dashboard_eligible"];
      console.log("\nMigration Column Verification:");
      verifiedCols.forEach((col) => {
        if (keys.includes(col)) {
          console.log(`  - [VERIFIED] ${col} exists in production DB!`);
        } else {
          console.log(`  - [MISSING] ${col}`);
        }
      });
    } else {
      console.log("No rows returned.");
    }
  } else {
    console.error("Error fetching schema:", res.status, await res.text());
  }
}

inspectSchema();
