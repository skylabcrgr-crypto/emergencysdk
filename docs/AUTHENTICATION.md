# Authentication

Authentication for the Emergency SDK dashboard + backend is **flag-gated** so the
public demo keeps working while production can enforce full login.

## Two coordinated flags

| Layer | Flag | Demo value | Secure value |
|-------|------|-----------|--------------|
| Backend (`server`) | `AUTH_ENABLED` | `false` | `true` |
| Dashboard (`dashboard`) | `VITE_DEMO_MODE` | `true` | `false` |

- **Demo** (`AUTH_ENABLED=false` + `VITE_DEMO_MODE=true`): the API attaches `req.user`
  when a valid token is present but **never rejects** unauthenticated requests, and the
  dashboard loads straight into the Operations console. A "Staff sign-in" button is still
  available in the header for testing the login flow.
- **Secure** (`AUTH_ENABLED=true` + `VITE_DEMO_MODE=false`): the API enforces
  `requireAuth`/`requireRole` on protected routes and the dashboard requires login.

> Always change the two flags together. Enabling `AUTH_ENABLED=true` while leaving the
> dashboard in demo mode would let the UI load but every API call would 401.

## Roles

`mobile | operator | admin | viewer | agency_partner`

- `operator`, `admin` — full operations access (view/update incidents).
- `viewer`, `agency_partner` — read-oriented dashboard access.
- `admin` — additionally sees **Admin Users** and can manage accounts.
- `mobile` — used by the mobile SDK, not a dashboard role.

## Token handling

- On login the backend returns `{ token, user }`. The dashboard stores the JWT in
  `sessionStorage` (clears on tab close).
- Every request sends `Authorization: Bearer <token>`. A `401` anywhere clears the token
  and routes the user back to login (`onUnauthorized` subscription in `api.ts`).
- **TODO (production):** move the token to an `httpOnly`, `Secure`, `SameSite` cookie set
  by the backend to mitigate XSS token theft, and add short-lived access tokens + refresh
  tokens.

## Login hardening

- **Account lockout:** after `MAX_LOGIN_ATTEMPTS` (default 5) failed logins the account is
  locked for `LOCKOUT_MINUTES` (default 15). Locked logins return `423 ACCOUNT_LOCKED`.
- **No user enumeration:** login always returns a generic "Invalid email or password."
  message; the dashboard maps error codes to generic copy.
- Successful login resets the failure counter and sets `lastLoginAt`.
- All attempts are audit-logged (`user_login`, `failed_login`, `account_locked`).

## Password policy

Enforced in `server/src/services/passwordPolicy.service.ts` and mirrored in the dashboard
`PasswordStrengthMeter` (`dashboard/src/auth/passwordPolicy.ts`). Keep both in sync.

- Minimum 12 characters
- Upper + lower case, a number, and a symbol
- Rejects common/guessable passwords and the email local-part
- Rejects long runs of a repeated character

## Forgot / reset password

1. `POST /api/auth/forgot-password` — always returns a generic response (no enumeration),
   creates a **hashed** reset token (SHA-256) valid for
   `PASSWORD_RESET_TOKEN_TTL_MINUTES` (default 30), invalidates any prior tokens, and
   "sends" the reset email via the mock email provider.
2. The reset URL points at `DASHBOARD_BASE_URL/reset-password?token=...`.
3. `POST /api/auth/reset-password` — looks up the token by hash, checks it is unused, not
   expired, and the account is active, validates the new password, then updates the
   password and marks the token used (in a transaction).

**Mock email:** `server/src/services/email.service.ts` logs a sanitized record (never the
token) and, in `NODE_ENV=development` only, returns a `devResetUrl` the dashboard surfaces
for local testing. Swap in SendGrid/Postmark/SES at the marked `TODO` for production.

## Change password (signed-in)

`POST /api/auth/change-password` — verifies the current password, validates the new one,
updates `passwordChangedAt`, and audit-logs `password_changed`.

## Session timeout (dashboard)

In secure mode the dashboard tracks inactivity and warns the operator at
`VITE_SESSION_WARNING_MINUTES` (default 28), signing out at
`VITE_SESSION_TIMEOUT_MINUTES` (default 30).

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | none | Sign in, returns `{ token, user }` |
| GET | `/api/auth/me` | bearer | Current user profile |
| POST | `/api/auth/logout` | bearer | Audit logout (client clears token) |
| POST | `/api/auth/change-password` | bearer | Change own password |
| POST | `/api/auth/forgot-password` | none | Request reset (generic response) |
| POST | `/api/auth/reset-password` | none | Complete reset with token |
