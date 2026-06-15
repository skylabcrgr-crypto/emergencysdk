/**
 * IncidentTypeSelector.tsx
 * Grid of incident type tiles for selecting the emergency category before SOS.
 * Designed to be fast to tap with large touch targets — usable with gloves.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import type { IncidentType } from '../types/emergency.types';
import { INCIDENT_TYPE_LABELS, INCIDENT_TYPE_ICONS } from '../types/emergency.types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface IncidentTypeSelectorProps {
  selected: IncidentType;
  onSelect: (type: IncidentType) => void;
  /** Number of columns in the grid — defaults to 2 */
  columns?: number;
  /** Accent color for the selected tile border */
  accentColor?: string;
}

// ─── Ordered list for display ─────────────────────────────────────────────────

const INCIDENT_ORDER: IncidentType[] = [
  'medical',
  'lost',
  'boating',
  'fishing',
  'hiking',
  'vehicle',
  'wildlife',
  'other',
];

// ─── Component ────────────────────────────────────────────────────────────────

export function IncidentTypeSelector({
  selected,
  onSelect,
  columns = 2,
  accentColor = '#CC0000',
}: IncidentTypeSelectorProps) {
  return (
    <ScrollView
      horizontal={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.grid, { flexDirection: 'row', flexWrap: 'wrap' }]}>
        {INCIDENT_ORDER.map((type) => {
          const isSelected = type === selected;
          const tileWidth = `${Math.floor(100 / columns) - 2}%` as const;

          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.tile,
                { width: tileWidth },
                isSelected && {
                  borderColor: accentColor,
                  borderWidth: 2.5,
                  backgroundColor: `${accentColor}18`,
                },
              ]}
              onPress={() => onSelect(type)}
              activeOpacity={0.75}
              accessible
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${INCIDENT_TYPE_LABELS[type]}${isSelected ? ', selected' : ''}`}
            >
              <Text style={styles.icon}>{INCIDENT_TYPE_ICONS[type]}</Text>
              <Text
                style={[
                  styles.label,
                  isSelected && { color: accentColor, fontWeight: '700' },
                ]}
                numberOfLines={2}
              >
                {INCIDENT_TYPE_LABELS[type]}
              </Text>
              {isSelected && (
                <View
                  style={[styles.selectedDot, { backgroundColor: accentColor }]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: 4,
  },
  grid: {
    gap: 10,
    justifyContent: 'space-between',
  },
  tile: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 90,
    borderWidth: 1.5,
    borderColor: '#333',
    position: 'relative',
  },
  icon: {
    fontSize: 28,
    marginBottom: 6,
  },
  label: {
    color: '#E0E0E0',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
  },
  selectedDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
