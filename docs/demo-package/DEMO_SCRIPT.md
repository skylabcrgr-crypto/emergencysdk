# ER Offline SDK — Demo Script

**Version:** 1.0  
**Audience:** Agency leadership, IT/security teams, procurement officers  
**Duration:** 25–35 minutes  
**Prerequisites:** Backend running, dashboard accessible, mobile device with pilot app installed

---

## Before You Begin

- [ ] Backend is running and accessible (check `GET /health` returns 200)
- [ ] Dashboard is open at your deployment URL
- [ ] Mobile device (or iOS Simulator) has the pilot app installed
- [ ] Test incident type pre-configured: "DEMO - Boating Emergency"
- [ ] At least 3 demo incidents already in the database (run seed: `npm run prisma:seed`)
- [ ] Confirm: `DATABASE_URL` is staging — not production

**Important:** Remind the audience at the start that **this is a pre-pilot prototype** and that no alert shown in this demo is connected to any real dispatch center or 911 system.

---

## Opening Statement (2 min)

> "What you're about to see is the ER Offline SDK — a software system designed to give Michigan state agency apps the ability to send structured emergency alerts even when the user has no cell signal. 
>
> I want to be clear up front: this system does **not replace 911**. It does not connect to any PSAP or dispatch center today. What it does is create a structured, encrypted record of an emergency that can be queued locally, transmitted when signal returns, and reviewed by designated agency supervisors.
>
> Think of it as the first building block of a future integrated system — one that will eventually connect to RapidSOS and agency CAD systems in later phases."

---

## Step 1: The Mobile Experience (5–7 min)

### 1.1 Show the app in online mode

1. Open the pilot app on the device
2. Navigate to the screen containing the `EmergencyButton` component
3. Point out: **"The button knows the device is online."** (show network status indicator)
4. Show the GPS coordinates displayed (note accuracy in meters)
5. Show the battery indicator

### 1.2 Trigger a demo alert (online)

1. Press the Emergency Button
2. Walk through the confirmation dialog:
   - Incident type selection
   - Optional notes field (type: "Demo alert — do not respond")
   - Show the **EMERGENCY DISCLAIMER** prompt and tap "I understand"
3. Confirm the alert
4. Show the success confirmation screen with the returned `incidentId`

> "That alert just hit our backend, was validated, stored in the database, and the incident ID came back in under a second."

### 1.3 Demonstrate the offline queue

1. Toggle the device to **Airplane Mode**
2. Trigger a second alert — show it completes locally (no error)
3. Explain: *"This packet was just encrypted with AES-256-GCM and stored in the device's secure app storage. It will transmit the moment connectivity returns."*
4. Toggle Airplane Mode OFF
5. Watch the status indicator switch — the queued alert flushes to the server

> "That's the core capability. In the UP or on a backcountry trail with no signal — the alert is captured, encrypted, and held until signal returns."

---

## Step 2: The Operator Dashboard (10–12 min)

### 2.1 Open the dashboard

1. Navigate to the dashboard URL in the browser
2. Point out the incident list — show the two demo alerts just created

### 2.2 Incident list features

1. **Filter by status** — filter to "queued" only. Show the queued alert appears.
2. **Filter by type** — type "boating" — show filtering works
3. **Map view** — point out the incident pins on the map, clustered by region
4. Show the **resource markers** (emergency resources imported from CSV) — click one to show popup
5. **Sort and count** — note the count in the header

### 2.3 Incident detail

1. Click on the demo alert to open the detail panel
2. Walk through the fields:
   - GPS coordinates (show on the map — pin updates to selected incident)
   - Battery level and charging state
   - Network type and signal status at time of alert
   - Device and app version
   - Nearest emergency resource (pre-calculated on device)
   - `retryCount` (0 for the online alert, likely 1 for the queued one)
3. Show the status history timeline — currently shows "queued → queued"

### 2.4 Status update

1. Update the status to **"received"**
2. Add an operator note: "Reviewing. Demo only — no real response."
3. Click "Update Status"
4. Show the **green confirmation banner**: "Status → received. Push notification triggered (demo) to device."
5. Refresh the incident — show the status history now shows the transition with timestamp

