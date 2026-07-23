-- AlterTable
ALTER TABLE "student_profiles"
ADD COLUMN "contact_number" TEXT,
ADD COLUMN "cgpa" DOUBLE PRECISION,
ADD COLUMN "codeforces_username" TEXT,
ADD COLUMN "profile_status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
ADD COLUMN "leaderboard_eligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "dashboard_eligible" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_codeforces_username_key"
ON "student_profiles"("codeforces_username");
