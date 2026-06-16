/**
 * IncidentList.tsx
 * Sidebar list of incidents with free-text search.
 * Status/type/county/etc. filtering is handled upstream by FilterPanel;
 * this component receives an already-filtered list and adds text search.
 */

import { useState } from 'react';
import type { ServerIncident, IncidentStatus } from '../types';
import { IncidentCard } from './IncidentCard';

interface IncidentListProps {
  incidents: ServerIncident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  lastRefreshed: Date | null;
  onRefresh: () => void;
}

const ACTIVE_STATUSES: IncidentStatus[] = ['queued', 'received', 'reviewing', 'dispatched', 'acknowledged'];

export function IncidentList({
  incidents,
  selectedId,
  onSelect,
  loading,
  lastRefreshed,
  onRefresh,
}: IncidentListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const activeCount = incidents.filter((i) => ACTIVE_STATUSES.includes(i.status)).length;

  const filtered = incidents.filter((inc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inc.serverIncidentId.toLowerCase().includes(q) ||
      inc.incidentType.toLowerCase().includes(q) ||
      inc.additionalNotes.toLowerCase().includes(q) ||
      inc.userId.toLowerCase().includes(q) ||
      (inc.assignedOperatorId?.toLowerCase().includes(q) ?? false) ||
      (inc.assignedAgency?.toLowerCase().includes(q) ?? false) ||
      (inc.nearestResource?.name.toLowerCase().includes(q) ?? false) ||
      (inc.nearestResource?.county.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* List header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Incidents</span>
            {activeCount > 0 && (
              <span style={{
                marginLeft: 8, backgroundColor: '#cc0000', color: '#fff',
                borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>
                {activeCount} active
              </span>
            )}
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{ backgroundColor: '#1e1e1e', color: '#888', padding: '5px 10px', fontSize: 12 }}
            title="Refresh incidents"
          >
            {loading ? '⟳' : '↻'} Refresh
          </button>
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder="Search ID, type, notes, operator, agency…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 8,
            color: '#e0e0e0',
            fontSize: 13,
            padding: '7px 10px',
            outline: 'none',
          }}
        />
      </div>

      {/* Last refreshed */}
      {lastRefreshed && (
        <div style={{ padding: '4px 14px', fontSize: 10, color: '#444', flexShrink: 0 }}>
          Last updated: {lastRefreshed.toLocaleTimeString()}
        </div>
      )}

      {/* List body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {loading && incidents.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 40, fontSize: 13 }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 40, fontSize: 13 }}>
            No incidents match this filter.
          </div>
        ) : (
          filtered.map((inc) => (
            <IncidentCard
              key={inc.serverIncidentId}
              incident={inc}
              selected={inc.serverIncidentId === selectedId}
              onClick={() => onSelect(inc.serverIncidentId)}
            />
          ))
        )}
      </div>
    </div>
  );
}
