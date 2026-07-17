async function run() {
  console.log("=== SYSTEM ENVIRONMENT CHECK ===");
  console.log("process.env.DATABASE_URL:", process.env.DATABASE_URL || "(not set)");
  console.log("process.env.DIRECT_URL:", process.env.DIRECT_URL || "(not set)");
}

run().catch(console.error);
