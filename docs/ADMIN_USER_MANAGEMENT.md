# Admin User Management

Admins manage dashboard accounts from the **Admin Users** tab (visible only to users with
the `admin` role). All endpoints live under `/api/admin/users` and require
`requireAuth + requireRole('admin')`.

## What admins can do

- **List** dashboard users (`admin`, `operator`, `viewer`, `agency_partner`).
- **Create** a user with a generated or supplied temporary password.
- **Edit** a user's name, role, and active status.
- **Deactivate / reactivate** a user (soft delete — the row is kept, `isActive=false`).
- **Reset** a user's password to a new temporary one.

`passwordHash` is never returned by any endpoint.

## Temporary passwords are shown once

When you create a user or reset a password, the API returns the temporary password **one
time** along with a warning. The dashboard shows it with a copy button and a notice that it
won't be shown again. Store it securely and share it through a trusted channel.

Supplied temporary passwords must satisfy the password policy; otherwise the API generates
a strong 16-character one.

## Last-admin protection

The system refuses to remove the last remaining active admin. Demoting, deactivating, or
deleting the final admin returns `409 LAST_ADMIN`, and the dashboard surfaces a clear
message. There is always at least one admin who can sign in.

## Soft delete

"Delete"/"Deactivate" sets `isActive=false`. Deactivated users:

- cannot sign in (login is rejected),
- are shown dimmed in the directory with a **Reactivate** action,
- keep their audit history.

`DELETE /api/admin/users/:id` and `POST /api/admin/users/:id/deactivate` are equivalent.

## Audit logging

Every admin action is recorded via the audit service:
`admin_user_created`, `admin_user_updated`, `admin_user_deactivated`,
`admin_user_reactivated`, `admin_password_reset`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/users` | List managed users |
| POST | `/api/admin/users` | Create user → `{ user, temporaryPassword, warning }` |
| PATCH | `/api/admin/users/:id` | Update name/role/isActive |
| POST | `/api/admin/users/:id/deactivate` | Soft delete |
| DELETE | `/api/admin/users/:id` | Soft delete (alias) |
| POST | `/api/admin/users/:id/reactivate` | Reactivate + clear lockout |
| POST | `/api/admin/users/:id/reset-password` | New temp password → `{ temporaryPassword, warning }` |

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `EMAIL_TAKEN` | 409 | A user with that email already exists |
| `LAST_ADMIN` | 409 | Cannot demote/deactivate the last admin |
| `WEAK_PASSWORD` | 400 | Supplied temp password fails policy |
| `NOT_FOUND` | 404 | No user with that id |
| `VALIDATION_ERROR` | 400 | Request body failed schema validation |

## Demo seed accounts

`server/prisma/seed.ts` provisions three demo accounts (idempotent upsert):

| Email | Password | Role |
|-------|----------|------|
| `admin@demo.er` | `DemoAdmin!2025` | admin |
| `operator@demo.er` | `DemoOperator!2025` | operator |
| `mobile@demo.er` | `DemoMobile!2025` | mobile |

Run with `npm run prisma:seed` in `server/`. Rotate/replace these before any real pilot.
