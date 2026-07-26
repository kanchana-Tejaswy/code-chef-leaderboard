const supabaseUrl = "https://mdvwpcntaetchvnlvvpo.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kdndwY250YWV0Y2h2bmx2dnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMTY4MTQsImV4cCI6MjA5ODc5MjgxNH0.cSlx9P2OaWfPnxC3oLrKSpmbgjcx5LmAjpRJOHYJdV4";

async function run() {
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    "Prefer": "count=exact"
  };

  const res = await fetch(`${supabaseUrl}/rest/v1/sync_jobs?select=*`, { headers });
  if (!res.ok) {
    console.error("Failed to fetch sync_jobs:", res.status, await res.text());
    return;
  }
  const jobs: any[] = await res.json();
  console.log("=== SyncJobs Count ===");
  console.log("Total SyncJobs:", jobs.length);
  if (jobs.length > 0) {
    console.log("Sample job:", jobs[0]);
    
    // Group by status
    const statusGroups: Record<string, number> = {};
    jobs.forEach(j => {
      statusGroups[j.status] = (statusGroups[j.status] || 0) + 1;
    });
    console.log("SyncJobs grouped by status:", statusGroups);
  }
}

run().catch(console.error);
