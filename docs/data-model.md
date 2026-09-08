# Data model

This describes the implemented read-only model. Future features below are
specifications, not shipped storage or API behavior.

## Shared calendar domain

`packages/domain/src/types.ts` defines two providers: `apple-system` and
`dayline-local`. `CalendarProvider` exposes capabilities plus `getCalendars`,
`getEvents(range, calendarIds)`, and `getEvent(id)`. Neither implementation exposes
create, update, or delete capabilities. Apple recurrence support means reading
system-expanded occurrences, not editing recurrence rules.

A `Calendar` contains a namespaced ID, native/external ID, provider ID, title,
color, source, and source modification flags. Apple source flags describe EventKit
metadata; an otherwise writable calendar is still read-only in Dayline.

A `CalendarEvent` includes identity, calendar/provider association, title,
description, start/end, all-day flag, timezone, location, URL, recurrence marker,
original start, and status. Timed boundaries are ISO instants. All-day boundaries
are civil `YYYY-MM-DD` dates. **End boundaries are exclusive** in both cases.

Apple calendar IDs use `apple-system:`. Event occurrence identity is a serialized
tuple of provider, native calendar ID, native event ID, displayed start/end, and
original start. This avoids collapsing a recurring series into one record when
EventKit reuses event identifiers. It is not a cross-device sync identity.

Event details routes contain an opaque token. The process-local token registry
stores only provider/event references, is bounded, and is not persisted. It is not
an authentication session or a durable/shareable event URL.

## On-device SQLite

`apps/mobile/src/migrations.ts` creates `dayline.db`'s schema with WAL and foreign
keys enabled. Schema migrations and `PRAGMA user_version` advance in an exclusive
transaction. A newer-than-supported schema fails rather than being reset.

- `preferences`: text key and JSON value. The `ui` snapshot stores view, timeline
  day count, and hidden calendar IDs. Defaults are Month, seven days, and no hidden
  calendars. Decoding bounds the timeline to 1–14 days and tolerates invalid input.
- `local_calendars`: text ID, title, and color. Migration inserts the `default`
  calendar, displayed as “On this device.”
- `local_events`: text ID, calendar foreign key, start/end strings, and a JSON
  event payload, with a calendar/range index. The provider reads these records;
  no user-facing writer is implemented and **no events are seeded**.

Preferences hydrate before the main app is ready. Writes are serialized; failed
saves surface a retry notice without discarding the current session selection.
The selected navigation date is session state, not a persisted preference.

Apple event payloads are not copied into these tables. They are read from EventKit
and held in memory. SQLite is not an Apple-calendar mirror or a sync outbox.

## PostgreSQL foundation

`apps/api/prisma/schema.prisma` and its checked-in foundation migration define the
Prisma 7.10.0 model. Root Compose runs PostgreSQL 17.

- `accounts`: UUID identity, unique email, creation/update timestamps.
- `sessions`: account foreign key, unique 64-character token-hash field, expiration,
  revocation, and creation timestamps. It is a future digest storage foundation;
  no token issuance or authentication exists.
- `devices`: account foreign key, installation UUID unique within the account,
  platform enum, optional name and last-seen timestamp, creation/update timestamps.
- `preferences`: optional one-to-one account preferences with timezone `UTC`, locale
  `en`, and Monday week start by default. SQL constrains week start to 0–6.

Account deletion cascades to child rows. Email uniqueness is case-sensitive text
uniqueness; normalization and verification are not implemented. Timezone and
locale validity are not enforced beyond column storage constraints. ORM writes
maintain `updatedAt`; direct SQL writers must do so themselves.

Backend preferences are separate from mobile UI preferences: **there is no
connection or synchronization between them**. Platform enum values do not imply
shipped clients. There are no backend event/task tables or account CRUD routes.

## Future specification — not shipped

Local editing, tasks, recurrence authoring, cross-device identity, sync operations,
conflict records, and widget snapshots need explicit schema/migration design
before implementation. Existing foundation tables must not be treated as evidence
that authentication, event synchronization, or widgets already work.
