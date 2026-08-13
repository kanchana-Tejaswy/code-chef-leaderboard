# Database Data Dictionary

This document provides a detailed catalog of the database models, fields, types, and constraints introduced in Phase 3.

---

## Phase 3 Additive Boundary

> [!IMPORTANT]
> **Boundary Rule**: Phase 3 is strictly **ADDITIVE**. It adds *only* the new academic registry and enrollment structures. It **MUST NOT** rename, replace, delete, or modify any existing fields, tables, or database relations.

---

## 1. New Models & Enums Data Dictionary

### Table: `cohorts`
Stores the academic entry and exit cohorts for students.

| Column | Type | Nullability | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | NOT NULL | PRIMARY KEY | `uuid_generate_v4()` | Unique cohort identifier |
| `name` | `VARCHAR(50)` | NOT NULL | UNIQUE | - | Descriptive name, e.g. "2023-2027" |
| `start_year` | `INT` | NOT NULL | - | - | Admission starting year |
| `end_year` | `INT` | NOT NULL | - | - | Graduation year |
| `created_at` | `TIMESTAMP` | NOT NULL | - | `NOW()` | Audit creation time |
| `updated_at` | `TIMESTAMP` | NOT NULL | - | `NOW()` | Audit last update time |

---

### Table: `departments`
Stores the college department names and institutional codes.

| Column | Type | Nullability | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | NOT NULL | PRIMARY KEY | `uuid_generate_v4()` | Unique department identifier |
| `name` | `VARCHAR(100)` | NOT NULL | UNIQUE | - | Full name, e.g. "Computer Science & Engineering" |
| `code` | `VARCHAR(10)` | NOT NULL | UNIQUE | - | Institutional code, e.g. "CSE" |
| `created_at` | `TIMESTAMP` | NOT NULL | - | `NOW()` | Audit creation time |
| `updated_at` | `TIMESTAMP` | NOT NULL | - | `NOW()` | Audit last update time |

---

### Table: `class_sections`
Stores sections partitioned by cohort and department.

| Column | Type | Nullability | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | NOT NULL | PRIMARY KEY | `uuid_generate_v4()` | Unique section identifier |
| `name` | `VARCHAR(10)` | NOT NULL | - | - | Section identifier, e.g. "A", "B", "C" |
| `cohort_id` | `VARCHAR(36)` | NOT NULL | FK (`cohorts.id`) | - | Associated cohort |
| `department_id`| `VARCHAR(36)` | NOT NULL | FK (`departments.id`)| - | Associated department |

**Composite Constraints:**
- `@@unique([id, cohort_id, department_id])` - Primary composite verification key.
- `@@unique([cohort_id, department_id, name])` - Ensures unique section name per cohort + department.

---

### Table: `student_enrollments`
Tracks student academic history and active department/section mappings.

| Column | Type | Nullability | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | NOT NULL | PRIMARY KEY | `uuid_generate_v4()` | Unique enrollment identifier |
| `student_id` | `VARCHAR(36)` | NOT NULL | FK (`student_profiles.id`)| - | Student identifier |
| `cohort_id` | `VARCHAR(36)` | NOT NULL | FK (`cohorts.id`) | - | Associated cohort |
| `department_id`| `VARCHAR(36)` | NOT NULL | FK (`departments.id`)| - | Associated department |
| `class_section_id`| `VARCHAR(36)`| NULL | FK (`class_sections.id`)| - | Associated section (nullable) |
| `is_current` | `BOOLEAN` | NOT NULL | INDEX | `true` | Identifies active enrollment |
| `academic_year`| `INT` | NOT NULL | - | - | Year of study (1, 2, 3, 4) |
| `created_at` | `TIMESTAMP` | NOT NULL | - | `NOW()` | Audit creation time |
| `updated_at` | `TIMESTAMP` | NOT NULL | - | `NOW()` | Audit last update time |

**Composite & Partial Constraints:**
- Composite FK on ClassSection: `FOREIGN KEY (class_section_id, cohort_id, department_id) REFERENCES class_sections (id, cohort_id, department_id)`
- Partial Unique Index: `CREATE UNIQUE INDEX student_enrollments_student_id_current_idx ON student_enrollments (student_id) WHERE is_current = true;`

