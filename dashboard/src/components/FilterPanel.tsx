/**
 * FilterPanel.tsx
 * Collapsible sidebar filter panel.
 * Supports: status, incident type, county, agency, source app, date range.
 * All filtering is performed client-side from the full incident list.
 */

import { useState } from 'react';
import type { ServerIncident, IncidentStatus, FilterState } from '../types';
import {
  INCIDENT_STATUS_ORDER,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_COLORS,
  INCIDENT_TYPE_ICONS,
  INCIDENT_TYPE_LABELS,
} from '../types';

interface FilterPanelProps {
  incidents: ServerIncident[];       // full unfiltered list for deriving options
  filter: FilterState;
  onChange: (f: FilterState) => void;
  filteredCount: number;
  onExportCsv: () => void;
}

export const EMPTY_FILTER: FilterState = {
  statuses:   [],
  types:      [],
  counties:   [],
  agencies:   [],
  sourceApps: [],
  dateFrom:   null,
  dateTo:     null,
};

function isFilterActive(f: FilterState): boolean {
  return (
    f.statuses.length > 0 ||
    f.types.length > 0 ||
    f.counties.length > 0 ||
    f.agencies.length > 0 ||
    f.sourceApps.length > 0 ||
    f.dateFrom !== null ||
    f.dateTo   !== null
  );
}

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

// ─── Section sub-component ────────────────────────────────────────────────────

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #1e1e1e', paddingBottom: 10, marginBottom: 10 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          color: '#666', fontSize: 10, fontWeight: 700, letterSpacing: 1,
          textTransform: 'uppercase', cursor: 'pointer', padding: '0 0 6px',
          display: 'flex', justifyContent: 'space-between',
        }}
      >
        {title}
        <span style={{ fontSize: 12, color: '#444' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && children}
    </div>
  );
}

// ─── Chip sub-component ───────────────────────────────────────────────────────

function Chip({
  label,
  active,
  color = '#888',
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: '3px 9px',
        backgroundColor: active ? `${color}33` : 'transparent',
        border: `1px solid ${active ? color : '#2a2a2a'}`,
        color: active ? color : '#555',
        borderRadius: 20,
        fontWeight: active ? 700 : 400,
        cursor: 'pointer',
        transition: 'all 0.12s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FilterPanel({
  incidents,
  filter,
  onChange,
  filteredCount,
  onExportCsv,
}: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Derive unique option values from the full incident set
  const counties = [...new Set(
    incidents.flatMap((i) => (i.nearestResource?.county ? [i.nearestResource.county] : []))
  )].sort();

  const agencies = [...new Set(
    incidents.flatMap((i) => (i.nearestResource?.name ? [i.nearestResource.name] : []))
  )].sort();

  const sourceApps = [...new Set(incidents.map((i) => i.sourceApp))].sort();
  const allTypes   = [...new Set(incidents.map((i) => i.incidentType))].sort();

  const active = isFilterActive(filter);

  return (
    <div style={{
      borderBottom: '1px solid #1e1e1e',
      backgroundColor: '#0c0c0c',
      flexShrink: 0,
    }}>
      {/* Collapse header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '9px 14px',
      }}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={{
            background: 'none', border: 'none', color: '#666', fontSize: 11,
            fontWeight: 700, letterSpacing: 0.8, cursor: 'pointer',
            display: 'flex', gap: 6, alignItems: 'center',
          }}
        >
          🔽 FILTERS
          {active && (
            <span style={{
              backgroundColor: '#cc0000', color: '#fff',
              borderRadius: 10, padding: '1px 6px', fontSize: 10,
            }}>
              ON
            </span>
          )}
          <span style={{ color: '#444', fontSize: 10 }}>
            {filteredCount} shown
          </span>
        </button>

        <div style={{ display: 'flex', gap: 6 }}>
          {active && (
            <button
              onClick={() => onChange(EMPTY_FILTER)}
              style={{
                fontSize: 10, padding: '3px 8px', backgroundColor: 'transparent',
                border: '1px solid #333', color: '#666', borderRadius: 6,
              }}
            >
              Clear
            </button>
          )}
          <button
            onClick={onExportCsv}
            title="Export filtered incidents as CSV"
            style={{
              fontSize: 10, padding: '3px 8px', backgroundColor: 'transparent',
              border: '1px solid #333', color: '#666', borderRadius: 6,
            }}
          >
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Filter body (collapsible) */}
      {!collapsed && (
        <div style={{ padding: '0 14px 12px', overflowY: 'auto', maxHeight: 360 }}>

          {/* Status */}
          <FilterSection title="Status">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {INCIDENT_STATUS_ORDER.map((s) => (
                <Chip
                  key={s}
                  label={INCIDENT_STATUS_LABELS[s]}
                  color={INCIDENT_STATUS_COLORS[s]}
                  active={filter.statuses.includes(s as IncidentStatus)}
                  onClick={() => onChange({ ...filter, statuses: toggle(filter.statuses, s as IncidentStatus) })}
                />
              ))}
            </div>
          </FilterSection>

          {/* Type */}
          {allTypes.length > 0 && (
            <FilterSection title="Incident Type">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {allTypes.map((t) => (
                  <Chip
                    key={t}
                    label={`${INCIDENT_TYPE_ICONS[t] ?? '🆘'} ${INCIDENT_TYPE_LABELS[t] ?? t}`}
                    active={filter.types.includes(t)}
                    onClick={() => onChange({ ...filter, types: toggle(filter.types, t) })}
                  />
                ))}
              </div>
            </FilterSection>
          )}

          {/* County */}
          {counties.length > 0 && (
            <FilterSection title="County" defaultOpen={false}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {counties.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    active={filter.counties.includes(c)}
                    onClick={() => onChange({ ...filter, counties: toggle(filter.counties, c) })}
                  />
                ))}
              </div>
            </FilterSection>
          )}

          {/* Agency */}
          {agencies.length > 0 && (
            <FilterSection title="Agency" defaultOpen={false}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {agencies.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    active={filter.agencies.includes(a)}
                    onClick={() => onChange({ ...filter, agencies: toggle(filter.agencies, a) })}
                  />
                ))}
              </div>
            </FilterSection>
          )}

          {/* Source App */}
          {sourceApps.length > 1 && (
            <FilterSection title="Source App" defaultOpen={false}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {sourceApps.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    active={filter.sourceApps.includes(s)}
                    onClick={() => onChange({ ...filter, sourceApps: toggle(filter.sourceApps, s) })}
                  />
                ))}
              </div>
            </FilterSection>
          )}

          {/* Date range */}
          <FilterSection title="Created Date" defaultOpen={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#555', fontSize: 11, width: 28 }}>From</span>
                <input
                  type="date"
                  value={filter.dateFrom ?? ''}
                  onChange={(e) => onChange({ ...filter, dateFrom: e.target.value || null })}
                  style={{
                    flex: 1, backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                    color: '#ccc', borderRadius: 6, padding: '4px 8px', fontSize: 11,
                    colorScheme: 'dark',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#555', fontSize: 11, width: 28 }}>To</span>
                <input
                  type="date"
                  value={filter.dateTo ?? ''}
                  onChange={(e) => onChange({ ...filter, dateTo: e.target.value || null })}
                  style={{
                    flex: 1, backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                    color: '#ccc', borderRadius: 6, padding: '4px 8px', fontSize: 11,
                    colorScheme: 'dark',
                  }}
                />
              </div>
            </div>
          </FilterSection>

        </div>
      )}
    </div>
  );
}
