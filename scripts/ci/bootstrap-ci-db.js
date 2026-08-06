const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

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

async function main() {
  // 2. Extract origin/main schema
  console.log("Extracting origin/main schema...");
  const mainCommit = "be230d2911d5751d77fd55f82b3dd5c237590dce";
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
  const rawSql = execSync(`npx prisma migrate diff --from-empty --to-schema "${schemaPath}" --script`, {
    env: { ...process.env, quiet: 'true' }
  }).toString();

  // Filter out any lines matching the injection log or prisma logs
  const cleanSqlLines = rawSql.split('\n').filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('◇') || trimmed.includes('injected env') || trimmed.includes('Loaded Prisma config')) {
      return false;
    }
    return true;
  });
  
  let cleanSql = cleanSqlLines.join('\n');
  
  // Append fake user access records (2 ADMIN, 2 GK_SIR)
  cleanSql += `
INSERT INTO "user_access" ("id", "email", "login_id", "role", "status", "first_login_completed", "must_set_password", "created_at", "updated_at") VALUES
('PHASE37_TEST_A1', 'PHASE37_TEST_admin1@example.com', 'PHASE37_TEST_admin1', 'ADMIN', 'ACTIVE', false, true, NOW(), NOW()),
('PHASE37_TEST_A2', 'PHASE37_TEST_admin2@example.com', 'PHASE37_TEST_admin2', 'ADMIN', 'ACTIVE', false, true, NOW(), NOW()),
('PHASE37_TEST_G1', 'PHASE37_TEST_gksir1@example.com', 'PHASE37_TEST_gksir1', 'GK_SIR', 'ACTIVE', false, true, NOW(), NOW()),
('PHASE37_TEST_G2', 'PHASE37_TEST_gksir2@example.com', 'PHASE37_TEST_gksir2', 'GK_SIR', 'ACTIVE', false, true, NOW(), NOW());
`;
  
  fs.writeFileSync(sqlPath, cleanSql);

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
    '20260730174800_add_student_archiving'
  ];

  console.log("Marking historical migrations as applied...");
  for (const migration of historicalMigrations) {
    console.log(`Resolving migration: ${migration}`);
    execSync(`npx prisma migrate resolve --applied ${migration}`, { stdio: 'inherit' });
  }

  // 6. Pre-migration Checks using pg Client
  console.log("Running pre-migration checks...");
  const pool = new Pool({ connectionString: url });
  
  // 6a. Confirm can_delete_students does not exist
  const columnRes = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'user_access' AND column_name = 'can_delete_students'
  `);
  if (columnRes.rows.length > 0) {
    console.error("FATAL Pre-migration check: can_delete_students column ALREADY exists!");
    process.exit(1);
  }
  console.log("Pre-migration verification: can_delete_students column does not exist (PASS).");

  // 6b. Confirm total UserAccess rows created is exactly 4
  const countRes = await pool.query(`
    SELECT COUNT(*) FROM "user_access" WHERE id LIKE 'PHASE37_TEST_%'
  `);
  const count = parseInt(countRes.rows[0].count, 10);
  if (count !== 4) {
    console.error(`FATAL Pre-migration check: UserAccess count is ${count}, expected 4!`);
    process.exit(1);
  }
  console.log(`Pre-migration verification: Total UserAccess rows created is ${count} (PASS).`);
  await pool.end();

  console.log("=== Legacy database baseline bootstrap completed successfully! ===");
}

main().catch(error => {
  console.error("FATAL: Bootstrap failed: ", error.message);
  process.exit(1);
});
