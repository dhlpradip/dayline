# @dayline/domain

Pure TypeScript calendar logic. The package exports source from `src/index.ts` and
has no UI, native, or provider dependencies. `src/types.ts` is the unchanged shared
model. Runtime dependencies are date-fns 4 and date-fns-tz 3.

## Public API

- `dateKey(date)` returns the device-local `YYYY-MM-DD` civil date.
- `parseDate(value)` parses ISO instants with their offsets intact. Civil dates
  (`YYYY-MM-DD`) and ISO date-times without offsets are interpreted locally, not
  as UTC. Invalid input throws `RangeError`; it is not normalized into another day.
  Providers should supply offset-bearing ISO instants for timed events.
- `dateKeyInTimeZone(date, timeZone)` formats an instant's civil date in an explicit
  IANA timezone using date-fns-tz. Other helpers use the device's local timezone.
- `monthRange(date)` returns the smallest Monday-aligned grid containing the full
  month (four, five, or six complete weeks).
- `visibleRange(date, view, days?)` returns local-midnight boundaries. Week starts
  on the selected date, defaulting to seven days; agenda defaults to 30 days.
  `days` overrides week/agenda only and must be a positive safe integer producing
  a valid end date. Day is one calendar day; year is Jan 1 to next Jan 1.
- `datesInRange(range)` returns distinct local midnights for days intersecting the
  half-open range. Partial first/last days are included, but a midnight end is
  excluded. Empty ranges return `[]`; reversed/invalid ranges throw `RangeError`.
- `eventsForDay(events, day)` returns the original intersecting event objects,
  sorted all-day first, then start instant, with input order breaking ties.
- `layoutEvents(events, day)` returns timed-only `EventLayout` objects with
  `event`, `startMinute`, `endMinute`, zero-based `column`, `columnCount`, and
  `columnSpan`. Results sort by visual start, then longer visual interval first,
  then input order. Minute values preserve seconds/milliseconds as fractions.

Every range and event interval is **start-inclusive, end-exclusive**. Calendar-day
arithmetic does not assume 24 elapsed hours. Event membership compares instants
against the actual local midnight boundaries; all-day civil dates first parse at
local midnight. `event.timezone` remains provider metadata, not a per-event display
timezone. Invalid, reversed, and zero-duration event records are omitted. Recurring
instances are never collapsed by `id` or `externalId`. Inputs are not mutated.

Use date-fns navigation functions directly in consumers; this package does not
wrap or re-export them.

## Overlap layout and DST

Events are clipped to the selected day and plotted on a fixed **0..1440 local
wall-clock-minute axis**. Start/end boundaries outside the day clip to 0/1440,
including on 23-hour and 25-hour days. Collision groups include transitive overlaps.
A greedy interval partition uses the minimum number of columns per visual group;
touching intervals do not collide. Each event expands rightward through all
contiguous columns containing no overlapping event, stopping at the first blocker.
Widths reset for the next independent group. The algorithm is deterministic for a
given input order and uses O(n²) worst-case time and O(n) auxiliary space.

**DST visual tradeoff:** the spring-forward missing hour still occupies axis
space. Both occurrences of a repeated fall-back hour occupy the same coordinates
and can collide visually even when their instants do not overlap. A positive
instant interval whose end wall time is equal to or earlier than its start is
rendered as a one-minute marker from its start (capped at 1440), rather than being
dropped or given negative height. Thus visual height is not elapsed duration.
Membership always uses instants, never these visual coordinates. Consumers that
need elapsed-time-proportional rendering or separate fold-hour rows need a
variable-length axis instead of this mobile layout contract.

## Validation

After the workspace owner installs dependencies and creates `tsconfig.base.json`,
run in this directory:

```sh
npm run typecheck
npm test
```

Vitest config sets `TZ=America/New_York` before forked workers start. Tests assert
both seasonal UTC offsets, so DST coverage cannot silently run under UTC. Coverage
includes leap years, complete month grids, civil/instant parsing, exclusive ends,
DST gap/fold behavior, recurrence identity, cross-midnight clipping, transitive
collision groups, touching intervals, expansion blockers, multiple-column width
expansion, input immutability, and seeded dense-schedule layout invariants.
