async function run() {
  console.log("=== SYSTEM ENVIRONMENT CHECK ===");
  console.log("process.env.POSTGRES_PRISMA_URL:", process.env.POSTGRES_PRISMA_URL ? "(set)" : "(not set)");
  console.log("process.env.DATABASE_URL:", process.env.DATABASE_URL ? "(set)" : "(not set)");
  console.log("process.env.DIRECT_URL:", process.env.DIRECT_URL ? "(set)" : "(not set)");
}

run().catch(console.error);
