# Design Phase Walkthrough

This walkthrough summarizes the database design corrections and validation results completed for Phase 2.1.

---

## Phase 3 Additive Boundary

> [!IMPORTANT]
> **Boundary Rule**: Phase 3 is strictly **ADDITIVE**. It adds *only* the new academic registry and enrollment structures. It **MUST NOT** rename, replace, delete, or modify any existing fields, tables, or database relations.

---

## 1. Summary of Design Corrections Completed

We have reviewed and corrected the database design documents in accordance with the Phase 2.1 guidelines:

1. **Additive Scope**: Isolated the Phase 3 implementation schemas so they represent only Cohort, Department, ClassSection, StudentEnrollment, and related enums/indexes.
2. **Option B Selected**: Enforced a composite foreign key on `StudentEnrollment` referencing `ClassSection(id, cohortId, departmentId)` to ensure no mismatch of cohort/department can physically occur while allowing class section to remain nullable when unassigned.
3. **No Guessing Policy**: Removed all default backfill values (e.g. defaulting to 2023-2027 or CSE). Unresolved students remain unmapped, and we designed a dry-run mapping report to evaluate import data.
4. **PostgreSQL Current Enrollment Index**: Formulated a partial unique index SQL query that enforces only one active (`is_current = true`) enrollment per student.
5. **Configurable Roll-Number Validation**: Designed a regex-driven validation rule engine starting with patterns derived from Aditya College of Engineering (`YYAG1A...` and `YYAG5A...`) instead of hardcoding a single pattern.
6. **Asynchronous Import Sizing**: Updated the import chunk sizes to `50–100` rows per transaction and introduced `ImportBatch` and `ImportRow` schemas for async processing of 4,000+ uploads.
7. **Safe Recovery & Deletion workflows**: Replaced destructive production rollbacks with non-destructive forward-fix strategies, and designed a multi-step user/auth deletion safety workflow.

---

## 2. Temporary Prisma Schema Validation

We validated the proposed database schema additions in a temporary setup using the Prisma CLI:

```bash
# Executed Command
npx prisma validate --schema="temp_schema.prisma"
```

### Result:
- **Status**: `VALID 🚀`
- **Output**:
  ```
  Prisma schema loaded from temp_schema.prisma.
  The schema at temp_schema.prisma is valid 🚀
  ```
This confirms there are no missing relation fields, type mismatches, opposite relation issues, or enum conflicts.

---

## 3. Working Tree Status (`git status --Granular`)

Running `git status --short` shows that the working tree remains dirty with pre-existing work. No code files, databases, or migrations were altered during this design correction phase:

```
 M package-lock.json
 M package.json
 M src/app/api/auth/login/password/route.ts
 M src/app/login/page.tsx
 M src/lib/auth.ts
 M src/services/auth-rate-limit.service.ts
 M tests/admin-auth-rebuild.test.ts
?? tests/auth-rate-limit.test.ts
```

We propose three separate future commits to stage this work cleanly:
1. **Commit 1 (Existing Auth Work)**: Commit the modified auth routes and test suites.
2. **Commit 2 (Database Design Documents)**: Commit the Phase 2.1 markdown documents under `docs/`.
3. **Commit 3 (Phase 3 Additive Schema)**: Apply the schema modifications to `prisma/schema.prisma` and create the migration file in Phase 3.
