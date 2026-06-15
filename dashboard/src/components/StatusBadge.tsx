/**
 * StatusBadge.tsx
 * Pill badge showing incident status with color coding.
 */

import type { IncidentStatus } from '../types';
import { INCIDENT_STATUS_LABELS, INCIDENT_STATUS_COLORS } from '../types';

interface StatusBadgeProps {
  status: IncidentStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const color = INCIDENT_STATUS_COLORS[status];
  const label = INCIDENT_STATUS_LABELS[status];

  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: `${color}22`,
        border: `1px solid ${color}88`,
        color,
        borderRadius: 20,
        padding: size === 'sm' ? '2px 8px' : '4px 12px',
        fontSize: size === 'sm' ? 11 : 12,
        fontWeight: 700,
        letterSpacing: 0.3,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
