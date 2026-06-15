/**
 * EmergencyDemoScreen.tsx
 * Full-featured demo screen for the Emergency Response SDK.
 *
 * Plug this screen into any Expo React Native app to demonstrate the
 * complete SOS flow: incident selection → SOS → GPS → packet → send/queue.
 *
 * This screen is intentionally self-contained so it can be dropped into
 * any of the target apps (fishing, parks, boating, hunting, tourism, trails)
 * with minimal integration effort.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { EmergencyButton } from '../emergency/components/EmergencyButton';
import { IncidentTypeSelector } from '../emergency/components/IncidentTypeSelector';
import { EmergencyStatusCard } from '../emergency/components/EmergencyStatusCard';

import {
  subscribeToNetworkChanges,
  getNetworkState,
} from '../emergency/services/networkService';
import {
  flushQueue,
  getQueueCount,
} from '../emergency/services/offlineQueueService';
import {
  sendPacketToAPI,
} from '../emergency/services/emergencyPacketService';
import {
  saveEmergencyContacts,
  getEmergencyContacts,
} from '../emergency/services/emergencyContactService';

import type {
  IncidentType,
  EmergencyButtonState,
  EmergencyPacket,
  NetworkState,
  EmergencyContact,
} from '../emergency/types/emergency.types';

// ─── Screen ───────────────────────────────────────────────────────────────────

interface EmergencyDemoScreenProps {
  /**
   * Optional API URL — when provided, queue flush and SOS button will POST to
   * this endpoint instead of the built-in mock.
   * Example: 'http://192.168.1.X:3001/api/emergency/incidents'
   */
  apiUrl?: string;
}

