# Emergency Response Offline SDK

A reusable offline-first emergency SOS module for Michigan state outdoor apps, with a mock dispatch backend (Express + PostgreSQL/Prisma) and an agency-grade operations dashboard (Vite + React + MapLibre).

> ⚠️ **Demo system — not a replacement for 911.** No real dispatch integration is active. Pilot/evaluation use only.

## Repository layout

| Path | Description |
| --- | --- |
| `src/emergency/` | Mobile SDK (Expo / React Native) — SOS button, offline queue, resource finder |
| `server/` | Express + Prisma backend (incidents, resources, audit log) |
| `dashboard/` | Vite + React operations console with MapLibre map |
| `data/` | CSV import templates and datasets |
| `legal/` | Compliance documents |
| `docs/` | Planning docs |

## How to import Michigan emergency resources

The backend stores emergency resources (sheriff offices, Coast Guard stations, hospitals, DNR offices, marinas, etc.) in the `EmergencyResource` table. You can bulk-import them from a CSV.

### 1. Prepare a CSV

Start from the template:

```
data/michigan_emergency_resources.template.csv
```

Required columns (header row required; column order does not matter):

```
name,type,agency,county,phone,address,latitude,longitude,jurisdiction,resourceCategory
```

| Column | Required | Notes |
| --- | --- | --- |
| `name` | ✅ | Used to derive a stable slug ID (upsert key) |
| `county` | ✅ | County name |
| `latitude` / `longitude` | ✅ | Decimal degrees; validated to be finite and in range |
| `type` **or** `resourceCategory` | ✅ (one) | Mapped to a normalized resource type |
| `phone` | optional | Defaults to `N/A` if blank |
| `address`, `agency`, `jurisdiction` | optional | Stored as provenance metadata |

`resourceCategory`/`type` values such as `Sheriff Office`, `Coast Guard Station`, `Hospital`, `DNR Office`, `Marina/Harbor Master`, `Ranger Station`, `State Park Office`, and `EMS Station` are automatically normalized to the mobile SDK's resource types (`county_sheriff`, `coast_guard`, `hospital`, `dnr_post`, `marina`, `ranger_station`, `trailhead_office`, `fire_station`, …).

### 2. Run the importer

```bash
cd server

# Preview without writing to the database
npm run import:resources -- --dry-run

# Import the bundled template into the database
npm run import:resources

# Import a custom CSV (path is relative to the server/ directory)
npm run import:resources -- ../data/michigan_emergency_resources_reloaded.csv

# Dry-run a custom CSV
npm run import:resources -- --dry-run ../data/my_resources.csv
```

The script is **idempotent** — it upserts each row by a slug derived from the resource name, so re-running it updates existing records rather than duplicating them.

### 3. Review the summary

The importer prints a validation + write summary, lists any rejected rows with reasons (missing fields, invalid/out-of-range coordinates, duplicate IDs), and shows a breakdown by normalized type. A non-zero exit code is returned if any row was rejected or failed to write.

### 4. Verify via the API

Once imported, resources are served by the backend:

```bash
# All resources (optional ?type= and ?county= filters)
curl http://localhost:3001/api/emergency/resources

# Nearest resources to a coordinate (optional ?type= and ?limit=)
curl "http://localhost:3001/api/emergency/resources/nearest?lat=45.02&lng=-84.68&type=county_sheriff"
```

They also appear on the dashboard map as diamond markers (toggle + type filter in the top-right map control), and the mobile SDK will pull and cache them automatically when online.

### Mobile SDK resource sync

The mobile `resourceFinderService` is offline-first:

1. **In-memory cache** — fastest; seeded from the bundled JSON on import.
2. **Online** — `refreshResourcesFromBackend(apiBaseUrl)` fetches `/api/emergency/resources`, then caches the dataset in memory and `AsyncStorage`.
3. **Offline** — `loadResources()` restores the last `AsyncStorage`-cached dataset.
4. **Fallback** — the bundled `michiganEmergencyResources.json` is always available so the SDK works with zero connectivity and zero setup.

```ts
import { loadResources, refreshResourcesFromBackend } from './src/emergency';

await loadResources();                                   // cold start (storage → bundled)
await refreshResourcesFromBackend('http://localhost:3001'); // refresh when online
```
