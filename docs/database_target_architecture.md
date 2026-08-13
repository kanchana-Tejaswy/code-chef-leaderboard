# Database Target Architecture Design

This document details the target database architecture and layout for Phase 3, addressing the structural adjustments needed to incorporate the academic registry.

---

## Phase 3 Additive Boundary

> [!IMPORTANT]
> **Boundary Rule**: Phase 3 is strictly **ADDITIVE**. It adds *only* the new academic registry and enrollment structures. It **MUST NOT** rename, replace, delete, or modify any existing fields, tables, or database relations.

### Additions Allowed:
- **New Tables**: `cohorts`, `departments`, `class_sections`, `student_enrollments`
- **New Enums**: `ImportBatchStatus`, `ImportRowStatus`, `ApprovalStatus`, `StudentStatus`
- **New Additive Indexes**: Partial unique index on student enrollments, indexes on foreign keys.

### Preservation Rules (Strictly Unchanged):
- `StudentProfile.name` remains required and unchanged.
- `StudentProfile.rollNumber` nullability remains `String?` (do not make it required or change it).
- `UserAccess` table structure (preserves existing HOD department-scope authorization).
- `CodechefProfile` and `LeetcodeProfile` (must not alter studentId relationships during the transition).
- `SyncJob` table structure and logic.
- supabase authentication integration.
- Existing import API endpoints must not break.

---

## 1. Relational Schema Blueprint (Prisma)

Below is the designed Prisma schema addition for Phase 3:

```prisma
enum ImportBatchStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum ImportRowStatus {
  PENDING
  MAPPED
  UNRESOLVED
  FAILED
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

enum StudentStatus {
  ACTIVE
  ARCHIVED
  TRASHED
  ALUMNI
}

model Cohort {
  id            String              @id @default(uuid())
  name          String              @unique // e.g., "2023-2027"
  startYear     Int                 @map("start_year")
  endYear       Int                 @map("end_year")
  createdAt     DateTime            @default(now()) @map("created_at")
  updatedAt     DateTime            @updatedAt @map("updated_at")
  classSections ClassSection[]
  enrollments   StudentEnrollment[]

  @@map("cohorts")
}

model Department {
  id            String              @id @default(uuid())
  name          String              @unique // e.g., "Computer Science & Engineering"
  code          String              @unique // e.g., "CSE"
  createdAt     DateTime            @default(now()) @map("created_at")
  updatedAt     DateTime            @updatedAt @map("updated_at")
  classSections ClassSection[]
  enrollments   StudentEnrollment[]

  @@map("departments")
}

model ClassSection {
  id           String              @id @default(uuid())
  name         String              // e.g., "A", "B", "C"
  cohortId     String              @map("cohort_id")
  departmentId String              @map("department_id")
  cohort       Cohort              @relation(fields: [cohortId], references: [id], onDelete: Cascade)
  department   Department          @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  enrollments  StudentEnrollment[]

  @@unique([id, cohortId, departmentId]) // Essential for composite foreign key constraint
  @@unique([cohortId, departmentId, name]) // Enforces unique section name per cohort and department
  @@map("class_sections")
}

model StudentEnrollment {
  id             String         @id @default(uuid())
  studentId      String         @map("student_id")
  cohortId       String         @map("cohort_id")
  departmentId   String         @map("department_id")
  classSectionId String?        @map("class_section_id")
  isCurrent      Boolean        @default(true) @map("is_current")
  academicYear   Int            @map("academic_year") // 1, 2, 3, 4
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")

  student        StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  cohort         Cohort         @relation(fields: [cohortId], references: [id], onDelete: Restrict)
  department     Department     @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  classSection   ClassSection?  @relation(fields: [classSectionId, cohortId, departmentId], references: [id, cohortId, departmentId], onDelete: Restrict)

  @@index([studentId])
  @@index([cohortId])
  @@index([departmentId])
  @@map("student_enrollments")
}
```

---

## 2. Student Enrollment Consistency: Justification of Option B

To prevent invalid mappings (such as associating a section of Cohort X / Department Y with an enrollment for Cohort A / Department B), the design enforces **Option B** (Composite Foreign Key relationship).

### Why Option B is Chosen over Option A:
- **Handling Nullable Sections**: A student may be enrolled in a department and cohort but not yet assigned to a class section (e.g. during early registration or lateral entry integration). Option A (storing *only* `classSectionId` and deriving cohort/department) makes it impossible to link a student to a cohort or department unless a section is assigned, or forces the creation of fake "UNASSIGNED" sections.
- **Option B Implementation**: Stores `cohortId`, `departmentId`, and `classSectionId` directly inside `StudentEnrollment`. When `classSectionId` is not null, a composite foreign key enforces that the section belongs to the exact same `cohortId` and `departmentId`.
- **Constraint Definition**:
  ```prisma
  classSection  ClassSection? @relation(fields: [classSectionId, cohortId, departmentId], references: [id, cohortId, departmentId], onDelete: Restrict)
  ```
  This guarantees database-level integrity, making mismatches physically impossible.

---

## 3. Current Enrollment Isolation & Transactional State Transitions

### Partial Unique Index
To enforce that a student has at most one current enrollment, a PostgreSQL partial unique index is defined:

```sql
CREATE UNIQUE INDEX student_enrollments_student_id_current_idx 
ON student_enrollments (student_id) 
WHERE is_current = true;
```

### Transaction Boundary for Student Transitions
When a student moves (e.g., shifts to a different section or is promoted to a new academic year), the following transactional sequence runs atomically inside a `READ COMMITTED` or higher transaction:

1. **End previous current enrollment**: Set `is_current = false` for the student's active enrollment.
2. **Create new enrollment**: Insert the new enrollment record with `is_current = true`.
3. **Atomically Commit**: Commit both changes. The database-level partial unique index ensures that at no point in time can two active enrollments coexist.

---

## 4. Roll-Number Validation and Normalization Design

### Normalization Process
1. **Trim Whitespace**: Remove leading and trailing spaces.
2. **Remove Internal Special Characters**: Convert to uppercase and strip out accidental internal spacing or hyphens.

### Configurable Validation Rule Engine
To avoid hardcoded regex validation that fails on newly encountered formats (like lateral entries or new departmental suffixes), the system uses an Admin-configurable regex table:

- **Regular admission pattern**: `^([0-9]{2})(AG)(1A)(0[1-9]|12|42|02|03|04|05)([0-9A-Z]{2})$`
- **Lateral entry pattern**: `^([0-9]{2})(AG)(5A)(0[1-9]|12|42|02|03|04|05)([0-9A-Z]{2})$`

If a roll number doesn't match any validated regex rule:
- It is flagged as `REQUIRES_REVIEW` or `INVALID_DATA` rather than being rejected, giving Admins the option to verify it manually or declare a new valid regex pattern.
