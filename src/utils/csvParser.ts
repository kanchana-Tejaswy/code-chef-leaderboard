export interface RawStudentInput {
  name?: string | null;
  rollNumber?: string | null;
  roll_number?: string | null;
  contactNumber?: string | null;
  contact_number?: string | null;
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

/**
 * Normalizes header string for flexible case-insensitive and whitespace-insensitive matching.
 */
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Maps arbitrary CSV / Excel column header to standard RawStudentInput keys.
 */
export function mapHeaderToField(header: string): keyof RawStudentInput | null {
  const norm = normalizeHeader(header);

  if (norm === "studentname" || norm === "name" || norm === "fullname") return "name";
  if (norm === "rollnumber" || norm === "rollno" || norm === "roll" || norm === "registrationno") return "rollNumber";
  if (norm === "contactnumber" || norm === "phone" || norm === "phonenumber" || norm === "contact" || norm === "mobile") return "contactNumber";
  if (norm === "yearofstudy" || norm === "year" || norm === "academicyear") return "year";
  if (norm === "branch" || norm === "department" || norm === "dept") return "branch";
  if (norm === "cgpa" || norm === "gpa" || norm === "percentage") return "cgpa";
  if (norm === "emailid" || norm === "email" || norm === "emailaddress") return "email";
  if (norm === "leetcodeprofileurl" || norm === "leetcodeurl" || norm === "leetcode" || norm === "leetcodeusername" || norm === "leetcodehandle") return "leetcodeUsername";
  if (norm === "codechefprofileurl" || norm === "codechefurl" || norm === "codechef" || norm === "codechefusername" || norm === "codechefhandle") return "codechefUsername";
  if (norm === "codeforcesprofileurl" || norm === "codeforcesurl" || norm === "codeforces" || norm === "codeforcesusername" || norm === "codeforceshandle") return "codeforcesUsername";
  if (norm === "githubprofileurl" || norm === "githuburl" || norm === "github" || norm === "githubusername" || norm === "githubhandle") return "githubUsername";
  if (norm === "linkedinprofileurl" || norm === "linkedinurl" || norm === "linkedin") return "linkedinUrl";

  return null;
}

/**
 * Client-safe dynamic spreadsheet parser for .csv, .xlsx, or .xls using on-demand XLSX import.
 */
export async function parseSpreadsheetBuffer(buffer: ArrayBuffer | Uint8Array): Promise<RawStudentInput[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const worksheet = workbook.Sheets[firstSheetName];
  const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

  if (jsonRows.length === 0) return [];

  const rawHeaders: string[] = (jsonRows[0] || []).map((h: any) => String(h || ""));
  const fieldMapping: Array<{ index: number; field: keyof RawStudentInput }> = [];

  rawHeaders.forEach((h, idx) => {
    const field = mapHeaderToField(h);
    if (field) {
      fieldMapping.push({ index: idx, field });
    }
  });

  const parsedRows: RawStudentInput[] = [];

  for (let i = 1; i < jsonRows.length; i++) {
    const rowArray = jsonRows[i];
    if (!rowArray || rowArray.length === 0) continue;

    // Check if row is non-empty
    const hasData = rowArray.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== "");
    if (!hasData) continue;

    const rowObj: RawStudentInput = {};
    fieldMapping.forEach(({ index, field }) => {
      const val = rowArray[index];
      (rowObj as any)[field] = val !== undefined && val !== null ? String(val).trim() : "";
    });

    parsedRows.push(rowObj);
  }

  return parsedRows;
}

/**
 * Generates downloadable CSV content string from row details array.
 */
export function exportSkippedRowsCSV(rowDetails: Array<{
  rowNumber: number;
  name: string;
  rollNumber: string;
  email: string;
  status: string;
  reason: string;
}>): string {
  const headers = ["Row Number", "Student Name", "Roll Number", "Email", "Status", "Reason"];
  const lines = [headers.join(",")];

  rowDetails.forEach((row) => {
    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
    lines.push([
      row.rowNumber,
      escapeCsv(row.name),
      escapeCsv(row.rollNumber),
      escapeCsv(row.email),
      escapeCsv(row.status),
      escapeCsv(row.reason),
    ].join(","));
  });

  return lines.join("\n");
}
