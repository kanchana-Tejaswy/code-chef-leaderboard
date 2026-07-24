export interface PasswordValidationResult {
  isValid: boolean;
  message?: string;
}

export function validatePassword(
  password?: string,
  confirmPassword?: string,
  userIdentifiers?: {
    email?: string;
    rollNumber?: string;
    fullName?: string | null;
  }
): PasswordValidationResult {
  if (!password) {
    return { isValid: false, message: "Password is required." };
  }

  // Length checks
  if (password.length < 12) {
    return { isValid: false, message: "Password must be at least 12 characters long." };
  }
  if (password.length > 128) {
    return { isValid: false, message: "Password cannot exceed 128 characters." };
  }

  // All whitespace check
  if (password.trim().length === 0) {
    return { isValid: false, message: "Password cannot be entirely whitespace." };
  }

  // Control characters check (ASCII 0-31 and 127)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(password)) {
    return { isValid: false, message: "Password contains invalid control characters." };
  }

  // Repetition check (e.g. "aaaaaaaaaaaa")
  if (/^(.)\1{11,}$/.test(password)) {
    return { isValid: false, message: "Password is too repetitive." };
  }

  // Common passwords check
  const commonPasswords = ["password123", "qwertyuiop", "1234567890", "testpassword"];
  if (commonPasswords.some(cp => password.toLowerCase().includes(cp))) {
    return { isValid: false, message: "Password is too common or easy to guess." };
  }

  // User identifier checks
  if (userIdentifiers) {
    const pwLower = password.toLowerCase();
    
    if (userIdentifiers.email && pwLower.includes(userIdentifiers.email.toLowerCase())) {
      return { isValid: false, message: "Password cannot contain your email address." };
    }
    
    if (userIdentifiers.rollNumber && pwLower.includes(userIdentifiers.rollNumber.toLowerCase())) {
      return { isValid: false, message: "Password cannot contain your roll number." };
    }

    if (userIdentifiers.fullName) {
      const names = userIdentifiers.fullName.toLowerCase().split(/\s+/).filter(n => n.length > 3);
      for (const name of names) {
        if (pwLower.includes(name)) {
          return { isValid: false, message: "Password cannot contain your name." };
        }
      }
    }
  }

  // Match check
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return { isValid: false, message: "Passwords do not match." };
  }

  return { isValid: true };
}

export function validateAdminPassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 12) {
    return { valid: false, error: "Password must be at least 12 characters long." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character." };
  }
  return { valid: true };
}
