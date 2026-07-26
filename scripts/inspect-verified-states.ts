const supabaseUrl = "https://mdvwpcntaetchvnlvvpo.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kdndwY250YWV0Y2h2bmx2dnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMTY4MTQsImV4cCI6MjA5ODc5MjgxNH0.cSlx9P2OaWfPnxC3oLrKSpmbgjcx5LmAjpRJOHYJdV4";

async function run() {
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    "Prefer": "count=exact"
  };

  const res = await fetch(`${supabaseUrl}/rest/v1/student_profiles?select=id,name,profile_status,admin_approval_status,codechef_username,leetcode_username`, { headers });
  const students: any[] = await res.json();

  const groups: Record<string, number> = {};
  students.forEach(s => {
    const key = `${s.profile_status} | ${s.admin_approval_status || 'null'}`;
    groups[key] = (groups[key] || 0) + 1;
  });

  console.log("=== Groupings of profile_status and admin_approval_status ===");
  console.log(groups);

  console.log("\nDetails of students who are VERIFIED:");
  students.filter(s => s.profile_status === 'VERIFIED').forEach(s => {
    console.log(`- ID: ${s.id} | Name: ${s.name} | Approval: ${s.admin_approval_status}`);
  });
}

run().catch(console.error);