---

## 2. Asynchronous Import Models Data Dictionary

To support processing 4,000+ upload rows asynchronously instead of keeping an HTTP connection open, we define the following audit structures:

### Table: `import_batches`
Tracks status of a bulk asynchronous spreadsheet upload batch.

| Column | Type | Nullability | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | NOT NULL | PRIMARY KEY | `uuid_generate_v4()` | Unique batch identifier |
| `file_name` | `VARCHAR(255)`| NOT NULL | - | - | Spreadsheet file name |
| `status` | `VARCHAR(30)` | NOT NULL | Enum: `ImportBatchStatus` | `PENDING` | Active batch state |
| `total_rows` | `INT` | NOT NULL | - | 0 | Total rows present in file |
| `processed_rows`| `INT` | NOT NULL | - | 0 | Count of processed rows |
| `failed_rows` | `INT` | NOT NULL | - | 0 | Count of failed rows |
| `created_by_id`| `VARCHAR(36)` | NOT NULL | FK (`user_access.id`)| - | Executing Administrator |
| `created_at` | `TIMESTAMP` | NOT NULL | - | `NOW()` | Audit creation time |
| `updated_at` | `TIMESTAMP` | NOT NULL | - | `NOW()` | Audit last update time |

---

### Table: `import_rows`
Tracks evaluation/validation results of individual lines in a batch.

| Column | Type | Nullability | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | NOT NULL | PRIMARY KEY | `uuid_generate_v4()` | Unique row identifier |
| `batch_id` | `VARCHAR(36)` | NOT NULL | FK (`import_batches.id`) | - | Associated import batch |
| `row_index` | `INT` | NOT NULL | - | - | Spreadsheet row number (0-indexed)|
| `raw_data` | `JSONB` | NOT NULL | - | - | JSON representation of raw row data|
| `status` | `VARCHAR(30)` | NOT NULL | Enum: `ImportRowStatus`| `PENDING` | Row mapping/validation state |
| `error_details`| `TEXT` | NULL | - | - | JSON description of failures/reasons|
| `created_at` | `TIMESTAMP` | NOT NULL | - | `NOW()` | Audit creation time |
| `updated_at` | `TIMESTAMP` | NOT NULL | - | `NOW()` | Audit last update time |

---

## 3. Status Integrity Rules & Constraints

The relationship between a student's active status and auditing attributes is governed by the following rules:

### Status-to-Timestamp State Chart:
- **`ACTIVE`**: `archived_at` IS NULL AND `trashed_at` IS NULL AND `permanent_delete_after` IS NULL.
- **`ARCHIVED`**: `archived_at` IS NOT NULL.
- **`TRASHED`**: `trashed_at` IS NOT NULL AND `permanent_delete_after` IS NOT NULL.
- **`ALUMNI`**: `archived_at` IS NULL AND `trashed_at` IS NULL AND `permanent_delete_after` IS NULL (Alumni represents a successful academic graduation state, **NOT** a trashed/deleted state).

### Enforcement Method:
- **Database Level (PostgreSQL)**: To guarantee data consistency even during raw DB manipulations:
  ```sql
  ALTER TABLE student_profiles ADD CONSTRAINT check_status_consistency CHECK (
    (profile_status = 'ACTIVE' AND archived_at IS NULL AND trashed_at IS NULL AND permanent_delete_after IS NULL) OR
    (profile_status = 'ARCHIVED' AND archived_at IS NOT NULL AND trashed_at IS NULL AND permanent_delete_after IS NULL) OR
    (profile_status = 'TRASHED' AND trashed_at IS NOT NULL AND permanent_delete_after IS NOT NULL) OR
    (profile_status = 'ALUMNI' AND archived_at IS NULL AND trashed_at IS NULL AND permanent_delete_after IS NULL)
  );
  ```
- **Service Level (Prisma / Zod)**: Backend API requests validate incoming states via Zod schemas prior to write operations.
