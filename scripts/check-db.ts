import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function checkDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // use DATABASE_URL from .env
  });

  try {
    const res1 = await pool.query(`SELECT count(*) FROM student_profiles;`);
    console.log("Student row count:", res1.rows[0].count);

    const res2 = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'student_profiles' AND column_name = 'email';
    `);
    if (res2.rows.length > 0) {
      console.log("email column exists.");
    } else {
      console.log("email column DOES NOT exist.");
    }

    const res3 = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'student_profiles' AND indexname = 'student_profiles_email_key';
    `);
    if (res3.rows.length > 0) {
      console.log("unique index student_profiles_email_key exists.");
    } else {
      console.log("unique index student_profiles_email_key DOES NOT exist.");
    }

  } catch (error) {
    console.error("Database check failed:", error);
  } finally {
    await pool.end();
  }
}

checkDatabase();
