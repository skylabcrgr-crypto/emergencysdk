# PRIVACY POLICY

**Effective Date:** June 15, 2026
**Version:** 1.0 — Pilot / Demo
**System:** Emergency Response Offline SDK ("ER SDK")
**Operator:** [Deploying Agency — to be completed at production launch]

---

## 1. Overview

This Privacy Policy describes what information the Emergency Response Offline SDK ("the System") collects, how it is used, how long it is retained, and what rights you have regarding your data.

**The System collects data for a single purpose: facilitating emergency response when cellular voice is unavailable.** Data is never sold, rented, or used for advertising.

---

## 2. Data We Collect

When you activate the SOS function, the System collects and transmits the following data:

### 2a. Location Data
| Field | Description |
|---|---|
| Latitude / Longitude | GPS coordinates at time of SOS activation |
| Accuracy | Estimated GPS accuracy radius in meters |
| Altitude | Device altitude if available |
| Timestamp | Date and time of location fix |
| Stale Flag | Whether coordinates came from cached GPS vs. live fix |

**Location is the most sensitive data this System collects. It is used solely to direct emergency resources and is not used for any other purpose.**

### 2b. Device and Technical Data
| Field | Description |
|---|---|
| Battery Level | Percentage (0–100%) |
| Battery State | Unplugged / Charging / Full / Unknown |
| Low Power Mode | Whether device battery saver is active |
| Network Type | Wi-Fi / Cellular / None |
| Signal Status | Strong / Weak / None |
| App Version | Version of the host application |
| Device ID | Anonymous device identifier (not linked to personal identity) |

### 2c. Incident Data
| Field | Description |
|---|---|
| Incident Type | Category selected by user (medical, lost, boating, etc.) |
| Additional Notes | Free-text notes entered by user |
| Nearest Resource | Closest registered emergency resource at time of activation |
| Packet Status | Whether the packet was sent, queued, or failed |

### 2d. User Identifier
In this pilot version, the user identifier is an anonymous placeholder (`anonymous-user`). In a production deployment, this would be the authenticated account identifier provided by the deploying agency's identity system. **No name, email, or Social Security Number is collected by this System in the current pilot version.**

### 2e. Emergency Contacts (Stored Locally Only)
Emergency contact names and phone numbers entered by the user are stored **only on the user's device** using encrypted local storage. They are never transmitted to the System's servers.

---

## 3. How We Use Your Data

Your emergency packet data is used exclusively to:
1. Display the incident to agency operators on the dashboard for coordinated response
2. Enable operators to identify your location and dispatch appropriate resources
3. Provide you with confirmation that your packet was received
4. Generate aggregated, anonymized usage statistics for system improvement (pilot phase only)

---

## 4. Data Storage

**On Device:** Emergency packets that cannot be immediately transmitted are stored in encrypted local storage (AsyncStorage) on your device until connectivity is restored. Queued packets are deleted from local storage after successful transmission.

**On Server:** Transmitted packets are stored in the agency's designated server infrastructure. In the current pilot, this is a demonstration server. In production, data would be stored in the deploying agency's certified infrastructure.

**On the Dashboard:** Incident records are visible to authorized agency operators on the operations dashboard. Operators can update incident status and add notes.

---

## 5. Who Can Access Your Data

| Accessor | Access Level |
|---|---|
| Agency Operators | Full incident detail for response purposes |
| Agency Administrators | Aggregated statistics and audit logs |
| Software Vendor | Anonymized technical logs for debugging (pilot phase) |
| Third Parties | **Never** — data is not shared with, sold to, or disclosed to third parties |
| Law Enforcement | Only pursuant to a valid court order or legal process |

---

## 6. Data Security

The System implements the following security measures:
- HTTPS/TLS encryption for all data in transit
- Encrypted local storage on device for queued packets
- Access controls limiting dashboard access to authorized agency personnel
- No storage of personally identifiable information beyond what is necessary for emergency response

In the current pilot phase, the demonstration server uses in-memory storage. **Production deployment must use hardened, certified infrastructure** meeting applicable state and federal data security requirements.

---

## 7. Your Rights

Subject to applicable law, you have the right to:
- **Access:** Request a copy of your emergency packet data
- **Deletion:** Request deletion of your transmitted incident records
- **Correction:** Request correction of inaccurate data
- **Portability:** Receive your data in a machine-readable format

To exercise these rights, contact: **[Deploying Agency — Contact Information to be completed]**

---

## 8. Children's Privacy

This System is not designed for or directed at children under the age of 13. We do not knowingly collect personal information from children under 13.

---

## 9. Michigan Privacy Law Compliance

This System is designed to be operated by Michigan state agencies and complies with applicable Michigan privacy statutes including the Michigan Identity Theft Protection Act (MCL 445.61 et seq.) and applicable state data classification requirements. Production deployment will require a formal Privacy Impact Assessment (PIA) by the deploying agency.

---

## 10. Changes to This Policy

We may update this Privacy Policy as the System moves from pilot to production. Material changes will be communicated through the app or agency communication channels.

---

## 11. Contact

Privacy questions or data requests:
**[Deploying Agency Privacy Officer — Contact Information to be completed]**

---

*Review by a licensed privacy attorney and the deploying agency's Privacy Officer is required before deploying this Privacy Policy in a production environment. A formal Privacy Impact Assessment (PIA) is required for Michigan state agency deployments.*
