const supabaseUrl = "https://mdvwpcntaetchvnlvvpo.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kdndwY250YWV0Y2h2bmx2dnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMTY4MTQsImV4cCI6MjA5ODc5MjgxNH0.cSlx9P2OaWfPnxC3oLrKSpmbgjcx5LmAjpRJOHYJdV4";

async function run() {
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    "Prefer": "count=exact"
  };

  const resStudents = await fetch(`${supabaseUrl}/rest/v1/student_profiles?select=*`, { headers });
  const students: any[] = await resStudents.json();

  const resJobs = await fetch(`${supabaseUrl}/rest/v1/sync_jobs?select=*`, { headers });
  const jobs: any[] = await resJobs.json();

  const withBoth = students.filter(s => s.codechef_username && s.codechef_username.trim() !== "" && s.leetcode_username && s.leetcode_username.trim() !== "");

  // Map student_id to jobs
  const studentJobsMap: Record<string, any[]> = {};
  jobs.forEach(j => {
    if (!studentJobsMap[j.student_id]) {
      studentJobsMap[j.student_id] = [];
    }
    studentJobsMap[j.student_id].push(j);
  });

  let studentsWithNoJob = 0;
  let studentsWithOneJob = 0;
  let studentsWithMultipleJobs = 0;
  const multiJobCounts: Record<number, number> = {};

  withBoth.forEach(s => {
    const sJobs = studentJobsMap[s.id] || [];
    if (sJobs.length === 0) {
      studentsWithNoJob++;
    } else if (sJobs.length === 1) {
      studentsWithOneJob++;
    } else {
      studentsWithMultipleJobs++;
      multiJobCounts[sJobs.length] = (multiJobCounts[sJobs.length] || 0) + 1;
    }
  });

  console.log("=== Job Distribution for Students with both handles ===");
  console.log(`Total students with both handles: ${withBoth.length}`);
  console.log(`Students with NO job in DB: ${studentsWithNoJob}`);
  console.log(`Students with exactly 1 job in DB: ${studentsWithOneJob}`);
  console.log(`Students with multiple jobs in DB: ${studentsWithMultipleJobs}`);
  console.log("Distribution of multiple jobs count:", multiJobCounts);

  // Let's see some example students with multiple jobs
  console.log("\nSample students with multiple jobs:");
  let count = 0;
  for (const s of withBoth) {
    const sJobs = studentJobsMap[s.id] || [];
    if (sJobs.length > 1 && count < 5) {
      console.log(`Student ID: ${s.id}, Name: ${s.name}, Job count: ${sJobs.length}`);
      sJobs.forEach(j => {
        console.log(`  - Job ID: ${j.id}, Status: ${j.status}, CreatedAt: ${j.created_at}, UpdatedAt: ${j.updated_at}`);
      });
      count++;
    }
  }
}

run().catch(console.error);
