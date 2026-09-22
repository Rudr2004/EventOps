# EventOps User Frontend

React + TypeScript + Vite SPA for the Event Manager, Operations Member, and Viewer roles of the EventOps
Intelligence Platform.

See the [repo-root README](../README.md) for the full project overview, architecture, and setup instructions
covering all three apps (this one, the backend, and the separate Admin console in `../admin-frontend`). This file
only covers what's specific to running this package on its own.

## Scripts

```bash
npm run dev       # dev server — http://localhost:5173
npm run build     # tsc -b && vite build
npm run preview   # preview the production build locally
npm run lint      # eslint
```

## Environment

Copy `.env.example` to `.env` — it points this app at the backend's API base URL (`http://localhost:3000/api/v1`
in dev). The backend must be running, and its `CORS_ORIGIN` env var must include this app's origin.

## What's here

- **Events**: list with search/status/owner/date-range filters, create/edit, and a detail page with inline
  Schedule, Tasks, Incidents, and Approval sections.
- **Calendar**: a cross-event schedule grouped by day and room.
- **Speakers**: a global directory, reused across events.
- **Tasks**: a kanban-style board across all visible events, with assignee/priority/due-date/overdue filters.
- **Incidents**: a list across all visible events, with a critical-incident banner.
- **Analytics**: aggregation-backed dashboards (Admin/Event Manager only) — event counts, workload, incident
  breakdowns, approval turnaround, room utilization/conflicts, and event health scores.

Role-based data scoping (an Event Manager only ever sees their own events and the tasks/incidents on them; an
Operations Member only sees what's assigned to them) is enforced by the backend API, not by hiding UI here — this
frontend's conditional rendering only ever mirrors what the API already allows or blocks.
