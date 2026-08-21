import { prisma } from "@/lib/prisma";
import { isMissingOrNA, extractPlatformHandle, formatToFullUrl } from "@/utils/urlValidation";
import { normalizeRoll, normalizeRollNumber, getCohortYears } from "@/utils/normalization";
import { ActivityService } from "./activity.service";
import { provisionStudentAccount } from "./auth-provisioning.service";
import crypto from "crypto";

export type RowClassification =
  | "READY"
  | "INCOMPLETE"
  | "DUPLICATE_ROLL_NUMBER"
  | "DUPLICATE_EMAIL"
  | "DUPLICATE_PLATFORM_USERNAME"
  | "INVALID_NAME"
  | "INVALID_ROLL_NUMBER"
  | "INVALID_EMAIL"
  | "INVALID_YEAR"
  | "INVALID_CGPA"
  | "INVALID_ROW";

export interface RawStudentInput {
  name?: string | null;
  rollNumber?: string | null;
  roll_number?: string | null;
  contactNumber?: string | null;
  contact_number?: string | null;
  phone?: string | null;
  year?: string | number | null;
  branch?: string | null;
  department?: string | null;
  section?: string | null;
  cgpa?: string | number | null;
  email?: string | null;
  codechefUsername?: string | null;
  codechef_username?: string | null;
  codechef_url?: string | null;
  leetcodeUsername?: string | null;
  leetcode_username?: string | null;
  leetcode_url?: string | null;
  codeforcesUsername?: string | null;
  codeforces_username?: string | null;
  codeforces_url?: string | null;
  githubUsername?: string | null;
  github_username?: string | null;
  github_url?: string | null;
  linkedinUrl?: string | null;
  linkedin_url?: string | null;
  hackerrankUsername?: string | null;
  hackerrank_username?: string | null;
  hackerrankUrl?: string | null;
  hackerrank_url?: string | null;
  hackerearthUsername?: string | null;
  hackerearth_username?: string | null;
  hackerearthUrl?: string | null;
  hackerearth_url?: string | null;
  profilePictureUrl?: string | null;
  profile_picture_url?: string | null;
}

export interface NormalizedStudentData {
  name: string;
  rollNumber: string;
  contactNumber: string | null;
  year: number;
  branch: string;
  department: string;
  section: string;
  cgpa: number | null;
  email: string;
  codechefUsername: string | null;
  leetcodeUsername: string | null;
  codeforcesUsername: string | null;
  githubUsername: string | null;
  linkedinUrl: string | null;
  hackerrankUsername: string | null;
  hackerearthUsername: string | null;
  profilePictureUrl: string | null;
}

export interface EvaluatedRow {
  index: number;
  raw: RawStudentInput;
  normalized: NormalizedStudentData;
  classification: RowClassification;
  reasons: string[];
  hadDuplicateHandle?: boolean;
}

export class StudentProfileService {
  /**
   * Normalizes raw inputs according to platform requirements.
   */
  static normalizeInput(input: RawStudentInput): NormalizedStudentData {
    const rawName = input.name || "";
    const name = String(rawName).trim().replace(/\s+/g, " ");

    const rawRoll = input.rollNumber || input.roll_number || "";
    const rollNumber = String(rawRoll).trim().toUpperCase();

    const rawEmail = input.email || "";
    const email = String(rawEmail).trim().toLowerCase();

    const rawContact = input.contactNumber || input.contact_number || input.phone;
    const contactNumber = isMissingOrNA(rawContact ? String(rawContact) : null)
      ? null
      : String(rawContact).trim();

    const rawDept = input.department || input.branch || "CSE";
    const department = String(rawDept).trim().toUpperCase();
    const branch = input.branch ? String(input.branch).trim().toUpperCase() : department;
    const section = input.section ? String(input.section).trim().toUpperCase() : "A";

    const rawYear = input.year;
    let year = 3;
    if (rawYear !== undefined && rawYear !== null && rawYear !== "") {
      const parsedYear = parseInt(String(rawYear), 10);
      if (!isNaN(parsedYear)) year = parsedYear;
    }

    const rawCgpa = input.cgpa;
    let cgpa: number | null = null;
    if (rawCgpa !== undefined && rawCgpa !== null && rawCgpa !== "") {
      const parsedCgpa = parseFloat(String(rawCgpa));
      if (!isNaN(parsedCgpa)) cgpa = parsedCgpa;
    }

    const rawCc = input.codechefUsername || input.codechef_username || input.codechef_url;
    const codechefUsername = extractPlatformHandle(rawCc ? String(rawCc) : null, "codechef");

    const rawLc = input.leetcodeUsername || input.leetcode_username || input.leetcode_url;
    const leetcodeUsername = extractPlatformHandle(rawLc ? String(rawLc) : null, "leetcode");

    const rawCf = input.codeforcesUsername || input.codeforces_username || input.codeforces_url;
    const codeforcesUsername = extractPlatformHandle(rawCf ? String(rawCf) : null, "codeforces");

    const rawGh = input.githubUsername || input.github_username || input.github_url;
    const githubUsername = extractPlatformHandle(rawGh ? String(rawGh) : null, "github");

    const rawLn = input.linkedinUrl || input.linkedin_url;
    const linkedinUrl = extractPlatformHandle(rawLn ? String(rawLn) : null, "linkedin");

    const rawHr = input.hackerrankUsername || input.hackerrank_username || input.hackerrankUrl || input.hackerrank_url;
    const hackerrankUsername = extractPlatformHandle(rawHr ? String(rawHr) : null, "hackerrank");

    const rawHe = input.hackerearthUsername || input.hackerearth_username || input.hackerearthUrl || input.hackerearth_url;
    const hackerearthUsername = extractPlatformHandle(rawHe ? String(rawHe) : null, "hackerearth");

    const rawPic = input.profilePictureUrl || input.profile_picture_url;
    const profilePictureUrl = isMissingOrNA(rawPic ? String(rawPic) : null)
      ? null
      : String(rawPic).trim();

    return {
      name,
      rollNumber,
      contactNumber,
      year,
      branch,
      department,
      section,
      cgpa,
      email,
      codechefUsername,
      leetcodeUsername,
      codeforcesUsername,
      githubUsername,
      linkedinUrl,
      hackerrankUsername,
      hackerearthUsername,
      profilePictureUrl,
    };
  }

