# ER Offline SDK — Security Overview

**Document Type:** Security Posture Summary  
**Audience:** Agency CISO, IT Security, Procurement Review  
**Version:** 0.9 (Pre-Pilot)  
**Classification:** Pre-Pilot — Internal Review

---

## Executive Summary

This document summarizes the security controls implemented in the ER Offline SDK pre-pilot system. It is intended to support agency security review, not to constitute a formal FedRAMP or NIST 800-53 compliance assessment.

The system does not currently hold a formal security certification. A full independent security audit is recommended before any production deployment involving real emergency data.

---

## 1. Mobile — Data at Rest

### Offline Queue Encryption

Emergency packets queued while offline are encrypted before storage in the device's application sandbox.

| Property | Implementation |
|----------|---------------|
| Algorithm | AES-256-GCM (authenticated encryption) |
| Key size | 256-bit |
| IV | Fresh 96-bit random IV per encryption operation |
| Authentication | GCM 128-bit authentication tag (detects tampering) |
| Crypto API | WebCrypto (`crypto.subtle`) — Hermes built-in |

### Key Management

| Property | Implementation |
|----------|---------------|
| Key generation | `crypto.subtle.generateKey` on first use |
| Key storage | `expo-secure-store` → iOS Keychain / Android Keystore |
| Key alias | `er_sdk_offline_queue_key_v1` |
| Key exportability | Exportable (stored as base64 in Keychain) |
| Scope | Per-device, per-install |

**Production TODOs (not yet implemented):**
- Hardware-bound keys via iOS Secure Enclave (non-exportable `CryptoKit` keys)
- Android StrongBox HSM binding
- Key rotation with versioned aliases and re-encryption of queue
- Enterprise MDM key rotation policy

### What Is Stored on Device

| Data | Storage | Encrypted |
|------|---------|-----------|
| Queued emergency packets | AsyncStorage | ✅ AES-256-GCM |
| Encryption key | expo-secure-store (Keychain/Keystore) | ✅ OS-managed |
| Push token | AsyncStorage | ❌ (opaque token, no PII) |
| Resource dataset cache | AsyncStorage | ❌ (public data) |

---

## 2. Mobile — Data in Transit

| Property | Implementation |
|----------|---------------|
| Transport | HTTPS / TLS 1.2+ |
| Certificate validation | Default Expo / React Native NSURLSession / OkHttp |
| Certificate pinning | ❌ Not implemented in pre-pilot |

**Production TODO:** Certificate pinning for production API endpoints.

---

## 3. Backend — HTTP Security Headers