export function EmergencyDemoScreen({ apiUrl }: EmergencyDemoScreenProps = {}) {
  const [incidentType, setIncidentType] = useState<IncidentType>('medical');
  const [notes, setNotes] = useState('');
  const [buttonState, setButtonState] = useState<EmergencyButtonState>('idle');
  const [activePacket, setActivePacket] = useState<EmergencyPacket | null>(null);
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    type: 'unknown',
    isInternetReachable: null,
  });
  const [queueCount, setQueueCount] = useState(0);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [autoFlush, setAutoFlush] = useState(true);

  // ── Load initial state ────────────────────────────────────────────────────
  useEffect(() => {
    void getNetworkState().then(setNetworkState);
    void getQueueCount().then(setQueueCount);
    void getEmergencyContacts().then(setContacts);
  }, []);

  // ── Network subscription + auto-flush ────────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges(async (state) => {
      setNetworkState(state);

      if (state.isConnected && autoFlush) {
        const { sent, failed } = await flushQueue((packet) =>
          sendPacketToAPI(packet, apiUrl).then(() => true).catch(() => false)
        );

        if (sent > 0 || failed > 0) {
          const newCount = await getQueueCount();
          setQueueCount(newCount);
          if (sent > 0) {
            const failedNote = failed > 0 ? `\n${failed} packet${failed !== 1 ? 's' : ''} will retry.` : '';
            Alert.alert(
              '📡 Queue Flushed',
              `${sent} queued packet${sent !== 1 ? 's' : ''} sent successfully.${failedNote}`
            );
          }
        }
      }

      const newCount = await getQueueCount();
      setQueueCount(newCount);
    });

    return () => unsubscribe();
  }, [autoFlush, apiUrl]);

  // ── Packet completion callback ────────────────────────────────────────────
  const handleComplete = useCallback(
    async (packet: EmergencyPacket, _state: EmergencyButtonState) => {
      setActivePacket(packet);
      const newCount = await getQueueCount();
      setQueueCount(newCount);
    },
    []
  );

  // ── Save contact ──────────────────────────────────────────────────────────
  const handleSaveContact = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      Alert.alert('Missing Info', 'Please enter both a name and phone number.');
      return;
    }

    const updated = [...contacts, { name: contactName.trim(), phone: contactPhone.trim() }];
    await saveEmergencyContacts(updated);
    setContacts(updated);
    setContactName('');
    setContactPhone('');
    setShowContactForm(false);
  };

  const handleRemoveContact = async (index: number) => {
    const updated = contacts.filter((_, i) => i !== index);
    await saveEmergencyContacts(updated);
    setContacts(updated);
  };

  const networkColor = networkState.isConnected ? '#2E7D32' : '#7B5EA7';
  const networkLabel = networkState.isConnected
    ? `Online (${networkState.type})`
    : 'Offline — Queuing enabled';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>🆘 Emergency SDK</Text>
          <Text style={styles.subtitle}>Michigan Field Response Module</Text>
        </View>

        {/* ── Network Status Banner ────────────────────────────────────────── */}
        <View style={[styles.networkBanner, { borderColor: networkColor }]}>
          <Text style={[styles.networkText, { color: networkColor }]}>
            {networkState.isConnected ? '🌐' : '🔌'} {networkLabel}
          </Text>
          {queueCount > 0 && (
            <Text style={styles.queueBadge}>
              {queueCount} queued
            </Text>
          )}
        </View>

        {/* ── Auto-flush toggle ─────────────────────────────────────────────── */}
        <View style={styles.row}>
          <Text style={styles.toggleLabel}>Auto-flush queue on reconnect</Text>
          <Switch
            value={autoFlush}
            onValueChange={setAutoFlush}
            trackColor={{ false: '#333', true: '#2E7D32' }}
            thumbColor="#FFF"
          />
        </View>

        {/* ── Incident Type Selector ───────────────────────────────────────── */}
        <SectionHeader title="Select Incident Type" />
        <IncidentTypeSelector
          selected={incidentType}
          onSelect={setIncidentType}
          columns={4}
        />

        {/* ── Notes field ──────────────────────────────────────────────────── */}
        <SectionHeader title="Additional Notes (optional)" />
        <TextInput
          style={styles.notesInput}
          placeholder="e.g. fallen hiker, unconscious, near pine ridge trail marker 7"
          placeholderTextColor="#555"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          maxLength={300}
          accessible
          accessibilityLabel="Additional notes for emergency responders"
        />

        {/* ── SOS Button ───────────────────────────────────────────────────── */}
        <SectionHeader title="Trigger SOS" />
        <View style={styles.buttonContainer}>
          <EmergencyButton
            incidentType={incidentType}
            additionalNotes={notes}
            onComplete={handleComplete}
            onStateChange={setButtonState}
            apiUrl={apiUrl}
          />
        </View>

        {/* ── Status Card ──────────────────────────────────────────────────── */}
        <SectionHeader title="Alert Status" />
        <EmergencyStatusCard
          packet={activePacket}
          buttonState={buttonState}
          queueCount={queueCount}
        />

        {/* ── Emergency Contacts ───────────────────────────────────────────── */}
        <SectionHeader title="Emergency Contacts" />
        {contacts.length === 0 ? (
          <Text style={styles.emptyText}>
            No contacts saved. Add contacts to receive SMS alerts.
          </Text>
        ) : (
          <View style={styles.contactList}>
            {contacts.map((c, i) => (
              <View key={i} style={styles.contactRow}>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactPhone}>{c.phone}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveContact(i)}
                  style={styles.removeBtn}
                  accessibilityLabel={`Remove ${c.name}`}
                >
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {showContactForm ? (
          <View style={styles.contactForm}>
            <TextInput
              style={styles.input}
              placeholder="Contact name"
              placeholderTextColor="#555"
              value={contactName}
              onChangeText={setContactName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor="#555"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => setShowContactForm(false)}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={handleSaveContact}
              >
                <Text style={styles.btnPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.btn, styles.btnOutline]}
            onPress={() => setShowContactForm(true)}
          >
            <Text style={styles.btnOutlineText}>+ Add Contact</Text>
          </TouchableOpacity>
        )}

        {/* ── Footer disclaimer ─────────────────────────────────────────────── */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ This is a prototype demo. No real 911 or dispatch integration is
            active. In a life-threatening emergency, call 911 directly.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionDivider} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  networkBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  networkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  queueBadge: {
    backgroundColor: '#7B5EA7',
    color: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  toggleLabel: {
    color: '#CCC',
    fontSize: 13,
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#222',
  },
  notesInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    color: '#E0E0E0',
    fontSize: 14,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 8,
  },
  contactList: {
    gap: 8,
    marginBottom: 8,
  },
  contactRow: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#E0E0E0',
    fontSize: 14,
    fontWeight: '600',
  },
  contactPhone: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  removeBtn: {
    padding: 6,
  },
  removeText: {
    color: '#B71C1C',
    fontSize: 16,
    fontWeight: '700',
  },
  contactForm: {
    gap: 10,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    color: '#E0E0E0',
    fontSize: 14,
    padding: 12,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: '#CC0000',
  },
  btnPrimaryText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: '#222',
  },
  btnSecondaryText: {
    color: '#AAA',
    fontSize: 14,
  },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: '#444',
    borderStyle: 'dashed',
    marginTop: 8,
  },
  btnOutlineText: {
    color: '#888',
    fontSize: 14,
  },
  disclaimer: {
    marginTop: 32,
    padding: 14,
    backgroundColor: '#1A0A00',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#5C3000',
  },
  disclaimerText: {
    color: '#FF8F00',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
