/**
 * passwordPolicy.ts
 * Client-side mirror of server/src/services/passwordPolicy.service.ts.
 * Keep both in sync. Used by the PasswordStrengthMeter and reset/change forms.
 */

export interface PasswordCheck {
  id: string;
  label: string;
  passed: boolean;
}

export const PASSWORD_MIN_LENGTH = 12;

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

export function evaluatePassword(password: string, emailLocalPart?: string): {
  checks: PasswordCheck[];
  score: number;
  valid: boolean;
  strength: 'weak' | 'fair' | 'strong';
} {
  const lower = password.toLowerCase();
  const notCommon =
    password.length > 0 &&
    !WEAK_PASSWORDS.some((w) => lower === w || lower.includes(w)) &&
    !(emailLocalPart && emailLocalPart.length >= 3 && lower.includes(emailLocalPart.toLowerCase())) &&
    !/(.)\1{5,}/.test(password);

  const checks: PasswordCheck[] = [
    { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, passed: password.length >= PASSWORD_MIN_LENGTH },
    { id: 'upper', label: 'An uppercase letter', passed: /[A-Z]/.test(password) },
    { id: 'lower', label: 'A lowercase letter', passed: /[a-z]/.test(password) },
    { id: 'number', label: 'A number', passed: /[0-9]/.test(password) },
    { id: 'symbol', label: 'A symbol (! @ # $ %)', passed: /[^A-Za-z0-9]/.test(password) },
    { id: 'notCommon', label: 'Not a common or guessable password', passed: notCommon },
  ];

  const required = checks.filter((c) => c.id !== 'notCommon');
  const score = required.filter((c) => c.passed).length;
  const valid = checks.every((c) => c.passed);
  const strength: 'weak' | 'fair' | 'strong' =
    valid ? 'strong' : score >= 3 ? 'fair' : 'weak';

  return { checks, score, valid, strength };
}