Helmet v8 applies the following headers to all responses:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` |
| `Content-Security-Policy` | Helmet default (strict API) |
| `X-DNS-Prefetch-Control` | `off` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | (Helmet default) |
| `X-Powered-By` | **Removed** by Helmet |

---

## 4. Backend — CORS

In pre-pilot (development), CORS is open to localhost.  
In staging/production, CORS is **locked to `CORS_ORIGINS` env var** (whitelist-only):

```typescript
const configuredOrigins = env.CORS_ORIGINS.split(',').map(o => o.trim());
// + localhost:5173 / localhost:8081 in development only
```

No wildcard (`*`) origins are permitted in staging or production.

---

## 5. Backend — Rate Limiting

| Tier | Endpoint(s) | Limit | Window |
|------|------------|-------|--------|
| Strict | Future auth routes (`/api/auth/*`) | 10 req/IP | 15 min |
| Moderate | `POST /api/emergency/incidents` | 30 req/IP | 15 min |
| Dashboard | All `GET /api/emergency/*` and `GET /api/admin/*` | 200 req/IP | 15 min |

Rate limit headers follow IETF `draft-polli-ratelimit-headers-07`.  
`trust proxy: 1` is set so Railway/Vercel proxy IPs are peeled correctly.

---

## 6. Backend — Input Validation and Sanitization

All inbound data is validated with **Zod** before reaching service layer code.

| Input Type | Validation |
|-----------|-----------|
| POST body (incident create) | `createIncidentSchema` — all fields typed and bounded |
| PATCH body (status update) | `updateStatusSchema` — status must be valid enum value |
| Operator notes | HTML tag stripping, HTML entity stripping, whitespace normalization, 500-char max |
| Query parameters (all routes) | Zod coercion and bounds (lat/lng -90/90, -180/180; limit 1–50; page ≥ 1) |
| `incidentType`, `incidentId` | Max length bounds; no shell injection surface (ORM parameterized queries) |

**SQL injection:** Not applicable — all database access is through Prisma ORM with parameterized queries. No raw SQL in application code.

**XSS:** Server only returns JSON. No server-side HTML rendering.

---

## 7. Backend — Audit Logging

All material operator actions produce an immutable `AuditLog` record in PostgreSQL.

| Property | Implementation |
|----------|---------------|
| Storage | PostgreSQL — Prisma-managed |
| Immutability | Schema has no `updatedAt` field; no UPDATE/DELETE routes exist |
| Content | action, entityType, entityId, ipAddress, userAgent, metadata (JSON) |
| Access | Read-only via `GET /api/admin/audit-logs` (requires admin role header) |

Logged events include: incident creation, incident view, status changes, assignment changes, note additions, access denied events.

---

## 8. Backend — Error Responses

In `production` and `staging` environments (`NODE_ENV !== 'development'`), 5xx error responses return only:

```json
{ "success": false, "error": "Internal server error", "timestamp": "...", "requestId": "..." }
```

Stack traces and internal error messages are **never** included in production error responses. Full error details are written to `stderr` (structured JSON) for ops team log aggregation.

---

## 9. Backend — Environment Configuration

Sensitive configuration is validated at startup using Zod (`server/src/config/env.ts`). The server **process exits** with a diagnostic message if any required variable is missing or invalid. This prevents misconfigured deployments from silently operating with insecure defaults.

---

## 10. Authentication Status

**Current state (pre-pilot):** The admin role is enforced by a simple `x-operator-role: admin` header check. This is **not production-grade authentication**.

**Phase 2 plan:** JWT authentication with:
- RS256 asymmetric signing (not HMAC shared secret)
- Short-lived access tokens (15 min)
- Refresh token rotation
- Role claims: `operator`, `supervisor`, `admin`, `readonly`
- `JWT_SECRET` / key pair stored in secrets manager (Railway Variables / AWS Secrets Manager)

---

## 11. Known Pre-Pilot Limitations

| Limitation | Risk | Mitigation Plan |
|-----------|------|-----------------|
| No JWT auth | Admin header is spoofable | Phase 2 — JWT + RBAC |
| No certificate pinning | MITM possible on compromised networks | Production hardening |
| Exportable encryption keys | Key extractable from Keychain via forensics | Phase 3 — Secure Enclave |
| Mock push notifications | No real device notification | Phase 3 — EAS/APNs/FCM |
| No penetration test | Unknown surface vulnerabilities | Recommend before production |
| No FedRAMP/SOC2 | Not suitable for covered data classes | External audit required |

---

## 12. Recommended Pre-Production Security Steps

- [ ] Independent penetration test (OWASP Top 10 scope minimum)
- [ ] Formal threat model (STRIDE or similar)
- [ ] Implement JWT authentication (Phase 2)
- [ ] Implement certificate pinning on mobile
- [ ] Upgrade to hardware-bound encryption keys (Secure Enclave / StrongBox)
- [ ] Configure WAF (Cloudflare, AWS WAF, or equivalent) in front of API
- [ ] Enable database encryption at rest (Supabase does this by default)
- [ ] Implement secrets rotation policy for `JWT_SECRET` and database credentials
- [ ] Conduct Privacy Impact Assessment (PIA) with agency privacy officer
- [ ] Review against NIST SP 800-53 controls applicable to the data classification
