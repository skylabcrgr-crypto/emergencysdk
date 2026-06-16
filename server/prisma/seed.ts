/**
 * seed.ts
 * Prisma seed script — populates the database with demo incidents.
 *
 * Run:
 *   cd server && npm run prisma:seed
 *
 * This replicates the three hard-coded incidents from the old in-memory store
 * so the dashboard has realistic data immediately after a fresh migration.
 *
 * Seed is idempotent — uses upsert so running it multiple times is safe.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_RESOURCES = [
  {
    id: 'msp-gaylord-post',
    name: 'Michigan State Police — Gaylord Post',
    type: 'state_police',
    phone: '989-732-5141',
    county: 'Otsego',
    latitude: 45.0285,
    longitude: -84.6742,
  },
  {
    id: 'houghton-lake-marina',
    name: 'Houghton Lake Public Marina',
    type: 'marina',
    phone: '989-422-3111',
    county: 'Roscommon',
    latitude: 44.3198,
    longitude: -84.7703,
  },
  {
    id: 'alger-county-sheriff',
    name: 'Alger County Sheriff',
    type: 'county_sheriff',
    phone: '906-387-4444',
    county: 'Alger',
    latitude: 46.4580,
    longitude: -86.6070,
  },
];

const SEED_INCIDENTS = [
  {
    externalPacketId: 'seed-a1b2c3d4-0001',
    serverIncidentId: 'INC-0001',
    incidentType: 'lost',
    latitude: 45.0200,
    longitude: -84.6800,
    accuracy: 8,
    staleLocation: false,
    batteryLevel: 0.62,
    batteryState: 'unplugged',
    batteryCharging: false,
    signalStatus: 'weak',
    networkType: 'cellular',
    userId: 'user-fisher-001',
    deviceId: 'ios-device-seed',
    appVersion: '1.0.0',
    nearestResourceId: 'msp-gaylord-post',
    nearestResourceDistanceMiles: 3.2,
    nearestResourceSnapshot: {
      id: 'msp-gaylord-post',
      name: 'Michigan State Police — Gaylord Post',
      type: 'state_police',
      phone: '989-732-5141',
      county: 'Otsego',
      latitude: 45.0285,
      longitude: -84.6742,
      distanceMiles: 3.2,
    },
    additionalNotes: 'Lost on trail near Elk River, last seen marker 14',
    status: 'reviewing' as const,
    receivedAt: new Date(Date.now() - 47 * 60 * 1000),
    packetTimestamp: new Date(Date.now() - 47 * 60 * 1000),
    initialStatusHistory: [
      { fromStatus: null, toStatus: 'queued', minutesAgo: 47 },
      { fromStatus: 'queued', toStatus: 'received', minutesAgo: 44, note: 'Operator picked up' },
      { fromStatus: 'received', toStatus: 'reviewing', minutesAgo: 40, note: 'Contacting trailhead' },
    ],
  },
  {
    externalPacketId: 'seed-a1b2c3d4-0002',
    serverIncidentId: 'INC-0002',
    incidentType: 'boating',
    latitude: 44.3100,
    longitude: -84.7600,
    accuracy: 12,
    staleLocation: false,
    batteryLevel: 0.38,
    batteryState: 'unplugged',
    batteryCharging: false,
    signalStatus: 'weak',
    networkType: 'cellular',
    userId: 'user-boater-099',
    deviceId: 'android-device-seed',
    appVersion: '1.0.0',
    nearestResourceId: 'houghton-lake-marina',
    nearestResourceDistanceMiles: 1.8,
    nearestResourceSnapshot: {
      id: 'houghton-lake-marina',
      name: 'Houghton Lake Public Marina',
      type: 'marina',
      phone: '989-422-3111',
      county: 'Roscommon',
      latitude: 44.3198,
      longitude: -84.7703,
      distanceMiles: 1.8,
    },
    additionalNotes: 'Engine failure, taking on water',
    status: 'dispatched' as const,
    receivedAt: new Date(Date.now() - 12 * 60 * 1000),
    packetTimestamp: new Date(Date.now() - 12 * 60 * 1000),
    initialStatusHistory: [
      { fromStatus: null, toStatus: 'queued', minutesAgo: 12 },
      { fromStatus: 'queued', toStatus: 'received', minutesAgo: 11 },
      { fromStatus: 'received', toStatus: 'dispatched', minutesAgo: 9, note: 'Coast Guard unit dispatched from Houghton Lake' },
    ],
  },
  {
    externalPacketId: 'seed-a1b2c3d4-0003',
    serverIncidentId: 'INC-0003',
    incidentType: 'medical',
    latitude: 46.4090,
    longitude: -86.6570,
    accuracy: 8,
    staleLocation: false,
    batteryLevel: 0.62,
    batteryState: 'unplugged',
    batteryCharging: false,
    signalStatus: 'weak',
    networkType: 'cellular',
    userId: 'user-hiker-442',
    deviceId: 'ios-device-seed-2',
    appVersion: '1.0.0',
    nearestResourceId: 'alger-county-sheriff',
    nearestResourceDistanceMiles: 5.1,
    nearestResourceSnapshot: {
      id: 'alger-county-sheriff',
      name: 'Alger County Sheriff',
      type: 'county_sheriff',
      phone: '906-387-4444',
      county: 'Alger',
      latitude: 46.4580,
      longitude: -86.6070,
      distanceMiles: 5.1,
    },
    additionalNotes: 'Suspected broken ankle, 2 miles in on Pictured Rocks trail',
    status: 'queued' as const,
    receivedAt: new Date(Date.now() - 3 * 60 * 1000),
    packetTimestamp: new Date(Date.now() - 3 * 60 * 1000),
    initialStatusHistory: [
      { fromStatus: null, toStatus: 'queued', minutesAgo: 3 },
    ],
  },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Upsert resources
  for (const resource of SEED_RESOURCES) {
    await prisma.emergencyResource.upsert({
      where: { id: resource.id },
      create: resource,
      update: { name: resource.name, phone: resource.phone },
    });
    console.log(`  ✓ Resource: ${resource.name}`);
  }

  // Upsert incidents
  for (const seed of SEED_INCIDENTS) {
    const { initialStatusHistory, ...incidentData } = seed;

    const existing = await prisma.emergencyIncident.findUnique({
      where: { serverIncidentId: incidentData.serverIncidentId },
    });

    if (existing) {
      console.log(`  ⏭  Incident ${incidentData.serverIncidentId} already exists — skipping`);
      continue;
    }

    // Create incident
    const incident = await prisma.emergencyIncident.create({
      data: {
        ...incidentData,
        nearestResourceSnapshot: incidentData.nearestResourceSnapshot,
        operatorNotes: '',
      },
    });

    // Create status history entries
    for (const entry of initialStatusHistory) {
      await prisma.incidentStatusHistory.create({
        data: {
          incidentId: incident.id,
          fromStatus: entry.fromStatus,
          toStatus: entry.toStatus,
          note: (entry as { note?: string }).note ?? null,
          changedAt: new Date(Date.now() - entry.minutesAgo * 60 * 1000),
        },
      });
    }

    console.log(`  ✓ Incident ${incidentData.serverIncidentId}: ${incidentData.incidentType} (${incidentData.status})`);
  }

  console.log('\n✅ Seed complete.');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
