/**
 * IncidentCard.tsx
 * Compact list row for a single incident in the sidebar list.
 */

import type { ServerIncident } from '../types';
import { INCIDENT_TYPE_ICONS, INCIDENT_TYPE_LABELS } from '../types';
import { StatusBadge } from './StatusBadge';

interface IncidentCardProps {
  incident: ServerIncident;
  selected: boolean;
  onClick: () => void;
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function IncidentCard({ incident, selected, onClick }: IncidentCardProps) {
  const icon = INCIDENT_TYPE_ICONS[incident.incidentType] ?? '🆘';
  const label = INCIDENT_TYPE_LABELS[incident.incidentType] ?? incident.incidentType;

  const isActive = !['resolved', 'false_alarm'].includes(incident.status);

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        cursor: 'pointer',
        backgroundColor: selected ? '#1e1e1e' : 'transparent',
        border: selected ? '1px solid #333' : '1px solid transparent',
        borderLeft: selected
          ? '3px solid #cc0000'
          : isActive
          ? '3px solid #333'
          : '3px solid transparent',
        transition: 'background 0.15s',
        marginBottom: 4,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#e0e0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>
            {incident.serverIncidentId} · {timeAgo(incident.receivedAt)}
          </div>
        </div>
        <StatusBadge status={incident.status} size="sm" />
      </div>

      {/* Coords */}
      <div style={{ fontSize: 11, color: '#555', fontFamily: 'monospace' }}>
        {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
      </div>

      {/* Nearest resource snippet */}
      {incident.nearestResource && (
        <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>
          📍 {incident.nearestResource.name} ({incident.nearestResource.distanceMiles.toFixed(1)} mi)
        </div>
      )}

      {/* Notes snippet */}
      {incident.additionalNotes && (
        <div style={{ fontSize: 11, color: '#555', marginTop: 3, fontStyle: 'italic',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          "{incident.additionalNotes}"
        </div>
      )}
    </div>
  );
}
