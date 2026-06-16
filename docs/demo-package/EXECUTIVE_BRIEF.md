# ER Offline SDK — Executive Brief

**Prepared for:** Michigan State Agency Leadership  
**Classification:** Pre-Pilot — Draft for Review  
**Date:** June 2026  
**Version:** 0.9 (Pre-Pilot)

---

> **Important Disclaimer:** This system is a pre-pilot prototype. It does **not** replace 911, does **not** connect to any active dispatch center, CAD system, or NG911 network, and provides **no guarantee of emergency response**. It is intended for controlled pilot evaluation only.

---

## What This Is

The **ER Offline SDK** is a reusable software module that enables Michigan state agency mobile applications (DNR, MDOT, State Police, MDNR enforcement) to embed a standardized emergency alerting capability — including offline operation in dead zones common to Michigan's Upper Peninsula, remote waterways, and rural forest regions.

It is designed to function as a **data collection and queuing layer** that integrates with professional dispatch systems in a future production phase, not as a standalone emergency response system.

## The Problem It Addresses

State agency field personnel and outdoor recreationists regularly operate in areas with no cellular coverage. When an emergency occurs in these zones, there is no reliable mechanism for them to:

- Alert dispatchers of their location
- Queue an alert for transmission when signal returns
- Surface GPS coordinates, battery status, and incident type in a structured format

Existing solutions require continuous connectivity or rely on personal satellite communicators (SPOT, Garmin inReach) that are neither integrated with state systems nor accessible on civilian smartphones.

## What the System Does

| Capability | Status |
|---|---|
| Embeds in existing Expo React Native state apps | ✅ Implemented |
| Captures GPS coordinates with accuracy metadata | ✅ Implemented |
| Captures battery level and charging state | ✅ Implemented |
| Detects offline/online status | ✅ Implemented |
| Queues emergency packets when offline | ✅ Implemented |
| Encrypts queued packets (AES-256-GCM) in device storage | ✅ Implemented |
| Retries transmission when connectivity returns | ✅ Implemented |
| Sends to a structured backend with operator dashboard | ✅ Implemented (pre-pilot) |
| Surfaces nearest emergency resources by type and distance | ✅ Implemented |
| Immutable audit log of all operator actions | ✅ Implemented |
| Push notification on incident status change | ✅ Implemented (mock) |
| Live 911 / PSAP dispatch integration | ❌ Not active — Phase 3 |
| RapidSOS PULSE integration | ❌ Not active — Phase 3 |
| CAD system integration (Motorola, Tyler, Hexagon) | ❌ Not active — Phase 3 |
| NG911 / ESInet routing | ❌ Not active — Phase 4 |

## The Pilot Proposal

We are requesting a **90-day controlled pilot** with one or two Michigan state agencies and a defined set of field personnel. The pilot would:

1. Integrate the SDK into one existing state app (or a dedicated pilot app)
2. Deploy to 20–50 field personnel in defined geographic zones
3. Capture structured incident data routed to agency supervisors (not 911)
4. Measure reliability, usability, battery impact, and offline queue performance
5. Identify integration requirements for CAD/dispatch systems

**Pilot does not require any changes to existing 911 or dispatch workflows.**

## Integration Roadmap

```
Phase 1 (Complete):  SDK + Encrypted Queue + Operator Dashboard + Resource Matching
Phase 2 (6 months):  JWT Authentication + Role-Based Access Control + Agency Multi-tenancy
Phase 3 (12 months): RapidSOS PULSE Integration + Real Push Notifications via APNs/FCM
Phase 4 (18 months): NG911 ESInet Routing + CAD Integration + Guaranteed Delivery Protocol
```

## Contact

**Project Lead:** [Name]  
**Agency:** [Agency Name]  
**Email:** [Email]  
**GitHub:** `production-hardening` branch — internal review only
