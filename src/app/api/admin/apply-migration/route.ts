import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canPerformWrite } from "@/lib/write-access";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("x-admin-secret") || request.headers.get("authorization");
    const adminSecret = process.env.ADMIN_SYNC_SECRET || process.env.CRON_SECRET;
    
    let isAuthorized = false;
    if (adminSecret && authHeader && (authHeader === adminSecret || authHeader === `Bearer ${adminSecret}`)) {
      isAuthorized = true;
    } else if (await canPerformWrite(request)) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Unauthorized migration request" }, { status: 401 });
    }

    const sqlStatements = [
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "contact_number" TEXT;`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "cgpa" DOUBLE PRECISION;`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "codeforces_username" TEXT;`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "profile_status" TEXT NOT NULL DEFAULT 'INCOMPLETE';`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "leaderboard_eligible" BOOLEAN NOT NULL DEFAULT false;`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "dashboard_eligible" BOOLEAN NOT NULL DEFAULT false;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "student_profiles_codeforces_username_key" ON "student_profiles"("codeforces_username");`,
      `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      );`,
      `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "started_at", "applied_steps_count")
       VALUES (
         gen_random_uuid()::text,
         '20260723210000_add_student_csv_bulk_import_fields',
         now(),
         '20260723210000_add_student_csv_bulk_import_fields',
         NULL,
         now(),
         1
       )
       ON CONFLICT DO NOTHING;`,
      `ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "attempt_count" INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "last_attempted_at" TIMESTAMPTZ;`,
      `ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "last_successful_at" TIMESTAMPTZ;`,
      `ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "error_category" TEXT;`,
      `CREATE INDEX IF NOT EXISTS "sync_jobs_status_idx" ON "sync_jobs"("status");`,
      `CREATE INDEX IF NOT EXISTS "sync_jobs_student_id_idx" ON "sync_jobs"("student_id");`,
      `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "started_at", "applied_steps_count")
       VALUES (
         gen_random_uuid()::text,
         '20260726000000_add_durable_sync_queue',
         now(),
         '20260726000000_add_durable_sync_queue',
         NULL,
         now(),
         1
       )
       ON CONFLICT DO NOTHING;`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "admin_approval_status" TEXT NOT NULL DEFAULT 'PENDING';`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ;`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "approved_by_id" TEXT;`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "approval_note" TEXT;`,
      `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "started_at", "applied_steps_count")
       VALUES (
         gen_random_uuid()::text,
         '20260726000001_add_admin_approval_fields',
         now(),
         '20260726000001_add_admin_approval_fields',
         NULL,
         now(),
         1
       )
       ON CONFLICT DO NOTHING;`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);`,
      `ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "archived_by_id" TEXT;`,
      `CREATE INDEX IF NOT EXISTS "student_profiles_archived_at_idx" ON "student_profiles"("archived_at");`,
      `CREATE INDEX IF NOT EXISTS "student_profiles_archived_by_id_idx" ON "student_profiles"("archived_by_id");`,
      `ALTER TABLE "student_profiles" DROP CONSTRAINT IF EXISTS "student_profiles_archived_by_id_fkey";`,
      `ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "user_access"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
      `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "started_at", "applied_steps_count")
       VALUES (
         gen_random_uuid()::text,
         '20260730174800_add_student_archiving',
         now(),
         '20260730174800_add_student_archiving',
         NULL,
         now(),
         1
       )
       ON CONFLICT DO NOTHING;`
    ];

    const results: string[] = [];
    for (const stmt of sqlStatements) {
      await prisma.$executeRawUnsafe(stmt);
      results.push(`Executed: ${stmt.slice(0, 50)}...`);
    }

    const columns: any[] = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'student_profiles'
      ORDER BY ordinal_position;
    `;

    return NextResponse.json({
      success: true,
      message: "Migrations applied successfully, including 20260730174800_add_student_archiving.",
      results,
      columns,
    }, { headers: { "Cache-Control": "private, no-store" } });

  } catch (err: any) {
    console.error("Migration Route Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Migration execution failed." }, { status: 500 });
  }
}
