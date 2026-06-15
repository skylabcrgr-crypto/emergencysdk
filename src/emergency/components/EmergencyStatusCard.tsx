/**
 * EmergencyStatusCard.tsx
 * Displays the current state and details of an emergency packet.
 * Shown after SOS is triggered — updates as the packet flows through states.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import type { EmergencyPacket, EmergencyButtonState } from '../types/emergency.types';
import { INCIDENT_TYPE_LABELS, INCIDENT_TYPE_ICONS } from '../types/emergency.types';
import { formatCoordinates, buildGoogleMapsUrl } from '../services/locationService';
import { formatDistanceMiles } from '../services/resourceFinderService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EmergencyStatusCardProps {
  packet: EmergencyPacket | null;
  buttonState: EmergencyButtonState;
  queueCount?: number;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  EmergencyButtonState,
  { color: string; bg: string; headline: string; icon: string }
> = {
  idle: {
    color: '#9E9E9E',
    bg: '#1A1A1A',
    headline: 'Ready',
    icon: '🛡️',
  },
  requesting_location: {
    color: '#E65C00',
    bg: '#1A0F00',
    headline: 'Acquiring GPS…',
    icon: '📡',
  },
  packet_created: {
    color: '#F0A500',
    bg: '#1A1200',
    headline: 'Packet Ready',
    icon: '📦',
  },
  sending: {
    color: '#F0A500',
    bg: '#1A1200',
    headline: 'Sending Alert…',
    icon: '📤',
  },
  queued_offline: {
    color: '#7B5EA7',
    bg: '#100C1A',
    headline: 'Queued — Offline',
    icon: '🔌',
  },
  sent: {
    color: '#2E7D32',
    bg: '#0A1A0A',
    headline: 'Alert Sent',
    icon: '✅',
  },
  failed: {
    color: '#B71C1C',
    bg: '#1A0000',
    headline: 'Send Failed',
    icon: '⚠️',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function EmergencyStatusCard({
  packet,
  buttonState,
  queueCount = 0,
}: EmergencyStatusCardProps) {
  const config = STATUS_CONFIG[buttonState];

  const openMapsUrl = () => {
    if (!packet) return;
    const url = buildGoogleMapsUrl(packet.latitude, packet.longitude);
    Linking.openURL(url).catch(() => {
      /* silently fail — Maps may not be available */
    });
  };

  return (
    <View
      style={[
        styles.card,
        { borderColor: config.color, backgroundColor: config.bg },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>{config.icon}</Text>
        <Text style={[styles.headline, { color: config.color }]}>
          {config.headline}
        </Text>
      </View>

      {/* Packet details — only shown once packet exists */}
      {packet && (
        <View style={styles.details}>
          {/* Incident type */}
          <Row
            icon={INCIDENT_TYPE_ICONS[packet.incidentType]}
            label="Incident"
            value={INCIDENT_TYPE_LABELS[packet.incidentType]}
          />

          {/* Coordinates — tappable to open Maps */}
          <TouchableOpacity onPress={openMapsUrl} activeOpacity={0.7}>
            <Row
              icon="📍"
              label="Location"
              value={formatCoordinates(
                packet.latitude,
                packet.longitude,
                packet.accuracy
              )}
              valueColor="#4FC3F7"
              suffix=" ↗"
            />
          </TouchableOpacity>

          {/* Nearest resource */}
          {packet.nearestResource && (
            <>
              {/* Out-of-state demo warning */}
              {packet.nearestResource.warning === 'LOCATION_OUTSIDE_MICHIGAN_DEMO_RANGE' && (
                <View style={styles.warningBanner}>
                  <Text style={styles.warningText}>
                    ⚠️ Device appears outside Michigan. Showing closest MI resource for demo purposes.
                  </Text>
                </View>
              )}
              <Row
                icon="🚨"
                label="Nearest Help"
                value={packet.nearestResource.name}
              />
              <Row
                icon="📏"
                label="Distance"
                value={formatDistanceMiles(packet.nearestResource.distanceMiles)}
              />
              <Row
                icon="📞"
                label="Resource Phone"
                value={packet.nearestResource.phone}
              />
            </>
          )}

          {/* Stale location warning */}
          {packet.staleLocation && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                📵 GPS using cached location — live fix unavailable. Coordinates may be up to 5 min old.
              </Text>
            </View>
          )}

          {/* Signal & network */}
          <Row icon="📶" label="Signal" value={packet.signalStatus} />
          <Row icon="🌐" label="Network" value={packet.networkType} />

          {/* Battery — if available */}
          {packet.batteryLevel !== null && (
            <Row
              icon="🔋"
              label="Battery"
              value={`${Math.round((packet.batteryLevel ?? 0) * 100)}% — ${packet.batteryState}${
                packet.lowPowerModeEnabled ? ' ⚡ Low Power' : ''
              }`}
            />
          )}

          {/* Packet ID — reference for support / dispatch */}
          <Row
            icon="🔑"
            label="Ref ID"
            value={packet.id.slice(0, 8).toUpperCase()}
            valueColor="#888"
          />

          {/* Additional notes */}
          {packet.additionalNotes ? (
            <Row icon="📝" label="Notes" value={packet.additionalNotes} />
          ) : null}
        </View>
      )}

      {/* Offline queue notice */}
      {buttonState === 'queued_offline' && queueCount > 0 && (
        <View style={styles.queueNotice}>
          <Text style={styles.queueText}>
            {queueCount} packet{queueCount !== 1 ? 's' : ''} queued — will
            auto-send when connection returns.
          </Text>
        </View>
      )}

      {/* Idle placeholder */}
      {buttonState === 'idle' && !packet && (
        <Text style={styles.idlePlaceholder}>
          Press SOS to begin an emergency alert.
        </Text>
      )}
    </View>
  );
}

// ─── Row Sub-component ────────────────────────────────────────────────────────

interface RowProps {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
  suffix?: string;
}

function Row({ icon, label, value, valueColor = '#E0E0E0', suffix = '' }: RowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }]}>
        {value}
        {suffix}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  headline: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  details: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  rowIcon: {
    fontSize: 14,
    marginRight: 6,
    width: 20,
  },
  rowLabel: {
    color: '#888',
    fontSize: 12,
    width: 96,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 12,
    flex: 1,
    flexWrap: 'wrap',
  },
  queueNotice: {
    marginTop: 12,
    backgroundColor: '#1C1430',
    borderRadius: 8,
    padding: 10,
  },
  queueText: {
    color: '#B39DDB',
    fontSize: 12,
    textAlign: 'center',
  },
  warningBanner: {
    backgroundColor: '#1A1200',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#5C4000',
    padding: 8,
    marginBottom: 4,
  },
  warningText: {
    color: '#FF8F00',
    fontSize: 11,
    lineHeight: 16,
  },
  idlePlaceholder: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
});
