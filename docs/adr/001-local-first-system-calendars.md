# ADR-001: Local-first with system calendars as the primary provider

Status: Accepted

## Context

Dayline must remain useful offline and without an account. iOS already synchronizes configured iCloud, Google and Exchange calendars through EventKit. Mirroring those events to a second server would introduce privacy exposure, duplicate ownership and conflict problems.

## Decision

Use the current Expo Calendar object API behind an Apple system calendar adapter. EventKit owns system records and recurrence expansion. SQLite owns Dayline-local data and versioned migrations. A separate local adapter supplies app-created calendars independently of permission to access EventKit. PostgreSQL is optional and will only synchronize authenticated Dayline-owned data. Provider-neutral models and explicit capabilities separate rendering from native APIs.

Use Expo Continuous Native Generation and development builds, not manually maintained native projects. Ask for calendar permission only after an explanation and never request unrelated permissions on launch. Do not log event content or upload system events. Prefer date-only values for all-day boundaries and instants plus IANA timezone for timed events.

## Consequences

The app works without backend availability. Calendar authorization and iOS account configuration can limit what is visible. Device testing is required for EventKit, revoked permissions and recurrence instances. Direct OAuth/CalDAV providers are deferred until the core local-first experience is validated. Native mutations and optional sync will be introduced with explicit recurrence scope and conflict handling rather than optimistic unsupported semantics.
