/**
 * UserRoleBadge.tsx
 * Small colored pill for a user's role.
 */

import { colors } from '../auth/authStyles';

const ROLE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  admin: { bg: '#2a1145', fg: '#c79bff', label: 'Admin' },
  operator: { bg: '#0e2433', fg: '#7fc7ff', label: 'Operator' },
  viewer: { bg: '#1a1a1f', fg: colors.textDim, label: 'Viewer' },
  agency_partner: { bg: '#10261b', fg: '#86e0b3', label: 'Agency Partner' },
  mobile: { bg: '#241a05', fg: '#f3cd7e', label: 'Mobile' },
};

export function UserRoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? { bg: colors.panelAlt, fg: colors.textDim, label: role };
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: s.bg,
        color: s.fg,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        padding: '3px 8px',
        borderRadius: 6,
      }}
    >
      {s.label}
    </span>
  );
}
