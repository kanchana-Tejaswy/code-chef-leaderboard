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
  
  // validate against standard 10-character alphanumeric college roll number format (e.g. 16X41A0501)
  // CLOUDTEST001 is a special case seen in the codebase
  if (cleaned === "CLOUDTEST001") return cleaned;

  // Assuming standard college roll numbers are exactly 10 alphanumeric characters.
  const rollRegex = /^[A-Z0-9]{10}$/;
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
