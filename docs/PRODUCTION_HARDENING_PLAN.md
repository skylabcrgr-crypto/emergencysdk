# Production Hardening Plan
## Emergency Response Offline SDK

**Branch:** `production-hardening`
**Baseline Audit Date:** June 15, 2026
**Auditor:** Engineering

---

## Baseline Audit Summary

### Repository Structure — CONFIRMED ✅

| Layer | Files | Status |
|---|---|---|
| Mobile SDK (`src/emergency/`) | 7 services, 3 components, 1 screen, 1 barrel, 1 types file | Demo-ready |
| Vercel Serverless API (`api/`) | `index.ts` → Express app | Deployed |
| Express Server (`server/src/`) | `app.ts`, `index.ts`, `routes/`, `data/`, `types.ts` | Demo-ready |
| Dashboard (`dashboard/src/`) | `App.tsx`, `api.ts`, `types.ts`, 5 components | Demo-ready |
| Bootstrap Script (`scripts/`) | `bootstrap-emergency-sdk-demo.sh` | Demo-ready |
| Legal (`legal/`) | 7 documents | Pilot-ready |
| Config | `vercel.json`, `app.json`, 3× `tsconfig.json`, 3× `package.json` | Confirmed |

### TypeScript Checks — BASELINE

| Scope | Result | Notes |
|---|---|---|
| `server/` — `tsc --noEmit` | ✅ **PASS — 0 errors** | CommonJS, ES2020, strict |
| `dashboard/` — `tsc --noEmit` | ✅ **PASS — 0 errors** | ESNext, strict, noUnusedLocals |
| Mobile SDK (root) | ⚠️ Requires Expo env | Structurally sound; types verified manually |

### Lines of Source Code

| Scope | LOC |
|---|---|
| All `.ts`/`.tsx` (src + server/src + dashboard/src + api) | **4,318** |

### npm Vulnerability Audit — BASELINE

| Scope | Result |
|---|---|
| Root (`/`) | 33 vulnerabilities — 12 high, 20 moderate, 1 low (from Expo + RN transitive deps) |
| `server/` | ✅ 0 vulnerabilities |
| `dashboard/` | Not yet audited on this branch |

> **Note:** Root vulnerabilities are in Expo/React Native transitive dependencies. Most cannot be resolved with `npm audit fix` without breaking Expo compatibility. These should be tracked and addressed when Expo SDK is upgraded.

### Known Gaps Identified in Audit

| # | Gap | Severity | Location |
|---|---|---|---|
| 1 | In-memory `Map` store — resets on every serverless cold start or server restart | 🔴 Critical | `server/src/data/incidents.store.ts` |
| 2 | No authentication on API endpoints — any client can POST or PATCH incidents | 🔴 Critical | `server/src/app.ts`, all routes |
| 3 | No authentication on dashboard — anyone with the URL can view/edit incidents | 🔴 Critical | `dashboard/src/` |
| 4 | `Math.random()` used in UUID generation — not cryptographically secure | 🟠 High | `src/emergency/services/emergencyPacketService.ts:159` |
| 5 | No rate limiting on API — vulnerable to packet flood / false alarm spam | 🟠 High | `server/src/app.ts` |
| 6 | No `helmet` HTTP security headers — missing CSP, HSTS, etc. | 🟠 High | `server/src/app.ts` |
| 7 | Offline queue stored in plain `AsyncStorage` — no encryption at rest | 🟠 High | `src/emergency/services/offlineQueueService.ts` |
| 8 | No push notification back-channel — operator ACK never surfaces to device | 🟠 High | Mobile SDK |
| 9 | `userId` is hardcoded `'anonymous-user'` — no identity link | 🟡 Medium | `emergencyPacketService.ts:67` |
| 10 | No input sanitization on `additionalNotes` text field | 🟡 Medium | `server/src/routes/emergency.routes.ts` |
| 11 | Audit log is `console.log` only — not persistent, not structured | 🟡 Medium | `server/src/routes/emergency.routes.ts:89,181` |
| 12 | CORS allows all `*.vercel.app` — should be locked to specific deployment URL in production | 🟡 Medium | `server/src/app.ts:32` |
| 13 | No RBAC on dashboard — all operators see all incidents, no role hierarchy | 🟡 Medium | `dashboard/src/` |
| 14 | Dashboard has no login — no session management | 🟡 Medium | `dashboard/src/` |
| 15 | No TLS certificate pinning on mobile | 🟡 Medium | `src/emergency/services/emergencyPacketService.ts` |
| 16 | `expo-battery ~6.0.2` — version mismatch with current Expo SDK expectations | 🟢 Low | `package.json` |
| 17 | `react-native@0.74.1` — minor patch behind (`0.74.5` expected) | 🟢 Low | `package.json` |
| 18 | No `Content-Security-Policy` header on dashboard | 🟢 Low | `dashboard/vite.config.ts` |
| 19 | `server/package.json` has duplicate `express`/`cors` relative to root — should align | 🟢 Low | `server/package.json` |

