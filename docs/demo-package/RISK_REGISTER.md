# ER Offline SDK — Risk Register

**Version:** 0.9 (Pre-Pilot)  
**Last Updated:** June 2026  
**Owner:** [Project Lead]

Risk ratings: **Likelihood** and **Impact** rated 1–5. **Risk Score** = Likelihood × Impact.

---

## Technical Risks

| ID | Risk | Likelihood | Impact | Score | Mitigation | Owner |
|----|------|-----------|--------|-------|-----------|-------|
| T1 | Device never regains connectivity — alert not transmitted | 3 | 5 | **15** | Documented in disclaimer; user training; recommend PLB for remote operations | Mobile SDK |
| T2 | GPS coordinates inaccurate (forest canopy, indoors) | 4 | 4 | **16** | Accuracy radius included in packet; operators trained to treat as approximate | Mobile SDK |
| T3 | Battery dies before queue flushes | 3 | 4 | **12** | Low-power mode detection; battery level in packet; recommend battery thresholds in UX | Mobile SDK |
| T4 | Encryption key lost (device wipe, OS reset) | 2 | 3 | **6** | Queue is lost but user can re-submit if conditions allow; documented limitation | SecureStore |
| T5 | Database unavailable during alert submission | 2 | 4 | **8** | Offline queue stores alert; retries automatically; `DB_UNAVAILABLE` 503 response surfaced to queue | Backend |
| T6 | Rate limit triggers for active field user | 2 | 3 | **6** | 30 req/15min for incident creation — adequate for legitimate use; alert surfaced in app | Backend |
| T7 | Push notification not received (device silent, no permission) | 3 | 2 | **6** | Notification is supplementary — operators update dashboard regardless; user can poll | Mobile/Backend |
| T8 | Vite/MapLibre bundle too large for slow connections | 2 | 2 | **4** | Code splitting planned for Phase 2; current 983 kB acceptable for agency Wi-Fi | Dashboard |

---

## Security Risks

| ID | Risk | Likelihood | Impact | Score | Mitigation | Owner |
|----|------|-----------|--------|-------|-----------|-------|
| S1 | Spoofed admin header grants unauthorized dashboard access | 3 | 4 | **12** | Phase 2: JWT authentication. Pre-pilot: network-level access restriction + audit log | Backend |
| S2 | Brute force against API endpoints | 2 | 3 | **6** | Rate limiting (10 strict / 30 moderate / 200 dashboard per 15 min) | Backend |
| S3 | GPS coordinates leaked via API response | 2 | 4 | **8** | CORS locked to approved origins; no public API access; Phase 2 adds auth | Backend |
| S4 | SQL injection via incident fields | 1 | 5 | **5** | All DB access via Prisma ORM (parameterized queries). No raw SQL in app code | Backend |
| S5 | XSS via operator notes | 1 | 3 | **3** | Zod schema strips HTML tags and entities; JSON-only responses | Backend |
| S6 | Man-in-the-middle on mobile API calls | 2 | 4 | **8** | TLS 1.2+ enforced; cert pinning planned for Phase 3 | Mobile/Backend |
| S7 | Encryption key extracted from Keychain via physical forensics | 1 | 4 | **4** | Exportable key is a known limitation; Secure Enclave planned for Phase 3 | Mobile SDK |
| S8 | Stack trace disclosed in production error | 1 | 3 | **3** | errorHandler masks stack in NODE_ENV !== 'development' | Backend |
| S9 | Unauthorized access to audit logs | 2 | 3 | **6** | Admin role guard + rate limit; Phase 2 JWT enforces this properly | Backend |
| S10 | Dependency vulnerability (npm) | 3 | 3 | **9** | Dependabot / npm audit in CI pipeline recommended; no known critical CVEs at time of writing | All |

---

## Operational Risks

| ID | Risk | Likelihood | Impact | Score | Mitigation | Owner |
|----|------|-----------|--------|-------|-----------|-------|
| O1 | Participant uses app as substitute for 911 in real emergency | 3 | 5 | **15** | Mandatory disclaimer at first launch; training; supervisor monitoring; large "CALL 911 FIRST" warning in UI | Training |
| O2 | Pilot supervisor misses alert (unstaffed hours) | 3 | 4 | **12** | Operators trained that system is not 24/7 monitored; participants informed; escalation path defined | Operations |
| O3 | Accidental activation by participants | 4 | 2 | **8** | Two-tap confirmation flow in UI; false alarm flag in status options; rate-limited | UX |
| O4 | Participant privacy complaint | 2 | 4 | **8** | Privacy policy signed at onboarding; data minimization; retention limits; opt-out available | Privacy |
| O5 | FOIA request for pilot incident data | 2 | 3 | **6** | Legal review of FOIA exemptions before pilot; data retention policy in place | Legal |
| O6 | Pilot data breach | 1 | 5 | **5** | AES-256-GCM on device; TLS in transit; restricted DB access; incident response plan needed | Security |
| O7 | Supabase (third party) outage | 2 | 4 | **8** | Offline queue holds alerts; supervisor aware of service status; SLA review recommended | Infrastructure |
| O8 | Participants uninstall app during pilot | 2 | 2 | **4** | Exit interview captures reason; not a safety risk | Operations |

---

## Compliance Risks

| ID | Risk | Likelihood | Impact | Score | Mitigation | Owner |
|----|------|-----------|--------|-------|-----------|-------|
| C1 | Michigan FOIA disclosure of GPS/incident data | 2 | 3 | **6** | Legal review; retention limits; exemption analysis | Legal |
| C2 | ADA accessibility not assessed | 3 | 2 | **6** | Accessibility audit planned for Phase 2 production build | UX/Legal |
| C3 | Non-compliance with agency app store policies | 2 | 3 | **6** | TestFlight / Firebase App Distribution used for pilot (avoids public App Store) | Mobile |
| C4 | Data residency concern (Supabase AWS us-east-1) | 2 | 3 | **6** | Review agency data residency requirements; Supabase supports alternative regions | Infrastructure |

---

## Risk Tracking

| Severity | Score Range | Count |
|----------|-------------|-------|
| Critical | 15–25 | 3 (T1, T2, O1) |
| High | 9–14 | 4 (S1, T3, O2, S10) |
| Medium | 5–8 | 12 |
| Low | 1–4 | 7 |

**Critical risks require explicit mitigation confirmation before pilot launch.**

---

*This register should be reviewed at the start of each pilot phase and updated when new risks are identified.*
