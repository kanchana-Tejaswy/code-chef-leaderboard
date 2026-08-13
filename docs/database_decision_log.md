# Database Decision Log

This document records the architectural and design decisions made for Phase 3.

---

## Phase 3 Additive Boundary

> [!IMPORTANT]
> **Boundary Rule**: Phase 3 is strictly **ADDITIVE**. It adds *only* the new academic registry and enrollment structures. It **MUST NOT** rename, replace, delete, or modify any existing fields, tables, or database relations.

---

## Architectural Decision Log

| Decision ID | Title | Status | Chosen Option | Alternative Explored | Justification & Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEC-01** | StudentEnrollment Consistency | **APPROVED** | **Option B** (Composite FK) | Option A (Store only `classSectionId`) | Option A makes it impossible to link a student to a cohort/department unless their section is known. Option B permits nullable `classSectionId` while enforcing relational checks when populated. |
| **DEC-02** | Current Enrollment Isolation | **APPROVED** | **Partial Unique Index** | App-level check only | Prevents duplicate active enrollments at the database level: `CREATE UNIQUE INDEX ... WHERE is_current = true`. |
| **DEC-03** | HOD Department Scope | **APPROVED** | Preserve `UserAccess.departmentId` | Migrate to `StaffDepartmentAccess` immediately | Preserving `departmentId` is the smallest safe change. A multi-department access structure (`StaffDepartmentAccess`) is documented for future phases, but no migration is done in Phase 3. |
| **DEC-04** | Student Approval State | **APPROVED** | Current `StudentApproval` + `StudentApprovalHistory` | Partial unique index on historical attempts | Storing active approval state in a separate 1:1 `StudentApproval` table keeps main queries clean, while history is written to a distinct audit table. Not implemented in Phase 3. |
| **DEC-05** | Roll-Number Validation | **APPROVED** | Configurable validation regex patterns | Hardcoded institutional regex | Hardcoding regex based on a single roll number breaks when new formats (like lateral entry) are added. Configurable patterns enable Admins to confirm new formats before they block imports. |
| **DEC-06** | Import Sizing | **APPROVED** | 50–100 row transactions + Async Worker | Synchronous 500-row imports | Single synchronous requests for 4,000+ rows hit gateway timeouts. Chunking at 50-100 rows keeps transactions fast, and an async batch worker prevents thread blocks. |
| **DEC-07** | Deletion Safety | **APPROVED** | Multi-step deletion workflow | Cascading DB-level deletion | Deleting a local student profile must not leave orphan accounts on Supabase Auth. The workflow disables logins, removes Auth users, and then cleans up local DB tables. |
| **DEC-08** | Status Consistency | **APPROVED** | DB CHECK constraints + service validation | Service validation only | Enforcing rules (e.g. active students cannot have trash timestamps) at both database and service levels guarantees data integrity. |
| **DEC-09** | Safe Production Rollbacks | **APPROVED** | Non-destructive recovery (forward-fixes) | Destructive ROLLBACK (DROP TABLE/COLUMN) | DROPPING tables in production risks total data loss. Recovery must focus on disabling reads, restoring legacy codes, and writing forward-fixes. |
