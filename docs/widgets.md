# Widgets

## Status: future specification, not shipped

There is no WidgetKit extension, widget configuration UI, App Group snapshot
pipeline, or widget refresh implementation in the current code. The app's Month,
Timeline, Day, Agenda, and Year screens are in-app views, not system widgets. EAS
development profiles do not establish widget targets or entitlements.

The following is a proposed acceptance specification, not implemented behavior.

## Proposed privacy and data boundary

- Define which calendar information a widget may show and obtain explicit user
  choices, particularly for titles, locations, and lock-screen exposure.
- If an App Group snapshot is introduced, minimize its fields, define protection
  and retention, and avoid copying the entire EventKit store.
- Respect hidden-calendar selections and revoke/clear access-dependent snapshots
  when permissions change. Define stale-data behavior when iOS has not run the
  app or extension since a permission change.
- Do not depend on backend credentials or silently upload system calendar data to
  generate a widget.

## Proposed native work

WidgetKit requires native target/extension configuration, provisioning,
entitlements, shared-container design, and an actual native build. Decide how
those changes are represented in Expo's native-generation workflow before adding
hand-maintained generated files.

Design bounded timelines and stale/empty states around iOS-controlled scheduling;
continuous or exact-minute refresh is not a delivery guarantee. Measure behavior
on a physical device, including reboot, offline use, timezone changes, and calendar
permission revocation.

## Navigation and acceptance requirements

Current event URLs contain process-local opaque tokens. They expire with the app
session or registry eviction and **cannot serve as durable widget deep links**.
A future design needs privacy-safe navigation that revalidates access and event
existence without encoding event content in a URL.

Acceptance should cover supported widget sizes, VoiceOver, large text where
supported, contrast, empty calendars, hidden calendars, all-day/multi-day events,
DST, stale snapshots, and denied/revoked permissions. None of these widget checks
is claimed as complete. See [roadmap](roadmap.md) and the parent-maintained
`PROGRESS.md` for implementation and validation tracking.
