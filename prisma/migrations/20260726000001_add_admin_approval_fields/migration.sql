-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "admin_approval_status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ;
ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "approved_by_id" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "approval_note" TEXT;
