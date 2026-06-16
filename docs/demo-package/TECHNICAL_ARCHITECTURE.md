# ER Offline SDK — Technical Architecture

**Document Type:** Technical Reference  
**Audience:** Agency IT, Security, and Integration Teams  
**Version:** 0.9 (Pre-Pilot)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MOBILE (Expo / React Native)                  │
│                                                                       │
│  ┌──────────────┐   ┌────────────────┐   ┌─────────────────────┐   │
│  │ EmergencyBtn │──▶│ EmergencyPacket│──▶│  offlineQueueService │   │
│  │ (React comp) │   │ (buildPacket)  │   │  (AES-256-GCM queue) │   │
│  └──────────────┘   └────────────────┘   └──────────┬──────────┘   │
│                                                        │              │
│  ┌────────────────────────────────────────────────────▼──────────┐  │
│  │ Background flush: NetInfo online → retry queue → POST /incidents│ │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                              HTTPS (TLS)
                                    │
┌───────────────────────────────────▼─────────────────────────────────┐
│                     EXPRESS BACKEND (Node.js 20)                      │
│                                                                       │
│  Helmet ▶ CORS ▶ Rate Limit ▶ requestLogger ▶ Routes                │
│                                                                       │
│  POST /api/emergency/incidents      ← Mobile SDK ingest              │
│  GET  /api/emergency/incidents      ← Dashboard list                 │
│  GET  /api/emergency/incidents/:id  ← Dashboard detail               │
│  PATCH /api/emergency/incidents/:id/status  ← Operator update       │
│  GET  /api/emergency/resources/nearest  ← Resource finder            │
│  GET  /api/admin/audit-logs         ← Immutable audit viewer         │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  incident.service  │  audit.service  │  notification.service │   │
│  │  resource.service  │  db/prisma      │                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                               PostgreSQL
                         (Supabase / Railway Postgres)
                                    │
┌───────────────────────────────────▼─────────────────────────────────┐
│                     REACT DASHBOARD (Vite / React 18)                 │
│                                                                       │
│  IncidentList  IncidentDetail  MapPanel  AuditLog                    │
│  CSV Export    Print View      Resource Markers                      │
│  Status Update (→ triggers mock push notification)                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Inventory

### Mobile SDK (`src/emergency/`)

| File | Purpose |
|------|---------|
| `EmergencyButton.tsx` | Drop-in React Native component. Captures GPS, battery, network, nearest resource. |
| `emergencyPacketService.ts` | Builds `EmergencyPacket` with all telemetry fields including push token. |
| `offlineQueueService.ts` | AsyncStorage queue. Encrypts on write, decrypts on read. Retries on connectivity. |
| `encryptionService.ts` | AES-256-GCM via Hermes `crypto.subtle`. IV-per-message, GCM authentication tag. |
| `secureStorageService.ts` | Per-device key management via `expo-secure-store` (iOS Keychain / Android Keystore). |
| `pushNotificationService.ts` | Expo push token registration; local status-change notifications. |
| `resourceFinderService.ts` | Loads and caches emergency resource dataset (offline-first). |
| `locationService.ts` | GPS with accuracy threshold and stale-location detection. |

### Backend (`server/src/`)

| File | Purpose |
|------|---------|
| `app.ts` | Express factory: Helmet, CORS (env-locked), rate limiting, structured logger, error handler. |
| `config/env.ts` | Zod env validation at startup — fails fast on missing vars. |
| `middleware/requestLogger.ts` | UUID request ID, structured JSON log line per response. |
| `middleware/errorHandler.ts` | Central error handler — no stack traces in production. |
| `middleware/rateLimit.ts` | Tiered: strict (auth), moderate (incident create), generous (dashboard). |
| `validation/incident.schema.ts` | Zod schema: validates + sanitizes all POST/PATCH incident body fields. |
| `validation/admin.schema.ts` | Zod schema: admin query params. |
| `validation/resource.schema.ts` | Zod schema: resource query params including lat/lng bounds. |
| `services/incident.service.ts` | Prisma CRUD + audit events + push notification trigger. |
| `services/audit.service.ts` | Append-only audit log writes and paginated reads. |
| `services/notification.service.ts` | Mock push notification (logs only). Ready for Expo Push API. |
| `services/resource.service.ts` | Resource queries with Haversine distance sorting. |

### Dashboard (`dashboard/src/`)