  static async evaluateRows(
    rows: RawStudentInput[],
    dbStudentsOverride?: any[]
  ): Promise<(EvaluatedRow & { isUpdate?: boolean; existingId?: string; changedFields?: string[] })[]> {
    let allDbStudents = dbStudentsOverride;
    if (!allDbStudents) {
      try {
        if (prisma.studentProfile && typeof prisma.studentProfile.findMany === "function") {
          allDbStudents = await prisma.studentProfile.findMany({
            select: {
              id: true,
              rollNumber: true,
              email: true,
              contactNumber: true,
              name: true,
              codechefUsername: true,
              leetcodeUsername: true,
              githubUsername: true,
              codeforcesUsername: true,
              linkedinUrl: true,
              section: true,
              department: true,
              branch: true,
              year: true,
              cgpa: true,
              adminApprovalStatus: true,
              archivedAt: true,
            },
          });
        } else {
          allDbStudents = [];
        }
      } catch (err) {
        allDbStudents = [];
      }
    }

    const studentMap = new Map<string, any>();
    const emailToStudentId = new Map<string, string>();
    const ccToStudentId = new Map<string, string>();
    const lcToStudentId = new Map<string, string>();
    const ghToStudentId = new Map<string, string>();
    const cfToStudentId = new Map<string, string>();

    for (const s of allDbStudents) {
      if (s.rollNumber) {
        studentMap.set(s.rollNumber.toUpperCase(), s);
      }
      if (s.email) emailToStudentId.set(s.email.toLowerCase(), s.id);
      if (s.codechefUsername) ccToStudentId.set(s.codechefUsername.toLowerCase(), s.id);
      if (s.leetcodeUsername) lcToStudentId.set(s.leetcodeUsername.toLowerCase(), s.id);
      if (s.githubUsername) ghToStudentId.set(s.githubUsername.toLowerCase(), s.id);
      if (s.codeforcesUsername) cfToStudentId.set(s.codeforcesUsername.toLowerCase(), s.id);
    }

    const batchRollSet = new Set<string>();
    const batchEmailSet = new Set<string>();
    const batchCcSet = new Set<string>();
    const batchLcSet = new Set<string>();
    const batchGhSet = new Set<string>();
    const batchCfSet = new Set<string>();

    const evaluated: any[] = [];

    for (let index = 0; index < rows.length; index++) {
      const raw = rows[index];
      const norm = this.normalizeInput(raw);
      const reasons: string[] = [];
      let classification: RowClassification = "READY";

      const existingStudent = norm.rollNumber ? studentMap.get(norm.rollNumber.toUpperCase()) : null;
      const isUpdate = !!existingStudent;

      // Merge with existing values to preserve richer data if incoming is blank
      if (isUpdate) {
        if (isMissingOrNA(norm.name) && existingStudent.name) norm.name = existingStudent.name;
        if (isMissingOrNA(norm.email) && existingStudent.email) norm.email = existingStudent.email;
        if (isMissingOrNA(norm.contactNumber) && existingStudent.contactNumber) norm.contactNumber = existingStudent.contactNumber;
        if (isMissingOrNA(norm.section) && existingStudent.section) norm.section = existingStudent.section;
        if ((norm.cgpa === null || isNaN(norm.cgpa)) && existingStudent.cgpa !== null) norm.cgpa = existingStudent.cgpa;
        if (isMissingOrNA(norm.codechefUsername) && existingStudent.codechefUsername) norm.codechefUsername = existingStudent.codechefUsername;
        if (isMissingOrNA(norm.leetcodeUsername) && existingStudent.leetcodeUsername) norm.leetcodeUsername = existingStudent.leetcodeUsername;
        if (isMissingOrNA(norm.codeforcesUsername) && existingStudent.codeforcesUsername) norm.codeforcesUsername = existingStudent.codeforcesUsername;
        if (isMissingOrNA(norm.githubUsername) && existingStudent.githubUsername) norm.githubUsername = existingStudent.githubUsername;
        if (isMissingOrNA(norm.linkedinUrl) && existingStudent.linkedinUrl) norm.linkedinUrl = existingStudent.linkedinUrl;
      }

      // --- Identity Validation ---
      if (!norm.name) {
        classification = "INVALID_NAME";
        reasons.push("Student name is required.");
      }

      if (!norm.rollNumber) {
        classification = "INVALID_ROLL_NUMBER";
        reasons.push("Roll number is required.");
      } else if (!/^[A-Z0-9_-]+$/.test(norm.rollNumber)) {
        classification = "INVALID_ROLL_NUMBER";
        reasons.push(`Invalid roll number format: ${norm.rollNumber}`);
      }

      // Email is only verified/required if present. During initial roster ingestion, email may be null.
      if (norm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm.email)) {
        classification = "INVALID_EMAIL";
        reasons.push(`Invalid email format: ${norm.email}`);
      }

      if (isNaN(norm.year) || norm.year < 1 || norm.year > 4) {
        classification = "INVALID_YEAR";
        reasons.push(`Year of study must be an integer between 1 and 4 (got ${raw.year}).`);
      }

      if (norm.cgpa !== null && (isNaN(norm.cgpa) || norm.cgpa < 0 || norm.cgpa > 10)) {
        classification = "INVALID_CGPA";
        reasons.push(`CGPA must be a decimal between 0.0 and 10.0 (got ${raw.cgpa}).`);
      }

      if (reasons.length > 0) {
        evaluated.push({ index, raw, normalized: norm, classification, reasons, isUpdate, existingId: existingStudent?.id });
        continue;
      }

      // --- Duplicate Checks ---
      if (batchRollSet.has(norm.rollNumber)) {
        classification = "DUPLICATE_ROLL_NUMBER";
        reasons.push(`Duplicate roll number ${norm.rollNumber} within uploaded CSV.`);
      }

      if (norm.email) {
        const conflictingStudentId = emailToStudentId.get(norm.email.toLowerCase());
        if (conflictingStudentId && conflictingStudentId !== existingStudent?.id) {
          classification = "DUPLICATE_EMAIL";
          reasons.push(`Email ${norm.email} already exists on another student.`);
        } else if (batchEmailSet.has(norm.email.toLowerCase())) {
          classification = "DUPLICATE_EMAIL";
          reasons.push(`Duplicate email ${norm.email} within uploaded CSV.`);
        }
      }

      if (classification === "DUPLICATE_ROLL_NUMBER" || classification === "DUPLICATE_EMAIL") {
        evaluated.push({ index, raw, normalized: norm, classification, reasons, isUpdate, existingId: existingStudent?.id });
        continue;
      }

      let hadDuplicateHandle = false;

      if (norm.codechefUsername) {
        const lowerCc = norm.codechefUsername.toLowerCase();
        const conflictingId = ccToStudentId.get(lowerCc);
        if ((conflictingId && conflictingId !== existingStudent?.id) || batchCcSet.has(lowerCc)) {
          hadDuplicateHandle = true;
          reasons.push(`Duplicate CodeChef handle '${norm.codechefUsername}' cleared.`);
          norm.codechefUsername = null;
        } else {
          batchCcSet.add(lowerCc);
        }
      }

      if (norm.leetcodeUsername) {
        const lowerLc = norm.leetcodeUsername.toLowerCase();
        const conflictingId = lcToStudentId.get(lowerLc);
        if ((conflictingId && conflictingId !== existingStudent?.id) || batchLcSet.has(lowerLc)) {
          hadDuplicateHandle = true;
          reasons.push(`Duplicate LeetCode handle '${norm.leetcodeUsername}' cleared.`);
          norm.leetcodeUsername = null;
        } else {
          batchLcSet.add(lowerLc);
        }
      }

      if (norm.githubUsername) {
        const lowerGh = norm.githubUsername.toLowerCase();
        const conflictingId = ghToStudentId.get(lowerGh);
        if ((conflictingId && conflictingId !== existingStudent?.id) || batchGhSet.has(lowerGh)) {
          hadDuplicateHandle = true;
          reasons.push(`Duplicate GitHub handle '${norm.githubUsername}' cleared.`);
          norm.githubUsername = null;
        } else {
          batchGhSet.add(lowerGh);
        }
      }

      if (norm.codeforcesUsername) {
        const lowerCf = norm.codeforcesUsername.toLowerCase();
        const conflictingId = cfToStudentId.get(lowerCf);
        if ((conflictingId && conflictingId !== existingStudent?.id) || batchCfSet.has(lowerCf)) {
          hadDuplicateHandle = true;
          reasons.push(`Duplicate Codeforces handle '${norm.codeforcesUsername}' cleared.`);
          norm.codeforcesUsername = null;
        } else {
          batchCfSet.add(lowerCf);
        }
      }

      if (hadDuplicateHandle) {
        classification = "INCOMPLETE";
        reasons.push("Profile classified as INCOMPLETE due to cleared duplicate platform handle(s).");
      } else if (!norm.codechefUsername || !norm.leetcodeUsername) {
        classification = "INCOMPLETE";
        reasons.push("Profile classified as INCOMPLETE (requires both CodeChef and LeetCode handles).");
      } else {
        classification = "READY";
      }

      const changedFields: string[] = [];
      if (isUpdate) {
        if (norm.name !== existingStudent.name) changedFields.push(`name: ${existingStudent.name || "blank"} -> ${norm.name}`);
        if (norm.email !== existingStudent.email) changedFields.push(`email: ${existingStudent.email || "blank"} -> ${norm.email || "blank"}`);
        if (norm.contactNumber !== existingStudent.contactNumber) changedFields.push(`contactNumber: ${existingStudent.contactNumber || "blank"} -> ${norm.contactNumber || "blank"}`);
        if (norm.section !== existingStudent.section) changedFields.push(`section: ${existingStudent.section || "blank"} -> ${norm.section || "blank"}`);
        if (norm.year !== existingStudent.year) changedFields.push(`year: ${existingStudent.year} -> ${norm.year}`);
        if (norm.cgpa !== existingStudent.cgpa) changedFields.push(`cgpa: ${existingStudent.cgpa !== null ? existingStudent.cgpa : "blank"} -> ${norm.cgpa !== null ? norm.cgpa : "blank"}`);
        if (norm.codechefUsername !== existingStudent.codechefUsername) changedFields.push(`codechef: ${existingStudent.codechefUsername || "blank"} -> ${norm.codechefUsername || "blank"}`);
        if (norm.leetcodeUsername !== existingStudent.leetcodeUsername) changedFields.push(`leetcode: ${existingStudent.leetcodeUsername || "blank"} -> ${norm.leetcodeUsername || "blank"}`);
      }

      batchRollSet.add(norm.rollNumber);
      if (norm.email) batchEmailSet.add(norm.email.toLowerCase());

      evaluated.push({
        index,
        raw,
        normalized: norm,
        classification,
        reasons,
        hadDuplicateHandle,
        isUpdate,
        existingId: existingStudent?.id,
        changedFields
      });
    }

