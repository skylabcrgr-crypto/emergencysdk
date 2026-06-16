# ER Offline SDK — Data Retention Policy (Draft)

**Status:** DRAFT — For Legal and Records Management Review  
**Applies to:** Pre-pilot program data  
**Jurisdiction:** State of Michigan

> *This is a draft policy for review. It must be aligned with the applicable agency records retention schedule, Michigan Freedom of Information Act (FOIA) requirements, and any applicable federal regulations before pilot launch.*

---

## 1. Purpose

This policy defines the retention periods, archival procedures, and deletion schedules for all data collected by the ER Offline SDK pre-pilot system. It is intended to ensure that data is kept no longer than necessary for the stated purposes, while meeting applicable legal and administrative record-keeping obligations.

---

## 2. Data Categories and Retention Schedules

### 2.1 Emergency Incident Records

| Field | Retention Period | Basis |
|-------|-----------------|-------|
| Full incident record (all fields) | 90 days after pilot conclusion or 1 year from creation, whichever is longer | Pilot evaluation; potential administrative or legal review |
| GPS coordinates | Same as incident record | Attached to incident |
| Battery / device telemetry | Same as incident record | Attached to incident |
| `additionalNotes` (free text) | Same as incident record | Attached to incident |
| `nearestResource` snapshot | Same as incident record | Attached to incident |

If an incident is associated with an actual emergency (even in a pilot context), the agency's standard incident records retention schedule applies and may supersede this schedule.

### 2.2 Audit Logs

| Record Type | Retention Period | Basis |
|-------------|-----------------|-------|
| All AuditLog records | 1 year after pilot conclusion | Administrative accountability; FOIA |
| Access denied events | 2 years | Security record-keeping |

Audit logs are **immutable** — they cannot be modified or deleted through the application interface. Deletion may only be performed directly by a database administrator with explicit authorization from the agency Records Management Officer.

### 2.3 Push Notification Tokens

| Data | Retention Period | Basis |
|------|-----------------|-------|
| Device push token (on incident record) | Deleted 30 days after incident status reaches `resolved`, `false_alarm`, or `closed` | No further notification purpose |
| Cached push token (on device) | Cleared on app uninstall or explicit opt-out | User control |

### 2.4 Server Logs

| Log Type | Retention Period | Basis |
|----------|-----------------|-------|
| Structured request logs (JSON, stdout) | 90 days (Railway / Vercel log retention) | Operational debugging |
| Error logs (stderr) | 90 days | Operational debugging |

Server logs do not contain request body content, query string parameters, or personal identifiable information beyond IP address.

### 2.5 Device-Stored Data (Mobile)

| Data | Retention Period | Mechanism |
|------|-----------------|-----------|
| Encrypted queue | Cleared after successful transmission or explicit app data clear | AsyncStorage auto-managed |
| Resource dataset cache | Cleared on SDK version update or explicit cache clear | AsyncStorage TTL |
| Encryption key | Remains in Keychain/Keystore until app uninstall or explicit deletion | expo-secure-store |

---

## 3. Deletion Procedures

### 3.1 Automated Deletion

A scheduled database job (to be implemented before production launch) will:
- Archive incidents older than the retention window to cold storage (S3 Glacier or equivalent)
- Hard-delete archived records from the active database
- Null push token fields 30 days after incident closure

**This automated deletion job is not yet implemented in the pre-pilot system.** Deletion during the pilot period will be performed manually by the database administrator.

### 3.2 Manual Deletion (Pilot Period)

Database administrators may perform record deletion using:

```sql
-- Delete incidents older than retention window (90-day post-pilot example)
DELETE FROM "EmergencyIncident"
WHERE "createdAt" < NOW() - INTERVAL '90 days'
  AND "status" IN ('resolved', 'false_alarm', 'closed');

-- Null push tokens on closed incidents older than 30 days
UPDATE "EmergencyIncident"
SET "pushToken" = NULL
WHERE "updatedAt" < NOW() - INTERVAL '30 days'
  AND "status" IN ('resolved', 'false_alarm', 'closed')
  AND "pushToken" IS NOT NULL;
```

All manual deletions must be authorized by the agency Records Management Officer and logged separately from the application audit log.

### 3.3 End-of-Pilot Deletion

Upon conclusion of the pilot program:

1. The pilot coordinator notifies the database administrator in writing
2. All incident records are exported to a secure archive (encrypted ZIP or agency-managed system)
3. Active database records are deleted within 30 days of pilot conclusion
4. Archive is retained per the agency records retention schedule
5. A deletion certificate is issued and retained

---

## 4. Backup Retention

| Backup Type | Retention | Location |
|-------------|-----------|----------|
| Supabase automated daily backups | 7 days (Free tier) / 30 days (Pro tier) | Supabase managed |
| Manual pre-migration backups | 90 days | Agency-managed storage |

---

## 5. FOIA Considerations

Emergency incident records and audit logs collected during the pilot may be subject to FOIA disclosure requests under the Michigan Freedom of Information Act (MCL 15.231 et seq.). Before responding to any FOIA request involving pilot data, the agency should:

1. Consult with agency legal counsel
2. Review applicable FOIA exemptions (e.g., MCL 15.243 — safety of individuals)
3. Redact personal identifiers if disclosure is required and permitted by law

---

## 6. Contact

**Records Management Officer:** [Name]  
**Agency:** [Agency Name]  
**Email:** [Email]

---

*This policy is a draft. It must be reviewed by agency legal counsel, the Privacy Officer, and the Records Management Officer before pilot launch.*
