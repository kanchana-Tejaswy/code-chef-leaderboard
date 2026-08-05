const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const url = process.env.DATABASE_URL;

console.log("=== Bootstrapping Legacy Database Baseline for CI ===");

// 1. Safety Check
if (!url) {
  console.error("FATAL: DATABASE_URL is not set.");
  process.exit(1);
}

const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
const isSupabase = url.includes('supabase.co') || url.includes('mdvwpcntaetchvnlvvpo');

if (!isLocal || isSupabase || !url.includes('ace_phase3_test')) {
  console.error("SECURITY BLOCK: Connection target is not a confirmed local disposable test database.");
  console.error("DATABASE_URL must point only to localhost/127.0.0.1 and use the database name 'ace_phase3_test'.");
  process.exit(1);
}

const tempDir = process.env.RUNNER_TEMP || '/tmp';
const schemaPath = path.join(tempDir, 'origin-main-schema.prisma');
const sqlPath = path.join(tempDir, 'origin-main-baseline.sql');

try {
  // 2. Extract origin/main schema
  console.log("Extracting origin/main schema...");
  const mainCommit = "edfd43dfa080203f2c91398ca7e08364ce24ddd2";
  execSync(`git show ${mainCommit}:prisma/schema.prisma > "${schemaPath}"`, { stdio: 'inherit' });

  // Verify extracted schema content safely
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  if (!schemaContent.includes('model StudentProfile') || schemaContent.includes('model Cohort')) {
    console.error("FATAL: Extracted schema does not match origin/main structure.");
    process.exit(1);
  }
  console.log("Schema extracted and verified successfully.");

  // 3. Generate baseline SQL script
  console.log("Generating baseline SQL script using prisma migrate diff...");
  execSync(`npx prisma migrate diff --from-empty --to-schema "${schemaPath}" --script > "${sqlPath}"`, { stdio: 'inherit' });

  // Verify baseline SQL content
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  if (!sqlContent.includes('CREATE TABLE "student_profiles"') || sqlContent.includes('CREATE TABLE "cohorts"')) {
    console.error("FATAL: Generated baseline SQL validation failed.");
    process.exit(1);
  }
  console.log("Baseline SQL script generated and verified successfully.");

  // 4. Apply baseline SQL via psql
  console.log("Applying baseline SQL script to local PostgreSQL...");
  // Pass password safely via environment variable in execute context
  execSync(`psql -h localhost -U postgres -d ace_phase3_test -f "${sqlPath}"`, {
    env: { ...process.env, PGPASSWORD: 'phase3_temp_validation_pwd' },
    stdio: 'inherit'
  });
  console.log("Baseline SQL script applied successfully.");

  // 5. Mark historical migrations as applied
  const historicalMigrations = [
    '0_init',
    '20260719000000_add_performance_indexes',
    '20260720000000_add_linkedin_url',
    '20260721000000_add_student_profile_email',
    '20260721000001_add_auth_foundation',
    '20260723210000_add_student_csv_bulk_import_fields',
    '20260726000000_add_durable_sync_queue',
    '20260726000001_add_admin_approval_fields',
    '20260730174800_add_student_archiving',
    '20260731083000_add_can_delete_students'
  ];

  console.log("Marking historical migrations as applied...");
  for (const migration of historicalMigrations) {
    console.log(`Resolving migration: ${migration}`);
    execSync(`npx prisma migrate resolve --applied ${migration}`, { stdio: 'inherit' });
  }

  console.log("=== Legacy database baseline bootstrap completed successfully! ===");
} catch (error) {
  console.error("FATAL: Bootstrap failed: ", error.message);
  process.exit(1);
}
