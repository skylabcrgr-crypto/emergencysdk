# Deployment Verification

Steps to verify the auth + admin features locally and after deploying to
Railway (server) + Vercel (dashboard).

## Environment variables

### Server (`server/.env`, Railway variables)

| Variable | Default | Notes |
|----------|---------|-------|
| `AUTH_ENABLED` | `false` | `true` to enforce auth |
| `JWT_SECRET` | — | **required**, min 32 chars |
| `TOKEN_TTL` | `8h` | JWT lifetime |
| `DASHBOARD_BASE_URL` | `http://localhost:5173` | used in reset links |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | `30` | reset token lifetime |
| `MAX_LOGIN_ATTEMPTS` | `5` | lockout threshold |
| `LOCKOUT_MINUTES` | `15` | lockout duration |
| `DATABASE_URL` / `DIRECT_URL` | — | Postgres (pooler / direct) |
| `CORS_ORIGINS` | — | comma-separated allowed origins |

### Dashboard (`dashboard/.env`, Vercel variables)

| Variable | Default | Notes |
|----------|---------|-------|
| `VITE_API_BASE_URL` | — | Railway server origin |
| `VITE_DEMO_MODE` | `true` | `false` to require login |
| `VITE_SESSION_TIMEOUT_MINUTES` | `30` | auto sign-out |
| `VITE_SESSION_WARNING_MINUTES` | `28` | warn before sign-out |

## Database migration

The new auth columns/tables are additive and nullable. Apply with:

```bash
cd server
npx prisma generate
npx prisma db push     # adds User columns + PasswordResetToken + InviteToken
npm run prisma:seed    # optional demo accounts
```

Railway's `preDeployCommand` already runs `npx prisma db push`, so a normal deploy applies
the schema safely.

## Verify with `AUTH_ENABLED=false` (demo)

1. `AUTH_ENABLED=false` (server) and `VITE_DEMO_MODE=true` (dashboard).
2. Dashboard loads directly into Operations — no login required.
3. Incidents, map, filters, CSV export, status updates, assignment, and notes all work.
4. The header shows a **Demo** badge and a **Staff sign-in** button.
5. Clicking **Staff sign-in** → sign in with `operator@demo.er` → header shows the user.

## Verify with `AUTH_ENABLED=true` (secure)

1. `AUTH_ENABLED=true` (server) and `VITE_DEMO_MODE=false` (dashboard); redeploy both.
2. Dashboard shows the **Login** screen; unauthenticated API calls return `401`.
3. Sign in as `admin@demo.er` → Operations loads; **Admin Users** tab is visible.
4. Sign in as `operator@demo.er` → **Admin Users** tab is hidden.
5. **Lockout:** 5 wrong passwords → `423` locked message.
6. **Forgot password:** submit email → generic confirmation; in dev the `devResetUrl`
   appears; open it → set a new strong password → sign in.
7. **Admin:** create a user (temp password shown once), edit role, deactivate/reactivate,
   reset password; confirm last-admin protection blocks demoting the only admin.
8. **Session timeout:** idle past the warning threshold → warning modal → auto sign-out.

## CI / build checks

```bash
npm --prefix server run ts:check     # server typecheck
npm --prefix server test             # server unit tests
npm --prefix dashboard run ts:check  # dashboard typecheck
npm --prefix dashboard run build     # dashboard production build
```

## Production hardening TODOs

- Replace the mock email provider with SendGrid/Postmark/SES.
- Move tokens to `httpOnly` `Secure` cookies; add refresh tokens.
- Add MFA and SSO (SAML / OIDC) for agency partners.
- Centralize rate limits behind the load balancer; tune per-route limits.
- Define audit-log retention + export, and PII handling per the data retention policy.
