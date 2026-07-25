-- Add durable sync queue columns to sync_jobs table
ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "attempt_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "last_attempted_at" TIMESTAMPTZ;
ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "last_successful_at" TIMESTAMPTZ;
ALTER TABLE "sync_jobs" ADD COLUMN IF NOT EXISTS "error_category" TEXT;

CREATE INDEX IF NOT EXISTS "sync_jobs_status_idx" ON "sync_jobs"("status");
CREATE INDEX IF NOT EXISTS "sync_jobs_student_id_idx" ON "sync_jobs"("student_id");