---

## Hardening TODO Checklist

> **Rules:**
> - Do NOT remove or break the existing demo flow
> - Do NOT break Expo compatibility — use `npx expo install` for Expo-managed packages
> - Each item is independently deployable — complete in any order within a section
> - Mark `[x]` when done, add PR link in notes column

---

### Section 1 — Database Persistence

Replace the in-memory `Map` store with durable persistence. The demo flow (seed incidents, POST/GET/PATCH) must continue to work identically after this change.

- [ ] **1.1** Evaluate and select database:
  - Option A: **PostgreSQL + Prisma** (recommended for Michigan state agency: structured, auditable, self-hostable)
  - Option B: **PlanetScale (MySQL)** — serverless-friendly for Vercel
  - Option C: **Supabase (PostgreSQL)** — includes auth, real-time, row-level security
  - Option D: **SQLite (Turso)** — edge-friendly, zero ops
  - _Decision required before implementing 1.2–1.5_

- [ ] **1.2** Create `server/prisma/schema.prisma` (or equivalent ORM schema) with models:
  - `Incident` — all fields from `ServerIncident` type
  - `StatusHistory` — `{ incidentId, status, operatorNote, changedAt, changedBy }`
  - `Operator` — for RBAC in Section 2

- [ ] **1.3** Replace `incidents.store.ts` with a database-backed repository module:
  - Same exported function signatures: `getAllIncidents`, `getIncidentById`, `createIncident`, `updateIncidentStatus`
  - Wrap in try/catch; return typed errors not raw DB exceptions
  - Keep 3 seed incidents as a database seed/migration script (not in-memory)

- [ ] **1.4** Add `DATABASE_URL` to `.env.example` and Vercel environment variables
  - Never commit real credentials — ensure `.env` is in `.gitignore` ✅ (already present)

- [ ] **1.5** Verify server TypeScript still passes after DB layer swap:
  - `cd server && npx tsc --noEmit`

- [ ] **1.6** Write basic integration tests for `createIncident` and `updateIncidentStatus`
  - Use `vitest` or `jest` with a test database
  - Minimum: create → fetch → update → verify status history

---

### Section 2 — Authentication / RBAC

Protect all API endpoints and the dashboard. The demo flow must remain accessible with a demo credential.

- [ ] **2.1** Select auth strategy:
  - Option A: **JWT Bearer tokens** — stateless, fits serverless, standard for mobile APIs
  - Option B: **Auth0 / Clerk** — managed, fast, supports SAML for state agency SSO
  - Option C: **Michigan state agency SSO (SAML 2.0 / OIDC)** — required for production state deployment
  - _Recommend JWT for pilot, with SAML migration path documented_

- [ ] **2.2** Create `server/src/middleware/auth.middleware.ts`:
  - Validate `Authorization: Bearer <token>` header
  - Return `401` on missing token, `403` on invalid/expired
  - Attach decoded `{ userId, role }` to `req.user`
  - Export `requireAuth` and `requireRole(role: string)` middleware

- [ ] **2.3** Apply `requireAuth` to all non-health API routes:
  - `POST /api/emergency/incidents` — require mobile SDK token (read: any valid issued token)
  - `GET /api/emergency/incidents` — require `operator` or `admin` role
  - `PATCH /api/emergency/incidents/:id/status` — require `operator` or `admin` role
  - `GET /health` — keep public ✅

- [ ] **2.4** Add RBAC roles to the `Operator` model:
  - `admin` — full access, can delete/archive incidents, manage operators
  - `operator` — view all incidents, update status, add notes
  - `viewer` — read-only access to incidents
  - `mobile` — POST only, no read access to other incidents

