# ER Offline SDK — 90-Day Pilot Proposal

**Prepared by:** [Project Lead Name]  
**Submitted to:** [Agency Name] — [Division/Unit]  
**Date:** June 2026  
**Pilot Duration:** 90 days  
**Status:** Proposal — Pending Agency Approval

---

## 1. Pilot Objective

To evaluate the ER Offline SDK in a real-world, low-risk operational context with Michigan state agency field personnel, and to produce a structured dataset informing a decision on whether to proceed to a Phase 2 production integration.

### Specific Success Metrics

| Metric | Target |
|--------|--------|
| Offline queue transmission success rate (when connectivity returns) | ≥ 95% |
| End-to-end latency from signal return to operator receipt | ≤ 10 seconds |
| GPS accuracy for alerts transmitted in the field | ≤ 25m CEP |
| Battery impact (background processes) | ≤ 2% per hour |
| Participant usability rating | ≥ 4.0/5.0 (exit survey) |
| False alarm rate (accidental activations) | ≤ 5% of total alerts |
| Zero production incidents (data loss, unauthorized disclosure) | Required |

---

## 2. Scope

### 2.1 Included in Pilot

- Integration into one existing state agency mobile app (or a dedicated pilot app)
- Up to 50 field personnel enrolled as pilot participants
- Defined geographic zones (Michigan UP, MDNR designated recreation areas, or equivalent)
- Backend operator dashboard staffed by designated pilot supervisors during business hours
- All alerts routed to pilot supervisors — **not to 911 or any dispatch center**
- Structured data collection for post-pilot analysis

### 2.2 Excluded from Pilot

- Live 911 dispatch routing (Phase 3)
- Integration with agency CAD systems (Phase 4)
- Public-facing app deployment
- Use in actual life-threatening emergencies as a primary alert method
- Any scenario where pilot participants are told this replaces 911

---

## 3. Pilot Phases

### Week 1–2: Setup and Onboarding

- [ ] Agency IT approves backend deployment environment
- [ ] Privacy Officer approves Privacy Policy draft
- [ ] Records Management Officer approves Data Retention Policy
- [ ] Legal counsel approves Emergency Disclaimer language
- [ ] Agency security team reviews Security Overview
- [ ] Backend deployed to staging environment
- [ ] Dashboard deployed and access provisioned for pilot supervisors
- [ ] Prisma migration applied to staging database
- [ ] Participant onboarding training delivered (1-hour session)
- [ ] Participants sign informed consent form (acknowledging emergency disclaimer)
- [ ] Pilot app distributed via TestFlight (iOS) / Firebase App Distribution (Android)

### Week 3–6: Active Pilot — Phase A (Limited)

- [ ] 10–15 volunteer participants in low-risk settings (parks, offices, parking lots)
- [ ] Weekly check-in calls with pilot supervisors
- [ ] Bug reports triaged and hotfixes deployed
- [ ] GPS accuracy and battery impact data collected passively

### Week 7–10: Active Pilot — Phase B (Field)

- [ ] Expand to full cohort (up to 50)
- [ ] Real field deployments during routine work activities
- [ ] Simulated emergency drill (scheduled, non-911, supervisor-only response)
- [ ] Offline queue behavior tested in known dead zones

### Week 11–12: Wind-Down and Analysis

- [ ] Participant exit surveys
- [ ] Data export and analysis
- [ ] Identification of integration requirements for Phase 2
- [ ] After-action report drafted

### Week 13 (Buffer): Report and Decision

- [ ] Final pilot report delivered to agency leadership
- [ ] Go/no-go decision for Phase 2 (production hardening + CAD integration planning)

---

## 4. Resource Requirements

### 4.1 Agency Commitments

| Resource | Hours/Duration | Notes |
|----------|---------------|-------|
| IT security review | 8–16 hours | One-time |
| Privacy/legal review | 4–8 hours | One-time |
| Pilot supervisor time | 2 hrs/week × 12 weeks | Reviewing dashboard during business hours |
| Participant onboarding | 1 hr/participant | One-time |
| IT infrastructure support | 4 hrs/week | App distribution, helpdesk |

### 4.2 Project Team Commitments

| Resource | Scope |
|----------|-------|
| Backend deployment and maintenance | Included |
| Dashboard updates during pilot | Included |
| Bug fixes and patches | Included |
| Weekly status reporting | Included |
| Final pilot report | Included |

---

## 5. Risk Summary

See [RISK_REGISTER.md](RISK_REGISTER.md) for the full risk register.

**Top risks:**
1. Participants may use the app as a substitute for 911 in a real emergency — **Mitigation:** Mandatory disclaimer at first launch; training; supervisor monitoring
2. Connectivity restoration not guaranteed — **Mitigation:** Documented in disclaimer; pilot supervisors aware
3. Privacy breach of GPS/incident data — **Mitigation:** AES-256-GCM queue encryption; restricted database access; data retention limits

---

## 6. Post-Pilot Path to Production

If the pilot meets its success metrics, the recommended next steps are:

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 2 | 6 months | JWT authentication, RBAC, multi-tenancy, penetration test |
| Phase 3 | 12 months | RapidSOS PULSE integration, real push notifications, certificate pinning |
| Phase 4 | 18 months | NG911/ESInet routing, CAD integration, formal security certification |

**Phase 2 and beyond require separate scoping, procurement, and budget approval.** This pilot proposal covers the pre-pilot phase only.

---

## 7. Approvals Required

| Approver | Role | Signature | Date |
|----------|------|-----------|------|
| [Name] | Agency IT Director | ___________ | _____ |
| [Name] | Agency Privacy Officer | ___________ | _____ |
| [Name] | Agency Legal Counsel | ___________ | _____ |
| [Name] | Records Management Officer | ___________ | _____ |
| [Name] | Field Operations Director | ___________ | _____ |
| [Name] | Project Lead | ___________ | _____ |

---

*This proposal is contingent on all approvals listed above and completion of all Week 1–2 setup tasks before participant enrollment begins.*
