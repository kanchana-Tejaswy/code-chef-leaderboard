import { prisma } from "@/lib/prisma";
import { isMissingOrNA, extractPlatformHandle } from "@/utils/urlValidation";
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
    data: NormalizedStudentData,
    dbClient = prisma
  ): Promise<{ success: boolean; profile?: any; error?: string }> {
    try {
      const targetId = crypto.randomUUID();

      const profile = await dbClient.studentProfile.create({
        data: {
          id: targetId,
          name: data.name,
          rollNumber: data.rollNumber,
          email: data.email,
          contactNumber: data.contactNumber,
          department: data.department,
          branch: data.branch,
          section: data.section,
          year: data.year,
          cgpa: data.cgpa,
          codechefUsername: data.codechefUsername,
          leetcodeUsername: data.leetcodeUsername,
          codeforcesUsername: data.codeforcesUsername,
          githubUsername: data.githubUsername,
          linkedinUrl: data.linkedinUrl,
          profilePictureUrl: data.profilePictureUrl,
          profileStatus: (data.codechefUsername || data.leetcodeUsername || data.codeforcesUsername) ? "PENDING_VERIFICATION" : "INCOMPLETE",
          leaderboardEligible: false,
          dashboardEligible: false,
          verificationStatus: "UNABLE_TO_VERIFY",
          leaderboardEntry: {
            create: {
              rank: 0,
              rating: 0,
              stars: 1,
              talentScore: 0,
              overallScore: 0,
              codechefScore: 0,
              leetcodeScore: 0,
              trendDirection: "NEUTRAL",
            },
          },
        },
      });

      await ActivityService.logEvent(
        "STUDENT_ADD",
        profile.id,
        `${data.name} (${data.department}) profile was created.`
      );

      return { success: true, profile };
    } catch (err: any) {
      console.error("Error in createProfile:", err);
      return { success: false, error: err.message || "Failed to create student profile" };
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
   * Processes a complete bulk CSV import using batch database transactions.
   */
  static async processBulkCsvImport(rows: RawStudentInput[]): Promise<{
    success: boolean;
    summary: {
      totalRows: number;
      createdCount: number;
      readyCount: number;
      incompleteCount: number;
      skippedDuplicateRollCount: number;
      skippedDuplicateEmailCount: number;
      skippedDuplicatePlatformCount: number;
      skippedInvalidCount: number;
      failedCount: number;
    };
    rowDetails: Array<{
      rowNumber: number;
      name: string;
      rollNumber: string;
      email: string;
      status: RowClassification;
      reason: string;
    }>;
    importedIds: string[];
  }> {
    const evaluated = await this.evaluateRows(rows);

    const importableRows = evaluated.filter(
      (r) => r.classification === "READY" || r.classification === "INCOMPLETE"
    );

    let createdCount = 0;
    let readyCount = 0;
    let incompleteCount = 0;
    let skippedDuplicateRollCount = 0;
    let skippedDuplicateEmailCount = 0;
    let skippedDuplicatePlatformCount = 0;
    let skippedInvalidCount = 0;
    let failedCount = 0;

    const rowDetails: Array<{
      rowNumber: number;
      name: string;
      rollNumber: string;
      email: string;
      status: RowClassification;
      reason: string;
    }> = [];

    const importedIds: string[] = [];

    // Process evaluation metrics
    for (const item of evaluated) {
      const reason = item.reasons.join(" ") || "Valid row.";
      rowDetails.push({
        rowNumber: item.index + 1,
        name: item.normalized.name || item.raw.name || "N/A",
        rollNumber: item.normalized.rollNumber || item.raw.rollNumber || item.raw.roll_number || "N/A",
        email: item.normalized.email || item.raw.email || "N/A",
        status: item.classification,
        reason,
      });

      if (item.hadDuplicateHandle) skippedDuplicatePlatformCount++;
      if (item.classification === "DUPLICATE_ROLL_NUMBER") skippedDuplicateRollCount++;
      else if (item.classification === "DUPLICATE_EMAIL") skippedDuplicateEmailCount++;
      else if (item.classification !== "READY" && item.classification !== "INCOMPLETE") skippedInvalidCount++;
    }

    // Execute safe database batch transactions (batch size = 25)
    const BATCH_SIZE = 25;
    for (let i = 0; i < importableRows.length; i += BATCH_SIZE) {
      const chunk = importableRows.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(async (tx) => {
        for (const item of chunk) {
          try {
            const res = await this.createProfile(item.normalized, tx as any);
            if (res.success && res.profile) {
              createdCount++;
              importedIds.push(res.profile.id);
              if (item.classification === "READY") readyCount++;
              else incompleteCount++;
            } else {
              failedCount++;
            }
          } catch (chunkErr) {
            console.error(`Failed chunk insert for ${item.normalized.rollNumber}:`, chunkErr);
            failedCount++;
          }
        }
      });
    }

    return {
      success: true,
      summary: {
        totalRows: rows.length,
        createdCount,
        readyCount,
        incompleteCount,
        skippedDuplicateRollCount,
        skippedDuplicateEmailCount,
        skippedDuplicatePlatformCount,
        skippedInvalidCount,
        failedCount,
      },
      rowDetails,
      importedIds,
    };
  }
}
