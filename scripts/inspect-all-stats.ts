const supabaseUrl = "https://mdvwpcntaetchvnlvvpo.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kdndwY250YWV0Y2h2bmx2dnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMTY4MTQsImV4cCI6MjA5ODc5MjgxNH0.cSlx9P2OaWfPnxC3oLrKSpmbgjcx5LmAjpRJOHYJdV4";

async function run() {
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    "Prefer": "count=exact"
  };

  // 1. Fetch Student Profiles
  const resStudents = await fetch(`${supabaseUrl}/rest/v1/student_profiles?select=*`, { headers });
  if (!resStudents.ok) {
    console.error("Failed to fetch students:", resStudents.status, await resStudents.text());
    return;
  }
  const students: any[] = await resStudents.json();

  // 2. Fetch Sync Jobs
  const resJobs = await fetch(`${supabaseUrl}/rest/v1/sync_jobs?select=*`, { headers });
  if (!resJobs.ok) {
    console.error("Failed to fetch sync jobs:", resJobs.status, await resJobs.text());
    return;
  }
  const jobs: any[] = await resJobs.json();

  console.log("=== INSPECTION DATA ===");
  console.log(`Total students in DB: ${students.length}`);
  console.log(`Total sync jobs in DB: ${jobs.length}`);

  // Calculate:
  // - Students with both platform handles
  const withBoth = students.filter(s => s.codechef_username && s.codechef_username.trim() !== "" && s.leetcode_username && s.leetcode_username.trim() !== "");
  
  // - Students missing CodeChef
  const missingCodechef = students.filter(s => !s.codechef_username || s.codechef_username.trim() === "");
  
  // - Students missing LeetCode
  const missingLeetcode = students.filter(s => !s.leetcode_username || s.leetcode_username.trim() === "");
  
  // - Students missing both
  const missingBoth = students.filter(s => (!s.codechef_username || s.codechef_username.trim() === "") && (!s.leetcode_username || s.leetcode_username.trim() === ""));

  // - SyncJob count by status (case-insensitive or exact)
  const jobsQueued = jobs.filter(j => j.status === 'QUEUED' || j.status === 'PENDING');
  const jobsProcessing = jobs.filter(j => j.status === 'PROCESSING' || j.status === 'RUNNING');
  const jobsRetryPending = jobs.filter(j => j.status === 'RETRY_PENDING');
  const jobsFailed = jobs.filter(j => j.status === 'FAILED');
  const jobsCompleted = jobs.filter(j => j.status === 'COMPLETED' || j.status === 'VERIFIED');

  // Eligible students for sync: students with both handles whose profile is not yet fully verified or requires sync.
  // Wait, let's look at who is eligible for sync.
  // Generally, students with both handles are eligible for sync.
  const eligibleStudents = withBoth;

  // Active SyncJob statuses
  const activeStatuses = ["QUEUED", "PENDING", "PROCESSING", "RUNNING", "RETRY_PENDING"];
  const studentsWithActiveJob = new Set(
    jobs.filter(j => activeStatuses.includes(j.status)).map(j => j.student_id)
  );

  const eligibleWithNoActiveJob = eligibleStudents.filter(s => !studentsWithActiveJob.has(s.id));

  // - Jobs stuck in PROCESSING/RUNNING
  // Let's print details of jobs in PROCESSING/RUNNING
  const stuckProcessing = jobs.filter(j => (j.status === 'PROCESSING' || j.status === 'RUNNING'));

  // - Oldest queued job time
  const queuedJobsSorted = [...jobsQueued].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const oldestQueuedTime = queuedJobsSorted.length > 0 ? queuedJobsSorted[0].created_at : "N/A";

  // - Last successfully processed job time
  // Wait, successful means COMPLETED or VERIFIED status, or last_successful_at is not null
  const completedJobsSorted = jobs.filter(j => j.status === 'COMPLETED' || j.status === 'VERIFIED' || j.last_successful_at)
    .map(j => ({ ...j, successTime: j.last_successful_at || j.updated_at }))
    .sort((a, b) => new Date(b.successTime).getTime() - new Date(a.successTime).getTime());
  
  const lastSuccessTime = completedJobsSorted.length > 0 ? completedJobsSorted[0].successTime : "N/A";

  console.log(`\n--- Metric Calculations ---`);
  console.log(`Students with both platform handles : ${withBoth.length}`);
  console.log(`Students missing CodeChef           : ${missingCodechef.length}`);
  console.log(`Students missing LeetCode           : ${missingLeetcode.length}`);
  console.log(`Students missing both               : ${missingBoth.length}`);
  console.log(`SyncJob QUEUED count                : ${jobsQueued.length} (exact status breakdown: ${JSON.stringify(jobs.reduce((acc, j) => { if(j.status==='QUEUED'||j.status==='PENDING') acc[j.status]=(acc[j.status]||0)+1; return acc; }, {}))})`);
  console.log(`SyncJob PROCESSING count            : ${jobsProcessing.length} (exact status breakdown: ${JSON.stringify(jobs.reduce((acc, j) => { if(j.status==='PROCESSING'||j.status==='RUNNING') acc[j.status]=(acc[j.status]||0)+1; return acc; }, {}))})`);
  console.log(`SyncJob RETRY_PENDING count         : ${jobsRetryPending.length}`);
  console.log(`SyncJob FAILED count                : ${jobsFailed.length}`);
  console.log(`SyncJob COMPLETED count               : ${jobsCompleted.length} (exact status breakdown: ${JSON.stringify(jobs.reduce((acc, j) => { if(j.status==='COMPLETED'||j.status==='VERIFIED') acc[j.status]=(acc[j.status]||0)+1; return acc; }, {}))})`);
  console.log(`Eligible students with no active SyncJob: ${eligibleWithNoActiveJob.length}`);
  console.log(`Jobs stuck in PROCESSING            : ${stuckProcessing.length}`);
  if (stuckProcessing.length > 0) {
    console.log("Stuck jobs details:", stuckProcessing.map(j => ({ id: j.id, status: j.status, updated_at: j.updated_at, student_id: j.student_id })));
  }
  console.log(`Oldest queued job time              : ${oldestQueuedTime}`);
  console.log(`Last successfully processed job time: ${lastSuccessTime}`);
  console.log(`---------------------------\n`);

  // Let's print some additional info to help diagnose why it's not moving
  console.log("=== Job Status Breakdown ===");
  const counts: Record<string, number> = {};
  jobs.forEach(j => { counts[j.status] = (counts[j.status] || 0) + 1; });
  console.log(counts);
}

run().catch(console.error);
