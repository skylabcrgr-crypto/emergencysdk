/**
 * passwordPolicy.service.ts
 * Server-side password strength validation.
 *
 * Mirrored by the dashboard PasswordStrengthMeter so the rules shown to the
 * user match what the backend enforces. Keep both in sync if rules change.
 */

export interface PasswordPolicyResult {
  valid: boolean;
  errors: string[];
  /** 0–5 — number of satisfied "strength" criteria (length, upper, lower, number, symbol). */
  score: number;
}

/** Common weak passwords / product terms that are always rejected. */
const WEAK_PASSWORDS = [
  'password',
  'password123',
  'admin',
  'admin123',
  'emergency',
  'skylab',
  'qwerty',
  'letmein',
];

export const PASSWORD_MIN_LENGTH = 12;

/**
 * Validate a password against the policy.
 * @param password   the candidate password
 * @param emailLocalPart  optional email local-part (before @) to reject reuse of
 */
export function validatePasswordStrength(
  password: string,
  emailLocalPart?: string,
): PasswordPolicyResult {
  const errors: string[] = [];

  const hasLength = password.length >= PASSWORD_MIN_LENGTH;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasLength) errors.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (!hasUpper) errors.push('Add at least one uppercase letter.');
  if (!hasLower) errors.push('Add at least one lowercase letter.');
  if (!hasNumber) errors.push('Add at least one number.');
  if (!hasSymbol) errors.push('Add at least one symbol (e.g. ! @ # $ %).');

  const lower = password.toLowerCase();

  if (WEAK_PASSWORDS.some((w) => lower === w || lower.includes(w))) {
    errors.push('This password is too common. Choose something less guessable.');
  }

  if (emailLocalPart && emailLocalPart.length >= 3 && lower.includes(emailLocalPart.toLowerCase())) {
    errors.push('Do not include your email name in your password.');
  }

  // Reject trivially repeated characters/sequences like 111111 or aaaaaa.
  if (/(.)\1{5,}/.test(password)) {
    errors.push('Avoid long runs of the same character.');
  }

  const score =
    (hasLength ? 1 : 0) +
    (hasUpper ? 1 : 0) +
    (hasLower ? 1 : 0) +
    (hasNumber ? 1 : 0) +
    (hasSymbol ? 1 : 0);

  return {
    valid: errors.length === 0,
    errors,
    score,
  };
}