- [ ] **2.5** Update mobile SDK `emergencyPacketService.ts` to send auth token:
  - Replace `userId: 'anonymous-user'` with `userId` from token claims
  - Add `Authorization` header to `sendPacketToAPI()`
  - Token source: agency-issued JWT or Expo SecureStore-cached token

- [ ] **2.6** Update `EmergencyDemoScreen.tsx` to accept `authToken?: string` prop alongside `apiUrl`

- [ ] **2.7** Add a demo service account with `mobile` role for the demo flow — never breaks demo

---

### Section 3 — Incident Audit Logs

Replace `console.log` with structured, persistent audit records for every state change.

- [ ] **3.1** Create `server/src/services/auditService.ts`:
  - `logIncidentCreated(incidentId, source, ip, userId)`
  - `logStatusChanged(incidentId, fromStatus, toStatus, operatorId, note)`
  - `logIncidentViewed(incidentId, operatorId)` — for CJIS compliance in production
  - Write to database `AuditLog` table AND structured JSON logger (see 3.2)

- [ ] **3.2** Add structured logger dependency:
  - `pino` (recommended — fast, JSON output, Vercel-compatible) or `winston`
  - Replace all `console.log` in server with `logger.info/warn/error`
  - Include `requestId` on every log line (generate per-request in middleware)

- [ ] **3.3** Add `AuditLog` database model:
  - Fields: `id`, `incidentId`, `action`, `actorId`, `actorRole`, `ip`, `userAgent`, `timestamp`, `details (JSON)`
  - Separate from `StatusHistory` — audit log is immutable (no UPDATE/DELETE)

- [ ] **3.4** Expose read-only audit log endpoint (admin only):
  - `GET /api/emergency/incidents/:id/audit` — returns full audit trail for one incident

- [ ] **3.5** Display status history timeline on dashboard (already partially built in `IncidentDetail`)  
  - Add operator name/role to history entries once auth is in place

---

### Section 4 — Dashboard Hardening

Protect the operations dashboard with login, session management, and access controls.

- [ ] **4.1** Add login page to dashboard:
  - Simple JWT-based login form (`/login`)
  - Store token in `sessionStorage` (not `localStorage`) — cleared on tab close
  - Redirect unauthenticated users to `/login`
  - Route guard component wrapping all dashboard pages

- [ ] **4.2** Add `Content-Security-Policy` headers:
  - Configure in `vite.config.ts` for dev
  - Add `vercel.json` `headers` array for production
  - Minimum: `default-src 'self'`, `script-src 'self'`, `connect-src 'self' <api-domain>`

- [ ] **4.3** Add operator identity display:
  - Show logged-in operator name and role in the top bar
  - Show operator name on status change entries in incident history

- [ ] **4.4** Scope incident visibility by role (if RBAC from Section 2 is complete):
  - `admin` — all incidents
  - `operator` — assigned incidents or all incidents (agency-configurable)
  - `viewer` — read-only, no status change buttons

- [ ] **4.5** Add session timeout:
  - Auto-logout after 30 minutes of inactivity
  - Display countdown warning at 25 minutes

- [ ] **4.6** Add rate limiting to dashboard API calls:
  - Debounce manual refresh button (already has 10s auto-poll, add 5s manual cooldown)

- [ ] **4.7** Add `helmet` to Express app:
  - `npm install helmet` in `server/`
  - Add `app.use(helmet())` in `server/src/app.ts`
  - Configure `helmet.contentSecurityPolicy` for API responses

---

### Section 5 — Mobile SDK Hardening

Harden the mobile SDK for production use without breaking Expo compatibility.

- [ ] **5.1** Replace `Math.random()` UUID with `crypto.getRandomValues()`:
  - Use `expo-crypto` (Expo-managed, no native config required): `import * as Crypto from 'expo-crypto'`
  - `Crypto.randomUUID()` — available since Expo SDK 46
  - Remove the custom `generateUUID()` function in `emergencyPacketService.ts`
  - Install: `npx expo install expo-crypto`

- [ ] **5.2** Encrypt the offline queue at rest:
  - Replace `@react-native-async-storage/async-storage` for sensitive queue data with `expo-secure-store`
  - `expo-secure-store` uses iOS Keychain / Android Keystore
  - Update `offlineQueueService.ts` to use `SecureStore.setItemAsync` / `getItemAsync`
  - Note: `expo-secure-store` has a 2KB value size limit — store packet IDs in SecureStore, full packets in encrypted AsyncStorage or split across multiple keys
  - Install: `npx expo install expo-secure-store`

