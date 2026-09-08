# Dayline API — Milestone 0

Small Express 5 service. Only health/readiness endpoints are implemented. Account,
session, device, and preference tables are a persistence foundation, **not an
authentication implementation**. There are no login, session issuance, account,
sync, or calendar CRUD routes, and no fake authentication middleware.

## Prerequisites and commands

Use Node **22.22.0** and pnpm **9.15.x**. Dependencies are installed once by the
workspace root; do not run a separate install here. Run these from the repo root:

```sh
pnpm --filter @dayline/api db:generate
pnpm --filter @dayline/api db:migrate
pnpm --filter @dayline/api dev
pnpm --filter @dayline/api test
pnpm --filter @dayline/api typecheck
pnpm --filter @dayline/api build
pnpm --filter @dayline/api start
```

- `db:generate` generates the ignored TypeScript Prisma client into
  `apps/api/src/generated/prisma`. Run before first `dev`.
- `db:migrate` runs `prisma migrate deploy` against the configured database. It
  applies checked-in migrations; it never generates a migration or resets data.
- `build` and `typecheck` first generate the Prisma client. Generation requires
  `DATABASE_URL` to be set, but does not require a live database.
- `test` uses Vitest/Supertest and dependency-injected probes: no PostgreSQL,
  Docker, generated Prisma client, or environment file is required.
- `build` uses tsup to create `dist/server.js`. Internal `@dayline/*` packages
  (including contracts exported as TypeScript source) are bundled. Third-party
  dependencies remain external and must be available to the deployed process.
  Do not deploy the JS file alone without its production dependencies.
- Shared compiler/lint/test tooling is supplied by the workspace root. This
  package extends `../../tsconfig.base.json` (strict ES2022/NodeNext).

## Environment

Both the runtime and `prisma.config.ts` load **`calendar/.env`**, not
`calendar/apps/api/.env`, and resolve it relative to their own file location,
not the shell working directory. Runtime source (`src/`) and build (`dist/`)
have identical directory depth. Injected process environment takes precedence;
an `.env` file is optional when variables are supplied by deployment tooling.
Dotenv does not print its startup banner or loaded values.

Minimum local configuration:

```dotenv
DATABASE_URL=postgresql://dayline:dayline@localhost:5432/dayline?schema=public
PORT=3001
HOST=127.0.0.1
CORS_ORIGINS=http://localhost:8081
```

Variables are validated with Zod before the server starts:

- **`DATABASE_URL`**: required, `postgresql://` or `postgres://` URL with a host
  and database. Credentials must be URL-encoded when necessary. Use real secret
  injection and properly validated PostgreSQL TLS outside local development;
  the sample password is local-only. The adapter honors the `schema` query
  parameter (default `public`). Configure pool/timeouts with the variables below,
  not old Prisma-engine `connection_limit`/`pool_timeout` URL options.
- **`CORS_ORIGINS`**: required, comma-separated exact HTTP(S) origins, e.g.
  `http://localhost:8081,https://calendar.example.com`. Whitespace is trimmed and
  duplicates removed. No wildcards, `null`, credentials, paths, query strings,
  fragments, or trailing slashes. Include each actual browser origin explicitly.
- **`HOST`**: default `127.0.0.1`; set `0.0.0.0` inside an API container.
- **`PORT`**: integer 1–65535; default `3001`.
- **`NODE_ENV`**: `development` (default), `test`, or `production`.
- **`LOG_LEVEL`**: `fatal`, `error`, `warn`, `info` (default), `debug`, `trace`,
  or `silent`. Production should normally retain `info` or above.
- **`RATE_LIMIT_WINDOW_MS`**: 1000–3600000; default `60000`.
- **`RATE_LIMIT_MAX`**: 1–100000; default `120` per client IP per window.
- **`DB_POOL_MAX`**: 1–50; default `5` per API process.
- **`DB_TIMEOUT_MS`**: 100–30000; default `2000`. Bounds pool acquisition,
  connection, client query, server statement, and HTTP readiness wait times.
- **`SHUTDOWN_TIMEOUT_MS`**: 1000–60000; default `10000`. Hard deadline for HTTP
  draining and database cleanup; exceeding it exits with status 1.

Invalid values prevent startup. The validation helper reports offending variable
names only, never their values. The startup log is generic to avoid leaking
third-party exception details. Prisma CLI loads only `DATABASE_URL`, so client
generation/migrations do not require HTTP-specific variables.

## HTTP contract and safeguards

- `GET /health`: `200 {"status":"ok","service":"dayline-api"}`. Process liveness
  only; never queries the database.
- `GET /ready`: runs `SELECT 1` through Prisma's PostgreSQL adapter. Returns
  `200 {"status":"ready","database":"up"}`, or generic
  `503 {"status":"unavailable","database":"down"}` on failure, timeout, or
  shutdown. Concurrent requests share a single outstanding probe. Results are
  not cached. It checks database connectivity, **not migration/schema currency**.
- Unknown routes return a structured 404. CORS rejections, rate limits, JSON
  parse/size errors, unsupported JSON encodings, and unexpected errors use
  `{"error":{"code":"...","message":"...","requestId":"..."}}`.
