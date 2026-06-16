# ER Offline SDK — Deployment Guide

> **Pre-pilot system. Does not replace 911. No live dispatch integration active.**

---

## Table of Contents

1. [Local Development](#local-development)
2. [Staging Deployment](#staging-deployment)
3. [Production Deployment](#production-deployment)
4. [Database Migrations](#database-migrations)
5. [Rollback Procedures](#rollback-procedures)
6. [Environment Variable Checklist](#environment-variable-checklist)

---

## 1. Local Development

### Prerequisites

| Tool         | Version  | Install                          |
|--------------|----------|----------------------------------|
| Node.js      | 20 LTS   | https://nodejs.org               |
| npm          | 10+      | Bundled with Node                |
| PostgreSQL   | 15+      | `brew install postgresql@15`     |
| Expo CLI     | latest   | `npm install -g expo-cli`        |

### Start the backend

```bash
cd server

# 1. Install dependencies
npm install

# 2. Copy env template and fill in values
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET (min 32 chars), CORS_ORIGINS

# 3. Run Prisma migrations against your local database
npx prisma migrate dev

# 4. (Optional) Seed demo data
npx prisma db seed

# 5. Start dev server (auto-restarts on changes)
npm run dev
# → http://localhost:3001
# → http://localhost:3001/health
```

### Start the dashboard

```bash
cd dashboard

# 1. Install dependencies
npm install

# 2. Copy env template
cp .env.example .env
# VITE_API_BASE_URL is blank in dev (Vite proxies /api to localhost:3001)

# 3. Start Vite dev server
npm run dev
# → http://localhost:5173
```

### Start the mobile SDK

```bash
# From repo root
npm install

# Set runtime env vars (or add to a local .env.local):
export EXPO_PUBLIC_API_BASE_URL=http://localhost:3001
export EXPO_PUBLIC_SOURCE_APP=dev

# iOS simulator
npm run ios

# Android emulator
npm run android
```

---

## 2. Staging Deployment

### Backend — Railway (recommended)

1. Create a Railway project and link your repo.
2. Set the **Root Directory** to `server/` in Railway project settings.
3. Railway detects `server/railway.json` and uses `server/Dockerfile` automatically.
4. Add all environment variables from [§6](#environment-variable-checklist) in the Railway Variables panel.
5. Add a PostgreSQL plugin in Railway (or connect Supabase — see below).
6. Railway runs the Docker health check against `GET /health` every 30 seconds.

### Backend — Supabase (managed Postgres)

```bash
# Use the pooler URL in DATABASE_URL (for app queries)
DATABASE_URL="postgresql://postgres.[REF]:[PWD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Use the direct URL in DIRECT_URL (for Prisma Migrate only)
DIRECT_URL="postgresql://postgres:[PWD]@db.[REF].supabase.co:5432/postgres"
```

Your Supabase project: **ongpvemqwnrzdlhglols**  
Connection settings: https://supabase.com/dashboard/project/ongpvemqwnrzdlhglols/settings/database

### Dashboard — Vercel

The root `vercel.json` deploys the dashboard from `dashboard/dist` and proxies `/api/*` to the serverless handler in `api/index.ts`.

```bash
# From repo root
vercel --prod

# Or for dashboard standalone deploy (using dashboard/vercel.json):
cd dashboard
vercel --prod
```

Set these Vercel environment variables:

```
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app
VITE_MAPBOX_TOKEN=pk.eyJ1...  (optional)
```

### Mobile — Expo EAS Build

```bash
npm install -g eas-cli
eas login
eas build --profile staging --platform all
```

Staging `.env` / EAS secrets:
```
EXPO_PUBLIC_API_BASE_URL=https://your-staging-backend.up.railway.app
EXPO_PUBLIC_SOURCE_APP=staging
```

---

## 3. Production Deployment

### Pre-deployment checklist

- [ ] `NODE_ENV=production` is set on the server
- [ ] `JWT_SECRET` is a cryptographically random 32+ char string (`openssl rand -hex 32`)
- [ ] `CORS_ORIGINS` lists only your production dashboard domain(s)
- [ ] `DATABASE_URL` points to the production database (not staging)
- [ ] All Prisma migrations are applied (`prisma migrate deploy`)
- [ ] Health check endpoint returns 200 (`GET /health`)
- [ ] Rate limiting is active (verify `RateLimit-*` response headers)
- [ ] Helmet security headers are present (`X-Frame-Options`, `X-Content-Type-Options`, etc.)

### Backend — Docker production build

```bash
cd server

# Build the production Docker image
docker build -t er-offline-sdk-server:latest .

# Run locally to verify
docker run \
  -e DATABASE_URL="$DATABASE_URL" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e CORS_ORIGINS="https://dashboard.youragency.gov" \
  -e PORT=3001 \
  -e NODE_ENV=production \
  -p 3001:3001 \
  er-offline-sdk-server:latest

# Push to container registry
docker tag er-offline-sdk-server:latest your-registry.io/er-offline-sdk-server:latest
docker push your-registry.io/er-offline-sdk-server:latest
```

### Dashboard — Vercel production

```bash
cd dashboard
vercel --prod
```

### Mobile — EAS Production Build

```bash
eas build --profile production --platform all
eas submit --profile production --platform all
```

---

## 4. Database Migrations

Prisma migrations should **always** be run using the `DIRECT_URL` (not the pooler URL), because PgBouncer transaction-mode pooling does not support advisory locks required by Prisma Migrate.

### Apply pending migrations (CI/CD)

```bash
cd server

# Staging / production — apply without prompts
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy
```

### Create a new migration (development only)

```bash
cd server

# Edit prisma/schema.prisma, then:
npx prisma migrate dev --name describe_your_change
```

### Pending migration as of this release

```bash
cd server
npx prisma migrate dev --name add_push_token_and_resource_import_fields
```

### Verify schema is in sync

```bash
cd server
npx prisma migrate status
```

---

## 5. Rollback Procedures

### Server rollback

```bash
# Railway: use the "Deployments" tab → select a prior deployment → "Redeploy"

# Docker: pull a prior tag and redeploy
docker pull your-registry.io/er-offline-sdk-server:v1.2.3
```

### Database rollback

Prisma does not generate automatic down-migrations. To roll back:

1. Identify the target migration in `server/prisma/migrations/`
2. Write a SQL script that reverses the schema change
3. Apply it directly:
   ```bash
   psql "$DIRECT_URL" -f rollback_YYYYMMDD.sql
   ```
4. Delete the rolled-back migration folder from `server/prisma/migrations/`
5. Run `npx prisma migrate resolve --rolled-back MIGRATION_NAME`

### Dashboard rollback

Vercel keeps all prior deployments. Use the Vercel dashboard → Deployments → "Promote to production" on any prior deployment.

### Mobile rollback

OTA (Expo Updates):
```bash
eas update --branch production --message "Rollback to v1.2.3"
```

App store rollback requires submitting a new build with the previous version code.

---

## 6. Environment Variable Checklist

### Server (`server/.env`)

| Variable        | Required | Description                                                                   | Example                                                   |
|-----------------|----------|-------------------------------------------------------------------------------|-----------------------------------------------------------|
| `DATABASE_URL`  | ✅ Yes    | PostgreSQL connection string (pooler URL for Vercel/Railway)                 | `postgresql://user:pass@host:5432/db`                     |
| `DIRECT_URL`    | ⚠ Migrate| Direct connection URL for Prisma Migrate (bypasses PgBouncer)                | `postgresql://user:pass@host:5432/db`                     |
| `JWT_SECRET`    | ✅ Yes    | Min 32 chars. Sign with `openssl rand -hex 32`                               | `a8f3e2...` (64 hex chars)                                |
| `CORS_ORIGINS`  | ✅ Yes    | Comma-separated allowed origins                                               | `https://dashboard.agency.gov,https://preview.vercel.app` |
| `PORT`          | ✅ Yes    | HTTP port (default: 3001)                                                    | `3001`                                                    |
| `NODE_ENV`      | ✅ Yes    | `development`, `staging`, or `production`                                    | `production`                                              |

### Dashboard (`dashboard/.env`)

| Variable              | Required    | Description                                         | Example                               |
|-----------------------|-------------|-----------------------------------------------------|---------------------------------------|
| `VITE_API_BASE_URL`   | Prod only   | Backend base URL (blank = Vite proxy in dev)        | `https://api.youragency.gov`          |
| `VITE_MAPBOX_TOKEN`   | Optional    | Mapbox token for enhanced map tiles                 | `pk.eyJ1...`                          |

### Mobile (EAS secrets / `.env.local`)

| Variable                    | Required  | Description                                    | Example                               |
|-----------------------------|-----------|------------------------------------------------|---------------------------------------|
| `EXPO_PUBLIC_API_BASE_URL`  | ✅ Yes     | Backend base URL                               | `https://api.youragency.gov`          |
| `EXPO_PUBLIC_MAPBOX_TOKEN`  | Optional  | Mapbox token                                   | `pk.eyJ1...`                          |
| `EXPO_PUBLIC_SOURCE_APP`    | Optional  | Source app identifier for analytics            | `michigan-dnr-app`                    |
| `EAS_PROJECT_ID`            | Push only | Expo project ID for push notifications         | `abc12345-...`                        |

> **Security note:** Never commit `.env` files. Use `.env.example` as a template only.  
> **Push note:** `EAS_PROJECT_ID` is required to enable real Expo push notifications. Until set, push registration is skipped silently on simulators and logs a warning on real devices.
