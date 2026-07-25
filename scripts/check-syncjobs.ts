const supabaseUrl = "https://mdvwpcntaetchvnlvvpo.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3OiOiJzdXBhYmFzZSIsInJlZiI6Im1kdndwY250YWV0Y2h2bmx2dnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMTY4MTQsImV4cCI6MjA5ODc5MjgxNH0.cSlx9P2OaWfPnxC3oLrKSpmbgjcx5LmAjpRJOHYJdV4";

async function checkSyncJobsTable() {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };

  const res = await fetch(`${supabaseUrl}/rest/v1/sync_jobs?select=*&limit=1`, { headers });
  console.log("sync_jobs status:", res.status);
  if (res.ok) {
    const data = await res.json();
    console.log("sync_jobs data:", data);
  } else {
    console.log("sync_jobs error:", await res.text());
  }
}
checkSyncJobsTable();