- Responses use shared Zod contracts from `@dayline/contracts`.
- Helmet security headers; `X-Powered-By` disabled; `Cache-Control: no-store`.
- A new server-generated UUID in `X-Request-Id` on every application response;
  inbound IDs are not trusted or reflected. The same ID correlates error bodies
  and structured Pino logs. CORS exposes the response ID to allowed browsers.
- JSON body limit: 16 KiB. Compressed JSON bodies are rejected. HTTP request,
  header, keepalive, and idle timeouts are bounded by the server.
- CORS rejects non-allowlisted origins with 403; origin-less requests (native
  clients, CLI, health checks) are accepted. CORS credentials are disabled.
  Allowed preflight methods are GET/HEAD/OPTIONS. **CORS is not authentication.**
- Rate limits cover all requests, including health, readiness, and preflight.
  Rejections include retry/rate-limit headers. The store is **in-memory and
  process-local**; restart resets it. A distributed store is a later concern.
  `trust proxy` is explicitly false, so forwarded IP headers cannot bypass the
  limiter. Behind a reverse proxy, clients share the proxy IP's quota. Do not
  blindly enable proxy trust; configure a known proxy topology before scaling.
- Request logs contain method, request ID, status, duration, and aborted state,
  not URLs, queries, IPs, headers, bodies, or raw error objects/stacks. Sensitive
  field redaction is additional defense in depth, not a license to log payloads.
  Do not add secrets to arbitrary log messages; redaction is field-based.
- SIGINT/SIGTERM stop accepting connections, mark readiness unavailable, drain
  in-flight HTTP requests, then disconnect Prisma and close the owned pg pool.
  Fatal runtime errors follow the same shutdown path with nonzero exit status.

Malformed transport-level HTTP requests rejected by Node before Express runs do
not pass through application middleware or receive the JSON error contract.

## Database foundation

Pinned Prisma CLI/client/adapter: **7.10.0**. `prisma.config.ts` supplies the
PostgreSQL connection URL (Prisma 7 does not put it in `schema.prisma`). The pg
pool is explicitly owned/closed by `src/database.ts`; ORM query/error logging is
disabled to prevent accidental SQL or credential exposure.

Checked-in migration: `prisma/migrations/20260908000000_foundation/migration.sql`.
Use PostgreSQL **16 or newer** for the coordinated local stack. The SQL uses
built-in `gen_random_uuid()` and needs no extension installation.

- `accounts`: UUID identity, unique email, creation/update timestamps.
- `sessions`: account FK, unique 64-character token digest placeholder,
  expiration/revocation timestamps, account and expiration indexes. No bearer
  token storage and no issuance/validation implementation.
- `devices`: account FK, installation UUID unique per account, platform enum,
  optional name/last-seen timestamp, creation/update timestamps.
- `preferences`: optional one-to-one account preferences; timezone `UTC`, locale
  `en`, and week start `1` (Monday) defaults. SQL checks week start is 0–6.
- Account deletion cascades to these child records. Prisma maintains `updatedAt`
  on ORM writes; direct SQL writers must update it themselves.

Future auth must decide email normalization/verification, digest generation,
rotation/revocation, and account/device ownership checks before exposing any
mutations. Email uniqueness currently follows PostgreSQL's case-sensitive text
semantics; timezone/locale validity beyond storage length is not DB-enforced.
Preserve the custom week-start CHECK in future migration work (Prisma schema
cannot directly model it). No auth provider, password handling, seed users,
calendar tables, or cloud synchronization is included.

## Compose/deployment handoff

Root Compose and root documentation are owned by the coordinating parent.
Required integration details:

1. PostgreSQL service: database `dayline`, user `dayline`, local-only password
   `dayline`; publish local port `5432` if running the API on the host. Add a
   persistent volume and a `pg_isready -U dayline -d dayline` health check.
2. Host API uses the sample URL above. A containerized API uses the **actual
   Compose database service name**, not `localhost`, in `DATABASE_URL`; it also
   needs `HOST=0.0.0.0` and port `3001` exposed/published as appropriate.
3. Generate the Prisma client during build. Run `db:migrate` as a separate
   deployment/init step after PostgreSQL becomes healthy, before serving traffic.
   The API intentionally does not auto-migrate on startup.
4. Use `/health` for liveness and `/ready` for database readiness, with intervals
   that fit the rate limit. Readiness 503 must not cause a liveness restart loop
   during a DB outage. A Node-based check can use built-in `fetch` when curl is
   absent from the runtime image.
5. Set the container stop grace period longer than `SHUTDOWN_TIMEOUT_MS`, e.g.
   15 seconds for the default 10-second shutdown deadline.
6. CORS origins are browser-facing origins, not internal container hostnames.
   Root's planned `http://localhost:8081` is supported. Physical devices need
   an API host reachable on the LAN, configured separately in the client.

## Validation scope

Tests cover environment defaults/rejections, contracts, liveness independence,
readiness success/failure/timeout/retry/shutdown, request IDs, CORS/preflight,
rate limits, safe 404/400/413/500 errors, security headers, and logging redaction.
Tests intentionally avoid importing the runtime/database modules. Live database
migration/probe and real-process signal shutdown checks require separate
integration validation once the parent provides dependencies and PostgreSQL.
