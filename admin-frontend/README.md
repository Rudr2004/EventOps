# EventOps Admin Console

A standalone React + TypeScript + Vite application for the Admin role of the EventOps Intelligence
Platform — organization-wide user management, the approval queue, incident oversight, an events
directory, and analytics. It is intentionally a **separate app** from the User-facing frontend
(`../frontend`), not a shared bundle: different login page, different nav, own build — both talk to
the same backend API.

## Setup

```bash
cp .env.example .env   # see .env.example for how to get your first Admin login
npm install
npm run dev             # http://localhost:5174
```

The backend (`../backend`) must be running and its `CORS_ORIGIN` env var must include this app's
origin (`http://localhost:5174` in dev — already set in `backend/.env.example`).

## Getting an Admin login

There is no registration page in this app, and no account is Admin by default — see
[`.env.example`](.env.example) for the one-time bootstrap steps (register normally in the User
app, then promote that account's role to `admin` directly in the database). Every Admin after the
first one can be promoted from this console's own **Users** screen.

## What's here

| Route | Purpose |
|---|---|
| `/` | Overview — quick links, pending-approval count, critical-incident banner |
| `/users` | List every user, change role, activate/deactivate |
| `/approvals` | Every event across the organization currently in Approval Pending |
| `/incidents` | Every incident across every event, filterable by severity/status |
| `/events` | Read-only, organization-wide event directory |
| `/analytics` | The same aggregation endpoints as the User app, unscoped (no owner restriction) |

Every action here calls the same backend endpoints an Event Manager or Operations Member would use
in the User-facing app — the only difference is which roles the backend's `RolesGuard` lets through.
There is no Admin-only backend logic beyond that guard, except:

- `PATCH /users/:id/role` and `/status` are Admin-only, and **reject changing your own account**
  (self-lockout guard) — you cannot demote or deactivate yourself, even by mistake.

## Scripts

```bash
npm run dev      # start the dev server on :5174
npm run build    # type-check + production build
npm run lint     # ESLint
npm run preview  # preview the production build locally
```
