export function normalizeEmail(email: string): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  
  // Basic normal email structure validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return null;
  }
  
  return trimmed;
}

export function normalizeRollNumber(rollNumber: string): string | null {
  if (!rollNumber) return null;
  
  // trim whitespace, uppercase, remove accidental internal spacing
  const cleaned = rollNumber.trim().toUpperCase().replace(/\s+/g, "");
  
  if (cleaned.length === 0) return null;
  
  // validate against standard 10 to 12-character alphanumeric college roll number format
  const rollRegex = /^[A-Z0-9]{10,12}$/;
  if (!rollRegex.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

export function normalizeStaffLoginId(email: string): string | null {
  return normalizeEmail(email);
}

export function normalizeStudentLoginId(rollNumber: string): string | null {
  return normalizeRollNumber(rollNumber);
}

// Normalization function (reused from mapping phase)
export function normalizeRoll(roll: string | null): { normalized: string | null; isNormalized: boolean } {
  if (!roll) return { normalized: null, isNormalized: false };
  const trimmed = roll.trim();
  let clean = trimmed.toUpperCase();
  
  if (clean.includes("TEST") || clean.includes("DEV")) {
    return { normalized: null, isNormalized: false };
  }

  let isNormalized = trimmed !== clean;

  if (clean.includes("-")) {
    clean = clean.replace(/-/g, "");
    isNormalized = true;
  }

  if (clean.includes("AO")) {
    clean = clean.replace(/AO/g, "A0");
    isNormalized = true;
  }
  
  if (clean === "23AGIA05G0") {
    clean = "23AG1A05G0";
    isNormalized = true;
  }

  if (trimmed !== clean) {
    isNormalized = true;
  }

  const regex = /^\d{2}AG[15]A\d{2}[A-Z\d]{2}$/;
  if (!regex.test(clean)) {
    return { normalized: null, isNormalized: false };
  }

  return { normalized: clean, isNormalized };
}

// Cohort resolution (reused from mapping phase)
export function getCohortYears(normalizedRoll: string): { startYear: number; endYear: number; code: string } | null {
  const prefix = parseInt(normalizedRoll.substring(0, 2), 10);
  const entryType = normalizedRoll.substring(4, 6);
  const startYear = 2000 + prefix;

  if (entryType === "1A") {
    const endYear = startYear + 4;
    return { startYear, endYear, code: `${startYear}-${endYear}` };
  } else if (entryType === "5A") {
    const endYear = startYear + 3;
    return { startYear, endYear, code: `${startYear}-${endYear}` };
  }
  return null;
}

