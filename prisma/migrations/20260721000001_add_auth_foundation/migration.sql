-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GK_SIR', 'HOD', 'STUDENT');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateTable
CREATE TABLE "user_access" (
    "id" TEXT NOT NULL,
    "auth_user_id" TEXT,
    "email" TEXT NOT NULL,
    "login_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "department_id" TEXT,
    "student_profile_id" TEXT,
    "first_login_completed" BOOLEAN NOT NULL DEFAULT false,
    "must_set_password" BOOLEAN NOT NULL DEFAULT true,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "password_set_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_access_auth_user_id_key" ON "user_access"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_access_email_key" ON "user_access"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_access_login_id_key" ON "user_access"("login_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_access_student_profile_id_key" ON "user_access"("student_profile_id");

-- CreateIndex
CREATE INDEX "user_access_role_idx" ON "user_access"("role");

-- CreateIndex
CREATE INDEX "user_access_status_idx" ON "user_access"("status");

-- CreateIndex
CREATE INDEX "user_access_department_id_idx" ON "user_access"("department_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "user_access" ADD CONSTRAINT "user_access_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_access"("id") ON DELETE SET NULL ON UPDATE CASCADE;
