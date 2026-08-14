import { prisma } from "@/lib/prisma";
import { isMissingOrNA, extractPlatformHandle } from "@/utils/urlValidation";
import { normalizeRoll, getCohortYears } from "@/utils/normalization";
import { ActivityService } from "./activity.service";
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
      profilePictureUrl,
    };
  }

  /**
   * Evaluates and classifies a set of student rows against database records and batch duplicates.
   */
  static async evaluateRows(
    rows: RawStudentInput[],
    dbStudentsOverride?: any[]
  ): Promise<EvaluatedRow[]> {
    let allDbStudents = dbStudentsOverride;
    if (!allDbStudents) {
      try {
        allDbStudents = await prisma.studentProfile.findMany({
          select: {
            id: true,
            rollNumber: true,
            email: true,
            codechefUsername: true,
            leetcodeUsername: true,
            githubUsername: true,
            codeforcesUsername: true,
          },
        });
      } catch (err) {
        allDbStudents = [];
      }
    }

    const dbRollSet = new Set(allDbStudents.filter((s) => s.rollNumber).map((s) => s.rollNumber!.toUpperCase()));
    const dbEmailSet = new Set(allDbStudents.filter((s) => s.email).map((s) => s.email!.toLowerCase()));
    const dbCcSet = new Set(allDbStudents.filter((s) => s.codechefUsername).map((s) => s.codechefUsername!.toLowerCase()));
    const dbLcSet = new Set(allDbStudents.filter((s) => s.leetcodeUsername).map((s) => s.leetcodeUsername!.toLowerCase()));
    const dbGhSet = new Set(allDbStudents.filter((s) => s.githubUsername).map((s) => s.githubUsername!.toLowerCase()));
    const dbCfSet = new Set(allDbStudents.filter((s) => s.codeforcesUsername).map((s) => s.codeforcesUsername!.toLowerCase()));

    const batchRollSet = new Set<string>();
    const batchEmailSet = new Set<string>();
    const batchCcSet = new Set<string>();
    const batchLcSet = new Set<string>();
    const batchGhSet = new Set<string>();
    const batchCfSet = new Set<string>();

    const evaluated: EvaluatedRow[] = [];

    for (let index = 0; index < rows.length; index++) {
      const raw = rows[index];
      const norm = this.normalizeInput(raw);
      const reasons: string[] = [];

      let classification: RowClassification = "READY";

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

      if (!norm.email) {
        classification = "INVALID_EMAIL";
        reasons.push("Email ID is required.");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm.email)) {
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

      // If basic validation failed already, proceed with classification
      if (reasons.length > 0) {
        evaluated.push({ index, raw, normalized: norm, classification, reasons });
        continue;
      }

      // --- Duplicate Checks ---
      if (dbRollSet.has(norm.rollNumber)) {
        classification = "DUPLICATE_ROLL_NUMBER";
        reasons.push(`Roll number ${norm.rollNumber} already exists in database.`);
      } else if (batchRollSet.has(norm.rollNumber)) {
        classification = "DUPLICATE_ROLL_NUMBER";
        reasons.push(`Duplicate roll number ${norm.rollNumber} within uploaded CSV.`);
      }

      if (dbEmailSet.has(norm.email)) {
        classification = "DUPLICATE_EMAIL";
        reasons.push(`Email ${norm.email} already exists in database.`);
      } else if (batchEmailSet.has(norm.email)) {
        classification = "DUPLICATE_EMAIL";
        reasons.push(`Duplicate email ${norm.email} within uploaded CSV.`);
      }

      if (classification === "DUPLICATE_ROLL_NUMBER" || classification === "DUPLICATE_EMAIL") {
        evaluated.push({ index, raw, normalized: norm, classification, reasons });
        continue;
      }

      let hadDuplicateHandle = false;

      if (norm.codechefUsername) {
        const lowerCc = norm.codechefUsername.toLowerCase();
        if (dbCcSet.has(lowerCc) || batchCcSet.has(lowerCc)) {
          hadDuplicateHandle = true;
          reasons.push(`Duplicate CodeChef handle '${norm.codechefUsername}' cleared.`);
          norm.codechefUsername = null;
        } else {
          batchCcSet.add(lowerCc);
        }
      }

      if (norm.leetcodeUsername) {
        const lowerLc = norm.leetcodeUsername.toLowerCase();
        if (dbLcSet.has(lowerLc) || batchLcSet.has(lowerLc)) {
          hadDuplicateHandle = true;
          reasons.push(`Duplicate LeetCode handle '${norm.leetcodeUsername}' cleared.`);
          norm.leetcodeUsername = null;
        } else {
          batchLcSet.add(lowerLc);
        }
      }

      if (norm.githubUsername) {
        const lowerGh = norm.githubUsername.toLowerCase();
        if (dbGhSet.has(lowerGh) || batchGhSet.has(lowerGh)) {
          hadDuplicateHandle = true;
          reasons.push(`Duplicate GitHub handle '${norm.githubUsername}' cleared.`);
          norm.githubUsername = null;
        } else {
          batchGhSet.add(lowerGh);
        }
      }

      if (norm.codeforcesUsername) {
        const lowerCf = norm.codeforcesUsername.toLowerCase();
        if (dbCfSet.has(lowerCf) || batchCfSet.has(lowerCf)) {
          hadDuplicateHandle = true;
          reasons.push(`Duplicate Codeforces handle '${norm.codeforcesUsername}' cleared.`);
          norm.codeforcesUsername = null;
        } else {
          batchCfSet.add(lowerCf);
        }
      }

      if (hadDuplicateHandle) {
        classification = "INCOMPLETE";
        reasons.push("Profile created as INCOMPLETE due to cleared duplicate platform handle(s).");
      } else if (!norm.codechefUsername || !norm.leetcodeUsername) {
        classification = "INCOMPLETE";
        reasons.push("Profile created as INCOMPLETE (requires both CodeChef and LeetCode URLs).");
      } else {
        classification = "READY";
      }

      // Mark batch tracking sets for roll and email
      batchRollSet.add(norm.rollNumber);
      batchEmailSet.add(norm.email);

      evaluated.push({ index, raw, normalized: norm, classification, reasons, hadDuplicateHandle });
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

      try {
        await ActivityService.logEvent(
          "STUDENT_ADD",
          profile.id,
          `${data.name} (${data.department}) profile was created.`,
          tx
        );
      } catch (actErr) {
        // Activity log failure should never block profile creation
      }

      return profile;
    };

    try {
      if (dbClient && typeof (dbClient as any).$transaction === "function") {
        try {
          const profile = await (dbClient as any).$transaction(async (tx: any) => {
            return execute(tx);
          });
          return { success: true, profile };
        } catch (txErr: any) {
          if (txErr instanceof TypeError && (txErr.message.includes("is not iterable") || txErr.message.includes("cannot read property Symbol"))) {
            console.warn("dbClient.$transaction mock does not support interactive transactions. Falling back to direct execution.");
            const profile = await execute(dbClient);
            return { success: true, profile };
          }
          throw txErr;
        }
      } else {
        const profile = await execute(dbClient);
        return { success: true, profile };
      }
    } catch (err: any) {
      console.error(`Error in createProfile for roll ${data.rollNumber}:`, err);
      return { success: false, error: err.message || "Failed to create student profile record." };
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
}
