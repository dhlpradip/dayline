# Current Milestone

Milestone 1 — iOS calendar core: read-only implementation and automated validation. Milestone 0 foundation code is implemented. Native/device and live PostgreSQL acceptance gates remain open; neither milestone is claimed fully accepted. The entire master prompt is not complete.

# Completed

- Inspected empty repository and toolchain. Installed isolated ignored `.tools/` Node 22.22.0/pnpm 9.15.0 because the system Node is 20.20.2.
- pnpm monorepo with strict TypeScript 6, shared config/contracts/domain/tooling, Expo SDK 57 and Express 5.
- Original light/dark calendar UI: Month, flexible 1–14-day Timeline, Day, virtualized 30-day Agenda, Year density/drill-down, Today and previous/next navigation.
- Expo Calendar current object API adapter; contextual full-access permission explanation, denied/error/local recovery, foreground/manual refresh, range caching and stale-read protection.
- Calendar source/colors/filtering and occurrence-specific read-only details. In-memory opaque route handles avoid placing event data in URLs. System events never uploaded or persisted as app-owned records.
- Transactional SQLite migrations, empty default local calendar and persisted view/filter/day-count preferences. No generated demo events; both providers currently read-only.
- Date-only all-day boundaries, exclusive range membership, leap years, DST and overlapping timed-event layout with column expansion, tested separately from UI.
- Confirmed Expo 57.0.2 Swift timezone label bug; checked-in pnpm patch returns the EventKit timezone identifier. Installed-source contract test ensures patch application. See ADR-002.
- Express health/readiness, validated environment, request IDs, safe structured logging, security headers, CORS allowlist, rate limiting and graceful shutdown.
- Prisma 7.10 PostgreSQL account/session/device/preference foundation, initial migration, PostgreSQL 17 Docker Compose service. No auth endpoints exposed yet.
- Architecture, ADRs, README, data model, recurrence, sync/security/testing/iOS limitations and roadmap documentation.

# In Progress

- Close Milestone 0 acceptance: live PostgreSQL migration/readiness and native app startup.
- Close Milestone 1 acceptance: browse actual iPhone-configured calendars and execute the manual checklist in `docs/testing.md`.

# Remaining

- Next: Milestone 2 provider mutation interfaces, local/native event creation/edit/delete, full editor, recurrence scopes, read-only enforcement and mutation tests. Local fallback is empty until creation exists.
- Milestone 3: gesture editing, resize, multi-selection, copy-to-dates, richer density/group controls.
- Milestones 4–10: tasks, productivity/search/templates, rich integrations, widgets, optional auth/cloud sync, direct providers and polish. See `docs/roadmap.md`.
- Add device E2E tests and measured accessibility/performance checks; no native visual verification has occurred.

# Known Issues

- Timeline uses a fixed 24-hour wall-clock axis; the repeated autumn DST hour is not a second visual band. Event membership uses actual instants; source timezone is retained.
- Agenda is virtualized within a bounded 30-day range; previous/next range navigation is implemented, not infinite loading.
- Month grid is text-only at present; density settings, bar mode, week-number settings, drag gestures and working-hours styling are later work.
- Local event reads currently parse stored payloads for calendar membership; add validated write schemas and indexed range columns with the event-management milestone before populating large local calendars.
- Native dependency patch requires rebuilding the development client. Never rely on Expo Go or a Metro reload for the Swift correction.
- Installation reports an ESLint 9 deprecation and a Prisma Studio React/React DOM peer warning. These do not block the API/CLI build or Expo dependency compatibility check; review tooling upgrades separately. Prisma 8's registry latest tag is a release candidate, so Prisma 7.10 stable is pinned.

# External Setup Required

1. Use Node 22.22.0 and pnpm 9.15.0 (see README). This checkout already has installed dependencies and an ignored root `.env` copied from local development defaults; do not overwrite real credentials.
2. Start Docker Desktop/another Docker daemon, then `docker compose up -d postgres` and `pnpm db:migrate`. Alternatively configure a reachable PostgreSQL URL.
3. Install/select full Xcode with iOS tools, then `pnpm ios`, or configure an Expo/EAS project and signing using `apps/mobile/eas.json`. No EAS project ID or Apple credentials are fabricated.
4. Test the rebuilt development client on a physical iPhone with configured calendars. Calendar access is requested from the UI, not startup.

# Validation Results

Validation performed with the isolated Node 22.22.0 runtime; normal commands below assume Node 22 is on PATH.

- `pnpm typecheck`: passed across all workspaces, including Prisma client generation and TypeScript 6.0.3 compatibility.
- Domain tests: 48 passed; includes America/New_York DST spring/fall and overlap properties.
- API tests: 48 passed. Initial sandbox execution failed with `listen EPERM`; rerunning with local socket permission passed.
- Mobile tests: 22 passed, including real Node SQLite migration rollback/idempotence tests and installed Swift patch assertion. Node reports its SQLite API as experimental; the shipping app uses expo-sqlite instead.
- `pnpm build`: passed; ESM API built with tsup and generated Prisma client.
- `pnpm build:mobile`: passed on final source, 1,533 modules and a 3.1 MB Hermes bundle. This validates bundling, not compilation of a native iOS binary or device startup. Fixed initial Metro failure caused by `.js` specifiers in a package exporting TypeScript source.
- `expo install --check`: passed after aligning SDK 57's TypeScript requirement to ~6.0.3 and native dependency versions.
- `expo config --type public`: passed. Config-plugin introspection also passed: full calendar-access usage text is present and reminders full-access permission text is absent.
- `prisma validate`: passed. `docker compose config --quiet`: passed.
- Finite built-API smoke check: process started, `/health` returned HTTP 200 and expected schema, `/ready` returned HTTP 503/database down with PostgreSQL offline, SIGTERM exited cleanly.
- `pnpm db:migrate`: blocked, P1001: cannot reach `localhost:5432`. Docker daemon is not running; no migration-success claim.
- `xcodebuild -version`: blocked, active developer directory has Command Line Tools only. No simulator/device/native build executed.
- Final `pnpm format` and `pnpm validate`: passed. Formatting, ESLint (zero warnings), all workspace typechecks, all 118 tests across 11 files, Prisma generation and API build passed together.
