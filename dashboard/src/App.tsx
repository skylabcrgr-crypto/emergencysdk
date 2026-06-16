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
import { fetchIncidents, fetchResources } from './api';
import type { ServerIncident, FilterState, IncidentStatus, EmergencyResourceRecord } from './types';
import { EMPTY_FILTER } from './components/FilterPanel';
import { StatsBar }      from './components/StatsBar';
import { FilterPanel }   from './components/FilterPanel';
import { IncidentList }  from './components/IncidentList';
import { MapPanel }      from './components/MapPanel';
import { IncidentDetail } from './components/IncidentDetail';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { ForgotPasswordScreen } from './components/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen';
import { SessionTimeoutModal } from './components/auth/SessionTimeoutModal';
import { UserManagementPanel } from './components/admin/UserManagementPanel';
import { UserRoleBadge } from './components/admin/UserRoleBadge';
import { colors } from './components/auth/authStyles';

const SESSION_TIMEOUT_MIN = Number(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES ?? '30') || 30;
const SESSION_WARNING_MIN = Number(import.meta.env.VITE_SESSION_WARNING_MINUTES ?? '28') || 28;

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

// ─── Operations console (the existing dashboard) ───────────────────────────────

function OperationsConsole() {
  const [incidents,      setIncidents]      = useState<ServerIncident[]>([]);
  const [resources,      setResources]      = useState<EmergencyResourceRecord[]>([]);
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

  // Resources change rarely — fetch once on connect, not on every poll.
  useEffect(() => {
    if (!backendOnline) return;
    fetchResources()
      .then(setResources)
      .catch(() => setResources([]));
  }, [backendOnline]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

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
              resources={resources}
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

// ─── Auth screen router (login ↔ forgot ↔ reset) ───────────────────────────────

type AuthView = 'login' | 'forgot';

function AuthScreens({ onCancel }: { onCancel?: () => void }) {
  const [view, setView] = useState<AuthView>('login');
  return (
    <div style={{ position: 'relative' }}>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 2,
            background: 'none', border: `1px solid ${colors.border}`,
            color: colors.textDim, borderRadius: 8, padding: '6px 12px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Back to demo
        </button>
      )}
      {view === 'login' ? (
        <LoginScreen onForgotPassword={() => setView('forgot')} />
      ) : (
        <ForgotPasswordScreen onBackToLogin={() => setView('login')} />
      )}
    </div>
  );
}

// ─── Top navigation / header ───────────────────────────────────────────────────

type Tab = 'operations' | 'admin';

function Header({
  tab, onTab, onStaffSignIn,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  onStaffSignIn: () => void;
}) {
  const { user, logout, demoMode, isAdmin, status } = useAuth();
  const authenticated = status === 'authenticated';

  const tabBtn = (t: Tab): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    color: tab === t ? colors.text : colors.textDim,
    borderBottom: tab === t ? `2px solid ${colors.accent}` : '2px solid transparent',
    padding: '6px 4px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20,
      backgroundColor: '#0a0a0b', borderBottom: `1px solid ${colors.border}`,
      padding: '8px 16px', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden style={{ fontSize: 16 }}>🛰️</span>
        <strong style={{ color: colors.text, fontSize: 14, whiteSpace: 'nowrap' }}>
          ER SDK Operations Dashboard
        </strong>
      </div>

      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
        color: demoMode ? colors.warning : colors.success,
        border: `1px solid ${demoMode ? colors.warning : colors.success}`,
        borderRadius: 5, padding: '2px 6px',
      }}>
        {demoMode ? 'Demo' : 'Live'}
      </span>

      {authenticated && (
        <nav style={{ display: 'flex', gap: 16, marginLeft: 8 }}>
          <button type="button" style={tabBtn('operations')} onClick={() => onTab('operations')}>
            Operations
          </button>
          {isAdmin && (
            <button type="button" style={tabBtn('admin')} onClick={() => onTab('admin')}>
              Admin Users
            </button>
          )}
        </nav>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {authenticated && user ? (
          <>
            <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
              <div style={{ color: colors.text, fontSize: 12, fontWeight: 600 }}>
                {user.name || user.email}
              </div>
              {user.name && <div style={{ color: colors.textFaint, fontSize: 11 }}>{user.email}</div>}
            </div>
            <UserRoleBadge role={user.role} />
            <button
              type="button"
              onClick={() => void logout()}
              style={{
                background: 'none', border: `1px solid ${colors.border}`,
                color: colors.textDim, borderRadius: 8, padding: '6px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onStaffSignIn}
            style={{
              backgroundColor: colors.accent, color: '#fff', border: 'none',
              borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Staff sign-in
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Auth gate / shell ─────────────────────────────────────────────────────────

function getResetToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (window.location.pathname !== '/reset-password') return null;
  return new URLSearchParams(window.location.search).get('token');
}

function isResetRoute(): boolean {
  return typeof window !== 'undefined' && window.location.pathname === '/reset-password';
}

function AppShell() {
  const { status, demoMode, isAdmin, logout, sessionMessage, clearSessionMessage } = useAuth();
  const [tab, setTab] = useState<Tab>('operations');
  const [demoSignIn, setDemoSignIn] = useState(false);
  const [showReset, setShowReset] = useState(isResetRoute());

  // Non-admins forced back to operations if they somehow land on admin.
  useEffect(() => {
    if (tab === 'admin' && !isAdmin) setTab('operations');
  }, [tab, isAdmin]);

  // Reset-password route takes precedence over everything.
  if (showReset) {
    return (
      <ResetPasswordScreen
        token={getResetToken()}
        onDone={() => {
          window.history.replaceState({}, '', '/');
          setShowReset(false);
        }}
      />
    );
  }

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.bg, color: colors.textDim, fontSize: 14,
      }}>
        Loading…
      </div>
    );
  }

  // Secure mode, not signed in → require login.
  if (status === 'unauthenticated') {
    return <AuthScreens />;
  }

  // Demo mode where the operator chose to sign in.
  if (status === 'demo' && demoSignIn) {
    return <AuthScreens onCancel={() => setDemoSignIn(false)} />;
  }

  const banner = sessionMessage ? (
    <div
      role="status"
      style={{
        backgroundColor: '#0e2433', borderBottom: `1px solid ${colors.accent}`,
        color: '#9fd2ff', padding: '6px 16px', fontSize: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}
    >
      <span>{sessionMessage}</span>
      <button
        type="button"
        onClick={clearSessionMessage}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', color: '#9fd2ff', cursor: 'pointer', fontSize: 16 }}
      >
        ×
      </button>
    </div>
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header tab={tab} onTab={setTab} onStaffSignIn={() => setDemoSignIn(true)} />
      {banner}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'admin' && isAdmin ? (
          <div style={{ height: '100%', overflowY: 'auto', backgroundColor: colors.bg }}>
            <UserManagementPanel />
          </div>
        ) : (
          <OperationsConsole />
        )}
      </div>
      <SessionTimeoutModal
        enabled={status === 'authenticated' && !demoMode}
        timeoutMinutes={SESSION_TIMEOUT_MIN}
        warningMinutes={SESSION_WARNING_MIN}
        onTimeout={() => void logout()}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

