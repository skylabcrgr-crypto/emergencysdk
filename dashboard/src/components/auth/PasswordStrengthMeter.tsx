/**
 * PasswordStrengthMeter.tsx
 * Accessible password requirement checklist + strength indicator.
 * Uses text labels (not color alone) for accessibility.
 */

import { evaluatePassword } from '../../auth/passwordPolicy';
import { colors } from './authStyles';

interface Props {
  password: string;
  emailLocalPart?: string;
}

const STRENGTH_LABEL: Record<string, string> = {
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
};

const STRENGTH_COLOR: Record<string, string> = {
  weak: colors.danger,
  fair: colors.warning,
  strong: colors.success,
};

export function PasswordStrengthMeter({ password, emailLocalPart }: Props) {
  const { checks, strength } = evaluatePassword(password, emailLocalPart);
  const barWidth = strength === 'strong' ? '100%' : strength === 'fair' ? '60%' : '30%';

  return (
    <div style={{ marginBottom: 16 }} aria-live="polite">
      <div
        style={{
          height: 6,
          backgroundColor: colors.border,
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            height: '100%',
            width: password ? barWidth : '0%',
            backgroundColor: STRENGTH_COLOR[strength],
            transition: 'width 160ms ease',
          }}
        />
      </div>
      <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 8 }}>
        Strength:{' '}
        <strong style={{ color: STRENGTH_COLOR[strength] }}>
          {password ? STRENGTH_LABEL[strength] : '—'}
        </strong>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {checks.map((c) => (
          <li
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: c.passed ? colors.success : colors.textFaint,
            }}
          >
            <span aria-hidden style={{ width: 14, display: 'inline-block' }}>
              {c.passed ? '✓' : '○'}
            </span>
            <span>
              {c.label}
              <span style={{ position: 'absolute', left: -9999 }}>
                {c.passed ? ' (met)' : ' (not met)'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
