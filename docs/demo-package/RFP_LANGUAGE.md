# ER Offline SDK — RFP Language Reference

**Document Type:** Suggested Procurement Language  
**Audience:** Agency Procurement, Contracting Officers  
**Status:** DRAFT — For Procurement Office Review  
**Version:** 0.9

> *This document provides suggested statement of work and evaluation criteria language for agencies seeking to procure a production-grade mobile emergency alerting system based on or similar to the ER Offline SDK. It is not a finalized procurement document and must be reviewed by the agency contracting officer and legal counsel before use in any formal RFP.*

---

## Part 1 — Background and Purpose

[Agency Name] seeks to procure a mobile emergency alerting software development and integration solution to supplement existing emergency communication capabilities for field personnel operating in areas with intermittent or no cellular connectivity.

This procurement is for **software development and integration services**, not for emergency dispatch services. The resulting system will not replace 911 or any Public Safety Answering Point (PSAP) function.

---

## Part 2 — Scope of Work

### 2.1 Mobile SDK Requirements

The Contractor shall deliver a reusable mobile software development kit (SDK) that:

1. Integrates into existing Expo React Native (SDK 51 or current LTS) applications
2. Provides a configurable emergency alert triggering component
3. Captures GPS coordinates with accuracy and staleness metadata
4. Captures device battery level, charging state, and network connectivity status
5. Implements an offline-first packet queue that:
   a. Persists emergency packets when no network connection is available
   b. Encrypts queued packets using AES-256-GCM or equivalent authenticated encryption
   c. Stores encryption keys in the device operating system's secure hardware-backed keystore (iOS Keychain / Android Keystore)
   d. Automatically retries transmission with exponential backoff when connectivity is restored
   e. Provides deduplication to prevent duplicate incident creation on retry
6. Includes a nearest-resource finder using Haversine distance calculation against an agency-provided resource dataset
7. Supports push notification receipt for incident status updates
8. Does **not** collect user data beyond what is explicitly enumerated in the privacy policy

### 2.2 Backend API Requirements

The Contractor shall deliver a production-grade REST API that:

1. Receives, validates, and stores emergency incident packets
2. Validates all inbound data using a schema validation library (Zod, Joi, or equivalent)
3. Sanitizes all free-text input (HTML stripping, length limiting)
4. Implements tiered rate limiting by endpoint category
5. Applies HTTP security headers per OWASP recommendations (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
6. Restricts CORS to approved origin whitelist
7. Includes trust proxy configuration for deployment behind reverse proxies
8. Implements an immutable, append-only audit log for all material operator actions
9. Produces structured JSON logs compatible with common log aggregation platforms
10. Does not expose stack traces or internal error details in production error responses
11. Is containerized (Docker) with a multi-stage build and non-root runtime user
12. Supports horizontal scaling via stateless architecture

### 2.3 Operator Dashboard Requirements

The Contractor shall deliver a web-based operator dashboard that:

1. Displays incoming emergency incidents in near real-time
2. Supports filtering by incident type, status, and time range
3. Displays incident location on an interactive map with satellite and terrain tile options
4. Allows operators to update incident status with audit-logged history
5. Allows operators to add notes and assign incidents to response units
6. Displays emergency resource locations on the map
7. Supports CSV export of incident data for after-action review
8. Supports print formatting for physical records

### 2.4 Security Requirements

The Contractor shall:

1. Deliver a security architecture document describing all data-at-rest and data-in-transit protections
2. Conduct an independent penetration test (OWASP Top 10 scope minimum) prior to production launch
3. Provide a vulnerability disclosure policy and remediation SLA
4. Implement JWT-based authentication with role-based access control for dashboard access
5. Support integration with agency SSO/SAML provider (Optional — Phase 2)
6. Maintain a software bill of materials (SBOM) and address known critical CVEs within 30 days of disclosure

### 2.5 Integration Requirements

The Contractor shall provide documented integration interfaces for:

1. RapidSOS PULSE API (for forwarding incident data to PSAP as supplement to 911)
2. Motorola PremierOne CAD (or equivalent agency-standard CAD system)
3. Expo Push Notification Service / APNs / Firebase Cloud Messaging
4. Agency identity provider (SAML 2.0 or OIDC)

Production activation of these integrations requires separate agency approvals, data-sharing agreements, and PSAP coordination and is outside the scope of Phase 1.

---

## Part 3 — Technical Evaluation Criteria

| Criterion | Weight | Evaluation Method |
|-----------|--------|------------------|
| Offline queue reliability (documented test results) | 20% | Technical proposal |
| Encryption implementation (AES-256-GCM or equivalent with hardware key storage) | 15% | Code review / architecture doc |
| GPS accuracy and metadata completeness | 10% | Demo / test |
| Security posture (headers, rate limiting, input validation, auth roadmap) | 20% | Security overview doc + code review |
| Audit logging completeness | 10% | Demo |
| Integration readiness (RapidSOS, CAD, push) | 10% | Architecture doc |
| Deployment automation and containerization | 5% | Demo |
| Documentation quality | 5% | Document review |
| Past performance — comparable state/municipal emergency systems | 5% | References |

---

## Part 4 — Data Handling Requirements

1. All incident data must be stored within the United States
2. Contractor must provide a data processing agreement (DPA) and subprocessor list
3. Retention schedules must comply with Michigan State Records Management standards
4. Contractor must support data deletion requests within 30 days
5. Contractor must notify the agency within 24 hours of any confirmed or suspected data breach

---

## Part 5 — Disclaimer Language for RFP

> **This procurement is for a supplemental mobile alerting capability. The resulting system does not replace 911, does not create a duty to respond on the part of any state agency or PSAP, and does not guarantee emergency response. Respondents must clearly disclose any limitations of offline transmission, GPS accuracy, and notification delivery in their proposals.**

---

## Part 6 — Deliverables and Milestones

| Deliverable | Target Date |
|------------|-------------|
| Technical architecture document | Week 4 |
| Security architecture and threat model | Week 6 |
| Privacy Impact Assessment | Week 6 |
| Data Retention Policy | Week 6 |
| Pilot-ready SDK, backend, dashboard | Week 10 |
| Penetration test report | Week 14 |
| 90-day pilot complete | Month 6 |
| Phase 2 production deployment | Month 12 |
| CAD integration (Phase 4) | Month 18–24 |

---

*This document is a reference only. It must be reviewed and finalized by the agency contracting officer, legal counsel, and IT security before inclusion in any formal solicitation.*
