# Security and privacy

This documents implemented safeguards and remaining work, not a security
certification or production-readiness claim.

## Mobile data boundary

Apple calendars are read locally through EventKit after user permission. iOS full
calendar access is broader than read-only access, but the implemented provider
exposes no create/update/delete operations and the UI is read-only. Reminders
access is not requested. Users may stay with the empty local calendar without
permission or an account.

The mobile app has **no backend connection, database credentials, login flow, or
auth token storage**. Never put `DATABASE_URL`, server secrets, or production
credentials in mobile code, Expo public environment variables, or app config.
System event payloads are not uploaded to the API or mirrored into SQLite.

SQLite stores UI preferences and the local-calendar foundation. Hidden calendar
IDs are persisted, so local preferences are not necessarily devoid of sensitive
metadata. The database is ordinary Expo SQLite in the app container; no custom
database encryption or secure-erasure feature is implemented. Do not claim that
platform storage isolation alone meets every at-rest protection requirement.

System reads are guarded by permission checks and invalidation generations.
Backgrounding removes system query data and invalidates in-flight reads;
foregrounding rechecks permission. When access is not granted, system navigation
handles are cleared. These controls are not a verified app-switcher screenshot
shield or a guarantee of byte-level memory erasure.

## Event details and URLs

Routes carry bounded, in-memory opaque handles rather than event IDs, titles,
notes, or locations. Handles are session-only references, **not cryptographic
authentication tokens**, authorization credentials, or shareable links. Permission
is revalidated before system data is read. Expired, moved, deleted, or inaccessible
events have unavailable states.

Event-supplied URLs are displayed as selectable text and never opened automatically.
Notes and locations are rendered as text, not executable HTML. Avoid adding event
payloads to analytics, crash breadcrumbs, logs, clipboard flows, or route params
without an explicit privacy review.

## API safeguards implemented

The Express 5 API exposes `/health` and `/ready`, not account or calendar APIs.
Its current safeguards include:

- Validated environment configuration, generic failure responses, shared response
  contracts, and server-generated request IDs rather than trusted inbound IDs.
- Helmet headers, disabled `X-Powered-By`, and `Cache-Control: no-store`.
- Exact-origin CORS, disabled credentialed CORS, and GET/HEAD/OPTIONS preflights.
  Origin-less native/CLI requests are allowed. **CORS is not authentication.**
- Process-local in-memory rate limiting, including health/readiness and preflight.
  Restart resets this state; it is not a distributed limiter.
- A 16 KiB JSON limit, rejected compressed JSON, bounded server/database timeouts,
  and graceful shutdown behavior.
- `trust proxy: false`. Forwarded headers are not an authority for client IPs;
  reverse-proxy deployments need deliberate topology configuration.

Request logs include method, generated request ID, status, duration, and aborted
state, but omit URLs, query strings, IPs, headers, bodies, and raw error objects.
Pino redacts known secret fields as additional defense in depth. Field redaction
cannot sanitize secrets embedded in arbitrary message strings. ORM query/error
logging is disabled. See [API documentation](../apps/api/README.md) for details.

## Development and deployment secrets

Root Compose binds PostgreSQL 17 to loopback and uses local-only example
credentials. This is a development foundation, not a production database security
configuration. Preserve `.env` privacy; use managed secret injection, appropriate
TLS, restricted network access, and deployment-specific credentials outside local
development. Do not publish database ports or trust arbitrary proxies by copying
the local setup into production unchanged.

EAS builds send project source to Expo's build service and require project/account
configuration. Review uploaded files, signing access, and build-service settings.
Do not intentionally include local secrets or private calendar fixtures in source.

## Milestone 8 authentication — future specification, not shipped

Account/session/device/preference tables are persistence foundations only. There
are no login, registration, session issuance/validation, refresh, sign-out, or
account-management endpoints; no ownership middleware or auth UI exists.

Before exposing account data or mutations, implement and validate authentication,
email normalization/verification, token digest generation, rotation/revocation,
secure client credential storage, account/device authorization, abuse controls,
and deletion/retention rules. The session hash column is not an authentication
implementation. Sync, widgets, and event mutations need their own consent and
privacy review before expanding today's data boundary.