- [ ] **5.3** Add certificate pinning for API calls:
  - Use `@pusher/network-policy` or a custom `fetch` wrapper with certificate hash validation
  - Pin the production API certificate SHA-256 fingerprint
  - Fallback: verify `https://` scheme is enforced in `sendPacketToAPI()`

- [ ] **5.4** Replace `'anonymous-user'` userId with real identity:
  - Add `expo-auth-session` for OAuth2 / OIDC login (Michigan MiLogin integration point)
  - Store authenticated `userId` in `expo-secure-store`
  - Pass to `buildEmergencyPacket` params

- [ ] **5.5** Replace placeholder `deviceId` with real device identifier:
  - Use `expo-device` (`Device.deviceName`) + `expo-application` (`Application.androidId` / iOS `identifierForVendor`)
  - Hash the identifier before storing — do not transmit raw device identifiers
  - Install: `npx expo install expo-device expo-application`

- [ ] **5.6** Add input validation to `additionalNotes`:
  - Maximum 500 characters enforced in `EmergencyButton.tsx`
  - Strip HTML/script tags before including in packet
  - Display character count in `EmergencyDemoScreen.tsx`

- [ ] **5.7** Add background location for queued packets:
  - When a packet is queued, register a background location task to update coordinates on reconnect
  - Use `expo-task-manager` + `expo-location` background mode
  - Update `app.json` with `expo-location` background permission
  - Install: `npx expo install expo-task-manager`

- [ ] **5.8** Upgrade version mismatches (after Expo SDK upgrade):
  - `expo-battery`: `~6.0.2` → `~8.0.1`
  - `react-native`: `0.74.1` → `0.74.5`
  - Run: `npx expo install expo-battery react-native`

---

### Section 6 — Push Notifications

Add a return channel so the mobile app receives confirmation when an operator acknowledges or dispatches.

- [ ] **6.1** Add `expo-notifications` to mobile SDK:
  - Install: `npx expo install expo-notifications`
  - Create `src/emergency/services/notificationService.ts`
  - Register for push token on app launch (`Notifications.getExpoPushTokenAsync`)
  - Store push token in `expo-secure-store` alongside userId

- [ ] **6.2** Include push token in `EmergencyPacket`:
  - Add `pushToken?: string` to `EmergencyPacket` type in `emergency.types.ts`
  - Populate in `buildEmergencyPacket` from `notificationService`

- [ ] **6.3** Add push notification send capability to server:
  - Install `expo-server-sdk` in `server/`: `npm install expo-server-sdk`
  - Create `server/src/services/pushService.ts`:
    - `sendAcknowledgementPush(pushToken, incidentId, status)` — called on PATCH status change
    - Handle `DeviceNotRegistered` errors (remove stale tokens)

- [ ] **6.4** Trigger push on status change in `emergency.routes.ts`:
  - On PATCH `dispatched` → send "Help is on the way" push to packet's `pushToken`
  - On PATCH `resolved` → send "Incident resolved" push

- [ ] **6.5** Handle incoming push notifications in mobile SDK:
  - `Notifications.addNotificationReceivedListener` in `App.tsx`
  - Update `EmergencyPacket.status` to `acknowledged` in local state
  - Show status update on `EmergencyStatusCard`

- [ ] **6.6** Add `PacketStatus.acknowledged` to types (already defined as future state in `emergency.types.ts`) — wire it up

---

### Section 7 — Encryption

End-to-end data protection for packets in transit and at rest.

- [ ] **7.1** Enforce HTTPS for all API calls in production:
  - Add guard in `sendPacketToAPI()`: throw if `apiUrl` starts with `http://` and `__DEV__` is false
  - Add to `vercel.json`: force HTTPS redirect

- [ ] **7.2** Add `helmet` HSTS header:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - Configured in `server/src/app.ts` via `helmet.hsts()`

- [ ] **7.3** Implement payload signing for mobile → server:
  - Each packet includes an `HMAC-SHA256` signature of the JSON body using a shared secret
  - Server verifies signature before processing — rejects unsigned packets
  - Key rotation procedure documented

