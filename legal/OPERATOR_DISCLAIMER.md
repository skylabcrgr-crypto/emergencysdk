# AGENCY OPERATOR DISCLAIMER AND ACKNOWLEDGMENT

**Effective Date:** June 15, 2026
**Version:** 1.0 — Pilot / Demo
**System:** Emergency Response Offline SDK ("ER SDK") — Operations Dashboard

---

## READ BEFORE ACCESSING THE DASHBOARD

This document must be read and acknowledged by every individual authorized to access the Emergency Response Offline SDK Operations Dashboard ("the Dashboard"). Access to the Dashboard implies acceptance of all terms below.

---

> **⚠️ CRITICAL NOTICE**
>
> **This system is NOT a replacement for 911.**
> **This Dashboard does NOT connect to the public safety 911 system.**
> **You are NOT a 911 dispatcher by virtue of monitoring this Dashboard.**
>
> **If you receive an incident and the victim can call 911, direct them to call 911.**

---

## 1. What This Dashboard Is

The ER SDK Dashboard is a digital incident monitoring tool that displays location-based emergency packets transmitted by mobile app users in remote or low-connectivity environments. It enables agency operators to:
- View incoming incident reports with GPS coordinates, incident type, and device data
- Update incident status (queued → reviewing → dispatched → resolved)
- Coordinate response using the provided contact information and resource data
- Maintain a status history for audit and review purposes

---

## 2. What This Dashboard Is NOT

This Dashboard is **not**:
- A 911 or E911 communications system
- A certified Public Safety Answering Point (PSAP)
- A CAD (Computer-Aided Dispatch) system
- A guaranteed real-time emergency notification system
- A system with guaranteed uptime or availability

---

## 3. Operator Responsibilities

As an authorized Dashboard operator, you are responsible for:

**3.1 Staying Attentive.** Monitor the Dashboard actively during your assigned shift. Incidents may require rapid response coordination. The Dashboard auto-refreshes every 10 seconds, but you should be present and attentive.

**3.2 Escalating Immediately.** When you receive an incident that appears to be a genuine emergency:
1. Immediately attempt to contact the victim or their emergency contacts if provided
2. Contact the appropriate law enforcement, search and rescue, or emergency management agency for the jurisdiction
3. Update the incident status to `dispatched` when resources are engaged
4. Never assume another operator has handled an incoming incident — verify

**3.3 Directing 911 First.** If contact is made with the victim and they have cellular service, direct them to call 911 immediately. This System is a fallback for when 911 is inaccessible.

**3.4 Documenting Actions.** Record all response actions in the operator notes field for each incident. Notes become part of the incident record for audit and review.

**3.5 Not Acting Beyond Authority.** Operators should not represent to victims or the public that this System guarantees emergency dispatch. Communications should be honest about the System's capabilities and limitations.

**3.6 Reporting System Failures.** If the Dashboard is unavailable, incidents are not loading, or you suspect data is missing, immediately notify your supervisor and the agency's technical contact.

---

## 4. Data Handling Obligations

By accessing the Dashboard, you acknowledge that:
- All incident data is **confidential** and may only be used for emergency response purposes
- Incident data may not be shared with unauthorized individuals, published, or discussed outside official agency channels
- You must report any suspected unauthorized access to incident data to your supervisor immediately
- Dashboard access is logged for security and audit purposes
- Your access credentials are personal and must not be shared

---

## 5. No Certification Conferred

Using this Dashboard does not make you a certified emergency dispatcher, first responder, or public safety communications officer. If your agency requires formal training or certification for emergency coordination activities, complete that training before using this System for live incidents.

---

## 6. Pilot Phase Limitations

During the pilot phase, you should be aware that:
- The backend server uses in-memory storage — incident data **will reset if the server restarts**
- GPS accuracy may be reduced for iOS Simulator users (Cupertino, CA coordinates) — the Dashboard will display an out-of-area warning
- Location data marked "stale" means the victim's device used cached GPS — actual location may differ by up to 200 meters
- The System has no SLA during the pilot — availability is best-effort

---

## 7. Limitation of Your Liability (Good Faith Action)

Operators who act in good faith, follow this protocol, and escalate appropriately to qualified emergency services are acting within the intended use of this System. This System is designed to route emergencies to qualified responders — not to make you the sole responder.

However, operators who ignore incoming incidents, fail to escalate, or deliberately mishandle incident data may be subject to agency disciplinary action.

---

## 8. Acknowledgment

By accessing the Dashboard, you confirm that:

- [ ] I have read and understood this Operator Disclaimer
- [ ] I understand this System is NOT a replacement for 911
- [ ] I will escalate all genuine emergencies to qualified emergency services
- [ ] I will handle all incident data confidentially
- [ ] I have received (or will complete) required agency orientation before handling live incidents
- [ ] I understand this System is in a pilot/demo phase with no guaranteed uptime or response capability

**Name:** ___________________________
**Agency / Department:** ___________________________
**Date:** ___________________________
**Supervisor:** ___________________________

---

*This acknowledgment should be signed and retained by the deploying agency as part of its operator onboarding record. Review by the agency's legal and HR departments is recommended before production deployment.*
