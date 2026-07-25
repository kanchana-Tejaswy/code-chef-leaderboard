const targetUrl = "https://code-chef-leaderboard.vercel.app";
const cronSecret = "your-super-secure-cron-token";

async function executeRollout() {
  console.log("=== STEP 1: APPLY MIGRATION ON VERCEL PRODUCTION DATABASE ===");
  try {
    const migRes = await fetch(`${targetUrl}/api/admin/apply-migration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
        "x-admin-secret": "your-super-secure-cron-token",
      },
    });
    console.log(`Migration Status: ${migRes.status} ${migRes.statusText}`);
    const migData = await migRes.json();
    console.log("Migration Result:", JSON.stringify(migData, null, 2));
  } catch (e: any) {
    console.error("Migration error:", e.message);
  }

  console.log("\n=== STEP 2: QUEUE ONLY 5 STUDENTS FIRST ===");
  try {
    // Queue all eligible students
    const queueRes = await fetch(`${targetUrl}/api/admin/bulk-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ action: "queue-all" }),
    });
    console.log(`Queue Action Status: ${queueRes.status}`);
    const queueData = await queueRes.json();
    console.log("Queue Result:", JSON.stringify(queueData, null, 2));

    // Process batch of 5
    console.log("\n=== STEP 3: PROCESS BATCH OF 5 STUDENTS ===");
    const batch5Res = await fetch(`${targetUrl}/api/admin/bulk-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ action: "process-batch", limit: 5 }),
    });
    console.log(`Process Batch 5 Status: ${batch5Res.status}`);
    const batch5Data = await batch5Res.json();
    console.log("Batch 5 Result:", JSON.stringify(batch5Data, null, 2));

    // Process batch of 20
    console.log("\n=== STEP 4: PROCESS BATCH OF 20 STUDENTS ===");
    const batch20Res = await fetch(`${targetUrl}/api/admin/bulk-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ action: "process-batch", limit: 20 }),
    });
    console.log(`Process Batch 20 Status: ${batch20Res.status}`);
    const batch20Data = await batch20Res.json();
    console.log("Batch 20 Result:", JSON.stringify(batch20Data, null, 2));

  } catch (e: any) {
    console.error("Rollout error:", e.message);
  }
}

executeRollout();