- [ ] **7.4** Encrypt `additionalNotes` field at rest in the database:
  - Use field-level encryption with AES-256-GCM
  - Key stored in environment variable, not in database

- [ ] **7.5** Add TLS client certificate option for agency-to-agency integrations:
  - Document mutual TLS (mTLS) setup for RapidSOS or CAD API integrations

---

### Section 8 — Deployment

Harden the Vercel deployment and add staging/production separation.

- [ ] **8.1** Create separate Vercel environments:
  - `main` branch → production (`emergencysdk.vercel.app`)
  - `production-hardening` and feature branches → preview deployments
  - `staging` branch → staging environment with staging DB and test API keys

- [ ] **8.2** Add environment variable management:
  - Create `.env.example` at root with all required variables documented:
    - `DATABASE_URL`
    - `JWT_SECRET`
    - `EXPO_ACCESS_TOKEN` (for push notifications)
    - `API_BASE_URL`
    - `HMAC_SECRET`
  - Populate in Vercel dashboard under Project Settings → Environment Variables

- [ ] **8.3** Add rate limiting to API:
  - Install `express-rate-limit` in `server/`: `npm install express-rate-limit`
  - Apply `rateLimit({ windowMs: 60000, max: 30 })` to POST `/incidents`
  - Apply `rateLimit({ windowMs: 60000, max: 120 })` to GET routes
  - For Vercel serverless: use `@upstash/ratelimit` with Redis for distributed rate limiting

- [ ] **8.4** Add health check monitoring:
  - Add `/health/detailed` endpoint returning DB connection status, queue depth, uptime
  - Configure Vercel Cron or external uptime monitor (UptimeRobot / BetterUptime) to ping `/health` every 5 minutes
  - Alert on failure

- [ ] **8.5** Add CI/CD pipeline:
  - Create `.github/workflows/ci.yml`:
    - On every push: `tsc --noEmit` for server + dashboard
    - On PR to `main`: run tests, check build succeeds
    - Block merge if TypeScript fails
  - Vercel auto-deploys on merge to `main` ✅ (already configured)

- [ ] **8.6** Add `Content-Security-Policy` and security headers to `vercel.json`:
  ```json
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(self)" }
      ]
    }
  ]
  ```

- [ ] **8.7** Lock CORS to specific production domain (remove `*.vercel.app` wildcard):
  - Replace regex with explicit: `https://emergencysdk.vercel.app`
  - Add agency production domain when known

- [ ] **8.8** Set up log aggregation:
  - Vercel → Vercel Log Drains → forward to Datadog / Logtail / Axiom
  - Structured `pino` JSON logs flow directly into aggregator

---

### Section 9 — Legal / Compliance Docs

Finalize all pilot documents for agency signature. See `legal/` directory.

- [ ] **9.1** `legal/PILOT_AGREEMENT.md` — fill in all `[bracketed placeholders]`:
  - `[Vendor Legal Name]` and address
  - `[Michigan State Agency Full Legal Name]`
  - `[START DATE]` / `[END DATE]`
  - `[$AMOUNT]` in limitation of liability clause
  - `[X] hours` of vendor support
  - Feedback schedule

- [ ] **9.2** `legal/PILOT_AGREEMENT.md` — complete Exhibit A, B, C:
  - Exhibit A: specific apps, user count, agency locations, geographic scope
  - Exhibit B: operator training curriculum (minimum 1 hour), support contact directory
  - Exhibit C: server location, security certifications, breach response SLA

- [ ] **9.3** `legal/PRIVACY_POLICY.md` — fill in agency Privacy Officer contact

- [ ] **9.4** `legal/TERMS_OF_USE.md` — fill in deploying agency name and contact

- [ ] **9.5** All 7 documents reviewed by:
  - [ ] Vendor legal counsel
  - [ ] Michigan Department of Attorney General or agency legal staff
  - [ ] Agency Privacy Officer (for PRIVACY_POLICY.md and DATA_RETENTION.md)
  - [ ] Agency Records Management Officer (for DATA_RETENTION.md)

- [ ] **9.6** Conduct Privacy Impact Assessment (PIA) — required for Michigan state agency deployment

- [ ] **9.7** Evaluate CJIS Security Policy compliance requirements if incident data may touch law enforcement systems

