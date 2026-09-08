# ADR 002: Preserve EventKit timezone identifiers in Expo Calendar

- Status: Accepted; dependency registration/application is coordinated by the parent.
- Date: 2026-09-08
- Scope: `expo-calendar@57.0.2`, iOS SDK 57 event reads.

## Context

The installed package's `ios/Next/CalendarNextModule.swift` serializes event timestamps as UTC instants but exposes an event's `timeZone` using `localizedName(for: .shortStandard, locale: .current)`. That is a localized standard-time label, not the original timezone identifier.

For example, midnight on September 8, 2026 in `America/New_York` is `2026-09-08T04:00:00Z`. The native getter can return `EST`. JavaScript accepts `EST` as a fixed standard-time zone and produces September 7 for that instant, while `America/New_York` correctly produces September 8. A JavaScript try/catch fallback does not catch this silent date shift. Labels can also vary with the device language.

This corrupts all-day start dates and exclusive end dates, affecting day membership, recurring-instance identifiers, and density counts.

## Decision

Apply `patches/expo-calendar@57.0.2.patch` through pnpm's patched dependency mechanism. The patch changes only the iOS **event** timezone getter:

```swift
expoEvent.event?.timeZone?.identifier
```

There is no separate iOS event end-timezone getter in this version. The same event timezone applies when normalizing both boundaries. Reminder getters and legacy APIs are intentionally unchanged.

The mobile adapter's invariant is that a non-empty native `timeZone` is the original `TimeZone.identifier`, never a localized display label. It converts all-day instants to civil dates using that identifier, preserving the exclusive end. Only genuinely floating events with no source timezone use device-local civil dates. An unsupported non-empty identifier fails visibly rather than silently switching to the viewer timezone. Existing date-only civil values are preserved without conversion.

We do not translate abbreviations into guessed regional zones or blacklist all abbreviations: a real fixed-offset timezone identifier can be valid. Correctness depends on preserving the original native identifier, not guessing from its spelling.

## Parent setup

Merge this entry into the root `package.json`'s existing pnpm settings (the patch author does not modify that file):

```json
{
  "pnpm": {
    "patchedDependencies": {
      "expo-calendar@57.0.2": "patches/expo-calendar@57.0.2.patch"
    }
  }
}
```

The parent must run the workspace installation with pnpm 9.15.0, retain the resulting lockfile patch hash, and verify the installed event getter contains `.identifier`. Commit the manifest registration, lockfile, and patch together. Subsequent frozen-lockfile installs must apply the patch as well.

Rebuild the iOS development client/EAS binary after applying the patch. Metro reloads and JavaScript-only updates do not replace compiled Swift. With CNG, the patched package source is compiled during the native build; no generated iOS source should be hand-edited.

## Regression checks

`apps/mobile/src/native-mapping.test.ts` includes:

- A real-file contract assertion resolving the installed `expo-calendar` package and verifying the **event** Swift getter uses `.identifier`. This intentionally fails before the patch is applied and does not boot native modules.
- A New York summer all-day fixture asserting September 8 through exclusive September 9 and the retained `America/New_York` identifier. It also demonstrates why the upstream `EST` label yields the wrong day.
- Rejection of an invalid, non-empty source timezone rather than viewer-zone fallback.

Run the mapping suite under both viewer timezones after applying the patch:

```sh
TZ=Pacific/Honolulu pnpm --filter @dayline/mobile exec vitest run src/native-mapping.test.ts
TZ=Asia/Tokyo pnpm --filter @dayline/mobile exec vitest run src/native-mapping.test.ts
```

The source assertion verifies the installed dependency, not the Swift compiled into an already-installed app. Native validation must use a rebuilt client and an actual summer all-day EventKit event.

## Upgrade/removal

Reinspect the native event getter when upgrading Expo Calendar. Remove or rebase this version-specific patch only after the upstream API preserves timezone identifiers; retain the regression tests. An unapplied patch or reverted getter must fail the installed-source contract check rather than silently reintroducing date shifts.