    return evaluated;
  }


  /**
   * Creates a single student profile in database.
   * NEVER performs an update or upsert.
   */
  static async createProfile(
    data: NormalizedStudentData & { cohortId?: string | null; departmentId?: string | null; classSectionId?: string | null },
    dbClient = prisma
  ): Promise<{ success: boolean; profile?: any; error?: string }> {
    const execute = async (tx: any) => {
      const targetId = crypto.randomUUID();

      // Ensure CGPA is valid float/null and year is int
      const parsedCgpa = data.cgpa !== null && !isNaN(Number(data.cgpa)) ? Number(data.cgpa) : null;
      const parsedYear = !isNaN(Number(data.year)) ? Math.min(Math.max(Number(data.year), 1), 4) : 1;
      const contactStr = data.contactNumber ? String(data.contactNumber).trim() : null;

      let sectionName = data.section || "A";
      if (data.classSectionId) {
        const sect = await tx.classSection.findUnique({
          where: { id: data.classSectionId }
        });
        if (sect) {
          sectionName = sect.name;
        }
      } else if (data.classSectionId === null) {
        sectionName = "";
      }

      const profile = await tx.studentProfile.create({
        data: {
          id: targetId,
          name: data.name,
          rollNumber: data.rollNumber,
          email: data.email || null,
          contactNumber: contactStr,
          department: data.department || "CSE",
          branch: data.branch || "CSE",
          section: sectionName || null,
          year: parsedYear,
          cgpa: parsedCgpa,
          codechefUsername: data.codechefUsername,
          leetcodeUsername: data.leetcodeUsername,
          codeforcesUsername: data.codeforcesUsername,
          githubUsername: data.githubUsername,
          linkedinUrl: data.linkedinUrl,
          profilePictureUrl: data.profilePictureUrl,
          profileStatus: (data.codechefUsername && data.leetcodeUsername) ? "PENDING_VERIFICATION" : "INCOMPLETE",
          leaderboardEligible: false,
          dashboardEligible: false,
          verificationStatus: "UNABLE_TO_VERIFY",
        },
      });

      if (data.cohortId && data.departmentId) {
        await tx.studentEnrollment.create({
          data: {
            studentId: profile.id,
            cohortId: data.cohortId,
            departmentId: data.departmentId,
            classSectionId: data.classSectionId || null,
            academicYear: parsedYear,
            isCurrent: true,
            enrollmentStatus: "ACTIVE",
          },
        });
      } else {
        const normRes = normalizeRoll(data.rollNumber);
        if (normRes.normalized) {
          const cohortInfo = getCohortYears(normRes.normalized);
          if (cohortInfo) {
            let cohort = await tx.cohort.findUnique({
              where: { code: cohortInfo.code },
            });
            if (!cohort) {
              cohort = await tx.cohort.create({
                data: {
                  code: cohortInfo.code,
                  startYear: cohortInfo.startYear,
                  endYear: cohortInfo.endYear,
                  status: "ACTIVE",
                },
              });
            }

            const deptCode = data.department ? data.department.trim().toUpperCase() : "CSE";
            let dept = await tx.department.findUnique({
              where: { code: deptCode },
            });
            if (!dept) {
              dept = await tx.department.create({
                data: {
                  code: deptCode,
                  name: deptCode,
                  isActive: true,
                },
              });
            }

            let classSectionId: string | null = null;
            if (data.classSectionId !== null) {
              const fallbackSectionName = data.section ? data.section.trim().toUpperCase() : "A";
              let section = await tx.classSection.findUnique({
                where: {
                  cohortId_departmentId_name: {
                    cohortId: cohort.id,
                    departmentId: dept.id,
                    name: fallbackSectionName,
                  },
                },
              });
              if (!section) {
                section = await tx.classSection.create({
                  data: {
                    cohortId: cohort.id,
                    departmentId: dept.id,
                    name: fallbackSectionName,
                    isActive: true,
                  },
                });
              }
              classSectionId = section.id;
            }

            await tx.studentEnrollment.create({
              data: {
                studentId: profile.id,
                cohortId: cohort.id,
                departmentId: dept.id,
                classSectionId,
                academicYear: parsedYear,
                isCurrent: true,
                enrollmentStatus: "ACTIVE",
              },
            });
          }
        }
      }

      // Sync new/configured platform accounts
      await StudentProfileService.syncPlatformAccounts(
        profile.id,
        {
          codechefUsername: data.codechefUsername,
          leetcodeUsername: data.leetcodeUsername,
          codeforcesUsername: data.codeforcesUsername,
          githubUsername: data.githubUsername,
          linkedinUrl: data.linkedinUrl,
          hackerrankUsername: data.hackerrankUsername,
          hackerearthUsername: data.hackerearthUsername,
        },
        tx
      );

      // Evaluate eligibility status
      await StudentProfileService.calculateAndUpdateEligibility(profile.id, tx);

      return profile;
    };

    try {
      let profile: any = null;

      // Only initiate a new $transaction if dbClient is the root prisma client
      const isRootClient = dbClient === prisma || !(dbClient as any)?._isTransaction;

      if (isRootClient && dbClient && typeof (dbClient as any).$transaction === "function") {
        try {
          profile = await (dbClient as any).$transaction(async (tx: any) => {
            (tx as any)._isTransaction = true;
            return execute(tx);
          }, {
            maxWait: 10000,
            timeout: 15000,
          });
        } catch (txErr: any) {
          if (txErr instanceof TypeError && (txErr.message.includes("is not iterable") || txErr.message.includes("cannot read property Symbol"))) {
            console.warn("dbClient.$transaction mock does not support interactive transactions. Falling back to direct execution.");
            profile = await execute(dbClient);
          } else {
            throw txErr;
          }
        }
      } else {
        profile = await execute(dbClient);
      }

      // Log activity event AFTER transaction commits so activity logging cannot abort the transaction
      if (profile && profile.id) {
        try {
          await ActivityService.logEvent(
            "STUDENT_ADD",
            profile.id,
            `${data.name} (${data.department || "CSE"}) profile was created.`,
            prisma
          );
        } catch (actErr) {
          // Ignored
        }
      }

      return { success: true, profile };
    } catch (err: any) {
      console.error(`Error in createProfile for roll ${data.rollNumber}:`, err);
      return { success: false, error: err.message || "Failed to create student profile record." };
    }
  }

  /**
   * Handles single-student Add / Full Replacement Edit workflow atomically.
   * If Roll Number is new: creates StudentProfile + StudentEnrollment + provisions UserAccess account.
   * If Roll Number exists: updates StudentProfile (full replacement), transitions StudentEnrollment, and reuses UserAccess account.
   */
  static async upsertSingleStudent(
    data: NormalizedStudentData & {
      cohortId?: string | null;
      departmentId?: string | null;
      classSectionId?: string | null;
    },
    dbClient = prisma
  ): Promise<{ success: boolean; isNew?: boolean; profile?: any; message?: string; error?: string }> {
    const rawRoll = data.rollNumber;
    if (!rawRoll) {
      return { success: false, error: "Roll number is required." };
    }

    const normRoll = normalizeRollNumber(rawRoll) || String(rawRoll).trim().toUpperCase();

    const execute = async (tx: any) => {
      // 1. Find existing student profile by normalized roll number
      const existing = await tx.studentProfile.findUnique({
        where: { rollNumber: normRoll },
        include: {
          studentEnrollments: {
            where: { isCurrent: true }
          }
        }
      });

      let targetCohortId = data.cohortId || null;
      let targetDepartmentId = data.departmentId || null;
      let targetClassSectionId = data.classSectionId !== undefined ? data.classSectionId : null;

      // Resolve Cohort if not provided
      if (!targetCohortId) {
        const cohortInfo = getCohortYears(normRoll);
        if (cohortInfo) {
          let cohort: any = null;
          if (tx.cohort && typeof tx.cohort.findUnique === "function") {
            cohort = await tx.cohort.findUnique({ where: { code: cohortInfo.code } });
            if (!cohort && typeof tx.cohort.create === "function") {
              cohort = await tx.cohort.create({
                data: {
                  code: cohortInfo.code,
                  startYear: cohortInfo.startYear,
                  endYear: cohortInfo.endYear,
                  status: "ACTIVE",
                }
              });
            }
          }
          targetCohortId = cohort?.id || "cohort-2023";
        }
      }

      // Resolve Department if not provided
      if (!targetDepartmentId && data.department) {
        const deptCode = data.department.trim().toUpperCase();
        let dept: any = null;
        if (tx.department && typeof tx.department.findUnique === "function") {
          dept = await tx.department.findUnique({ where: { code: deptCode } });
          if (!dept && typeof tx.department.create === "function") {
            dept = await tx.department.create({
              data: { code: deptCode, name: deptCode, isActive: true }
            });
          }
        }
        targetDepartmentId = dept?.id || "dept-cse";
      }

      const parsedCgpa = data.cgpa !== undefined && data.cgpa !== null && String(data.cgpa).trim() !== "" && !isNaN(Number(data.cgpa)) ? Number(data.cgpa) : null;
      const parsedYear = data.year && !isNaN(Number(data.year)) ? Math.min(Math.max(Number(data.year), 1), 4) : 1;
      const contactStr = data.contactNumber ? String(data.contactNumber).trim() : null;

      let sectionName = data.section ? data.section.trim().toUpperCase() : null;

      if (!existing) {
        // === NEW STUDENT CREATION ===
        const profile = await tx.studentProfile.create({
          data: {
            name: data.name.trim(),
            rollNumber: normRoll,
            department: data.department || "CSE",
            branch: data.branch || data.department || "CSE",
            section: sectionName,
            year: parsedYear,
            cgpa: parsedCgpa,
            email: data.email ? data.email.trim().toLowerCase() : null,
            contactNumber: contactStr,
            codechefUsername: data.codechefUsername ? data.codechefUsername.trim() : null,
            leetcodeUsername: data.leetcodeUsername ? data.leetcodeUsername.trim() : null,
            codeforcesUsername: data.codeforcesUsername ? data.codeforcesUsername.trim() : null,
            githubUsername: data.githubUsername ? data.githubUsername.trim() : null,
            linkedinUrl: data.linkedinUrl ? data.linkedinUrl.trim() : null,
            profileStatus: (data.codechefUsername && data.leetcodeUsername) ? "PENDING_VERIFICATION" : "INCOMPLETE",
            leaderboardEligible: false,
            dashboardEligible: false,
            verificationStatus: "UNABLE_TO_VERIFY",
          }
        });

        if (targetCohortId && targetDepartmentId && tx.studentEnrollment && typeof tx.studentEnrollment.create === "function") {
          await tx.studentEnrollment.create({
            data: {
              studentId: profile.id,
              cohortId: targetCohortId,
              departmentId: targetDepartmentId,
              classSectionId: targetClassSectionId,
              academicYear: parsedYear,
              isCurrent: true,
              enrollmentStatus: "ACTIVE",
            }
          });
        }

        await StudentProfileService.syncPlatformAccounts(
          profile.id,
          {
            codechefUsername: data.codechefUsername,
            leetcodeUsername: data.leetcodeUsername,
            codeforcesUsername: data.codeforcesUsername,
            githubUsername: data.githubUsername,
            linkedinUrl: data.linkedinUrl,
          },
          tx
        );

        await StudentProfileService.calculateAndUpdateEligibility(profile.id, tx);

        try {
          await provisionStudentAccount(profile.id, tx);
        } catch (authErr) {
          console.error("Failed to provision student UserAccess:", authErr);
        }

        return { isNew: true, profile, message: "Student profile created successfully." };
      } else {
        // === EXISTING STUDENT FULL REPLACEMENT ===
        // Replace mutable profile fields completely.
        // If an optional field is submitted as blank/null, set to null (clear old value).
        const updatedProfile = await tx.studentProfile.update({
          where: { id: existing.id },
          data: {
            name: data.name.trim(),
            // rollNumber is IMMUTABLE — never modified!
            department: data.department || null,
            branch: data.branch || data.department || null,
            section: sectionName,
            year: parsedYear,
            cgpa: parsedCgpa,
            email: data.email ? data.email.trim().toLowerCase() : null,
            contactNumber: contactStr,
            codechefUsername: data.codechefUsername ? data.codechefUsername.trim() : null,
            leetcodeUsername: data.leetcodeUsername ? data.leetcodeUsername.trim() : null,
            codeforcesUsername: data.codeforcesUsername ? data.codeforcesUsername.trim() : null,
            githubUsername: data.githubUsername ? data.githubUsername.trim() : null,
            linkedinUrl: data.linkedinUrl ? data.linkedinUrl.trim() : null,
            profileStatus: (data.codechefUsername && data.leetcodeUsername) ? "PENDING_VERIFICATION" : "INCOMPLETE",
          }
        });

        const profile = updatedProfile || existing;
        const currentE = existing.studentEnrollments?.[0];
        const placementChanged = !currentE ||
          currentE.cohortId !== targetCohortId ||
          currentE.departmentId !== targetDepartmentId ||
          currentE.classSectionId !== targetClassSectionId;

        if (placementChanged && targetCohortId && targetDepartmentId) {
          if (currentE) {
            await tx.studentEnrollment.update({
              where: { id: currentE.id },
              data: { isCurrent: false, enrollmentStatus: "COMPLETED" }
            });
          }
          await tx.studentEnrollment.create({
            data: {
              studentId: profile.id,
              cohortId: targetCohortId,
              departmentId: targetDepartmentId,
              classSectionId: targetClassSectionId,
              academicYear: parsedYear,
              isCurrent: true,
              enrollmentStatus: "ACTIVE",
            }
          });
        }

        await StudentProfileService.syncPlatformAccounts(
          profile.id,
          {
            codechefUsername: data.codechefUsername,
            leetcodeUsername: data.leetcodeUsername,
            codeforcesUsername: data.codeforcesUsername,
            githubUsername: data.githubUsername,
            linkedinUrl: data.linkedinUrl,
          },
          tx
        );

        await StudentProfileService.calculateAndUpdateEligibility(profile.id, tx);

        // Note: UserAccess account is REUSED. Existing password and mustSetPassword are NOT reset.

        return { isNew: false, profile, message: "Student already exists. Profile updated successfully." };
      }
    };

    try {
      const isRootClient = dbClient === prisma || !(dbClient as any)?._isTransaction;
      let res: any;
      if (isRootClient && dbClient && typeof (dbClient as any).$transaction === "function") {
        res = await (dbClient as any).$transaction(async (tx: any) => {
          (tx as any)._isTransaction = true;
          return execute(tx);
        }, { maxWait: 10000, timeout: 15000 });
      } else {
        res = await execute(dbClient);
      }
      return { success: true, isNew: res.isNew, profile: res.profile, message: res.message };
    } catch (err: any) {
      console.error(`Error in upsertSingleStudent for roll ${data.rollNumber}:`, err);
      return { success: false, error: err.message || "Failed to save student profile." };
    }
  }

  /**
   * Enforces permanent profile field immutability (rollNumber and email cannot be updated).
   */
  static validateProfileEdit(
    existingProfile: { rollNumber?: string | null; email?: string | null },
    updatePayload: any
  ): { valid: boolean; error?: string } {
    if (
      updatePayload.hasOwnProperty("rollNumber") ||
      updatePayload.hasOwnProperty("roll_number")
    ) {
      const rawRoll = updatePayload.hasOwnProperty("rollNumber")
        ? updatePayload.rollNumber
        : updatePayload.roll_number;
      const normRoll = rawRoll ? String(rawRoll).trim().toUpperCase() : null;

      if (
        existingProfile.rollNumber &&
        normRoll !== null &&
        normRoll !== existingProfile.rollNumber.toUpperCase()
      ) {
        return {
          valid: false,
          error: "Roll number is permanent and cannot be modified.",
        };
      }
    }

    if (updatePayload.hasOwnProperty("email")) {
      const normEmail = updatePayload.email ? String(updatePayload.email).trim().toLowerCase() : null;
      if (
        existingProfile.email &&
        normEmail !== null &&
        normEmail !== existingProfile.email.toLowerCase()
      ) {
        return {
          valid: false,
          error: "Email address is permanent and cannot be modified.",
        };
      }
    }

    return { valid: true };
  }

  /**
   * Processes a single batch of student rows with individual isolated row execution.
   */
  static async processBatchImport(
    rows: RawStudentInput[],
    batchIndex: number = 0,
    totalBatches: number = 1
  ): Promise<{
    success: boolean;
    batchIndex: number;
    totalBatches: number;
    summary: {
      totalRows: number;
      actuallyCreated: number;
      actuallyUpdated: number;
      unchanged: number;
      incompleteCreated: number;
      duplicateRollSkipped: number;
      duplicateEmailSkipped: number;
      invalidIdentitySkipped: number;
      duplicateHandlesCleared: number;
      databaseFailures: number;
    };
    failedRows: Array<{
      rowNumber: number;
      maskedRollNumber: string;
      status: string;
      reason: string;
    }>;
    createdProfileIds: string[];
  }> {
    const evaluated = await this.evaluateRows(rows);

    let actuallyCreated = 0;
    let actuallyUpdated = 0;
    let unchanged = 0;
    let incompleteCreated = 0;
    let duplicateRollSkipped = 0;
    let duplicateEmailSkipped = 0;
    let invalidIdentitySkipped = 0;
    let duplicateHandlesCleared = 0;
    let databaseFailures = 0;

    const failedRows: Array<{
      rowNumber: number;
      maskedRollNumber: string;
      status: string;
      reason: string;
    }> = [];

    const createdProfileIds: string[] = [];

    const maskRoll = (roll: string) => {
      if (!roll) return "N/A";
      return roll.length > 4 ? `${roll.slice(0, 4)}***` : `${roll.slice(0, 2)}***`;
    };

    for (const item of evaluated) {
      if (item.hadDuplicateHandle) {
        duplicateHandlesCleared++;
      }

      if (item.classification === "DUPLICATE_ROLL_NUMBER") {
        duplicateRollSkipped++;
        failedRows.push({
          rowNumber: item.index + 1,
          maskedRollNumber: maskRoll(item.normalized.rollNumber || item.raw.rollNumber || item.raw.roll_number || ""),
          status: "DUPLICATE_ROLL_NUMBER",
          reason: item.reasons.join(" ") || "Duplicate roll number skipped.",
        });
        continue;
      }

      if (item.classification === "DUPLICATE_EMAIL") {
        duplicateEmailSkipped++;
        failedRows.push({
          rowNumber: item.index + 1,
          maskedRollNumber: maskRoll(item.normalized.rollNumber || item.raw.rollNumber || item.raw.roll_number || ""),
          status: "DUPLICATE_EMAIL",
          reason: item.reasons.join(" ") || "Duplicate email address skipped.",
        });
        continue;
      }

      if (item.classification !== "READY" && item.classification !== "INCOMPLETE") {
        invalidIdentitySkipped++;
        failedRows.push({
          rowNumber: item.index + 1,
          maskedRollNumber: maskRoll(item.normalized.rollNumber || item.raw.rollNumber || item.raw.roll_number || ""),
          status: item.classification,
          reason: item.reasons.join(" ") || "Invalid identity data skipped.",
        });
        continue;
      }

      if (item.isUpdate) {
        if (item.changedFields && item.changedFields.length === 0) {
          unchanged++;
          createdProfileIds.push(item.existingId!);
          continue;
        }

        try {
          const res = await this.updateProfileRosterIngestion(item.existingId!, item.normalized);
          if (res.success) {
            actuallyUpdated++;
            createdProfileIds.push(item.existingId!);
          } else {
            databaseFailures++;
            failedRows.push({
              rowNumber: item.index + 1,
              maskedRollNumber: maskRoll(item.normalized.rollNumber),
              status: "DATABASE_ERROR",
              reason: res.error || "Database update error.",
            });
          }
        } catch (rowErr: any) {
          databaseFailures++;
          failedRows.push({
            rowNumber: item.index + 1,
            maskedRollNumber: maskRoll(item.normalized.rollNumber),
            status: "DATABASE_ERROR",
            reason: rowErr?.message || "Unexpected exception during row update.",
          });
        }
        continue;
      }

      // Execute isolated insertion per student profile (NO monolithic transaction)
      try {
        const res = await this.createProfile(item.normalized);
        if (res.success && res.profile) {
          actuallyCreated++;
          createdProfileIds.push(res.profile.id);
          if (item.classification === "INCOMPLETE" || item.hadDuplicateHandle) {
            incompleteCreated++;
          }
        } else {
          databaseFailures++;
          failedRows.push({
            rowNumber: item.index + 1,
            maskedRollNumber: maskRoll(item.normalized.rollNumber),
            status: "DATABASE_ERROR",
            reason: res.error || "Database insertion error.",
          });
        }
      } catch (rowErr: any) {
        databaseFailures++;
        failedRows.push({
          rowNumber: item.index + 1,
          maskedRollNumber: maskRoll(item.normalized.rollNumber),
          status: "DATABASE_ERROR",
          reason: rowErr?.message || "Unexpected exception during row creation.",
        });
      }
    }

    return {
      success: true,
      batchIndex,
      totalBatches,
      summary: {
        totalRows: rows.length,
        actuallyCreated,
        actuallyUpdated,
        unchanged,
        incompleteCreated,
        duplicateRollSkipped,
        duplicateEmailSkipped,
        invalidIdentitySkipped,
        duplicateHandlesCleared,
        databaseFailures,
      },
      failedRows,
      createdProfileIds,
    };
  }

  /**
   * Alias for backward compatibility with monolithic calls.
   */
  static async processBulkCsvImport(rows: RawStudentInput[]) {
    const res = await this.processBatchImport(rows, 0, 1);
    return {
      success: res.success,
      summary: {
        totalRows: res.summary.totalRows,
        createdCount: res.summary.actuallyCreated,
        readyCount: res.summary.actuallyCreated - res.summary.incompleteCreated,
        incompleteCount: res.summary.incompleteCreated,
        skippedDuplicateRollCount: res.summary.duplicateRollSkipped,
        skippedDuplicateEmailCount: res.summary.duplicateEmailSkipped,
        skippedDuplicatePlatformCount: res.summary.duplicateHandlesCleared,
        skippedInvalidCount: res.summary.invalidIdentitySkipped,
        failedCount: res.summary.databaseFailures,
      },
      rowDetails: res.failedRows.map((f) => ({
        rowNumber: f.rowNumber,
        name: "Student",
        rollNumber: f.maskedRollNumber,
        email: "masked@student",
        status: f.status as any,
        reason: f.reason,
      })),
      importedIds: res.createdProfileIds,
    };
  }

  /**
   * Safe platform account synchronization. Ensures a student has at most one record
   * per platform in StudentPlatformAccount table and normalizes handles/URLs.
   */
  static async syncPlatformAccounts(
    studentId: string,
    data: {
      codechefUsername?: string | null;
      leetcodeUsername?: string | null;
      codeforcesUsername?: string | null;
      githubUsername?: string | null;
      linkedinUrl?: string | null;
      hackerrankUsername?: string | null;
      hackerearthUsername?: string | null;
    },
    tx: any = prisma
  ): Promise<void> {
    if (!tx || !tx.studentPlatformAccount) {
      return;
    }
    const platforms: Array<{ type: "CODECHEF" | "LEETCODE" | "CODEFORCES" | "GITHUB" | "LINKEDIN" | "HACKERRANK" | "HACKEREARTH"; val: string | null | undefined }> = [
      { type: "CODECHEF", val: data.codechefUsername },
      { type: "LEETCODE", val: data.leetcodeUsername },
      { type: "CODEFORCES", val: data.codeforcesUsername },
      { type: "GITHUB", val: data.githubUsername },
      { type: "LINKEDIN", val: data.linkedinUrl },
      { type: "HACKERRANK", val: data.hackerrankUsername },
      { type: "HACKEREARTH", val: data.hackerearthUsername },
    ];

    for (const p of platforms) {
      const handle = p.val ? p.val.trim() : null;

      if (!handle) {
        // If handle is empty or cleared, delete the platform account record
        await tx.studentPlatformAccount.deleteMany({
          where: { studentProfileId: studentId, platform: p.type }
        });
        continue;
      }

      // Check if it already exists
      const existing = await tx.studentPlatformAccount.findUnique({
        where: {
          studentProfileId_platform: {
            studentProfileId: studentId,
            platform: p.type
          }
        }
      });

      const urlType = p.type.toLowerCase() as any;
      const canonicalUrl = formatToFullUrl(handle, urlType);

      if (existing) {
        if (existing.normalizedHandle.toLowerCase() === handle.toLowerCase()) {
          // No handle change, preserve existing verificationStatus & verifiedAt
          if (existing.profileUrl !== canonicalUrl) {
            await tx.studentPlatformAccount.update({
              where: { id: existing.id },
              data: { profileUrl: canonicalUrl }
            });
          }
          continue;
        }
        // Handle has changed, reset to PENDING and clear verifiedAt
        await tx.studentPlatformAccount.update({
          where: { id: existing.id },
          data: {
            normalizedHandle: handle,
            profileUrl: canonicalUrl,
            verificationStatus: "PENDING",
            verifiedAt: null
          }
        });
      } else {
        // Create new platform account with PENDING status
        await tx.studentPlatformAccount.create({
          data: {
            studentProfileId: studentId,
            platform: p.type,
            normalizedHandle: handle,
            profileUrl: canonicalUrl,
            verificationStatus: "PENDING"
          }
        });
      }
    }
  }

  /**
   * Resolves derived leaderboard/dashboard eligibility based on CodeChef & LeetCode verification statuses
   * and explicit Admin approval, keeping the legacy cached columns in sync to avoid data drift.
   */
  static async calculateAndUpdateEligibility(studentId: string, tx: any = prisma): Promise<boolean> {
    if (!tx || !tx.studentProfile) {
      return false;
    }

    const student = await tx.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        platformAccounts: {
          where: { platform: { in: ["CODECHEF", "LEETCODE"] } }
        }
      }
    });

    if (!student || student.archivedAt) {
      await tx.studentProfile.update({
        where: { id: studentId },
        data: { leaderboardEligible: false, dashboardEligible: false }
      });
      return false;
    }

    const accounts = student.platformAccounts || [];
    const ccAccount = accounts.find((p: any) => p.platform === "CODECHEF");
    const lcAccount = accounts.find((p: any) => p.platform === "LEETCODE");

    const ccVerified = ccAccount?.verificationStatus === "VERIFIED";
    const lcVerified = lcAccount?.verificationStatus === "VERIFIED";
    const adminApproved = student.adminApprovalStatus === "APPROVED";

    const isEligible = ccVerified && lcVerified && adminApproved;

    const hasCc = Boolean(student.codechefUsername);
    const hasLc = Boolean(student.leetcodeUsername);
    let profileStatus = student.profileStatus;
    if (ccVerified && lcVerified) {
      profileStatus = "VERIFIED";
    } else if (hasCc && hasLc) {
      if (profileStatus !== "VERIFIED") {
        profileStatus = "PENDING_VERIFICATION";
      }
    } else {
      profileStatus = "INCOMPLETE";
    }

    await tx.studentProfile.update({
      where: { id: studentId },
      data: {
        leaderboardEligible: isEligible,
        dashboardEligible: isEligible,
        profileStatus
      }
    });

    return isEligible;
  }

  /**
   * Idempotent updates on existing student profiles during roster ingestion.
   * Runs inside a Prisma transaction, updates modified fields, and tracks enrollment history.
   */
  static async updateProfileRosterIngestion(
    id: string,
    data: NormalizedStudentData & { cohortId?: string | null; departmentId?: string | null; classSectionId?: string | null }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.$transaction(async (tx) => {
        const activeEnrollment = await tx.studentEnrollment.findFirst({
          where: { studentId: id, isCurrent: true }
        });

        let targetCohortId = data.cohortId;
        let targetDeptId = data.departmentId;
        let targetSectionId = data.classSectionId;

        if (!targetCohortId || !targetDeptId) {
          const normRes = normalizeRoll(data.rollNumber);
          if (normRes.normalized) {
            const cohortInfo = getCohortYears(normRes.normalized);
            if (cohortInfo) {
              let cohort = await tx.cohort.findUnique({ where: { code: cohortInfo.code } });
              if (!cohort) {
                cohort = await tx.cohort.create({
                  data: { code: cohortInfo.code, startYear: cohortInfo.startYear, endYear: cohortInfo.endYear, status: "ACTIVE" }
                });
              }
              targetCohortId = cohort.id;
            }
            const deptCode = data.department ? data.department.trim().toUpperCase() : "CSE";
            let dept = await tx.department.findUnique({ where: { code: deptCode } });
            if (!dept) {
              dept = await tx.department.create({
                data: { code: deptCode, name: deptCode, isActive: true }
              });
            }
            targetDeptId = dept.id;
          }
        }

        if (!targetSectionId && data.section && targetCohortId && targetDeptId) {
          const sectionName = data.section.trim().toUpperCase();
          let section = await tx.classSection.findUnique({
            where: {
              cohortId_departmentId_name: {
                cohortId: targetCohortId,
                departmentId: targetDeptId,
                name: sectionName
              }
            }
          });
          if (!section) {
            section = await tx.classSection.create({
              data: {
                cohortId: targetCohortId,
                departmentId: targetDeptId,
                name: sectionName,
                isActive: true
              }
            });
          }
          targetSectionId = section.id;
        }

        const placementChanged =
          !activeEnrollment ||
          activeEnrollment.cohortId !== targetCohortId ||
          activeEnrollment.departmentId !== targetDeptId ||
          activeEnrollment.classSectionId !== (targetSectionId || null);

        if (placementChanged) {
          if (activeEnrollment) {
            await tx.studentEnrollment.update({
              where: { id: activeEnrollment.id },
              data: { isCurrent: false, endedAt: new Date() }
            });
          }

          if (targetCohortId && targetDeptId) {
            await tx.studentEnrollment.create({
              data: {
                studentId: id,
                cohortId: targetCohortId,
                departmentId: targetDeptId,
                classSectionId: targetSectionId || null,
                academicYear: data.year,
                isCurrent: true,
                enrollmentStatus: "ACTIVE",
                startedAt: new Date()
              }
            });
          }
        }

        let sectionName = data.section;
        if (targetSectionId) {
          const sect = await tx.classSection.findUnique({ where: { id: targetSectionId } });
          if (sect) sectionName = sect.name;
        } else if (data.classSectionId === null) {
          sectionName = "";
        }

        await tx.studentProfile.update({
          where: { id },
          data: {
            name: data.name,
            email: data.email || null,
            contactNumber: data.contactNumber,
            department: data.department,
            branch: data.branch,
            section: sectionName || null,
            year: data.year,
            cgpa: data.cgpa,
            codechefUsername: data.codechefUsername,
            leetcodeUsername: data.leetcodeUsername,
            codeforcesUsername: data.codeforcesUsername,
            githubUsername: data.githubUsername,
            linkedinUrl: data.linkedinUrl
          }
        });

        await StudentProfileService.syncPlatformAccounts(
          id,
          {
            codechefUsername: data.codechefUsername,
            leetcodeUsername: data.leetcodeUsername,
            codeforcesUsername: data.codeforcesUsername,
            githubUsername: data.githubUsername,
            linkedinUrl: data.linkedinUrl,
            hackerrankUsername: data.hackerrankUsername,
            hackerearthUsername: data.hackerearthUsername,
          },
          tx
        );

        await StudentProfileService.calculateAndUpdateEligibility(id, tx);

        try {
          await ActivityService.logEvent(
            "STUDENT_UPDATE",
            id,
            `${data.name} (${data.department}) profile was updated during roster import.`,
            tx
          );
        } catch (actErr) {}
      });
      return { success: true };
    } catch (err: any) {
      console.error(`Failed to update profile ${id}:`, err);
      return { success: false, error: err.message || "Failed to update profile record." };
    }
  }
}
