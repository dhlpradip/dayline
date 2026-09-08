# Dayline

An iOS-first, read-only calendar browser built with Expo SDK 57, React Native,
TypeScript, and SQLite. Real system calendar data comes from EventKit through the
new Expo Calendar API; no demo events are seeded.

## Implementation status

Milestone 0's foundation and Milestone 1's read-only core are implemented in code.
This is **not completion of the full product scope or native acceptance**. In the
current development environment, native acceptance is blocked by the lack of full
Xcode, and live PostgreSQL acceptance is blocked by the stopped Docker daemon.
See [docs/PROGRESS.md](docs/PROGRESS.md) for exact validation results, patch
application status, and outstanding acceptance work; this README is not a test log.

Implemented:

- Month grid, Timeline adjustable from 1–14 days, single-day timeline, 30-day
  Agenda, and Year with daily event density and month drill-down.
- Calendar filtering, selected view, and timeline length persisted in SQLite.
- Read-only event details for the selected occurrence, reached through opaque
  session-only route tokens rather than event content in URLs.
- Optional Apple Calendar access, permission explanations and recovery, manual
  refresh, and foreground permission rechecks.
- An **empty, read-only local calendar** named “On this device.” It works without
  an account or calendar permission but contains no events on a fresh install;
  local event creation is not implemented.
- Express 5 / Prisma 7.10.0 backend foundation and PostgreSQL 17 Compose service,
  with account, session, device, and preference tables. Only health/readiness
  endpoints are implemented.

There is no task UI, event creation/editing/deletion UI, authentication UI or auth
endpoints, cloud sync, or widgets UI/extension. Web is not a targeted platform.
The mobile app does not connect to the backend and needs no backend credentials.

## Prerequisites

- **Node 22.22.0** and **pnpm 9.15.0**. Use nvm or fnm rather than the environment's
  default Node 20.20.2. The ignored `.tools/` directory contains environment-local
  tooling, not a portable setup requirement.
- Docker with its daemon running for the PostgreSQL/API integration workflow.
- Full Xcode and its iOS platform tools for a local native build; Command Line
  Tools alone are insufficient. Physical-device builds also need signing.
- Alternatively, an Expo account and configured EAS project for a cloud-built
  development client. Cloud builds upload project source and may incur charges.

For example, with nvm already installed:

```sh
nvm install 22.22.0
nvm use 22.22.0
corepack enable
corepack prepare pnpm@9.15.0 --activate
node --version
pnpm --version
```

With fnm, use `fnm install 22.22.0` and `fnm use 22.22.0` instead of the nvm lines.
Ensure each terminal running the project uses the same toolchain.

## First-time setup

Run from the repository root, `calendar/`. Copy the environment example only on
first setup; preserve an existing `.env` rather than overwriting it.

```sh
cp .env.example .env
pnpm install
pnpm db:generate
docker compose up -d postgres
```

Wait for PostgreSQL to become healthy (`docker compose ps`), then:

```sh
pnpm db:migrate
pnpm dev:api
```

The API runtime and Prisma configuration load the **root** `.env`, not a file in
`apps/api/`. It must supply `DATABASE_URL`; the API also requires `CORS_ORIGINS`.
See [API configuration](apps/api/README.md) for variables and operational details.
Compose publishes PostgreSQL only on `127.0.0.1:5432` and persists its data in a
named volume. Its sample credentials are for local development only.

`pnpm db:generate` does not require a running database. `pnpm db:migrate` applies
checked-in migrations using `prisma migrate deploy`; the API does not migrate on
startup. The default API address is `http://127.0.0.1:3001`: `/health` checks process
liveness, and `/ready` checks database connectivity, not migration currency.

In another root terminal, start Metro for a development client:

```sh
pnpm dev:mobile
```

To build/install locally with full Xcode, use a separate root terminal:

```sh
pnpm ios
```

The mobile read-only experience can run independently of the API and PostgreSQL.
Use a native development client, not Expo Go, for acceptance of the patched native
calendar behavior. `pnpm dev:mobile` starts Metro; it does not compile Swift.

