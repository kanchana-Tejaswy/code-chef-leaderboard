-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('CODECHEF', 'LEETCODE', 'CODEFORCES', 'GITHUB', 'LINKEDIN', 'HACKERRANK', 'HACKEREARTH');

-- CreateEnum
CREATE TYPE "PlatformVerificationStatus" AS ENUM ('NOT_CONFIGURED', 'PENDING', 'VERIFIED', 'INVALID', 'FAILED');

-- CreateTable
CREATE TABLE "student_platform_accounts" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "profile_url" TEXT NOT NULL,
    "normalized_handle" TEXT NOT NULL,
    "verification_status" "PlatformVerificationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_platform_accounts_student_id_platform_key" ON "student_platform_accounts"("student_id", "platform");

-- CreateIndex
CREATE INDEX "student_platform_accounts_platform_normalized_handle_idx" ON "student_platform_accounts"("platform", "normalized_handle");

-- CreateIndex
CREATE INDEX "student_profiles_name_idx" ON "student_profiles"("name");

-- AddForeignKey
ALTER TABLE "student_platform_accounts" ADD CONSTRAINT "student_platform_accounts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
