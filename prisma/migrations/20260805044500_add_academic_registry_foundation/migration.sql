-- CreateEnum
CREATE TYPE "CohortStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'GRADUATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PROMOTED', 'REPEATING', 'SUSPENDED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "cohorts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "start_year" INTEGER NOT NULL,
    "end_year" INTEGER NOT NULL,
    "status" "CohortStatus" NOT NULL DEFAULT 'ACTIVE',
    "graduated_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sections" (
    "id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_enrollments" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "class_section_id" UUID,
    "academic_year" INTEGER NOT NULL,
    "semester" INTEGER,
    "enrollment_status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cohorts_code_key" ON "cohorts"("code");

-- CreateIndex
CREATE INDEX "cohorts_status_idx" ON "cohorts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cohorts_start_year_end_year_key" ON "cohorts"("start_year", "end_year");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_is_active_idx" ON "departments"("is_active");

-- CreateIndex
CREATE INDEX "class_sections_cohort_id_idx" ON "class_sections"("cohort_id");

-- CreateIndex
CREATE INDEX "class_sections_department_id_idx" ON "class_sections"("department_id");

-- CreateIndex
CREATE INDEX "class_sections_is_active_idx" ON "class_sections"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "class_sections_id_cohort_id_department_id_key" ON "class_sections"("id", "cohort_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_sections_cohort_id_department_id_name_key" ON "class_sections"("cohort_id", "department_id", "name");

-- CreateIndex
CREATE INDEX "student_enrollments_student_id_idx" ON "student_enrollments"("student_id");

-- CreateIndex
CREATE INDEX "student_enrollments_cohort_id_idx" ON "student_enrollments"("cohort_id");

-- CreateIndex
CREATE INDEX "student_enrollments_department_id_idx" ON "student_enrollments"("department_id");

-- CreateIndex
CREATE INDEX "student_enrollments_class_section_id_idx" ON "student_enrollments"("class_section_id");

-- CreateIndex
CREATE INDEX "student_enrollments_is_current_idx" ON "student_enrollments"("is_current");

-- CreateIndex
CREATE INDEX "student_enrollments_cohort_id_department_id_is_current_idx" ON "student_enrollments"("cohort_id", "department_id", "is_current");

-- CreateIndex
CREATE INDEX "student_enrollments_cohort_id_department_id_class_section_i_idx" ON "student_enrollments"("cohort_id", "department_id", "class_section_id", "is_current");

-- AddForeignKey
ALTER TABLE "class_sections" ADD CONSTRAINT "class_sections_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sections" ADD CONSTRAINT "class_sections_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_class_section_id_cohort_id_department__fkey" FOREIGN KEY ("class_section_id", "cohort_id", "department_id") REFERENCES "class_sections"("id", "cohort_id", "department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateOneCurrentEnrollmentIndex
CREATE UNIQUE INDEX "student_enrollments_one_current_per_student"
ON "student_enrollments" ("student_id")
WHERE "is_current" = true;

-- AddAcademicYearCheckConstraint
ALTER TABLE "student_enrollments"
ADD CONSTRAINT "student_enrollments_academic_year_check"
CHECK ("academic_year" BETWEEN 1 AND 4);

-- AddSemesterCheckConstraint
ALTER TABLE "student_enrollments"
ADD CONSTRAINT "student_enrollments_semester_check"
CHECK ("semester" IS NULL OR "semester" BETWEEN 1 AND 8);
