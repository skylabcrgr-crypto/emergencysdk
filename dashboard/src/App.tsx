/**
 * App.tsx
 * Root dashboard component.
 * Two-panel layout: incident list (sidebar) + incident detail (main pane).
 * Auto-refreshes every 10 seconds.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import './dashboard.css';
import { fetchIncidents } from './api';
import type { ServerIncident } from './types';
import { StatsBar } from './components/StatsBar';
import { IncidentList } from './components/IncidentList';
import { IncidentDetail } from './components/IncidentDetail';

const POLL_INTERVAL_MS = 10_000;

export default function App() {
  const [incidents, setIncidents] = useState<ServerIncident[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchIncidents();
      setIncidents(data);
      setBackendOnline(true);
      setLastRefreshed(new Date());

      // Auto-select first active incident on first load
      setSelectedId((prev) => {
        if (prev) return prev;
        const first = data.find((i) => !['resolved', 'false_alarm'].includes(i.status));
        return first?.serverIncidentId ?? data[0]?.serverIncidentId ?? null;
      });
    } catch {
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    void load();
    pollRef.current = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const handleUpdated = (updated: ServerIncident) => {
    setIncidents((prev) =>
      prev.map((i) => (i.serverIncidentId === updated.serverIncidentId ? updated : i))
    );
  };

  const selectedIncident = incidents.find((i) => i.serverIncidentId === selectedId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── Legal disclaimer banner ─────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#1a0a00',
        borderBottom: '1px solid #5c2800',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <span style={{ color: '#FF8F00', fontSize: 12, lineHeight: 1.5 }}>
          <strong>DEMO SYSTEM — NOT A REPLACEMENT FOR 911.</strong>
          {' '}This dashboard is a supplemental tool for evaluation purposes only.
          If a victim can call 911, direct them to call 911 immediately.
          No SLA or guaranteed response time. Pilot data only — no real dispatch integration active.
        </span>
      </div>

      {/* Top stats bar */}
      <StatsBar incidents={incidents} backendOnline={backendOnline} />

      {/* Main two-panel layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar — incident list */}
        <div style={{
          width: 340,
          flexShrink: 0,
          borderRight: '1px solid #1e1e1e',
          backgroundColor: '#0f0f0f',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <IncidentList
            incidents={incidents}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loading}
            lastRefreshed={lastRefreshed}
            onRefresh={load}
          />
        </div>

        {/* Main panel — incident detail */}
        <div style={{ flex: 1, overflow: 'hidden', backgroundColor: '#0d0d0d' }}>
          {!backendOnline ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 12 }}>
              <span style={{ fontSize: 48 }}>🔌</span>
              <div style={{ color: '#666', fontSize: 16, fontWeight: 600 }}>Backend Offline</div>
              <div style={{ color: '#444', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>
                Make sure the server is running on port 3001.<br />
                <code style={{ color: '#777' }}>cd server && npm run dev</code>
              </div>
              <button
                onClick={load}
                style={{ backgroundColor: '#1e1e1e', color: '#888', marginTop: 8 }}
              >
                Retry Connection
              </button>
            </div>
          ) : selectedIncident ? (
            <IncidentDetail
              incident={selectedIncident}
              onUpdated={handleUpdated}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 8 }}>
              <span style={{ fontSize: 48 }}>🛡️</span>
              <div style={{ color: '#555', fontSize: 15 }}>Select an incident to review</div>
              <div style={{ color: '#333', fontSize: 12 }}>
                Auto-refreshing every {POLL_INTERVAL_MS / 1000}s
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
