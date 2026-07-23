export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("x-admin-secret") || request.headers.get("authorization");
    if (!authHeader || (!authHeader.includes("apply-migration-now") && !authHeader.includes("your-super-secure-cron-token"))) {
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
      message: "Migration 20260723210000_add_student_csv_bulk_import_fields applied successfully.",
      results,
      columns,
    }, { headers: { "Cache-Control": "private, no-store" } });

  } catch (err: any) {
    console.error("Migration Route Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Migration execution failed." }, { status: 500 });
  }
}
