/**
 * App.tsx
 * Agency-grade operations console.
 *
 * Layout:
 *   [Disclaimer] [StatsBar]
 *   [Sidebar: FilterPanel + IncidentList] | [MapPanel] | [IncidentDetail (when selected)]
 *
 * Features: live map, sidebar filters, CSV export, print-friendly detail.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import './dashboard.css';
import { fetchIncidents } from './api';
import type { ServerIncident, FilterState, IncidentStatus } from './types';
import { EMPTY_FILTER } from './components/FilterPanel';
import { StatsBar }      from './components/StatsBar';
import { FilterPanel }   from './components/FilterPanel';
import { IncidentList }  from './components/IncidentList';
import { MapPanel }      from './components/MapPanel';
import { IncidentDetail } from './components/IncidentDetail';

const POLL_INTERVAL_MS = 10_000;

// Michigan bounding box
const MI_BOX = { minLat: 41.696, maxLat: 47.521, minLon: -90.419, maxLon: -82.122 };

// ─── Filter logic ─────────────────────────────────────────────────────────────

function applyFilters(incidents: ServerIncident[], f: FilterState): ServerIncident[] {
  return incidents.filter((inc) => {
    if (f.statuses.length   && !f.statuses.includes(inc.status as IncidentStatus))          return false;
    if (f.types.length      && !f.types.includes(inc.incidentType))                         return false;
    if (f.counties.length   && !f.counties.includes(inc.nearestResource?.county ?? ''))     return false;
    if (f.agencies.length   && !f.agencies.includes(inc.nearestResource?.name   ?? ''))     return false;
    if (f.sourceApps.length && !f.sourceApps.includes(inc.sourceApp))                       return false;
    if (f.dateFrom) { if (new Date(inc.receivedAt) < new Date(f.dateFrom)) return false; }
    if (f.dateTo)   {
      const to = new Date(f.dateTo); to.setDate(to.getDate() + 1);
      if (new Date(inc.receivedAt) >= to) return false;
    }
    return true;
  });
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportToCsv(incidents: ServerIncident[]): void {
  const HEADERS = [
    'ID', 'Type', 'Status', 'Received', 'County', 'Agency',
    'Latitude', 'Longitude', 'Accuracy(m)', 'StaleGPS',
    'Battery%', 'BatteryState', 'Signal', 'Network',
    'AssignedOperator', 'AssignedAgency', 'SourceApp',
    'Notes', 'OperatorNotes',
  ];

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const rows = incidents.map((i) => [
    i.serverIncidentId,
    i.incidentType,
    i.status,
    i.receivedAt,
    i.nearestResource?.county    ?? '',
    i.nearestResource?.name      ?? '',
    i.latitude.toFixed(6),
    i.longitude.toFixed(6),
    Math.round(i.accuracy).toString(),
    i.staleLocation ? 'YES' : 'no',
    i.batteryLevel !== null ? `${Math.round((i.batteryLevel ?? 0) * 100)}%` : '',
    i.batteryState,
    i.signalStatus,
    i.networkType,
    i.assignedOperatorId ?? '',
    i.assignedAgency     ?? '',
    i.sourceApp,
    escape(i.additionalNotes),
    escape(i.operatorNotes),
  ]);

  const csv = [HEADERS.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv, ''], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `er-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [incidents,      setIncidents]      = useState<ServerIncident[]>([]);
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [backendOnline,  setBackendOnline]  = useState(false);
  const [lastRefreshed,  setLastRefreshed]  = useState<Date | null>(null);
  const [filter,         setFilter]         = useState<FilterState>(EMPTY_FILTER);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchIncidents();
      setIncidents(data);
      setBackendOnline(true);
      setLastRefreshed(new Date());
      setSelectedId((prev) => {
        if (prev) return prev;
        const first = data.find((i) => !['resolved', 'false_alarm', 'closed'].includes(i.status));
        return first?.serverIncidentId ?? data[0]?.serverIncidentId ?? null;
      });
    } catch {
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    pollRef.current = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const handleUpdated = useCallback((updated: ServerIncident) => {
    setIncidents((prev) =>
      prev.map((i) => (i.serverIncidentId === updated.serverIncidentId ? updated : i))
    );
  }, []);

  const filteredIncidents  = applyFilters(incidents, filter);
  const selectedIncident   = incidents.find((i) => i.serverIncidentId === selectedId) ?? null;
  const outOfArea = selectedIncident
    ? selectedIncident.latitude  < MI_BOX.minLat || selectedIncident.latitude  > MI_BOX.maxLat ||
      selectedIncident.longitude < MI_BOX.minLon || selectedIncident.longitude > MI_BOX.maxLon
    : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── Legal disclaimer ────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#1a0a00', borderBottom: '1px solid #5c2800',
        padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
        <span style={{ color: '#FF8F00', fontSize: 11, lineHeight: 1.4 }}>
          <strong>DEMO SYSTEM — NOT A REPLACEMENT FOR 911.</strong>
          {' '}Supplemental evaluation tool only. No SLA. No real dispatch integration. Pilot data only.
        </span>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <StatsBar incidents={incidents} backendOnline={backendOnline} />

      {/* ── Three-column body ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left sidebar: FilterPanel + IncidentList ──────────────────────── */}
        <div style={{
          width: 340, flexShrink: 0,
          borderRight: '1px solid #1e1e1e',
          backgroundColor: '#0f0f0f',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <FilterPanel
            incidents={incidents}
            filter={filter}
            onChange={setFilter}
            filteredCount={filteredIncidents.length}
            onExportCsv={() => exportToCsv(filteredIncidents)}
          />
          <IncidentList
            incidents={filteredIncidents}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loading}
            lastRefreshed={lastRefreshed}
            onRefresh={load}
          />
        </div>

        {/* ── Center: Map ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
          {backendOnline ? (
            <MapPanel
              incidents={filteredIncidents}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: 12, backgroundColor: '#0d0d0d',
            }}>
              <span style={{ fontSize: 48 }}>🔌</span>
              <div style={{ color: '#666', fontSize: 16, fontWeight: 600 }}>Backend Offline</div>
              <div style={{ color: '#444', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>
                Start the server: <code style={{ color: '#777' }}>cd server && npm run dev</code>
              </div>
              <button onClick={load} style={{ backgroundColor: '#1e1e1e', color: '#888', marginTop: 8 }}>
                Retry Connection
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Incident detail (shown when incident is selected) ──────── */}
        {selectedIncident && (
          <div style={{
            width: 480, flexShrink: 0,
            borderLeft: '1px solid #1e1e1e',
            backgroundColor: '#0d0d0d',
            overflow: 'hidden',
          }}>
            <IncidentDetail
              incident={selectedIncident}
              outOfArea={outOfArea}
              onUpdated={handleUpdated}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
