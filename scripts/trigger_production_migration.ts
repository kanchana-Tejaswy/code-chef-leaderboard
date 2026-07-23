async function triggerMigration() {
  console.log("=== TRIGGERING MIGRATION ON VERCEL PRODUCTION DATABASE ===");
  const targetUrl = "https://code-chef-leaderboard.vercel.app/api/public-migration";

  console.log(`Sending POST request to: ${targetUrl}`);
  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": "apply-migration-now",
      },
    });

    console.log(`HTTP Response Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log("Raw Response Text:\n", text);
  } catch (err: any) {
    console.error("Migration Trigger Error:", err.message);
  }
}

triggerMigration();
