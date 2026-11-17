# New Final: merge notes

`New Final` = **functionality from `Latest Code`** + **UI from `Final Aicyro Pro`** (the New UI public site and the Hallmark redesign of the operator app).

The merge is three-way. Its common ancestor is `Aicyro Multi tenant`, from which both projects grew.

| Category | Files | Taken from |
| --- | --- | --- |
| Changed only in Latest Code | backend, `functions/`, `scripts/`, `widget.js`, `embed/chatbot.jsx`, libs | Latest Code |
| Changed only in Final | `lg.jsx` shell, login screens, Insight, Conversations, superadmin shell and settings, appearance, password, `_document`, `layout`, configs, `login.js` fix | Final |
| New in Final | public site pages and `components/`, styles (`tokens`, `base`, `site`, `closedesk`, `closedesk-widget`), `founding-application` and `generate-audit` APIs, `routeScopes`, `DESIGN.md` | Final |
| Changed in both, auto-merged | AicyroChatbot, HomeScreen, Report, Chatbotsetting, `analytics.js`, `package.json` | git three-way merge (Latest logic + Final markup) |
| Changed in both, hand-resolved | `_app.jsx`, `cookie-consent.js`, `database.rules.json`, Booking, CookieDataDisplay, CookieGrid, CookieMap, TerminalScreen, ClientManagement | see below |
| Rebuilt on Latest's version with the redesign | BusinessProfile, notification-settings, LiveNotifications | Latest code, Final look |

## What Latest Code removed, and so New Final does not have
These are the CD06 to CD15 features:
- appointments API;
- notification jobs API (acknowledge, replay, settings);
- handoff manager, lead contract and idempotency locks;
- policy engine;
- voice lifecycle and voice session API;
- tenant onboarding and the activation checklist;
- release manifest and `/api/version`;
- backup/recovery.

The UI follows suit:
- The tenant table has no Activation Readiness column and no Activate button.
- The checklist dialog is gone.
- Lead status is Booked or Captured.
- The booking drawer has no Appointment ID or Timezone rows.
- The cookie API no longer has its dashboard GET fallback.

## Hand-resolved details
- **Cookie banner** (`components/Essential/CookieConsentBanner.jsx`):
  - Final's design;
  - Latest's tracking (ipinfo plus a freeipapi fallback with timeouts, GPS with a network fallback, accuracy radius, no location prompt after "reject", direct RTDB sync);
  - the direct sync and the cookie use the record ID that the server's same-device merge returns.
- **`cookie-consent.js`:**
  - Latest's richer location record (exact GPS, accuracy, source), written to global `user_cookies` and to the tenant partition;
  - Final's same-device merge (lookup on the global partition) and field-length caps.
- **Rules:** Latest's rules plus `audits`, `founding_applications` and the `ipAddress` index on `user_cookies`.
- **GPS marker:** Latest's "GPS exact" marker shows as a success badge on the cookie grid, the map tooltip and the selected-pin panel.

## Dev server
`npm run dev` runs `next dev --webpack`. With Turbopack (the Next 16 default), the dev server fails to load Bricolage Grotesque: Google Fonts now serves it from a `fonts.gstatic.com/l/font?kit=...` URL that Turbopack's dev font loader cannot parse (`next/font/google queries have exactly one entry`). `next build` is not affected.