### EAS development builds

`apps/mobile/eas.json` defines `development` and `development-simulator` profiles
with the pinned Node/pnpm versions. The app configuration has **no EAS project ID**
yet. Authenticate and configure/link the project before requesting a build
(`eas login`, then `eas build:configure`). Using the CLI through pnpm:

```sh
cd apps/mobile
pnpm dlx eas-cli login
pnpm dlx eas-cli build:configure
pnpm dlx eas-cli build --platform ios --profile development-simulator
```

For a physical device, use `--profile development` instead and follow EAS signing
and device-registration prompts. Review configuration changes made by EAS. Install
the resulting development client, then run `pnpm dev:mobile` from the repository
root. No EAS build or signing acceptance is implied by the checked-in profiles.

### Required native timezone patch

The root manifest registers `patches/expo-calendar@57.0.2.patch` with pnpm. Upstream
Expo Calendar's iOS event timezone getter uses `localizedName`, which can turn a
regional timezone into a misleading standard-time label and shift all-day dates.
The patch returns `TimeZone.identifier` instead. See
[ADR 002](docs/adr/002-expo-calendar-timezone.md).

Install with the pinned pnpm version and verify patch application before mobile
acceptance. **Rebuild the native development client after applying or changing the
patch.** A Metro reload or JavaScript-only update cannot replace compiled Swift.

## Workspace and commands

- `apps/mobile`: Expo Router screens, EventKit adapter, SQLite, and mobile tests.
- `apps/api`: Express service, Prisma schema/migration, and API tests.
- `packages/domain`: provider contracts, date ranges, event membership and layout.
- `packages/contracts`: shared API response/error schemas.
- `packages/config`, `packages/eslint-config`, `packages/tsconfig`: shared configuration.

Root package scripts:

```sh
pnpm typecheck
pnpm test
pnpm test:api
pnpm build
pnpm build:mobile
pnpm lint
pnpm format:check
pnpm validate
```

`build` builds the API. `build:mobile` exports iOS JavaScript/assets, **not** a native
app. `validate` combines formatting, lint, typechecking, tests, and the API build;
it does not perform device or live-database acceptance. `pnpm format` rewrites
workspace formatting, so use it intentionally when coordinating shared work.

## Troubleshooting

- **Node/Expo tooling errors:** verify `node --version` is 22.22.0 and `pnpm --version` is 9.15.0 in the current terminal, then reinstall with `pnpm install --frozen-lockfile`.
- **Prisma P1001 / readiness 503:** start Docker, run `docker compose up -d postgres`, wait for a healthy database and retry `pnpm db:migrate`. Check the root `DATABASE_URL`. The mobile app does not depend on this service.
- **Xcode reports Command Line Tools only:** install full Xcode and select its developer directory in Xcode's Locations settings. Install an iOS platform/runtime before `pnpm ios`.
- **Calendar native module unavailable or patch test fails:** use pnpm to apply the checked-in patch and rebuild the development client; Expo Go and a Metro reload cannot apply Swift changes.
- **No calendars/events:** grant full access in iOS Settings, verify accounts/events exist in Apple Calendar, check the visible calendar filters, and refresh. The local calendar starts empty by design.
- **API tests report `listen EPERM`:** allow temporary local sockets in your execution sandbox. Tests use transient HTTP listeners and injected database probes, not production services.

## Documentation

- [Data model](docs/data-model.md)
- [Calendar reads and future sync specification](docs/calendar-sync.md)
- [Recurrence and date semantics](docs/recurrence.md)
- [Widgets: future specification, not shipped](docs/widgets.md)
- [Security and privacy boundaries](docs/security.md)
- [Testing and manual acceptance](docs/testing.md)
- [iOS limitations and build requirements](docs/ios-limitations.md)
- [Roadmap and acceptance gates](docs/roadmap.md)
- [Architecture](docs/architecture.md) and [architecture decisions](docs/adr)