| File | Purpose |
|------|---------|
| `App.tsx` | Root — polling, incident list, resource loading, backend status. |
| `components/MapPanel.tsx` | MapLibre GL JS map with incident pins and resource markers. |
| `components/IncidentDetail.tsx` | Status update, assignment, notes, status history, push confirm banner. |
| `components/AuditLog.tsx` | Paginated, filterable audit log viewer. |

---

## Data Model (Prisma)

```
EmergencyIncident
  serverIncidentId  String    @id @default(cuid())
  incidentType      String
  latitude          Float
  longitude         Float
  accuracy          Float
  batteryLevel      Float?
  signalStatus      String
  additionalNotes   String
  status            IncidentStatus
  pushToken         String?
  createdAt         DateTime
  updatedAt         DateTime
  nearestResource   EmergencyResource?  (FK, nullable)
  statusHistory     StatusHistoryEntry[]
  auditLogs         AuditLog[]

EmergencyResource
  id              String @id
  name            String @unique
  type            String
  phone           String
  county          String
  latitude        Float
  longitude       Float
  address         String?
  agency          String?
  jurisdiction    String?
  resourceCategory String?

AuditLog
  id          String    @id @default(cuid())
  action      String
  entityType  String?
  entityId    String?
  ipAddress   String?
  userAgent   String?
  metadata    Json?
  createdAt   DateTime  (immutable — no updatedAt)
```

---

## Offline Queue Protocol

1. **Trigger:** User taps EmergencyButton. GPS, battery, network metadata captured.
2. **Build:** `buildEmergencyPacket()` assembles typed packet with UUID, timestamp, push token.
3. **Persist:** `persistQueue()` calls `encryptString(JSON.stringify(packets))` → AES-256-GCM envelope → `AsyncStorage.setItem`.
4. **Retry:** `NetInfo` event fires when connectivity returns → `flushQueue(sendFn)` → deduplicates by packet UUID → attempts HTTP POST → removes sent packets.
5. **Failure:** If POST fails, packet stays in queue with incremented `retryCount`. Exponential backoff: `min(retryCount * 2000, 30000)` ms.
6. **Migration:** Legacy plain-JSON queue is detected and re-encrypted on first read.

**What offline queuing does NOT provide:**
- Guaranteed delivery if the device is destroyed, lost, or never regains connectivity
- Real-time location tracking or position updates
- SMS fallback (SMS service is a separate opt-in capability, not used by the queue)

---

## Security Architecture

See [SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md) for full details.

**Summary:**
- AES-256-GCM encrypted queue with per-device key in OS secure storage
- Helmet HTTP security headers on all responses
- CORS locked to `CORS_ORIGINS` env var (whitelist-only in production)
- Zod validation + HTML sanitization on all request inputs
- Tiered rate limiting (10/30/200 req per 15 min by endpoint tier)
- Immutable append-only audit log
- No stack traces in production error responses
- No PII stored in server logs (path only, no query strings)

---

## Integration Roadmap

### Phase 3 — RapidSOS PULSE

`notification.service.ts` already has the architectural socket for real push. The `createIncident()` service path would add:

```typescript
// POST https://api.rapidsos.com/v2/incidents
// with OAuth 2.0 bearer token + incident payload mapped to PULSE schema
```

### Phase 3 — Expo Push / APNs / FCM

`pushNotificationService.ts` is structured for real token registration. Requires:
- `EAS_PROJECT_ID` set in `app.config.ts`
- APNs `.p8` key uploaded to Expo EAS
- `google-services.json` for Android FCM

### Phase 4 — NG911 / CAD

The `PATCH /incidents/:id/status` handler includes a `// Future: CAD API call` comment slot. CAD integration requires:
- Motorola PremierOne, Tyler New World, or Hexagon CAD API credentials
- ESInet routing table for Michigan PSAPs by county
- Formal data-sharing agreement with the PSAP

---

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Mobile | Expo SDK | 51 |
| Mobile JS runtime | Hermes (React Native) | 0.74.1 |
| Mobile language | TypeScript | 5.4.5 |
| Mobile crypto | WebCrypto (Hermes built-in) | — |
| Mobile secure storage | expo-secure-store | — |
| Backend language | TypeScript / Node.js | 20 LTS |
| Backend framework | Express | 4.x |
| Backend ORM | Prisma | 5.22.0 (LTS) |
| Database | PostgreSQL | 15+ |
| Dashboard | React + Vite | 18.3 / 5.x |
| Dashboard map | MapLibre GL JS | 4.7.1 |
| Input validation | Zod | 3.x |
| Security headers | Helmet | 8.x |
| Container | Docker (multi-stage) | — |
| Hosting (backend) | Railway | — |
| Hosting (dashboard) | Vercel | — |
