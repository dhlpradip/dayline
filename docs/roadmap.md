# Roadmap

## Status interpretation

“Implemented” means the corresponding code exists, not that every native,
integration, or release acceptance gate has passed. Milestone 0's foundation and
Milestone 1's read-only core are implemented. **The full product prompt is not
complete.** Exact validation results and coordination status belong in the
parent-maintained `PROGRESS.md`, not duplicated counts or dated snapshots here.

## Milestone 0 — foundation implemented; integration acceptance outstanding

- pnpm workspace and shared TypeScript/tooling packages.
- Expo SDK 57 mobile shell, SQLite migration/bootstrap, and EAS development profiles.
- Express 5 API with health/readiness, validated configuration, structured privacy-
  conscious logging, response contracts, and defensive middleware.
- Prisma 7.10.0 account/session/device/preference schema and checked-in migration.
- PostgreSQL 17 Compose development service with loopback binding and persistence.

Remaining gates include live migration/readiness and process-shutdown checks with
a running database. The Docker daemon is off in the current environment. EAS also
requires account/project linking; no project ID is supplied by the app config.

## Milestone 1 — read-only core implemented; native acceptance outstanding

- Real EventKit calendar reads through the new SDK 57 API and a read-only provider
  boundary; no sample event fallback.
- Empty SQLite-backed “On this device” calendar available without sign-in or
  permission, with no local event writer/UI.
- Persisted calendar visibility, selected view, and 1–14-day timeline length.
- Month, Timeline, Day, 30-day Agenda, Year density, and occurrence-specific details
  reached through opaque session tokens.
- Permission explanation/recovery, foreground/manual refresh, invalidation of
  stale system reads, and unavailable/error/empty states.
- Domain date/layout logic and mobile mapping, navigation, migration, preference,
  and density tests.
- Registered `expo-calendar@57.0.2` patch preserving native timezone identifiers;
  see [ADR 002](adr/002-expo-calendar-timezone.md).

Acceptance requires the installed patch, a rebuilt native client, and the
[manual device checklist](testing.md). Full Xcode is unavailable in the current
environment. Installed-source tests, typechecking, and API builds cannot establish
which Swift is in a previously installed client or replace device acceptance.

## Future specifications — not shipped

The following are remaining product areas, not implemented features or commitments
to a newly assigned milestone order:

- **Event creation/editing/deletion:** capability-aware writes, validation, local
  persistence, and safe native mutation semantics. No editing UI exists now.
- **Recurrence authoring:** occurrence/series scope, exceptions, timezone handling,
  and regression coverage. Reading EventKit occurrences is already implemented;
  authoring is not. See [recurrence](recurrence.md).
- **Tasks:** task domain/storage and task-management UI are not implemented.
- **Synchronization:** explicit data ownership/consent, durable identities, retry
  and conflict rules, and offline recovery. No mobile/backend connection or sync
  endpoint exists. See [calendar sync](calendar-sync.md).
- **Widgets:** native extension, entitlements, privacy-safe snapshots, bounded
  refresh, and durable navigation design. No widget UI or extension exists.
  See [widget specification](widgets.md).
- **Milestone 8 authentication:** real identity/session flows, secure credential
  storage, account/device authorization, revocation, and account lifecycle. Tables
  alone are not auth; there are no auth endpoints or auth UI. See
  [security](security.md).

Web is not a current target. Do not infer shipped platforms or features from
library dependencies, backend enum values, or future documentation.

## Completion gates

Before claiming completion beyond code implementation:

1. Record actual automated checks and native patch verification in `PROGRESS.md`.
2. Run PostgreSQL migrations and API integration acceptance with the database up.
3. Build the native client with the patch and complete physical-device smoke tests.
4. Resolve accessibility, permission, offline, recurrence, and DST findings.
5. Implement and independently accept the remaining product areas before claiming
   the full scope complete.
