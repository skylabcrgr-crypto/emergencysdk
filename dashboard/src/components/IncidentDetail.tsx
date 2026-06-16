/**
 * IncidentDetail.tsx
 * Agency-grade incident detail panel.
 *
 * Sections:
 *   Header · Assignment · Location (stale/out-of-area warnings) · Nearest Resource
 *   Incident Details · Device & User · Add Note · Operator Notes
 *   Status History · Status Actions
 *
 * Print: clicking "🖨 Print" triggers window.print().
 *        CSS @media print in dashboard.css shows only #print-incident.
 */

import { useState, useEffect } from 'react';
import type { ServerIncident, IncidentStatus } from '../types';
import {
  INCIDENT_TYPE_ICONS,
  INCIDENT_TYPE_LABELS,
  INCIDENT_STATUS_ORDER,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_COLORS,
} from '../types';
import { StatusBadge } from './StatusBadge';
import {
  updateIncidentStatus,
  addOperatorNote,
  updateIncidentAssignment,
} from '../api';

interface IncidentDetailProps {
  incident: ServerIncident;
  outOfArea: boolean;
  onUpdated: (updated: ServerIncident) => void;
  onClose: () => void;
}

const MAPS_URL = (lat: number, lon: number) =>
  `https://maps.google.com/?q=${lat.toFixed(6)},${lon.toFixed(6)}`;

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', gap: 8, padding: '5px 0',
      borderBottom: '1px solid #1a1a1a',
    }}>
      <span style={{ color: '#555', fontSize: 11, width: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#ccc', fontSize: 12, flex: 1, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#444',
        textTransform: 'uppercase', marginBottom: 8, paddingBottom: 5,
        borderBottom: '1px solid #1e1e1e',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function WarnBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: '#1a0a00', border: '1px solid #6b3200', borderRadius: 6,
      padding: '5px 10px', marginBottom: 6, fontSize: 11, color: '#ff8f00',
      display: 'flex', gap: 6, alignItems: 'flex-start',
    }}>
      <span style={{ flexShrink: 0 }}>⚠️</span>
      <span>{children}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IncidentDetail({ incident, outOfArea, onUpdated, onClose }: IncidentDetailProps) {
  const [statusLoading,  setStatusLoading]  = useState(false);
  const [noteInput,      setNoteInput]      = useState('');
  const [noteLoading,    setNoteLoading]    = useState(false);
  const [assignOp,       setAssignOp]       = useState(incident.assignedOperatorId ?? '');
  const [assignAgency,   setAssignAgency]   = useState(incident.assignedAgency     ?? '');
  const [assignLoading,  setAssignLoading]  = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  /** Confirmation message shown after a status update (push notification demo). */
  const [notifConfirm,   setNotifConfirm]   = useState<string | null>(null);

  // Sync assignment fields when the selected incident changes
  useEffect(() => {
    setAssignOp(incident.assignedOperatorId ?? '');
    setAssignAgency(incident.assignedAgency ?? '');
    setError(null);
  }, [incident.serverIncidentId, incident.assignedOperatorId, incident.assignedAgency]);

  const handleStatusUpdate = async (newStatus: IncidentStatus) => {
    setStatusLoading(true);
    setError(null);
    setNotifConfirm(null);
    try {
      const updated = await updateIncidentStatus(incident.serverIncidentId, newStatus);
      onUpdated(updated);
      // Show a brief confirmation that the backend notification service was called.
      // The server logs the push payload (demo); in production this triggers real APNs/FCM.
      setNotifConfirm(`Status → ${newStatus}. Push notification triggered (demo) to device.`);
      setTimeout(() => setNotifConfirm(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status update failed');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteInput.trim()) return;
    setNoteLoading(true);
    setError(null);
    try {
      const updated = await addOperatorNote(incident.serverIncidentId, noteInput.trim());
      onUpdated(updated);
      setNoteInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Note submission failed');
    } finally {
      setNoteLoading(false);
    }
  };

  const handleSaveAssignment = async () => {
    setAssignLoading(true);
    setError(null);
    try {
      const updated = await updateIncidentAssignment(
        incident.serverIncidentId,
        assignOp.trim()     || null,
        assignAgency.trim() || null,
      );
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assignment save failed');
    } finally {
      setAssignLoading(false);
    }
  };

  const icon  = INCIDENT_TYPE_ICONS[incident.incidentType]  ?? '🆘';
  const label = INCIDENT_TYPE_LABELS[incident.incidentType] ?? incident.incidentType;
  const actionStatuses = INCIDENT_STATUS_ORDER.filter((s) => s !== incident.status);

  const batteryPct = incident.batteryLevel !== null
    ? `${Math.round((incident.batteryLevel ?? 0) * 100)}%`
    : null;

  return (
    <div
      id="print-incident"
      style={{ padding: '18px 20px', overflowY: 'auto', height: '100%', fontSize: 13 }}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid #2a2a2a',
            color: '#666', fontSize: 12, padding: '4px 10px', borderRadius: 6,
          }}
        >
          ✕ Close
        </button>
        <button
          onClick={() => window.print()}
          style={{
            background: 'none', border: '1px solid #2a2a2a',
            color: '#666', fontSize: 12, padding: '4px 10px', borderRadius: 6,
          }}
        >
          🖨 Print Report
        </button>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 40, lineHeight: 1 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            {label}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge status={incident.status} />
            <span style={{ color: '#555', fontSize: 12 }}>{incident.serverIncidentId}</span>
            <span style={{ color: '#444', fontSize: 11 }}>
              {new Date(incident.receivedAt).toLocaleString()}
            </span>
          </div>
          {(incident.assignedOperatorId || incident.assignedAgency) && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#666' }}>
              👤 {incident.assignedOperatorId ?? '—'}
              {incident.assignedAgency ? ` · ${incident.assignedAgency}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* ── Warnings ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: incident.staleLocation || outOfArea ? 14 : 0 }}>
        {incident.staleLocation && (
          <WarnBanner>
            Stale GPS — location may be outdated. Verify with victim.
          </WarnBanner>
        )}
        {outOfArea && (
          <WarnBanner>
            Out-of-area — coordinates fall outside Michigan coverage zone.
          </WarnBanner>
        )}
      </div>

      {/* ── Assignment ──────────────────────────────────────────────────────── */}
      <Section title="Assignment">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={assignOp}
            onChange={(e) => setAssignOp(e.target.value)}
            placeholder="Operator ID / badge"
            style={inputStyle}
          />
          <input
            value={assignAgency}
            onChange={(e) => setAssignAgency(e.target.value)}
            placeholder="Agency name"
            style={inputStyle}
          />
        </div>
        <button
          onClick={handleSaveAssignment}
          disabled={assignLoading}
          style={{ ...btnStyle, opacity: assignLoading ? 0.5 : 1 }}
        >
          {assignLoading ? 'Saving…' : 'Save Assignment'}
        </button>
      </Section>

      {/* ── Location ────────────────────────────────────────────────────────── */}
      <Section title="Location">
        <Row label="Coordinates"
          value={
            <a href={MAPS_URL(incident.latitude, incident.longitude)} target="_blank" rel="noreferrer">
              {incident.latitude.toFixed(6)}, {incident.longitude.toFixed(6)} ↗
            </a>
          }
          mono
        />
        <Row label="Map Link"
          value={
            <a href={MAPS_URL(incident.latitude, incident.longitude)} target="_blank" rel="noreferrer">
              Open in Google Maps ↗
            </a>
          }
        />
        <Row label="GPS Accuracy" value={`±${Math.round(incident.accuracy)} m`} />
        {incident.altitude !== null && (
          <Row label="Altitude" value={`${incident.altitude} m`} />
        )}
        <Row label="Stale GPS" value={incident.staleLocation ? '⚠️ Yes' : 'No'} />
        <Row label="Out of Area" value={outOfArea ? '⚠️ Yes — outside Michigan' : 'No'} />
      </Section>

      {/* ── Nearest Resource ────────────────────────────────────────────────── */}
      {incident.nearestResource ? (
        <Section title="Nearest Emergency Resource">
          <Row label="Name"   value={incident.nearestResource.name} />
          <Row label="Type"   value={incident.nearestResource.type.replace(/_/g, ' ')} />
          <Row label="County" value={incident.nearestResource.county} />
          <Row label="Phone"
            value={
              <a href={`tel:${incident.nearestResource.phone}`}>
                {incident.nearestResource.phone}
              </a>
            }
          />
          <Row label="Distance" value={`${incident.nearestResource.distanceMiles.toFixed(1)} mi`} />
          <Row label="Resource GPS"
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
          <p style={{ color: '#555', fontSize: 12 }}>No resource data in packet.</p>
        </Section>
      )}

      {/* ── Incident Details ─────────────────────────────────────────────────── */}
      <Section title="Incident Details">
        <Row label="Type"       value={label} />
        <Row label="Source App" value={incident.sourceApp} />
        {incident.additionalNotes && (
          <Row label="Victim Notes" value={`"${incident.additionalNotes}"`} />
        )}
        <Row label="Signal"     value={incident.signalStatus} />
        <Row label="Network"    value={incident.networkType} />
        {batteryPct && (
          <Row
            label="Battery"
            value={`${batteryPct}  ${incident.batteryState}${incident.batteryCharging ? '  ⚡ charging' : ''}`}
          />
        )}
        <Row label="Retry Count" value={String(incident.retryCount)} />
      </Section>

      {/* ── Device & User ────────────────────────────────────────────────────── */}
      <Section title="Device & User">
        <Row label="User ID"     value={incident.userId}    mono />
        <Row label="Device ID"   value={incident.deviceId}  mono />
        <Row label="App Version" value={incident.appVersion} />
        <Row label="Packet ID"   value={incident.packetId}  mono />
        <Row label="Packet Time" value={new Date(incident.packetTimestamp).toLocaleString()} />
      </Section>

      {/* ── Add Operator Note ────────────────────────────────────────────────── */}
      <Section title="Add Operator Note">
        {error && (
          <div style={{ color: '#f44336', fontSize: 11, marginBottom: 8 }}>{error}</div>
        )}
        <textarea
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          placeholder="e.g. 'Unit 7 en route from Gaylord Post. ETA ~12 min.'"
          rows={3}
          style={{ ...textareaStyle, marginBottom: 8 }}
        />
        <button
          onClick={handleAddNote}
          disabled={noteLoading || !noteInput.trim()}
          style={{ ...btnStyle, opacity: noteLoading || !noteInput.trim() ? 0.5 : 1 }}
        >
          {noteLoading ? 'Saving…' : 'Add Note'}
        </button>
      </Section>

      {/* ── Operator Notes Log ───────────────────────────────────────────────── */}
      {incident.operatorNotes && (
        <Section title="Operator Notes">
          <pre style={{
            fontSize: 11, color: '#aaa', whiteSpace: 'pre-wrap',
            fontFamily: 'inherit', margin: 0,
          }}>
            {incident.operatorNotes}
          </pre>
        </Section>
      )}

      {/* ── Status History ───────────────────────────────────────────────────── */}
      <Section title="Status History">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...incident.statusHistory].reverse().map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: 4,
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

      {/* ── Status Actions ───────────────────────────────────────────────────── */}
      <Section title="Update Status">
        {error && (
          <div style={{ color: '#f44336', fontSize: 12, marginBottom: 10 }}>{error}</div>
        )}
        {notifConfirm && (
          <div style={{
            fontSize: 11, color: '#81c784', background: 'rgba(46,125,50,0.15)',
            border: '1px solid #2e7d32', borderRadius: 6, padding: '5px 10px',
            marginBottom: 10,
          }}>
            📲 {notifConfirm}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {actionStatuses.map((s) => {
            const color = INCIDENT_STATUS_COLORS[s];
            return (
              <button
                key={s}
                disabled={statusLoading}
                onClick={() => handleStatusUpdate(s)}
                style={{
                  backgroundColor: `${color}22`,
                  border: `1px solid ${color}88`,
                  color,
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: statusLoading ? 'not-allowed' : 'pointer',
                  opacity: statusLoading ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {statusLoading ? '…' : `→ ${INCIDENT_STATUS_LABELS[s]}`}
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ─── Shared inline styles ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: 6,
  color: '#e0e0e0',
  fontSize: 12,
  padding: '6px 10px',
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  color: '#e0e0e0',
  fontSize: 12,
  padding: '8px 10px',
  resize: 'vertical',
  fontFamily: 'inherit',
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  backgroundColor: '#1e2a1e',
  border: '1px solid #2e4a2e',
  color: '#4caf50',
  borderRadius: 6,
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
