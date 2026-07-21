-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_email_key"
ON "student_profiles"("email");
