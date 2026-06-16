# FALSE ALARM POLICY

**Effective Date:** June 15, 2026
**Version:** 1.0 — Pilot / Demo
**System:** Emergency Response Offline SDK ("ER SDK")

---

> **⚠️ This system is NOT a replacement for 911.**
> **If you can call 911, call 911 FIRST.**

---

## 1. Purpose

This policy establishes user and operator responsibilities regarding false, accidental, or duplicate emergency alerts transmitted through the ER SDK. False alarms divert real emergency resources, erode trust in the system, and may have legal consequences.

---

## 2. Definition of a False Alarm

For the purposes of this policy, a false alarm is any emergency packet transmission where:
- No genuine emergency existed at the time of transmission
- The user accidentally activated the SOS function without immediate need
- The same emergency was already resolved or handled through other means (e.g., 911 was reached)
- The transmission was a test conducted outside of a designated test environment

---

## 3. Accidental Activation

If you activate the SOS function accidentally:

**Immediately:**
1. Note the Packet Reference ID displayed on your screen (e.g., `A1B2C3D4`)
2. If you have cell service, call the agency's non-emergency line to report the false alarm
3. If the dashboard operator contacts you, inform them the alert was accidental

**As soon as possible:**
- Contact the deploying agency at **[Agency Non-Emergency Contact — to be completed]** to cancel the incident
- Provide the Packet Reference ID and the approximate time of activation

**Do NOT:**
- Send a second SOS packet to "cancel" the first — this creates additional false alarms
- Assume the false alarm will be automatically cancelled — always notify the agency directly

**Design Note for Production:** Future versions of this system should include a 10-second cancellation window with a visible "Cancel Alert" button before the packet is transmitted.

---

## 4. Deliberate False Alarms

**Deliberately triggering a false emergency alert is a serious offense.**

Under Michigan law, filing a false emergency report may constitute:
- **MCL 750.411a** — Making a false report of a crime (misdemeanor or felony depending on circumstances)
- **MCL 750.207** — False report of a bomb or emergency (felony)
- Civil liability for the cost of emergency response

This System logs all packet transmissions including device identifier, timestamp, GPS coordinates, and network information. This data may be provided to law enforcement pursuant to a valid legal process.

---

## 5. Operator Response to Suspected False Alarms

Agency operators who receive a transmission that may be a false alarm should:
1. Attempt to confirm the emergency through available means (contact emergency contacts if provided)
2. Mark the incident status as `reviewing` pending confirmation
3. Document the basis for suspecting a false alarm in the operator notes field
4. Escalate to a supervisor before standing down response resources
5. Update the incident to `closed` with a clear note if confirmed false alarm
6. Report patterns of false alarms from the same device ID to the agency security officer

**Operators must never assume an alert is false without due diligence.** The cost of a missed genuine emergency exceeds the cost of investigating a false alarm.

---

## 6. Repeat False Alarms

Users who generate repeated false alarms may be:
- Contacted by the deploying agency for guidance
- Required to complete additional training before continued system access
- Suspended or removed from the System at the agency's discretion
- Referred to law enforcement in cases of deliberate misuse

---

## 7. System Testing

Authorized testing of the System (by agency staff, vendors, or developers) must be conducted using a designated test environment. **Never test the SOS function in the production environment** without prior written authorization from the agency and a pre-arranged agreement with any operators who will be monitoring.

Test packets must be clearly labeled (e.g., `additionalNotes: "TEST — DO NOT DISPATCH"`) and operators must be notified in advance.

---

## 8. Feedback Loop

The deploying agency will maintain a log of confirmed false alarms and report aggregate statistics (not individual user data) to the vendor annually for system improvement purposes, including:
- Rate of accidental activation
- Common circumstances of false alarms
- Time-to-cancellation after notification

---

*This policy should be reviewed in conjunction with the deploying agency's existing emergency communication false alarm policies and legal counsel before production deployment.*
