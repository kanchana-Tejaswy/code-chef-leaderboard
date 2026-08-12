# Student Enrollment Mapping Report - Dry Run

Summary of the real B.Tech academic registry dry-run mapping for existing students.

## Summary Statistics
- **Total Student Profiles**: 416
- **READY**: 414
- **AMBIGUOUS**: 0
- **MISSING_DATA**: 0
- **INVALID**: 2
- **UNRESOLVED**: 0

---

## READY Students Breakdown

### Cohort: 2023-2027
* **Department: ECE**
  - Section A: 16 students
* **Department: CSE**
  - Section B: 1 students
  - Section A: 78 students
* **Department: IT**
  - Section A: 19 students
* **Department: CSM**
  - Section A: 43 students
* **Department: CSD**
  - Section A: 78 students
* **Department: IOT**
  - Section A: 23 students
* **Department: AIDS**
  - Section A: 15 students
* **Department: AIML**
  - Section A: 11 students

### Cohort: 2024-2028
* **Department: CSE**
  - Section A: 52 students
  - Section B: 1 students
  - Section C: 1 students
  - Section F: 1 students
* **Department: EEE**
  - Section A: 1 students
* **Department: IT**
  - Section A: 6 students
* **Department: CSM**
  - Section A: 9 students
* **Department: CSD**
  - Section A: 5 students
* **Department: IOT**
  - Section A: 6 students

### Cohort: 2024-2027
* **Department: CIVIL**
  - Section A: 1 students
* **Department: ECE**
  - Section A: 1 students
* **Department: CSE**
  - Section A: 5 students
* **Department: CSM**
  - Section A: 7 students
* **Department: CSD**
  - Section A: 5 students
* **Department: AIDS**
  - Section A: 2 students
* **Department: AIML**
  - Section A: 1 students

### Cohort: 2025-2029
* **Department: CSE**
  - Section A: 22 students
* **Department: IT**
  - Section A: 1 students

### Cohort: 2025-2028
* **Department: CSE**
  - Section A: 3 students

## User Decision Required / Anomalies Found

### 1. Test Dev student (INVALID)
- **Student ID**: `f8fdc9fc-c903-45f7-b8f1-71a5c5bb3e62`
- **Roll Number**: `22CS999`
- **Legacy values**: Department: CSE, Year: 3, Section: A
- **Issue**: Invalid roll number format.
- **User Decision**: Exclude from enrollment or correct roll number.

### 2. Kunuru Akash Goud (INVALID)
- **Student ID**: `936c0204-b57e-4476-9fd7-294c0191f083`
- **Roll Number**: `23AG1A17229`
- **Legacy values**: Department: AIDS, Year: 4, Section: A
- **Issue**: Invalid roll number format.
- **User Decision**: Exclude from enrollment or correct roll number.

### 3. Kuduru Keerthana (SAFE_NORMALIZATION)
- **Student ID**: `dc88dba8-04d6-452e-8c14-ffd0087946b6`
- **Roll Number**: `23AG1AO5G1`
- **Normalized Roll**: `23AG1A05G1`
- **Legacy values**: Department: CSE, Year: 4, Section: A
- **Issue**: Roll number format normalized (trimmed, uppercase, hyphens or letter-O typo fixed).
- **User Decision**: Auto-normalized safely during dry-run. Action: Correct the roll number in the main profile database.

### 4. Kosana Lavanya (SAFE_NORMALIZATION)
- **Student ID**: `1a1ac3da-cd0e-46ba-842a-5db7c0cdd0b0`
- **Roll Number**: `23AGIA05G0`
- **Normalized Roll**: `23AG1A05G0`
- **Legacy values**: Department: CSE, Year: 4, Section: A
- **Issue**: Roll number format normalized (trimmed, uppercase, hyphens or letter-O typo fixed).
- **User Decision**: Auto-normalized safely during dry-run. Action: Correct the roll number in the main profile database.

### 5. Akshaya Mavila Veettil (SAFE_NORMALIZATION)
- **Student ID**: `e4e20cae-c896-4db0-9694-9ec3d99ba66e`
- **Roll Number**: `24AG1A-05J6`
- **Normalized Roll**: `24AG1A05J6`
- **Legacy values**: Department: CSE, Year: 3, Section: A
- **Issue**: Roll number format normalized (trimmed, uppercase, hyphens or letter-O typo fixed).
- **User Decision**: Auto-normalized safely during dry-run. Action: Correct the roll number in the main profile database.

---

## Write Check Validation

- **StudentEnrollment Count Before**: 0 | **After**: 0 | **Diff**: 0
- **StudentProfile Count Before**: 416 | **After**: 416 | **Diff**: 0
- **UserAccess Count Before**: 4 | **After**: 4 | **Diff**: 0

**Safety Status**: PASSED (Zero writes performed)