- [ ] **9.8** Verify `app.json` bundle identifiers are registered with Apple/Google under correct entity:
  - iOS: `gov.michigan.er-offline-sdk` — needs Apple Developer account under state entity
  - Android: `gov.michigan.erofflinessdk` — needs Google Play account under state entity

- [ ] **9.9** Accessibility compliance (ADA / Section 508):
  - Add `accessibilityLabel` props to all `EmergencyButton`, `EmergencyStatusCard`, `IncidentTypeSelector` touchable elements
  - Test with VoiceOver (iOS) and TalkBack (Android)
  - Dashboard: verify WCAG 2.1 AA contrast ratios on all text/background combinations

---

### Section 10 — State Agency Demo Package

Prepare materials for a formal demonstration to state IT stakeholders and agency leadership.

- [ ] **10.1** Create `docs/DEMO_SCRIPT.md` — step-by-step demo runbook:
  - Environment setup checklist (3 terminals, Expo Go install, LAN IP)
  - Scenario 1: Lost hiker — offline SOS, queue, reconnect, dashboard response
  - Scenario 2: Boating incident — online SOS, immediate dashboard receipt, dispatch
  - Scenario 3: Simulator demo — out-of-Michigan warning, stale GPS warning
  - Troubleshooting: what to do if Expo won't start, backend is down, dashboard won't load

- [ ] **10.2** Create `docs/ARCHITECTURE_OVERVIEW.md` — one-page non-technical brief:
  - What the system does (3 bullet points)
  - How it works (simple diagram)
  - What it is NOT (not 911, not production, not certified)
  - Integration roadmap (RapidSOS, CAD, NG911, satellite)

- [ ] **10.3** Create `docs/AGENCY_INTEGRATION_CHECKLIST.md` — what an agency needs to go live:
  - Infrastructure requirements
  - Staff training requirements
  - Legal review checklist
  - Security review checklist
  - Estimated timeline to production pilot

- [ ] **10.4** Produce the demo package assets:
  - [ ] One-page PDF brief (export from docs/ markdown)
  - [ ] Screen recording of demo flow (≤ 3 minutes)
  - [ ] QR code linking to Expo Go install + demo app
  - [ ] Slide deck (10 slides max): problem, solution, demo, integration path, next steps

- [ ] **10.5** Deploy a stable demo instance on Vercel:
  - Create `demo` branch → separate Vercel project at `demo.emergencysdk.vercel.app`
  - Pre-load 5–10 representative seed incidents (medical, boating, lost, fishing, hiking)
  - Seed incidents should span realistic Michigan coordinates (UP, Lower Peninsula, Straits)
  - Demo instance resets seed data daily via a Vercel Cron function

- [ ] **10.6** Identify 3 target Michigan state agencies for pilot outreach:
  - Michigan DNR (primary — parks, fishing, boating, hunting)
  - Michigan State Police (Emergency Management)
  - MDOT (roadside assist / vehicle breakdown coverage)

- [ ] **10.7** Prepare pilot pricing model / SOW template for vendor negotiations

---

## Implementation Priority Order

For the first sprint on `production-hardening`, recommended sequence:

```
1. Section 8.5 — CI/CD pipeline (GitHub Actions) — protects all future work
2. Section 1.1 — Choose database
3. Section 2.1 — Choose auth strategy
4. Section 1.2–1.5 — Implement DB layer
5. Section 2.2–2.4 — Implement auth middleware
6. Section 5.1 — Fix Math.random UUID (quick win, security-critical)
7. Section 8.3 — Rate limiting (quick win, security-critical)
8. Section 4.7 — Add helmet (quick win)
9. Section 3.1–3.3 — Structured audit logging
10. Section 6.1–6.4 — Push notifications
```

---

## Compatibility Constraints

| Constraint | Rule |
|---|---|
| Expo SDK ~51.0.0 | All new mobile packages must use `npx expo install` — never `npm install` for Expo-managed packages |
| React Native 0.74 | No New Architecture (Fabric/TurboModules) — keep `"newArchEnabled": false` in app.json |
| Vercel serverless | Server must remain stateless between requests — all state in database, no module-level singletons |
| Demo flow | The demo SOS → packet → dashboard flow must work end-to-end at all times on `main` |
| Legal docs | `legal/` files must not be deleted — they may be superseded by v2 versions but originals must be archived |

---

*Last updated: June 15, 2026 — production-hardening branch baseline*
