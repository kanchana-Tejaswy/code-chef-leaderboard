-- CreateEnum
CREATE TYPE "ContestPlatform" AS ENUM ('CODECHEF', 'LEETCODE', 'CODEFORCES');

-- CreateEnum
CREATE TYPE "ContestStatus" AS ENUM ('UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "contests" (
    "id" UUID NOT NULL,
    "platform" "ContestPlatform" NOT NULL,
    "platform_contest_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contest_url" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER,
    "contest_type" TEXT,
    "status" "ContestStatus" NOT NULL DEFAULT 'UPCOMING',
    "last_metadata_synced_at" TIMESTAMP(3),
    "last_results_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest_participations" (
    "id" UUID NOT NULL,
    "contest_id" UUID NOT NULL,
    "student_id" TEXT NOT NULL,
    "student_enrollment_id" UUID,
    "platform_username" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "rank" INTEGER,
    "problems_solved" INTEGER,
    "penalty" DOUBLE PRECISION,
    "rating_before" INTEGER,
    "rating_after" INTEGER,
    "rating_change" INTEGER,
    "participated_at" TIMESTAMP(3),
    "source_updated_at" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contest_participations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contests_slug_key" ON "contests"("slug");

-- CreateIndex
CREATE INDEX "contests_status_idx" ON "contests"("status");

-- CreateIndex
CREATE INDEX "contests_start_time_idx" ON "contests"("start_time");

-- CreateIndex
CREATE UNIQUE INDEX "contests_platform_platform_contest_id_key" ON "contests"("platform", "platform_contest_id");

-- CreateIndex
CREATE INDEX "contest_participations_contest_id_idx" ON "contest_participations"("contest_id");

-- CreateIndex
CREATE INDEX "contest_participations_student_id_idx" ON "contest_participations"("student_id");

-- CreateIndex
CREATE INDEX "contest_participations_student_enrollment_id_idx" ON "contest_participations"("student_enrollment_id");

-- CreateIndex
CREATE INDEX "contest_participations_rank_idx" ON "contest_participations"("rank");

-- CreateIndex
CREATE INDEX "contest_participations_score_idx" ON "contest_participations"("score");

-- CreateIndex
CREATE UNIQUE INDEX "contest_participations_contest_id_student_id_key" ON "contest_participations"("contest_id", "student_id");

-- AddForeignKey
ALTER TABLE "contest_participations" ADD CONSTRAINT "contest_participations_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_participations" ADD CONSTRAINT "contest_participations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_participations" ADD CONSTRAINT "contest_participations_student_enrollment_id_fkey" FOREIGN KEY ("student_enrollment_id") REFERENCES "student_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
