/**
 * IncidentDetail.tsx
 * Full detail panel for the selected incident.
 * Shows all packet data, nearest resource, status history, and action buttons.
 */

import { useState } from 'react';
import type { ServerIncident, IncidentStatus } from '../types';
import {
  INCIDENT_TYPE_ICONS,
  INCIDENT_TYPE_LABELS,
  INCIDENT_STATUS_ORDER,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_COLORS,
} from '../types';
import { StatusBadge } from './StatusBadge';
import { updateIncidentStatus } from '../api';

interface IncidentDetailProps {
  incident: ServerIncident;
  onUpdated: (updated: ServerIncident) => void;
}

const MAPS_URL = (lat: number, lon: number) =>
  `https://maps.google.com/?q=${lat.toFixed(6)},${lon.toFixed(6)}`;

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #1e1e1e' }}>
      <span style={{ color: '#666', fontSize: 12, width: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#ccc', fontSize: 12, flex: 1, fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#555',
        textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6,
        borderBottom: '1px solid #222' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function IncidentDetail({ incident, onUpdated }: IncidentDetailProps) {
  const [loading, setLoading] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStatusUpdate = async (newStatus: IncidentStatus) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await updateIncidentStatus(
        incident.serverIncidentId,
        newStatus,
        noteInput.trim() || undefined
      );
      onUpdated(updated);
      setNoteInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const icon = INCIDENT_TYPE_ICONS[incident.incidentType] ?? '🆘';
  const label = INCIDENT_TYPE_LABELS[incident.incidentType] ?? incident.incidentType;

  // Next logical statuses to move to (allow any transition for demo flexibility)
  const actionStatuses = INCIDENT_STATUS_ORDER.filter((s) => s !== incident.status);

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
        <span style={{ fontSize: 44, lineHeight: 1 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            {label}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge status={incident.status} />
            <span style={{ color: '#555', fontSize: 12 }}>{incident.serverIncidentId}</span>
            <span style={{ color: '#555', fontSize: 12 }}>
              Received {new Date(incident.receivedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ backgroundColor: '#1a0a00', border: '1px solid #5c3000', borderRadius: 8,
        padding: '8px 12px', marginBottom: 20, fontSize: 12, color: '#ff8f00' }}>
        ⚠️ Demo only — no real dispatch integration active. Do not use in a real emergency.
      </div>

      {/* Location */}
      <Section title="Location">
        <Row label="Coordinates"
          value={
            <a href={MAPS_URL(incident.latitude, incident.longitude)} target="_blank" rel="noreferrer">
              {incident.latitude.toFixed(6)}, {incident.longitude.toFixed(6)} ↗
            </a>
          }
          mono
        />
        <Row label="Accuracy" value={`±${Math.round(incident.accuracy)}m`} />
        {incident.altitude !== null && (
          <Row label="Altitude" value={`${incident.altitude}m`} />
        )}
        <Row label="Map Link"
          value={
            <a href={MAPS_URL(incident.latitude, incident.longitude)} target="_blank" rel="noreferrer">
              Open in Google Maps ↗
            </a>
          }
        />
      </Section>

      {/* Nearest Resource */}
      {incident.nearestResource ? (
        <Section title="Nearest Emergency Resource">
          <Row label="Name" value={incident.nearestResource.name} />
          <Row label="Type" value={incident.nearestResource.type.replace(/_/g, ' ')} />
          <Row label="County" value={incident.nearestResource.county} />
          <Row label="Phone"
            value={
              <a href={`tel:${incident.nearestResource.phone}`}>
                {incident.nearestResource.phone}
              </a>
            }
          />
          <Row label="Distance" value={`${incident.nearestResource.distanceMiles.toFixed(1)} miles`} />
          <Row label="Resource Coords"
            value={
              <a
                href={MAPS_URL(incident.nearestResource.latitude, incident.nearestResource.longitude)}
                target="_blank"
                rel="noreferrer"
              >
                {incident.nearestResource.latitude.toFixed(4)}, {incident.nearestResource.longitude.toFixed(4)} ↗
              </a>
            }
            mono
          />
          {incident.nearestResource.address && (
            <Row label="Address" value={incident.nearestResource.address} />
          )}
        </Section>
      ) : (
        <Section title="Nearest Emergency Resource">
          <p style={{ color: '#555', fontSize: 12 }}>No resource data included in packet.</p>
        </Section>
      )}

      {/* Incident Info */}
      <Section title="Incident Details">
        <Row label="Type" value={label} />
        {incident.additionalNotes && (
          <Row label="Notes" value={`"${incident.additionalNotes}"`} />
        )}
        <Row label="Signal" value={incident.signalStatus} />
        <Row label="Network" value={incident.networkType} />
        {incident.batteryLevel !== null && (
          <Row
            label="Battery"
            value={`${Math.round((incident.batteryLevel ?? 0) * 100)}%${incident.batteryCharging ? ' ⚡' : ''}`}
          />
        )}
        <Row label="Retry Count" value={String(incident.retryCount)} />
      </Section>

      {/* Device / User */}
      <Section title="Device & User">
        <Row label="User ID" value={incident.userId} mono />
        <Row label="Device ID" value={incident.deviceId} mono />
        <Row label="App Version" value={incident.appVersion} />
        <Row label="Packet ID" value={incident.packetId} mono />
        <Row label="Packet Time" value={new Date(incident.packetTimestamp).toLocaleString()} />
      </Section>

      {/* Operator Notes */}
      {incident.operatorNotes && (
        <Section title="Operator Notes">
          <pre style={{ fontSize: 12, color: '#aaa', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
            {incident.operatorNotes}
          </pre>
        </Section>
      )}

      {/* Status History — shows full from → to transitions, not raw audit logs */}
      <Section title="Status History">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...incident.statusHistory].reverse().map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                display: 'inline-block',
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: INCIDENT_STATUS_COLORS[entry.status] ?? '#444',
                marginTop: 4, flexShrink: 0,
              }} />
              <div>
                <span style={{ fontSize: 12, color: '#ccc', fontWeight: 600 }}>
                  {entry.fromStatus
                    ? `${INCIDENT_STATUS_LABELS[entry.fromStatus] ?? entry.fromStatus} → ${INCIDENT_STATUS_LABELS[entry.status] ?? entry.status}`
                    : `${INCIDENT_STATUS_LABELS[entry.status] ?? entry.status} (initial)`}
                </span>
                <span style={{ fontSize: 11, color: '#555', marginLeft: 8 }}>
                  {new Date(entry.changedAt).toLocaleString()}
                </span>
                {entry.changedById && (
                  <span style={{ fontSize: 11, color: '#444', marginLeft: 6 }}>
                    · by {entry.changedById}
                  </span>
                )}
                {entry.operatorNote && (
                  <div style={{ fontSize: 11, color: '#777', fontStyle: 'italic', marginTop: 2 }}>
                    "{entry.operatorNote}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Status Update Actions */}
      <Section title="Update Status">
        {error && (
          <div style={{ color: '#f44336', fontSize: 12, marginBottom: 10 }}>{error}</div>
        )}

        <textarea
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          placeholder="Optional operator note (e.g. 'Unit 7 en route')"
          rows={2}
          style={{
            width: '100%',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 8,
            color: '#e0e0e0',
            fontSize: 13,
            padding: '8px 10px',
            resize: 'vertical',
            fontFamily: 'inherit',
            marginBottom: 12,
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {actionStatuses.map((s) => {
            const color = INCIDENT_STATUS_COLORS[s];
            return (
              <button
                key={s}
                disabled={loading}
                onClick={() => handleStatusUpdate(s)}
                style={{
                  backgroundColor: `${color}22`,
                  border: `1px solid ${color}88`,
                  color,
                  borderRadius: 8,
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {loading ? '…' : `→ ${INCIDENT_STATUS_LABELS[s]}`}
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
