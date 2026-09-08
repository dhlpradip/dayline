# Recurrence, all-day events, and timezones

## Implemented recurrence reads

EventKit expands recurring events for the requested range through Expo SDK 57's
`listEvents`. Dayline displays those returned occurrences; it does not implement
an RRULE expansion engine, recurrence editor, or series mutation UI.

The adapter marks records as recurring when a recurrence rule, detached-instance
flag, or original start is present. It retains original start when supplied.
Occurrence IDs include native calendar/event IDs, the displayed interval, and
original start, because a native event identifier can be shared by multiple
occurrences. Identical occurrence IDs are deduplicated at the provider boundary.

Opening details re-queries an occurrence window, padded by a local day at either
end for timezone/civil-date differences, and matches the exact occurrence ID.
If that occurrence changed or disappeared, details become unavailable rather than
silently displaying the series master. Native recurrence/exception behavior still
requires real-device acceptance.

## Date invariants

- Timed events store ISO instants and display in the device timezone. Details also
  show the original event timezone when available.
- All-day events store civil dates, not UTC-midnight instants.
- All event and query ranges are half-open: `[start, end)`. An event ending at
  midnight does not also occupy the following day.
- Multi-day events appear on every intersected day. Year density counts event-days,
  so a multi-day event contributes on each occupied date rather than once per year.
- Local day boundaries use calendar-day arithmetic, not fixed 24-hour durations.
  Month grids are Monday-aligned; changing the week start is not implemented.

## Required Expo Calendar patch

`expo-calendar@57.0.2` exposes the iOS event timezone with
`localizedName(for: .shortStandard, locale: .current)` upstream. A standard-time
label such as `EST` can lose a regional timezone's summer offset even when accepted
by JavaScript, silently shifting all-day dates.

The registered pnpm patch changes that event getter to `.identifier`, retaining
values such as `America/New_York`. Both all-day boundaries are converted using
the original identifier; already-civil date strings remain unchanged. Only a
missing source timezone uses device-local civil dates. An invalid non-empty
identifier fails instead of silently falling back. The adapter does not guess a
region from an abbreviation.

See [ADR 002](adr/002-expo-calendar-timezone.md) for the decision and upgrade rules.
**A native rebuild is mandatory after patch application.** The installed-source
contract test checks dependency source, not the Swift inside an old installed app.

## Known DST visualization limit

Timed layout uses a fixed 24-hour local wall-clock axis. During fall-back, repeated
hours share coordinates. A positive real interval whose wall-clock end folds
behind its start is represented as a one-minute layout interval, bounded by
midnight. Day membership still uses actual instants. This is not a proportional
23/25-hour elapsed-time visualization; see `packages/domain/src/events.ts`.

## Future recurrence specification — not shipped

Before adding recurrence editing, define single-occurrence versus whole-series
operations, detached exceptions, skipped dates, end conditions, and timezone
preservation. Do not imply “this and future events” behavior without proving the
native API's semantics. Local recurrence requires its own storage/expansion design;
the current local provider reports no recurrence capability.

See [testing](testing.md) for DST, multi-day, and exception smoke checks.
