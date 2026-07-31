-- AlterTable
ALTER TABLE "user_access" ADD COLUMN "can_delete_students" BOOLEAN NOT NULL DEFAULT false;

-- Update existing admins to true
UPDATE "user_access" SET "can_delete_students" = true WHERE "role" = 'ADMIN';
