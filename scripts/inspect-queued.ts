const supabaseUrl = "https://mdvwpcntaetchvnlvvpo.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kdndwY250YWV0Y2h2bmx2dnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMTY4MTQsImV4cCI6MjA5ODc5MjgxNH0.cSlx9P2OaWfPnxC3oLrKSpmbgjcx5LmAjpRJOHYJdV4";

async function run() {
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    "Prefer": "count=exact"
  };

  const resJobs = await fetch(`${supabaseUrl}/rest/v1/sync_jobs?status=eq.QUEUED`, { headers });
  const queuedJobs: any[] = await resJobs.json();

  console.log("=== QUEUED Jobs Analysis ===");
  console.log("Total QUEUED jobs:", queuedJobs.length);

  const studentJobCounts: Record<string, number> = {};
  queuedJobs.forEach(j => {
    studentJobCounts[j.student_id] = (studentJobCounts[j.student_id] || 0) + 1;
  });

  const uniqueStudentsCount = Object.keys(studentJobCounts).length;
  console.log("Unique students with QUEUED jobs:", uniqueStudentsCount);

  // Print distribution of QUEUED jobs per student
  const countsDist: Record<number, number> = {};
  Object.values(studentJobCounts).forEach(c => {
    countsDist[c] = (countsDist[c] || 0) + 1;
  });
  console.log("Distribution of QUEUED jobs count per student:", countsDist);

  // Let's print details of the unique student IDs having QUEUED jobs
  const resStudents = await fetch(`${supabaseUrl}/rest/v1/student_profiles?select=id,name`, { headers });
  const students: any[] = await resStudents.json();
  const studentMap = new Map(students.map(s => [s.id, s.name]));

  console.log("\nTop students by QUEUED job count:");
  const sortedStudents = Object.entries(studentJobCounts).sort((a, b) => b[1] - a[1]);
  sortedStudents.slice(0, 10).forEach(([sid, count]) => {
    console.log(`- Student: ${studentMap.get(sid)} (ID: ${sid}) | QUEUED Job Count: ${count}`);
  });
}

run().catch(console.error);
