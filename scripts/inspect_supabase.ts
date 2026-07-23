import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env"), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function inspectSchema() {
  const headers = {
    apikey: serviceKey!,
    Authorization: `Bearer ${serviceKey!}`,
    "Content-Type": "application/json",
  };

  // Query 1 row from student_profiles without specific column selection
  const res = await fetch(`${supabaseUrl}/rest/v1/student_profiles?select=*&limit=5`, {
    headers,
  });

  if (res.ok) {
    const data = await res.json();
    console.log("=== EXISTING COLUMNS IN PRODUCTION student_profiles TABLE ===");
    if (data.length > 0) {
      console.log("Available keys in row:", Object.keys(data[0]));
      console.log("\nLatest 5 student profile records in production DB:");
      data.forEach((s: any) => {
        const maskedRoll = s.roll_number ? "****" + s.roll_number.slice(-4) : "NONE";
        console.log(`- ID: ${s.id} | Name: ${s.name} | Roll: ${maskedRoll} | Email: ${s.email} | CreatedAt: ${s.created_at}`);
      });
    } else {
      console.log("No rows in table.");
    }
  } else {
    console.error("Error fetching schema:", res.status, await res.text());
  }
}

inspectSchema();
