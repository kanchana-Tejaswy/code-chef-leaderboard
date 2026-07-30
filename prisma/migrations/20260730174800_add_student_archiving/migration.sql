-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN "archived_at" TIMESTAMP(3);
ALTER TABLE "student_profiles" ADD COLUMN "archived_by_id" TEXT;

-- CreateIndex
CREATE INDEX "student_profiles_archived_at_idx" ON "student_profiles"("archived_at");
CREATE INDEX "student_profiles_archived_by_id_idx" ON "student_profiles"("archived_by_id");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "user_access"("id") ON DELETE SET NULL ON UPDATE CASCADE;
