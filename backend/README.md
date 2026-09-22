# EventOps Backend

NestJS + TypeScript + MongoDB REST API for the EventOps Intelligence Platform.

See the [repo-root README](../README.md) for the full project overview, architecture, setup instructions covering
all three apps, and documented deviations from the spec. This file only covers what's specific to running this
package on its own.

## Scripts

```bash
npm run start:dev       # dev server with watch mode — http://localhost:3000/api/v1, Swagger at /docs
npm run build           # nest build
npm run start:prod      # run the compiled build (dist/main)
npm test                # unit tests (vitest)
npm run test:e2e        # integration tests against a real MongoDB connection (uses MONGODB_URI from .env)
npm run test:cov        # unit tests with coverage
npm run export:openapi  # regenerate ../docs/openapi.json from the live OpenAPI document
npm run lint            # eslint
npm run format          # prettier --write
```

## Environment

Copy `.env.example` to `.env` and fill in `MONGODB_URI`, the JWT secrets, and `CORS_ORIGIN` (comma-separated —
must include both frontend dev origins, `http://localhost:5173` and `http://localhost:5174`, if running both).
