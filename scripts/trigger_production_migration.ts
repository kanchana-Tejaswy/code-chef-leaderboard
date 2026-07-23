import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const content = fs.readFileSync(envPath, "utf-8");
const envVars: Record<string, string> = {};
content.split("\n").forEach((l) => {
  const parts = l.split("=");
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    envVars[k] = v;
  }
});

const cronSecret = envVars["CRON_SECRET"] || "your-super-secure-cron-token";

async function triggerMigration() {
  console.log("=== TRIGGERING MIGRATION ON VERCEL PRODUCTION DATABASE ===");
  const targetUrl = "https://code-chef-leaderboard.vercel.app/api/admin/apply-migration";

  console.log(`Sending POST request to: ${targetUrl}`);
  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    console.log(`HTTP Response Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log("Response Payload:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Migration Trigger Error:", err.message);
  }
}

triggerMigration();
