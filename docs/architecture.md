# Dayline architecture

## Ownership and boundaries

Dayline is an iOS-first, anonymous-by-default calendar workspace. Expo SDK 57 and Expo Router host the UI. System calendars remain owned by EventKit; neither events nor credentials from calendars configured in iOS are uploaded to Dayline. SQLite owns app-local calendars, events and preferences. Optional authenticated PostgreSQL sync will apply only to Dayline-owned records in a later milestone.

- `apps/mobile`: native integration adapters, SQLite repositories, TanStack Query range caching, Zustand view state, accessible calendar views.
- `apps/api`: Express 5 service, validated environment, structured redacted logging, request IDs, error boundaries, rate limiting and PostgreSQL readiness.
- `packages/contracts`: shared Zod network schemas; the mobile and API must not duplicate DTOs.
- `packages/domain`: provider-neutral calendar types, civil-date/range operations and interval layout, with deterministic tests.
- `packages/config`: one product identity definition.
- `packages/tsconfig`, `packages/eslint-config`: strict shared tooling.

## Calendar reads

Views consume normalized domain records through `CalendarProvider`, never Expo Calendar objects. Provider capabilities make unsupported operations explicit. EventKit expands system recurrences. Occurrence identity combines provider event identity and occurrence start; all-day records preserve date-only boundaries with an exclusive end. Date navigation uses calendar-day arithmetic rather than adding 24-hour millisecond offsets. Range reads are bounded, keyed by visible calendars and dates, and stale results cannot replace a newer selection. Refresh on foreground and manually; do not assume a native change observer exists.

SQLite migrations run transactionally before the UI reads repositories. Hidden calendar IDs and view preferences persist locally. System event query caches remain in memory, are cleared when access changes, and are never treated as app-owned data. No backend connection is needed for calendar startup or reads.

## Delivery and validation

Milestone 0 establishes tooling, API, database and app boot. Milestone 1 implements read-only browsing of real configured calendars, permissions, local calendar fallback, filtering and five calendar views. Event editing, richer task workflows, widgets, authentication and cloud sync follow in the specified milestone order. Features are not represented as complete merely because a screen exists.

Native validation requires full Xcode and an iOS development build or EAS plus a physical device. Docker/PostgreSQL validation is reported separately from unit and API tests. Node 22.22+ is the development baseline for current native tooling. Dependencies are pinned by `pnpm-lock.yaml`.
