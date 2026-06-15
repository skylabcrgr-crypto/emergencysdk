/**
 * StatsBar.tsx
 * Top bar showing incident counts by status at a glance.
 */

import type { ServerIncident, IncidentStatus } from '../types';
import { INCIDENT_STATUS_ORDER, INCIDENT_STATUS_LABELS, INCIDENT_STATUS_COLORS } from '../types';

interface StatsBarProps {
  incidents: ServerIncident[];
  backendOnline: boolean;
}

export function StatsBar({ incidents, backendOnline }: StatsBarProps) {
  const counts = INCIDENT_STATUS_ORDER.reduce<Record<IncidentStatus, number>>(
    (acc, s) => {
      acc[s] = incidents.filter((i) => i.status === s).length;
      return acc;
    },
    {} as Record<IncidentStatus, number>
  );

  return (
    <div style={{
      backgroundColor: '#111',
      borderBottom: '1px solid #1e1e1e',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      height: 48,
      flexShrink: 0,
      overflowX: 'auto',
    }}>
      {/* Brand */}
      <div style={{ marginRight: 24, flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>🆘 ER Dashboard</span>
        <span style={{
          marginLeft: 8, fontSize: 10, fontWeight: 600,
          color: backendOnline ? '#2E7D32' : '#B71C1C',
          backgroundColor: backendOnline ? '#0a1a0a' : '#1a0000',
          border: `1px solid ${backendOnline ? '#2E7D32' : '#B71C1C'}`,
          borderRadius: 10, padding: '1px 7px',
        }}>
          {backendOnline ? '● LIVE' : '● OFFLINE'}
        </span>
      </div>

      <div style={{ width: 1, height: 28, backgroundColor: '#222', marginRight: 20, flexShrink: 0 }} />

      {/* Stat pills */}
      {INCIDENT_STATUS_ORDER.map((s) => {
        const count = counts[s];
        const color = INCIDENT_STATUS_COLORS[s];
        return (
          <div key={s} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 14px', flexShrink: 0,
            borderRight: '1px solid #1e1e1e',
          }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: 4,
              backgroundColor: count > 0 ? color : '#333',
            }} />
            <span style={{ fontSize: 11, color: '#666' }}>{INCIDENT_STATUS_LABELS[s]}</span>
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: count > 0 ? color : '#444',
            }}>
              {count}
            </span>
          </div>
        );
      })}

      <div style={{ marginLeft: 'auto', flexShrink: 0, paddingLeft: 16 }}>
        <span style={{ fontSize: 11, color: '#444' }}>
          Michigan Field Response Module · Demo
        </span>
      </div>
    </div>
  );
}