> "In the Phase 3 production build, that push notification would go to the user's device via APNs or Firebase. Today it's a mock — it logs the payload but doesn't send. The architecture is ready for it."

### 2.5 Assignment

1. Assign the incident to "Supervisor - Demo"
2. Assign a unit: "Marine Unit 3"
3. Show the assignment appears in the detail view

### 2.6 CSV export

1. Click "Export CSV"
2. Open the downloaded file — show the structured columns
3. Mention: *"This gives supervisors a structured record for after-action review."*

---

## Step 3: The Audit Log (3–4 min)

1. Navigate to the Audit Log tab in the dashboard
2. Show the log entries generated by the demo:
   - `incident_created` — from the mobile POST
   - `incident_viewed` — from opening the detail
   - `incident_status_changed` — from the status update
   - `incident_assignment_changed` — from assigning the unit
3. Point out: **"These records are immutable. There is no edit or delete route in the API."**
4. Filter by `action: incident_status_changed` — show filtered view
5. Mention: *"Every action any operator takes is logged. In a future production deployment, this supports FOIA compliance, audits, and accountability."*

---

## Step 4: Security Posture (3–4 min, optional for technical audiences)

> "A few things worth calling out for your security team:"

1. **Encrypted device storage** — "Queued alerts are AES-256-GCM encrypted before being written to the device. Even if someone has physical access to the device, they can't read queued alerts without the key, which is stored in the iOS Keychain or Android Keystore."

2. **API security** — Open browser dev tools → check a response header
   - Show `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security` (set by Helmet)
   - Show `RateLimit-Remaining` header (express-rate-limit)
   - Show `X-Request-Id` header (request tracing)

3. **Input validation** — "Every field on every inbound request is validated with Zod. Operator notes have HTML stripped and are limited to 500 characters."

4. **What's not there yet** — Be transparent: "JWT authentication for the dashboard is Phase 2. Today it uses a role header — not suitable for production. Certificate pinning on mobile is Phase 3. The roadmap is documented."

---

## Step 5: Integration Roadmap (3 min)

Show the roadmap from `TECHNICAL_ARCHITECTURE.md`:

| Phase | Timeline | Key Integration |
|-------|----------|----------------|
| Phase 1 | ✅ Complete | SDK + Queue + Dashboard + Resource Matching |
| Phase 2 | 6 months | JWT Auth + RBAC + Multi-tenancy |
| Phase 3 | 12 months | RapidSOS PULSE + Real Push + Cert Pinning |
| Phase 4 | 18 months | NG911/ESInet + CAD Integration |

> "The code already has the architectural hooks for RapidSOS — the service function is stubbed and documented. What Phase 3 requires is the data-sharing agreement with RapidSOS and the PSAP coordination. The software engineering lift is defined and bounded."

---

## Closing and Q&A (5 min)

**Suggested closing:**

> "What you've seen today is a working prototype. It does what it's designed to do: capture, encrypt, queue, and transmit structured emergency data from field devices, and surface it to supervisors on a professional operator dashboard.
>
> What it doesn't do — and what we've been very deliberate about — is overclaim. It doesn't replace 911. It doesn't guarantee rescue. It doesn't pretend to be a dispatch system.
>
> What it does provide is a foundation. One that's architecturally ready for the integrations that would make it a genuine supplement to 911 — RapidSOS, CAD, NG911. And one that we believe is ready for a 90-day controlled pilot with your agency.
>
> We have a complete pilot proposal, a risk register, a privacy policy draft, and a data retention policy available for your legal and security teams. We'd welcome the opportunity to proceed to that next step."

---

## Troubleshooting During Demo

| Problem | Resolution |
|---------|-----------|
| Map doesn't load | Fallback to OpenFreeMap tiles — should load without Mapbox token |
| Alert doesn't appear on dashboard | Check backend health at `/health`; verify `DATABASE_URL` is set |
| GPS shows (0,0) | On simulator — GPS is mocked; show "staleLocation: true" flag |
| Push banner doesn't appear | Confirm backend notification mock is in place; check server logs |
| Rate limit hit | Restart server or wait 15 min; or temporarily increase limit in rateLimit.ts for demo |
