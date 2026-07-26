const supabaseUrl = "https://mdvwpcntaetchvnlvvpo.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kdndwY250YWV0Y2h2bmx2dnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMTY4MTQsImV4cCI6MjA5ODc5MjgxNH0.cSlx9P2OaWfPnxC3oLrKSpmbgjcx5LmAjpRJOHYJdV4";

async function run() {
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    "Prefer": "count=exact"
  };

  // 1. Fetch recent Sync Logs (last 10)
  const resSyncLogs = await fetch(`${supabaseUrl}/rest/v1/sync_logs?order=created_at.desc&limit=15`, { headers });
  const syncLogs = resSyncLogs.ok ? await resSyncLogs.json() : [];
  console.log("=== Recent Sync Logs ===");
  if (syncLogs.length === 0) {
    console.log("No sync logs found.");
  } else {
    syncLogs.forEach((l: any) => {
      console.log(`- CreatedAt: ${l.created_at} | Status: ${l.status} | Duration: ${l.duration_ms}ms | InitiatedBy: ${l.initiated_by} | StudentId: ${l.student_id} | Error: ${l.error_message}`);
    });
  }

  // 2. Fetch recent Fetch Logs (last 10)
  const resFetchLogs = await fetch(`${supabaseUrl}/rest/v1/fetch_logs?order=created_at.desc&limit=15`, { headers });
  const fetchLogs = resFetchLogs.ok ? await resFetchLogs.json() : [];
  console.log("\n=== Recent Fetch Logs ===");
  if (fetchLogs.length === 0) {
    console.log("No fetch logs found.");
  } else {
    fetchLogs.forEach((l: any) => {
      console.log(`- CreatedAt: ${l.created_at} | Platform: ${l.platform} | Username: ${l.username} | Status: ${l.status} | Error: ${l.error}`);
    });
  }

  // 3. Fetch recent Audit Logs (last 10)
  const resAuditLogs = await fetch(`${supabaseUrl}/rest/v1/audit_logs?order=created_at.desc&limit=15`, { headers });
  const auditLogs = resAuditLogs.ok ? await resAuditLogs.json() : [];
  console.log("\n=== Recent Audit Logs ===");
  if (auditLogs.length === 0) {
    console.log("No audit logs found.");
  } else {
    auditLogs.forEach((l: any) => {
      console.log(`- CreatedAt: ${l.created_at} | Action: ${l.action} | TargetType: ${l.target_type} | TargetId: ${l.target_id}`);
    });
  }
}

run().catch(console.error);
