# iOS limitations and native setup

## Target and native dependencies

The implemented system-calendar experience targets iOS using Expo SDK 57 and its
new Expo Calendar API. Web is not targeted. The adapter reports Apple Calendar
unavailable on non-iOS platforms; package dependencies or platform enum values do
not establish Android/web acceptance.

Local compilation uses `pnpm ios` from the root and requires **full Xcode**, iOS
platform tools, and appropriate simulator/device setup. Command Line Tools alone
cannot perform native acceptance. Physical-device deployment also needs signing.
The current environment does not have full Xcode, so a successful typecheck or
iOS JavaScript export is not proof the native app works.

`pnpm dev:mobile` starts Metro for a development client. `pnpm build:mobile` exports
iOS JavaScript/assets only. Neither creates a signed iOS binary. Expo Go is not an
acceptance target for the dependency's patched Swift implementation.

## Mandatory Expo Calendar native patch

The root pnpm configuration registers a patch for `expo-calendar@57.0.2`. It replaces
the event timezone's localized standard-time name with `TimeZone.identifier`.
Otherwise an accepted label such as `EST` can silently shift a summer all-day event
to the wrong civil date. See [ADR 002](adr/002-expo-calendar-timezone.md).

Use Node 22.22.0 and pnpm 9.15.0 for installation and verify the installed-source
contract. **Rebuild and reinstall the native development client after applying the
patch.** Metro reloads and JavaScript-only updates leave old Swift unchanged.
Recheck/rebase the patch when upgrading Expo Calendar; do not remove it merely to
make dependency installation succeed.

## EAS alternative

`apps/mobile/eas.json` provides development-device and development-simulator build
profiles. No EAS project ID is configured yet. Run `eas login` and
`eas build:configure` before development build commands; the
[root README](../README.md#eas-development-builds) includes the pnpm CLI workflow.
EAS needs an Expo account, network access, project linking, and applicable signing
credentials. Source is uploaded to the build service and usage may incur charges.
An EAS profile in the repository is not evidence of a completed build.

## Permissions are broader than application behavior

On iOS 17 and later, browsing existing calendar events requires full calendar
access; write-only permission is not enough. The app explains this before its
explicit permission request. Dayline remains read-only even if the OS grant and
calendar source permit writes. Reminders permission is disabled in app config.

Denied access requires recovery through Settings. Native availability/permission
errors leave local browsing usable, but the fresh local calendar is empty and
cannot be populated from Dayline yet. Permission revocation and foreground races
need device testing, including an already-open detail screen.

## System data and refresh

EventKit reflects calendars configured and available on the device. Dayline cannot
guarantee remote provider freshness, complete offline history, or immediate
cross-device updates. No background sync worker or native change subscription is
implemented; foreground and manual refresh re-read available data.

All-day boundaries use civil dates; timed events display in the device timezone.
The timeline uses a fixed 24-hour wall-clock axis, with repeated fall-back hours
sharing coordinates rather than a proportional 25-hour day. Read the
[recurrence/DST notes](recurrence.md) before evaluating those fixtures.

Detail links are process-local opaque handles, not persistent deep links. They
can expire after restart, registry eviction, or permission loss. Widgets would
need a separate native extension and navigation design; none is shipped.

## Acceptance boundary

Run the [manual smoke checklist](testing.md) on a rebuilt physical-device client,
including permissions, DST, recurrence, multi-day events, accessibility, foreground
refresh, and airplane mode. No accessibility certification, native performance
benchmark, App Store readiness, or complete product acceptance is claimed.
The parent-maintained `PROGRESS.md` records exact validation evidence and blockers.
