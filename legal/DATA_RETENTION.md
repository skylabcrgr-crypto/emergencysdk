# DATA RETENTION POLICY

**Effective Date:** June 15, 2026
**Version:** 1.0 — Pilot / Demo
**System:** Emergency Response Offline SDK ("ER SDK")

---

## 1. Purpose

This policy establishes how long emergency incident data collected by the ER SDK is retained, when it is deleted, and what rights individuals have to request deletion. Retention periods are designed to balance operational needs, legal compliance, and individual privacy rights.

---

## 2. Data Categories and Retention Periods

### 2a. Transmitted Incident Records (Server-Side)

| Data | Retention Period | Basis |
|---|---|---|
| Emergency packet (GPS, incident type, device data) | **90 days** (pilot) / **7 years** (production) | Operational response record; potential legal hold |
| Incident status history | Same as incident record | Audit trail for operator actions |
| Operator notes | Same as incident record | Part of incident record |
| Aggregated / anonymized statistics | **Indefinite** | No personal data; system improvement |

**Pilot Phase Note:** During the pilot, all incident records are stored in-memory and reset when the server restarts. No records persist beyond the server session. Production deployment must implement durable storage with the retention schedule above.

**Production Note:** In a production deployment by a Michigan state agency, the 7-year retention period aligns with standard public records requirements under the Michigan Freedom of Information Act (FOIA). Legal counsel should confirm the applicable retention schedule for the specific agency context.

### 2b. On-Device Data

| Data | Retention Period | Basis |
|---|---|---|
| Offline queue (unsent packets) | Until successfully transmitted, then deleted | Temporary transmission buffer |
| Emergency contacts | Until user manually deletes or uninstalls app | User-controlled; stored locally only |
| App logs | 30 days (device storage limits apply) | Debugging only |

### 2c. Access Logs and Audit Trails

| Data | Retention Period | Basis |
|---|---|---|
| Dashboard access logs | **1 year** (pilot) / **3 years** (production) | Security audit |
| API request logs | **30 days** (pilot) | Debugging; no personal data retained beyond this period |
| Status change history | Same as incident record | Operator accountability |

---

## 3. Deletion Procedures

### 3a. Routine Deletion
- On-device queued packets: automatically deleted upon confirmed successful transmission
- Server incident records: automatically purged at the end of the applicable retention period
- Log files: rotated and purged on the schedule above

### 3b. User-Requested Deletion
A user may request deletion of their transmitted incident records by contacting the deploying agency. Requests will be processed within **30 days**. The agency may decline deletion requests where retention is required by law (e.g., active investigation, legal hold).

### 3c. Legal Hold
Records subject to active litigation, investigation, or FOIA request are placed on legal hold and exempt from routine deletion until the hold is lifted.

### 3d. Pilot Data Disposal
At the conclusion of the pilot program, all incident records collected during the pilot will be:
1. Anonymized for statistical analysis purposes, OR
2. Permanently deleted within 30 days of pilot conclusion

The pilot conclusion procedure will be documented and signed by both parties in the Pilot Agreement.

---

## 4. Data Minimization

The System is designed to collect only data necessary for emergency response:
- No name, email address, or Social Security Number is collected
- Emergency contacts are stored on-device only and never transmitted
- Device ID is an anonymous technical identifier, not linked to personal identity

Data fields are periodically reviewed; any field not demonstrably necessary for emergency response will be removed.

---

## 5. Cross-Border Data Transfer

In the pilot phase, all data resides in the continental United States. Production deployments for Michigan state agencies must ensure data residency within the United States, consistent with applicable state data sovereignty requirements.

---

## 6. Compliance Framework

Production deployment of this system by a Michigan state agency will require compliance with:
- Michigan Freedom of Information Act (MCL 15.231 et seq.) — records requests
- Michigan Identity Theft Protection Act (MCL 445.61 et seq.) — breach notification
- Michigan Digital Infrastructure Act (as applicable)
- Applicable CJIS Security Policy requirements if incident data touches law enforcement
- NIST SP 800-53 or equivalent for federal-adjacent deployments

---

## 7. Policy Review

This policy is reviewed annually or upon material changes to the System, applicable law, or agency data governance requirements.

---

*Review by the deploying agency's Records Management Officer, Privacy Officer, and legal counsel is required before deploying this policy in a production environment.*
