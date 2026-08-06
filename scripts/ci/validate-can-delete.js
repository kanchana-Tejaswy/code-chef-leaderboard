const { Pool } = require('pg');

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function run() {
  const pool = new Pool({ connectionString: url });
  let hasFailed = false;

  function report(checkNum, description, success) {
    if (success) {
      console.log(`Check ${checkNum}: ${description} - PASS`);
    } else {
      console.error(`Check ${checkNum}: ${description} - FAIL`);
      hasFailed = true;
    }
  }

  try {
    // 1. Column exists, type is BOOLEAN, default value is false, non-nullable
    const columnInfo = await pool.query(`
      SELECT data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'user_access' AND column_name = 'can_delete_students'
    `);
    
    report(1, "can_delete_students column exists", columnInfo.rows.length === 1);
    
    if (columnInfo.rows.length === 1) {
      const col = columnInfo.rows[0];
      report(2, "Column type is BOOLEAN", col.data_type === 'boolean');
      report(3, "Default value is false", col.column_default === 'false');
      report(4, "Column is non-nullable", col.is_nullable === 'NO');
    } else {
      report(2, "Column type is BOOLEAN", false);
      report(3, "Default value is false", false);
      report(4, "Column is non-nullable", false);
    }

    // Fetch the fake records
    const usersRes = await pool.query(`
      SELECT id, role, "can_delete_students" 
      FROM "user_access" 
      WHERE id LIKE 'PHASE37_TEST_%'
      ORDER BY id
    `);
    const users = usersRes.rows;

    // 5. Both fake ADMIN users have can_delete_students = true
    const admin1 = users.find(u => u.id === 'PHASE37_TEST_A1');
    const admin2 = users.find(u => u.id === 'PHASE37_TEST_A2');
    report(5, "Both fake ADMIN users have can_delete_students = true", 
      admin1 && admin1.can_delete_students === true && 
      admin2 && admin2.can_delete_students === true
    );

    // 6. Both fake GK_SIR users have can_delete_students = false
    const gksir1 = users.find(u => u.id === 'PHASE37_TEST_G1');
    const gksir2 = users.find(u => u.id === 'PHASE37_TEST_G2');
    report(6, "Both fake GK_SIR users have can_delete_students = false", 
      gksir1 && gksir1.can_delete_students === false && 
      gksir2 && gksir2.can_delete_students === false
    );

    // 7. Total UserAccess record count remains 4
    report(7, "Total UserAccess record count remains 4", users.length === 4);

    // 8. No role values changed
    report(8, "No role values changed", 
      admin1 && admin1.role === 'ADMIN' && 
      admin2 && admin2.role === 'ADMIN' && 
      gksir1 && gksir1.role === 'GK_SIR' && 
      gksir2 && gksir2.role === 'GK_SIR'
    );

    // 9. No UserAccess records were deleted
    const allUsersCount = await pool.query(`SELECT COUNT(*) FROM "user_access"`);
    report(9, "No UserAccess records were deleted", parseInt(allUsersCount.rows[0].count, 10) === 4);

    // 10. Creating a new non-admin user defaults to false
    await pool.query(`
      INSERT INTO "user_access" ("id", "email", "login_id", "role", "status", "first_login_completed", "must_set_password", "created_at", "updated_at")
      VALUES ('PHASE37_TEST_NEW', 'PHASE37_TEST_new@example.com', 'PHASE37_TEST_new', 'STUDENT', 'ACTIVE', false, true, NOW(), NOW())
    `);
    const newRecord = await pool.query(`SELECT "can_delete_students" FROM "user_access" WHERE id = 'PHASE37_TEST_NEW'`);
    report(10, "Creating a new non-admin user defaults to false", 
      newRecord.rows.length === 1 && newRecord.rows[0].can_delete_students === false
    );

    // Cleanup new record
    await pool.query(`DELETE FROM "user_access" WHERE id = 'PHASE37_TEST_NEW'`);

    // Cleanup all PHASE37_TEST records
    console.log("Cleaning up fake PHASE37_TEST records...");
    await pool.query(`DELETE FROM "user_access" WHERE id LIKE 'PHASE37_TEST_%'`);
    
    // Verify zero remain
    const remainingRes = await pool.query(`SELECT COUNT(*) FROM "user_access" WHERE id LIKE 'PHASE37_TEST_%'`);
    const remainingCount = parseInt(remainingRes.rows[0].count, 10);
    report(11, "PHASE37_TEST records completely cleaned up", remainingCount === 0);

  } catch (err) {
    console.error("Verification failed with error:", err.message);
    hasFailed = true;
  } finally {
    await pool.end();
  }

  if (hasFailed) {
    process.exit(1);
  } else {
    console.log("ALL can_delete_students VALIDATION CHECKS PASSED!");
  }
}

run().catch(console.error);
