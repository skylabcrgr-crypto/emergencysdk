/**
 * MapPanel.tsx
 * Fullscreen MapLibre GL map showing incident markers.
 *
 * Token strategy:
 *   VITE_MAPBOX_TOKEN set  → Mapbox dark-v11 satellite/streets style
 *   No token               → OpenFreeMap vector tiles (free, OSM-based)
 *
 * If the map fails to load (no internet / style error), a fallback
 * placeholder is shown with Google Maps links for each incident.
 */

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { ServerIncident } from '../types';
import { INCIDENT_STATUS_COLORS, INCIDENT_TYPE_ICONS } from '../types';

interface MapPanelProps {
  incidents: ServerIncident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN ?? '') as string;

const MAP_STYLE: string = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=${MAPBOX_TOKEN}`
  : 'https://tiles.openfreemap.org/styles/liberty';

// Michigan center
const MI_CENTER: [number, number] = [-84.5, 44.5];

const MAPS_LINK = (lat: number, lon: number) =>
  `https://maps.google.com/?q=${lat.toFixed(6)},${lon.toFixed(6)}`;

export function MapPanel({ incidents, selectedId, onSelect }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const markersRef   = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // ── Initialize map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style:     MAP_STYLE,
        center:    MI_CENTER,
        zoom:      6.2,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        'bottom-right'
      );

      map.on('load', () => setMapReady(true));
      map.on('error', () => setMapError(true));

      mapRef.current = map;
    } catch {
      setMapError(true);
      return;
    }

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // ── Sync markers when incidents list changes ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    // Remove stale markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    incidents.forEach((inc) => {
      const color = INCIDENT_STATUS_COLORS[inc.status] ?? '#888';
      const icon  = INCIDENT_TYPE_ICONS[inc.incidentType] ?? '🆘';
      const isActive = !['resolved', 'false_alarm', 'closed'].includes(inc.status);

      // Custom marker element
      const el = document.createElement('div');
      el.style.cssText = [
        `width:${isActive ? 16 : 12}px`,
        `height:${isActive ? 16 : 12}px`,
        'border-radius:50%',
        `background:${color}`,
        'border:2.5px solid rgba(255,255,255,0.9)',
        'cursor:pointer',
        'box-shadow:0 1px 6px rgba(0,0,0,0.6)',
        'transition:transform 0.15s',
        isActive ? 'animation:markerPulse 2.4s ease-in-out infinite' : '',
      ].join(';');

      el.title = `${icon} ${inc.serverIncidentId} — ${inc.status}`;

      const popup = new maplibregl.Popup({
        offset: 14,
        closeButton: false,
        closeOnClick: false,
        maxWidth: '220px',
      }).setHTML(`
        <div style="font-family:system-ui;font-size:12px;line-height:1.5;padding:2px">
          <div style="font-weight:700;margin-bottom:2px">${icon} ${inc.serverIncidentId}</div>
          <div style="color:#555;margin-bottom:1px">${inc.incidentType} &middot; <strong style="color:${color}">${inc.status}</strong></div>
          ${inc.nearestResource ? `<div style="color:#777">${inc.nearestResource.name}</div>` : ''}
          ${inc.additionalNotes ? `<div style="font-style:italic;color:#777;margin-top:3px">"${inc.additionalNotes.slice(0, 80)}${inc.additionalNotes.length > 80 ? '…' : ''}"</div>` : ''}
        </div>
      `);

      el.addEventListener('mouseenter', () => popup.addTo(map));
      el.addEventListener('mouseleave', () => popup.remove());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(inc.serverIncidentId);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([inc.longitude, inc.latitude])
        .addTo(map);

      markersRef.current.set(inc.serverIncidentId, marker);
    });

    // Fit bounds to active incidents (on first load only — afterwards follow selection)
    const active = incidents.filter((i) => !['resolved', 'false_alarm', 'closed'].includes(i.status));
    if (active.length >= 2) {
      const bounds = new maplibregl.LngLatBounds();
      active.forEach((i) => bounds.extend([i.longitude, i.latitude]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 900 });
    } else if (active.length === 1) {
      map.flyTo({ center: [active[0].longitude, active[0].latitude], zoom: 11, duration: 900 });
    }
  }, [incidents, mapReady, onSelect]);

  // ── Highlight selected marker ─────────────────────────────────────────────
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      if (id === selectedId) {
        el.style.transform = 'scale(1.9)';
        el.style.zIndex    = '10';
        if (mapRef.current) {
          mapRef.current.easeTo({
            center: marker.getLngLat(),
            duration: 500,
          });
        }
      } else {
        el.style.transform = 'scale(1)';
        el.style.zIndex    = '1';
      }
    });
  }, [selectedId]);

  // ── Fallback: no map (no internet or style load error) ────────────────────
  if (mapError) {
    return (
      <div style={{
        height: '100%', backgroundColor: '#0a0a0a',
        display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 16,
      }}>
        <div style={{
          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8,
          padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#888',
        }}>
          ⚠️ Map unavailable — showing Google Maps links.
          {!MAPBOX_TOKEN && ' Set VITE_MAPBOX_TOKEN or check internet connection.'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {incidents.map((inc) => {
            const color = INCIDENT_STATUS_COLORS[inc.status] ?? '#888';
            return (
              <a
                key={inc.serverIncidentId}
                href={MAPS_LINK(inc.latitude, inc.longitude)}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'block', padding: '8px 12px', borderRadius: 8,
                  backgroundColor: '#141414', border: `1px solid ${color}44`,
                  color: '#ccc', textDecoration: 'none', fontSize: 12,
                }}
              >
                <span style={{ color, fontWeight: 700 }}>● {inc.serverIncidentId}</span>
                {' '}{inc.incidentType} —{' '}
                {inc.latitude.toFixed(5)}, {inc.longitude.toFixed(5)} ↗
              </a>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Source attribution overlay */}
      {!MAPBOX_TOKEN && (
        <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 5,
          backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4,
          padding: '3px 8px', fontSize: 10, color: '#aaa', pointerEvents: 'none',
        }}>
          Map: OpenFreeMap · OSM · Set VITE_MAPBOX_TOKEN for Mapbox
        </div>
      )}

      {/* Incident count overlay */}
      <div style={{
        position: 'absolute', bottom: 32, left: 8, zIndex: 5,
        backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4,
        padding: '4px 10px', fontSize: 11, color: '#ccc', pointerEvents: 'none',
      }}>
        {incidents.filter((i) => !['resolved', 'false_alarm', 'closed'].includes(i.status)).length} active ·{' '}
        {incidents.length} total
      </div>
    </div>
  );
}
