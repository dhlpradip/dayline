# Calendar reads and synchronization

## Implemented: read-only system access, not cloud sync

`apps/mobile/src/apple-provider.ts` is the native calendar boundary. It lazily loads
`expo-calendar` and uses the new SDK 57 API: `getCalendarPermissions(false)`,
`requestCalendarPermissions(false)`, `getCalendars(EntityTypes.EVENT)`, and
`listEvents(calendarIds, start, end)`. It does not use the legacy calendar API.

Dayline reads calendars available in the device's EventKit store. Apple/iOS may
synchronize those calendars with their configured providers; Dayline does not
implement iCloud, Google, CalDAV, or backend synchronization. It neither uploads
system events nor requires an account/API connection to browse them.

## Read lifecycle

1. SQLite initializes the empty local calendar and restores UI preferences.
2. Calendar access is checked without automatically requesting permission. The
   user can stay local, or read an explanation before requesting full access.
3. Granted access enables system calendar queries. Hidden calendar IDs are removed
   from the requested IDs; this selection is persisted locally.
4. The active view sets a bounded event range: the whole-week month grid,
   1–14-day Timeline, Day, 30-day Agenda, or calendar Year.
5. Native records are normalized and deduplicated by occurrence ID. Local and
   system results are combined for display. Event details re-query the selected
   occurrence rather than substituting its series master.

The local provider remains read-only and starts with no events. Empty results are
not replaced with sample data.

## Refresh and permission changes

Manual Refresh and app foregrounding recheck permissions and refresh data. Moving
away from the active state invalidates in-flight system reads and removes system
query data. Access checks use generations/sequence guards so an older asynchronous
result cannot repopulate the current permission state. Native reads also check
permission before and after fetching.

System queries are in-memory React Query data, not persistent event storage. When
access is not granted, system detail handles are cleared and system events are
not displayed. Denial, unavailable native support, read errors, loading, and
all-calendars-hidden states have distinct recovery/empty-state UI. Local browsing
remains available without permission.

There is no EventKit change subscription or background sync worker. Changes made
in Apple Calendar are picked up by foreground/manual refresh, subject to the
system store's own availability. A moved/deleted occurrence can make an existing
detail link unavailable; reopen it from refreshed results.

## Offline boundary

SQLite preferences and the local calendar do not depend on a network. EventKit
reads can use system data already on the device; Dayline does not guarantee that
all remote calendars or historical events have been downloaded. Airplane-mode
acceptance must use known on-device events. See [testing](testing.md).

The [timezone patch](adr/002-expo-calendar-timezone.md) is required for correct
all-day normalization. Installing JavaScript alone is insufficient: rebuild the
native client after applying the patch.

## Future synchronization specification — not shipped

Any future sync implementation must explicitly define:

- User consent, account authentication, per-device ownership, and exactly which
  data leaves the device. Milestone 8 authentication remains unimplemented.
- Whether locally authored data is syncable; system-calendar data must not become
  an implicit upload merely because it can be read through EventKit.
- Durable IDs, versioning, idempotent retries, deletion/tombstone handling, offline
  queues, and conflict resolution.
- Recovery after permission revocation, sign-out, account deletion, and partial
  failures, without resurrecting removed or unauthorized data.
- Background execution limits and visible last-refresh/error states without
  promising real-time delivery on iOS.

These are design requirements, not existing endpoints, queues, or guarantees.
