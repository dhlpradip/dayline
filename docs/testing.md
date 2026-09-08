# Testing and acceptance

## Evidence and scope

The parent-maintained `PROGRESS.md` is the authoritative record of exact commands,
results, patch application, and remaining checks. This document intentionally does
not duplicate test counts or dated results.

Milestone 0 and the Milestone 1 read-only core are implemented in code, but native
and live PostgreSQL acceptance remain incomplete in the current environment:
full Xcode is unavailable and the Docker daemon is stopped. Mobile validation must
include installation/application of the registered Expo Calendar patch. A unit
suite, API build, or JavaScript export cannot stand in for native acceptance.

## Automated commands

Use Node **22.22.0** and pnpm **9.15.0**, with dependencies installed from the root.
See [setup](../README.md). Run from `calendar/`:

```sh
pnpm typecheck
pnpm test:api
pnpm --filter @dayline/domain test
pnpm --filter @dayline/mobile test
pnpm test
pnpm build
pnpm build:mobile
pnpm lint
pnpm format:check
```

`pnpm validate` combines formatting, lint, typechecking, all workspace tests, and
the API build. It neither starts PostgreSQL nor builds/runs a native client.
API generation/build/typechecking needs `DATABASE_URL` configuration but not a
live database. API tests use injected probes and do not require PostgreSQL.

Existing suites exercise:

- Domain date ranges, civil dates, day membership, overlap layout, and DST cases.
- Mobile mapping, permission/read invalidation, occurrence navigation, preference
  decoding, migration behavior, and density calculation.
- API configuration, health/readiness behavior, contracts, request IDs, CORS,
  rate limits, bounded failures, headers, and logging redaction.

These are not an end-to-end native UI or real PostgreSQL test suite.

### Installed native dependency contract

After `pnpm install`, run the mapping regression in contrasting viewer zones:

```sh
TZ=Pacific/Honolulu pnpm --filter @dayline/mobile exec vitest run src/native-mapping.test.ts
TZ=Asia/Tokyo pnpm --filter @dayline/mobile exec vitest run src/native-mapping.test.ts
```

The suite checks that the installed `expo-calendar@57.0.2` event Swift getter uses
`.identifier`, and covers summer all-day normalization and invalid timezone
handling. An unapplied patch must not be waved through as an acceptable failure.
See [ADR 002](adr/002-expo-calendar-timezone.md). Rebuild the native client before
device checks: passing the source assertion does not repair an old binary.

## Live PostgreSQL/API acceptance

With Docker running and root `.env` configured:

```sh
docker compose up -d postgres
docker compose ps
```

Wait for the database health check, then:

```sh
pnpm db:generate
pnpm db:migrate
pnpm dev:api
```

From another terminal, using the default API host/port:

```sh
curl -i http://127.0.0.1:3001/health
curl -i http://127.0.0.1:3001/ready
```

Expected: liveness succeeds independently of database availability; readiness
succeeds with the database reachable and returns generic 503 when unavailable.
Readiness only probes connectivity, so also verify the migration and foundation
tables. Verify repeated migration deployment is safe and exercise graceful
shutdown with an actual API process. Perform database outage tests only in an
isolated local stack, not a shared environment; do not delete the database volume
to simulate an outage. Record actual observations in `PROGRESS.md`.

## Manual iOS device smoke checklist

Use a rebuilt development client and disposable events created in **Apple
Calendar**, since Dayline cannot create test events. Avoid real private content
in screenshots or bug reports. Check on a physical device; simulator testing is
useful but does not replace it.

### Startup, permissions, and recovery

- [ ] Fresh install without granting access shows the empty “On this device”
      calendar, no sample events, and no login or event-creation requirement.
- [ ] “Connect Apple Calendar” explains full access before the native prompt;
      “Not now” and “Stay local” leave browsing usable.
- [ ] Grant full access and confirm actual system calendars/events appear.
- [ ] Deny access, follow Open Settings, grant access, and return to the app.
- [ ] Revoke access in Settings while Dayline is backgrounded; foreground both
      the calendar and an open detail screen. Confirm system data is no longer
      shown and stale asynchronous reads do not restore it.
- [ ] Regrant permission and refresh; reopen an event from current results rather
      than relying on a cleared session handle.
- [ ] Edit or delete a fixture in Apple Calendar, return to Dayline, and confirm
      foreground/manual refresh and missing-occurrence recovery.

### Views, filtering, and details

- [ ] Navigate Month, Timeline at 1 and 14 days, Day, the 30-day Agenda, and Year.
      Check Today, previous/next navigation, scroll behavior, and empty ranges.
- [ ] Hide individual calendars, hide all, restart, and confirm persisted choices
      and the explicit all-hidden state. Restore visibility.
- [ ] Change view/timeline length, restart, and confirm restoration.
- [ ] Confirm Year density counts occupied event-days and opens the chosen month.
- [ ] Open details for a specific repeating occurrence; verify dates, source,
      timezone, notes, and location against Apple Calendar.
- [ ] Confirm event URLs remain text; expired session routes show unavailable
      rather than leaking content or selecting another event.

### Date correctness

- [ ] Exercise a summer all-day event in `America/New_York` with a different
      device timezone. Verify its civil start and exclusive end remain correct
      in the rebuilt client, including multi-day variants.
- [ ] Check spring-forward and fall-back timed events, including repeated hours.
      Compare actual date membership separately from the documented fixed-axis
      [DST layout limitation](recurrence.md).
- [ ] Check overlapping timed events, overnight/multi-day events, events ending
      exactly at midnight, month/year boundaries, and leap-day ranges.
- [ ] Check daily/weekly/monthly recurrence, a detached/moved occurrence, and a
      deleted occurrence using fixtures supported by Apple Calendar.
- [ ] Change the device timezone, foreground/refresh, and verify timed display,
      all-day membership, details, and density together.

### Offline, accessibility, and presentation

- [ ] Enable airplane mode with known events already in EventKit. Browse all views,
      refresh, and open details; do not assume remote events are downloaded.
- [ ] Cold-start offline and confirm SQLite preferences/local browsing need no API.
- [ ] With VoiceOver, verify control labels, selection states, reading order,
      event-detail navigation, permission recovery, and modal dismissal.
- [ ] Test large Dynamic Type, light/dark appearance, contrast, touch targets,
      narrow iPhones, iPad layout, and rotation. Check clipped/overlapping event
      labels and horizontal timeline navigation without assuming compliance.

Task/edit/auth/sync/widget flows are not acceptance targets for shipped code yet.
Their future specifications must gain tests when implemented, not be marked
passing because corresponding UI is absent.
