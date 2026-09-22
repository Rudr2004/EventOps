# EventOps Intelligence Platform

An internal event-operations platform: teams create events, schedule sessions and speakers, route events through an
approval workflow, assign and track operational tasks, report and resolve incidents, and monitor event health through
a dashboard.

- **Backend**: NestJS + TypeScript + MongoDB (Mongoose), REST API under `/api/v1`.
- **User frontend**: React + TypeScript + Vite, TanStack Query, React Router — for Event Managers, Operations
  Members, and Viewers.
- **Admin console**: a second, standalone React + TypeScript + Vite app (`admin-frontend/`) for the Admin role —
  organization-wide user management, approvals, incidents, events, and analytics. Deliberately a separate app (own
  login page, own build, own port) rather than role-gated routes inside the User frontend — see
  [Documented deviations](#documented-deviations-from-the-literal-spec) below for why.

See [`docs/architecture.svg`](docs/architecture.svg) for a diagram of how the two frontends, the API, MongoDB, and
the still-planned Redis cache and AI summary service fit together.

## Setup

### Backend

```bash
cd backend
cp .env.example .env   # fill in MONGODB_URI and JWT secrets
npm install
npm run start:dev      # http://localhost:3000/api/v1, Swagger at /docs
```

### User frontend

```bash
cd frontend
cp .env.example .env   # points at the backend's API base URL
npm install
npm run dev             # http://localhost:5173
```

### Admin console

```bash
cd admin-frontend
cp .env.example .env   # see .env.example for how to get your first Admin login
npm install
npm run dev             # http://localhost:5174
```

The backend's `CORS_ORIGIN` env var must include both frontend origins (already set to
`http://localhost:5173,http://localhost:5174` in `backend/.env.example`). There is no registration page in the
Admin console and no account is Admin by default — see `admin-frontend/.env.example` for the one-time bootstrap
(register normally in the User app, then promote that account's role to `admin` directly in the database). Every
Admin after the first one can be promoted from the console's own Users screen.

### Tests

```bash
cd backend
npm test        # unit tests (vitest)
npm run test:e2e  # integration tests against a real MongoDB connection (uses MONGODB_URI from .env)
```

### API documentation

Swagger UI is served live at `/docs` while the backend is running. A static export of the same OpenAPI document is
committed at [`docs/openapi.json`](docs/openapi.json) for reviewers who want the API contract without starting the
server — regenerate it after changing any endpoint with:

```bash
cd backend
npm run export:openapi   # writes ../docs/openapi.json
```

## Architecture

### Domain model: references, not embedding

The suggested domain model (`User → Events → Sessions / Tasks / Incidents → Comments / Activity / Approvals`) is
implemented with **top-level collections linked by ObjectId references**, not embedded sub-documents, with one
exception (Task comments/activity, see below).

**Why references over embedding:**
- Sessions, Tasks, and Incidents all need to be **listed and filtered independently of their parent Event** — e.g.
  `GET /tasks?assignee=X&status=Y` across all events, or a global `/speakers` directory reused across many events.
  Embedding would make these queries require scanning/unwinding every Event document.
- Speakers are explicitly a **shared, reusable directory** — a real speaker profile is the same person across
  multiple events, so it cannot be an embedded array on one Event without duplicating and desynchronizing data.
- Mongo documents have a 16MB size ceiling; an Event with years of tasks/incidents/sessions embedded would risk
  hitting that ceiling in a way a reference-based design never does.

**Exception — Task comments and activity history are embedded sub-documents** on the Task itself
(`backend/src/modules/tasks/schemas/task.schema.ts`). These are always read and written together with their parent
task, never queried independently, and are naturally bounded in size (a task accumulates dozens of comments, not
millions) — embedding here avoids an unnecessary extra collection and round-trip for data that has no independent
lifecycle.

**Event status history** (`event-status-history` collection) is a separate top-level collection, not embedded on
Event, because it is genuinely independent, append-only audit data — it must survive even if events are heavily
edited, and reviewing "everything that happened across events X and Y" without loading full Event documents needs
its own collection.

### Authentication: JWT, access + refresh pair

**JWT was chosen over PASETO.** JWT has vastly more mature tooling in the Node/Nest ecosystem
(`@nestjs/jwt`, `passport-jwt`), is what most reviewers and the wider hiring market recognize, and its historical
weaknesses (algorithm-confusion attacks, `"alg": "none"`) are mitigated by explicitly configuring the HMAC algorithm
and never trusting the token header for algorithm selection — which this backend does implicitly by using
`@nestjs/jwt`'s `HS256` default and a server-only secret. PASETO's main advantage (no alg-confusion surface at all)
is a real one, but not worth the smaller ecosystem and less familiar tooling for this project's scope.

**Token expiry strategy:**
- **Access token**: 15 minutes (`JWT_ACCESS_EXPIRES_IN`), sent as `Authorization: Bearer <token>` on every request,
  validated by `JwtStrategy`. Short-lived by design — if one leaks, the exposure window is small.
- **Refresh token**: 7 days (`JWT_REFRESH_EXPIRES_IN`), used only to obtain a new access token via
  `POST /auth/refresh`. The frontend's axios client (`frontend/src/api/client.ts`) automatically retries a
  401-failed request once after a successful silent refresh.

**Logout / invalidation strategy:** the refresh token is **not** purely stateless. On login/register/refresh, the
server stores a bcrypt hash of the current refresh token on the user document (`refreshTokenHash`). `POST /auth/logout`
sets that hash to `null`, which immediately invalidates the refresh token server-side — a stolen refresh token stops
working the moment the legitimate user logs out, even though the token itself hasn't expired. Access tokens are not
individually revocable (that would require a token blacklist/allowlist, adding a lookup to every authenticated
request); the 15-minute expiry is the mitigation for that gap. This is a deliberate trade-off: full access-token
revocation would need a Redis-backed denylist checked on every request, adding latency and infrastructure for a
15-minute window of exposure that is already small.

**Never logged**: passwords, tokens, and the `refreshTokenHash`/`passwordHash` fields are marked
`select: false` in their Mongoose schemas (never returned by default queries), and the structured request-logging
interceptor (`backend/src/common/interceptors/request-logging.interceptor.ts`) logs only method, path, status code,
duration, and a correlation id — never request bodies or headers.

### Approval workflow = audited event-status transitions

The Approval workflow (`backend/src/modules/approvals`) is implemented as three specific edges of the Event
lifecycle graph (`Planning → Approval Pending`, `Approval Pending → Approved`, `Approval Pending → Planning`) that
are **deliberately excluded** from the generic `PATCH /events/:id/status` endpoint and only reachable through
`POST /events/:id/submit`, `/approve`, `/reject`. Each of those three calls goes through
`EventsService.recordTransition()`, which writes one row to the `event-status-history` collection recording actor,
timestamp, previous status, new status, and an optional comment/reason. The **same** method is used for every other
ordinary lifecycle transition (Draft→Planning, Approved→Live, Live→Completed, Completed→Archived) and the archive
action — so every status change on an Event, not just approvals, ends up in one auditable history, satisfying the
spec's general "every important state transition should be auditable" requirement with a single mechanism rather
than two parallel audit systems.

### Request correlation

Every request receives a correlation id (`x-correlation-id` header — reused if the client already sent one,
otherwise generated) via `CorrelationIdMiddleware`. `RequestLoggingInterceptor` logs one line per request
(`METHOD path status durationMs correlationId=...`), and `AllExceptionsFilter` includes the same id in both the
error log line and the JSON error response body, so a user-reported error can be traced back to its exact server
log line.

## Documented deviations from the literal spec

These were explicit, deliberate decisions, made with the project owner's sign-off, rather than the spec being
misread:

1. **Speakers are a global directory** (`GET/POST /speakers`, not nested under `/events/:id/speakers`) — a speaker
   profile is reused across multiple events, so nesting it under one event would force duplicate profiles.
2. **Events have no `DELETE` endpoint** — only `PATCH /events/:id/archive`, reachable only from `Completed` status.
   The business rule "deleting/archive operations must preserve required audit history" is easier to satisfy
   correctly with a soft-archive-only design than a real delete plus a parallel audit trail.
3. **`GET /users` is Admin + Event Manager**, not Admin-only as the literal API surface table suggests. Event
   Managers need to look up Operations Members by name to assign tasks to them; without this they'd have no way to
   populate an assignee picker. `PATCH /users/:id/role` and `PATCH /users/:id/status` remain Admin-only.
4. **Tasks require an `eventId`** to create (`POST /events/:id/tasks`) and carry an *optional* `session` reference
   on the same document, rather than being creatable directly under a session as one literal reading of "create
   tasks under an event/session" might suggest — an event-scoped task list needed to exist regardless of whether a
   task is tied to a specific session, so the event relationship is required and the session relationship is
   optional.
5. **The Admin user-management screen lives in a separate app (`admin-frontend/`), not in this frontend.** Per the
   project owner's direction, the Admin console is its own standalone React app with its own login page, nav, and
   build — not a role-gated route bundled into the User frontend. Both apps call the same backend API; the only
   difference is which roles `RolesGuard` lets through. `ProtectedRoute`'s `allowedRoles` prop in the User frontend
   is still used to gate the few User-frontend routes that are Admin/Event-Manager-only (e.g. Analytics); none of
   the currently-built User-frontend routes need a harder redirect since every role has at least read access to
   Events/Sessions/Speakers/Tasks, with write permissions enforced at the API layer and reflected in the UI via
   conditional buttons — which is not itself the authorization boundary, the API guards are.
6. **Tasks can only be assigned to a user with the Operations Member role** — enforced server-side
   (`TasksService.assertAssigneeIsOperationsMember`) on both create and reassignment, not just implied by the UI's
   assignee picker only listing Operations Members.

## Known limitations

- **Redis caching is not yet implemented.** The Analytics endpoints (`/analytics/*`) hit MongoDB aggregation
  pipelines directly on every request. The spec's cache-aside + explicit-invalidation requirement is designed for
  but not yet built — see the Redis box in `docs/architecture.svg`, shown dashed as planned.
- **Docker/Docker Compose orchestration is not yet implemented.** All three apps (backend, frontend, admin-frontend)
  currently run directly via `npm run dev`/`start:dev`, not containers.
- **No CI pipeline for the two frontend apps.** The backend has a GitHub Actions workflow (install → lint → test →
  build); the frontends do not yet have an equivalent.
- **The AI-assisted operations summary (stretch goal) is not implemented.** It was explicitly optional in the spec
  and was not prioritized.
- Access tokens cannot be individually revoked before their 15-minute expiry (see the logout/invalidation trade-off
  above) — acceptable for this project's scope, would need a Redis-backed denylist for a stricter guarantee (the
  same Redis instance planned for caching, once built, would make this cheap to add).
- List-endpoint sorting is limited to a per-endpoint whitelist of fields (documented in each controller's Swagger
  annotations) rather than arbitrary fields, to avoid sorting on unindexed data or leaking internal field names.
- Session room-conflict checks are global (a room can't be double-booked across *any* two events), which is
  correct per the spec, but there is no endpoint to *report* a conflict that already exists in the data (e.g. from
  a session cancelled after booking) beyond `GET /analytics/scheduling-conflicts` — it detects conflicts, it does
  not currently offer a one-click resolution flow.
