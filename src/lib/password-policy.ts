/**
 * Shared password policy validation for staff credentials.
 * Server-side helper to ensure strong admin-chosen passwords.
 */

const COMMON_PASSWORDS = new Set([
  'password',
  '12345678',
  '123456789',
  'qwerty123',
  'admin123',
  'admin1234',
  'welcome123',
  'password123',
  'letmein123',
  'changeme',
  'iloveyou',
  'pass1234',
  'secret123',
]);

export interface PasswordValidationContext {
  email?: string | null;
  name?: string | null;
}

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePasswordPolicy(
  password: string,
  context?: PasswordValidationContext,
): PasswordValidationResult {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password must be a string.' };
  }

  // Length check: min 8, max 72 (72 is bcrypt max input length limit)
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }

  if (password.length > 72) {
    return { valid: false, error: 'Password cannot exceed 72 characters.' };
  }

  const lowerPass = password.toLowerCase().trim();

  // Check common password list
  if (COMMON_PASSWORDS.has(lowerPass)) {
    return {
      valid: false,
      error: 'Password is too common and easily guessed. Please choose a more secure password.',
    };
  }

  // Check email equality or local part equality
  if (context?.email) {
    const cleanEmail = context.email.toLowerCase().trim();
    const localPart = cleanEmail.split('@')[0];

    if (lowerPass === cleanEmail) {
      return { valid: false, error: 'Password cannot be identical to your email address.' };
    }

    if (localPart && localPart.length >= 3 && lowerPass === localPart) {
      return { valid: false, error: 'Password cannot be identical to the username part of your email address.' };
    }
  }

  // Check name equality
  if (context?.name) {
    const cleanName = context.name.toLowerCase().trim();
    if (cleanName.length >= 3 && lowerPass === cleanName) {
      return { valid: false, error: 'Password cannot be identical to your name.' };
    }
  }

  return { valid: true };
}
