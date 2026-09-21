# CloseDesk / AicyroNext — Repository Analysis

Generated from the synced workspace at `d:\Software House 01\CloseDesk-Aicyro-GIT`.

**Product:** CloseDesk (branded publicly as Aicyro) — a marketing site plus an AI front-desk widget (text + OpenAI Realtime voice), a Pulse admin dashboard (`/lg`), structured logging (`/logs`), and Firebase-backed lead/email automation.

**Runtime:** Next.js 16 pages router, React 19, Tailwind 3, Firebase Realtime Database, OpenAI (chat + Realtime WebRTC), AWS Polly (TTS preview), Firebase Cloud Functions (email).

---

## 1. How the system fits together

```text
Visitor browser
  ├─ Marketing pages (/) ── Navbar, landing sections, cookie banner
  ├─ AicyroChatbot (layout.jsx, hidden on /lg and /logs)
  │    ├─ POST /api/chat          → OpenAI JSON chat + prospects/{session}
  │    ├─ POST /api/openai-token  → OpenAI Realtime client secret
  │    ├─ POST /api/sync-voice    → voice tools, transcripts, telemetry
  │    ├─ POST /api/leads         → leads/{id}
  │    └─ queueEmailAlert()       → email_alerts/{id} ── Cloud Function ── Gmail
  ├─ Free audit wizard        → POST /api/generate-audit → audits/{id}
  └─ Analytics / logs         → /api/analytics, logger → /api/app-state

Admin (/lg)
  ├─ Login vs Firebase `login` / `superadmins`
  ├─ Live RTDB listeners: leads, bookings, conversations, settings
  └─ Settings write chatbot_config, appearance, notifications

Ops
  ├─ /logs  → POST /api/app-query (RBAC over system_logs)
  ├─ GitHub Actions daily → /api/cron/retention-cleanup
  └─ Cloud Function cron hourly → scheduled_reminders
```

The **single source of truth for bot behavior** is `src/lib/ruleBook.js` (policy `2.11.0`), merged with Firebase `settings/chatbot_config` (includes `voiceEnabled` kill switch).

---

## 2. Complete file structure

Omitted from this tree: `node_modules/`, `.next/`, lockfile internals, and local env files (gitignored). Duplicate/legacy copies are listed because they exist in the repo.

```text
CloseDesk-Aicyro-GIT/
├── .eslintrc.json
├── .firebaserc
├── .github/workflows/retention-cron.yml
├── .gitignore
├── .npmrc
├── README.md
├── REDIRECT_CONFIG.md
├── REPOSITORY_ANALYSIS.md          (this document)
├── eslint.config.mjs
├── firebase.json
├── jsconfig.json
├── next.config.js
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── docs/
│   ├── LOGGING_SCHEMA.md
│   ├── VOICE_PRIVACY_POLICY.md
│   ├── VOICE_PRODUCTION_READINESS_SIGNOFF.md
│   └── VOICE_QA_TEST_SUITE.md
├── evaluations/
│   └── report_v2.1.0.json
├── functions/
│   ├── .eslintrc.js
│   ├── .gitignore
│   ├── index.js
│   ├── package.json
│   ├── package-lock.json
│   └── assets/logo.png
├── public/
│   ├── avatars/ai-spark.svg
│   ├── og-image.svg
│   ├── robot.svg
│   └── robots.txt
├── scripts/
│   ├── qa-simulator.js
│   ├── run_evaluations.js
│   ├── vad_tuning_harness.js
│   └── voice_qa_harness.js
└── src/
    ├── assets/icon.svg, robot.svg
    ├── database.json
    ├── styles/globals.css, globals copy.css
    ├── lib/                    (17 modules — tracing, logging, Firebase, policy)
    ├── pages/                  (routes + API)
    └── components/             (UI)
```

### `src/pages/`

```text
_app.jsx, _document.jsx, layout.jsx
index.jsx, 404.jsx, lg.jsx, logs.jsx
free-website-audit.jsx, privacy.jsx, cookie.jsx, termofuse.jsx
api/
  analytics.js, app-query.js, app-state.js, chat.js
  generate-audit.js, generate-email.js, insights.js, leads.js
  login.js, openai-token.js, openai-token copy.js, openai-token copy 2.js
  sync-voice.js, tts.js, upload-logo.js
  cron/retention-cleanup.js
```

### `src/lib/`

```text
firebase.js, ruleBook.js, cookiePersonalization.js
logger.js, loggerPresets.js, alertManager.js
apiMiddleware.js, tracer.js, aiTracer.js, ragTracer.js
toolTracer.js, dbTracer.js, retryTracer.js, integrationTracer.js
auditTracer.js, activityTracker.js, notificationHelper.js
```

### `src/components/`

```text
ThemeProvider.jsx, ThemeToggle.jsx, GlobalActivityTracker.jsx
Chatbot/AicyroChatbot.jsx
Essential/{Navbar, Navbar copy, Footer, Seo, CookieConsentBanner}.jsx
Form/{Popupform, PopupModel}.jsx
Home/{Hero, Problem, TheTurn, NightScene, Pricing, Compare, NotFor, Trust, Offer, Faq, Cta}.jsx
Home/OLD/{Speed, Solution, LivePreviewSection, Process, Industries, Pulse,
          Founding, DoneForYou, TheDifference, FaqAndFooter}.jsx
Dashboard/{LoginScreen, HomeScreen, TerminalScreen, NewScreen, Booking, Insight,
           Conversations, Report, OperatingHours, LiveNotifications,
           CookieDataDisplay, SettingsScreen}.jsx
Dashboard/Settings/{PasswordChange, BusinessProfile, Chatbotsetting,
                    notification-settings, apearance}.jsx
Dashboard/superadmin/{superadminlogin, SuperAdminDashboard, ClientManagement}.jsx
Dashboard/superadmin/Settings/SuperAdminAppearance.jsx
```

---

## 3. External dependencies

### 3.1 npm — Next.js app (`package.json`)

| Package | Role in this repo |
|---|---|
| `next` ^16.1.6 | Pages router, API routes, build |
| `react` / `react-dom` ^19.2.4 | UI |
| `firebase` ^12.13.0 | Client RTDB (config, leads, logs, auth tables) |
| `openai` ^6.37.0 | Chat Completions + (indirect) Realtime session secrets |
| `@aws-sdk/client-polly` | `/api/tts` MP3 synthesis for dashboard voice preview |
| `@aws-sdk/client-transcribe` | Declared; **not imported** by application source |
| `formidable` | Declared; **not used** (upload-logo route is a misplaced token mint) |
| `framer-motion` | Landing motion (OLD/DoneForYou and similar) |
| `jspdf` | PDF export on `/free-website-audit` |
| `lucide-react` | Icons |
| `react-hot-toast` | Dashboard toasts (notifications settings) |
| `react-simple-maps` | Used by CookieDataDisplay (geo visualization) |
| `recharts` | Insight charts |
| `tailwindcss` + `postcss` + `autoprefixer` | Styling |
| `eslint` + `eslint-config-next` | Lint |

Path alias: `@/*` → `./src/*` (`jsconfig.json`).

`.npmrc` sets `legacy-peer-deps=true` (likely for `react-simple-maps` vs React 19).

### 3.2 npm — Cloud Functions (`functions/package.json`)

| Package | Role |
|---|---|
| `firebase-functions` v1 | RTDB `onCreate`, Pub/Sub schedule |
| `firebase-admin` | Server RTDB + timestamps |
| `nodemailer` | Gmail SMTP for alerts and reminders |

Engine: Node 20. Firebase project: `aichatbot-a6217` (`.firebaserc`).

### 3.3 Hosted / HTTP services

| Service | Used by |
|---|---|
| Firebase Realtime Database | Almost all APIs, dashboard, chatbot, Cloud Functions |
| OpenAI Chat Completions | `/api/chat`, `/api/leads` (abandoned summary), `/api/insights`, `/api/generate-audit` |
| OpenAI Realtime `client_secrets` | `/api/openai-token` |
| OpenAI TTS (script) | `scripts/voice_qa_harness.js` |
| AWS Polly | `/api/tts` |
| Make.com webhook | `/api/generate-email` (`MAKE_COM_EMAIL_WEBHOOK_URL`) |
| Gmail SMTP | `functions/index.js` |
| GitHub Actions | Daily POST to `https://aicyro.pro/api/cron/retention-cleanup` |
| Netlify (inferred) | Production host in cron workflow; `.netlify/` gitignored |

### 3.4 Environment variables (names only)

Consumed in source (do not commit values):

- Firebase public: `NEXT_PUBLIC_FIREBASE_*` (apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId, measurementId)
- App: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`
- Secrets: `OPENAI_API_KEY`, `CUSTOM_AWS_REGION`, `CUSTOM_AWS_ACCESS_KEY_ID`, `CUSTOM_AWS_SECRET_ACCESS_KEY`, `MAKE_COM_EMAIL_WEBHOOK_URL`, `WEBHOOK_SECRET`, `CRON_SECRET`
- Functions: `GMAIL_EMAIL`, `GMAIL_PASSWORD`

---

## 4. Internal dependency map

### 4.1 Logging / tracing stack

```text
cookiePersonalization
        ↑
loggerPresets ← logger ← alertManager ← firebase
        ↑
apiMiddleware ← tracer (generateCorrelationId)
        ↑
AI routes: aiTracer, ragTracer, retryTracer, toolTracer, dbTracer, auditTracer
integrationTracer → retryTracer
```

`CloseDeskLogger._transmitToCentralDatabase` POSTs every client/server log to `/api/app-state` (intentionally **not** wrapped in `withApiLogger` to avoid log recursion).

### 4.2 Chat / voice runtime

```text
layout.jsx → AicyroChatbot
               ├─ notificationHelper → firebase (`notifications`, `email_alerts`)
               ├─ activityTracker → /api/analytics
               ├─ tracer.fetchWithTrace → /api/chat, /api/openai-token, /api/sync-voice, /api/leads
               └─ firebase (settings/chatbot_config)

/api/chat        → ruleBook, openai, firebase, ragTracer, aiTracer, retryTracer, apiMiddleware
/api/openai-token → ruleBook, firebase, OpenAI HTTP, apiMiddleware
/api/sync-voice  → firebase, apiMiddleware
functions/index.js ← RTDB email_alerts, scheduled_reminders
```

### 4.3 App shell

```text
_document.jsx (FOUC theme script)
     ↓
_app.jsx → ThemeProvider, layout, GlobalActivityTracker, CookieConsentBanner, trackVisit
     ↓
pages (index, legal, audit, lg, logs, 404)
```

### 4.4 Pulse dashboard (`/lg`)

`lg.jsx` is the router/shell. It imports login screens, superadmin, Home/Terminal/Bookings/Insight/Conversations/Report, settings panels, LiveNotifications, CookieDataDisplay. Those components talk **directly** to Firebase client SDK except Insight (calls `/api/insights`) and TerminalScreen (calls `/api/leads`).

### 4.5 Unused / leftover internals

| File | Notes |
|---|---|
| `src/pages/api/upload-logo.js` | File name/export say upload; **body is a voice token mint** (no formidable) |
| `openai-token copy.js`, `openai-token copy 2.js` | Duplicate token APIs |
| `src/styles/globals copy.css`, `Navbar copy.jsx` | Copies; audit page still uses Navbar copy |
| `src/lib/toolTracer.js` | Implemented; **no API currently imports it** |
| `@aws-sdk/client-transcribe`, `formidable` | In package.json, unused in `src/` |
| `Home/OLD/*` | Imported in `index.jsx` but commented out in the render tree |
| `REDIRECT_CONFIG.md` | Documents `next.config.js` redirects that **are not implemented** (config is `{ reactStrictMode: true }` only) |
| `src/database.json` | Seed login objects with plaintext passwords — treat as sensitive, not production auth |

---

## 5. Firebase Realtime Database paths (internal data graph)

| Path | Writers | Readers |
|---|---|---|
| `settings/chatbot_config` | ChatbotSettings | ruleBook, AicyroChatbot, openai-token |
| `settings/log_retention` | (dashboard/settings, if present) | retention-cleanup |
| `login` | PasswordChange, ClientManagement | login API, LoginScreen |
| `superadmins` | superadmin flows | SuperAdminLogin |
| `users/{username}/appearance` | Appearance settings | ThemeProvider, lg.jsx |
| `users/root/notifications` | NotificationSettings | Cloud Function email |
| `prospects/{session_id}` | chat, sync-voice | chat, openai-token, sync-voice |
| `session_actions/{session_id}` | chat, sync-voice | same |
| `transcripts/{session_id}` | sync-voice; wiped by chat deletion | Conversations |
| `leads/{id}` | /api/leads, chatbot via that API | dashboard, insights |
| `audits/{id}` | generate-audit | Report / audit UI |
| `email_alerts/{id}` | notificationHelper | Cloud Function `sendEmailAlert` |
| `scheduled_reminders` | Cloud Function | `processScheduledReminders` |
| `notifications` | notificationHelper, NotificationSettings | LiveNotifications |
| `analytics/*` | /api/analytics | HomeScreen / Report |
| `analytics_events` | /api/chat | analytics consumers |
| `voice_telemetry/{session}`, `voice_errors/{session}` | sync-voice | ops |
| `system_logs/structured_events/{log_id}` | /api/app-state | /api/app-query, retention |
| `system_logs/activity_events` | legacy | app-query merge |
| `system_alerts` | alertManager | ops UI if any |
| `logs/email_errors` | Cloud Function | ops |

---

## 6. File-by-file core logic

### 6.1 Root / config

| File | Logic |
|---|---|
| `package.json` | Scripts: `dev`, `build`, `start`, `lint`, `test:ai` (evaluations against local `/api/chat`) |
| `next.config.js` | Strict mode only |
| `jsconfig.json` | `@/` alias |
| `tailwind.config.js` | `darkMode: "class"`; CSS-variable color tokens; scans `src/pages` and `src/components` |
| `postcss.config.js` | Tailwind + Autoprefixer |
| `eslint.config.mjs` | Flat config wrapping `next/core-web-vitals` |
| `.eslintrc.json` | Legacy ESLint config (alongside flat) |
| `firebase.json` | Deploys `functions/` codebase, Node ignore patterns |
| `.firebaserc` | Default project `aichatbot-a6217` |
| `.gitignore` | node_modules, Next output, `.env*`, `.netlify` |
| `.npmrc` | `legacy-peer-deps=true` |
| `README.md` | Outdated structure notes (`/services`, `/portfolio` routes do not exist) |
| `REDIRECT_CONFIG.md` | How-to for redirects/404; not wired in current `next.config.js` |

### 6.2 Docs / evaluations / public / assets

| File | Logic |
|---|---|
| `docs/LOGGING_SCHEMA.md` | Canonical structured log fields (services Website/API/AI/Voice/Pulse) |
| `docs/VOICE_PRIVACY_POLICY.md` | Voice data handling policy |
| `docs/VOICE_PRODUCTION_READINESS_SIGNOFF.md` | Launch checklist |
| `docs/VOICE_QA_TEST_SUITE.md` | Voice QA scenarios |
| `evaluations/report_v2.1.0.json` | Last `npm run test:ai` output |
| `public/robots.txt`, `og-image.svg`, `robot.svg`, `avatars/ai-spark.svg` | SEO/static |
| `src/assets/*` | Component-imported SVGs |
| `src/styles/globals.css` | Theme CSS variables (`data-theme`, brand hues) |
| `src/styles/globals copy.css` | Duplicate stylesheet |
| `src/database.json` | Local seed of `login` users (plaintext) |

### 6.3 Cloud Functions

**`functions/index.js`**

1. `sendEmailAlert` — onCreate `/email_alerts/{alertId}`: skip if not `pending`; load `users/root/notifications`; honor `urgentAlerts` / `afterHoursAlerts`; send admin HTML (chat start vs lead); optionally send visitor confirmation; queue `scheduled_reminders` (24h after booking and 24h before meeting); mark sent/error.
2. `processScheduledReminders` — hourly Pub/Sub: send due pending reminder emails.

**`functions/assets/logo.png`** — CID attachment `company-logo`.

**`functions/.eslintrc.js`** — Google ESLint for Functions.

### 6.4 GitHub

**`.github/workflows/retention-cron.yml`** — Daily 00:00 UTC (and manual) `curl` with `CRON_SECRET` to production retention API.

### 6.5 Scripts

| File | Logic |
|---|---|
| `scripts/run_evaluations.js` | Hits `localhost:3000/api/chat` with pricing/handoff/deletion cases; writes `evaluations/report_*.json` |
| `scripts/qa-simulator.js` | Smoke tests chat + sync-voice validation |
| `scripts/voice_qa_harness.js` | OpenAI TTS MP3s for pronunciation QA |
| `scripts/vad_tuning_harness.js` | Offline table of pause lengths vs VAD `silence_duration_ms` |

### 6.6 `src/lib` (core)

| File | Logic | Internal deps | External |
|---|---|---|---|
| `firebase.js` | Singleton Firebase app + `db` | — | `firebase/app`, `firebase/database`, env |
| `ruleBook.js` | Defaults + merge `settings/chatbot_config`; builds text JSON-schema vs voice brevity instructions; `POLICY_VERSION` | firebase | Firebase |
| `cookiePersonalization.js` | Strict cookies: consent + anon UUID | — | `document.cookie` |
| `logger.js` | `CloseDeskLogger`: redact secrets/PII, whitelist context, console JSON, POST `/api/app-state`, smart alerts | alertManager | fetch |
| `loggerPresets.js` | Factories: Website, API, AI, Voice, Pulse + browser UA context | logger, cookiePersonalization | — |
| `alertManager.js` | On CRITICAL / named events, throttle 5 min, push `system_alerts` | firebase | Firebase |
| `apiMiddleware.js` | Wrap API: correlation headers, patch `res.json/send/end`, log latency/status, catch 500 | loggerPresets, tracer | — |
| `tracer.js` | UUID, `x-correlation-id` / `x-session-id`, `fetchWithTrace` 15s abort | cookiePersonalization, loggerPresets | fetch |
| `aiTracer.js` | Wrap LLM promise: tokens, tools, handoff; `safeParseAiResponse` | — | — |
| `ragTracer.js` | Wrap retrieval; log IDs/scores not content | — | — |
| `toolTracer.js` | Parse tool JSON, execute, return LLM-safe errors | — | — |
| `dbTracer.js` | Time Firebase ops; classify permission/network/timeout | — | — |
| `retryTracer.js` | Exponential backoff; CRITICAL on final fail | — | — |
| `integrationTracer.js` | Sanitize URL/headers, fetch + retry | retryTracer | fetch |
| `auditTracer.js` | who/what/target/previous/new security vs admin | — | — |
| `activityTracker.js` | Skip `/lg`; POST page_view / chatbot_opened / conversation_started | cookiePersonalization | `/api/analytics` |
| `notificationHelper.js` | `logToFirebase` + `queueEmailAlert` | firebase | Firebase |

### 6.7 API routes

| File | Logic |
|---|---|
| `chat.js` | POST only. Rate-limit 15/min/session. Prompt-injection flag. Merge prospect + client lead. Mock RAG wrap. `getMasterRuleBook("text")`. OpenAI `json_object` with retry+trace. Sanitize contact/website. Persist `prospects`, `session_actions`, optional transcript wipe on `TRIGGER_DATA_DELETION`. Always 200 with fallback reply on engine failure. |
| `openai-token.js` | POST. Validate `lead_{ts}_{hash}` session. Rate-limit 5/min IP+session. Load prospect. Voice rulebook. **403 if `voiceEnabled === false`**. Mint OpenAI Realtime client secret with tools (context, audit, consult, callback, handoff, privacy, deletion). |
| `sync-voice.js` | POST. Actions: telemetry, errors, transcripts. Else route `tool_name` into prospect flags with idempotency (`session_actions`). Validates email/website. |
| `leads.js` | GET all leads. POST upsert `leads/{id}`; duplicate skip; abandoned-chat OpenAI summary; dbTracer on read/write. |
| `app-state.js` | POST ingest structured log → `system_logs/structured_events/{log_id}` |
| `app-query.js` | POST RBAC log query (SUPERADMIN/DEVELOPER/QA/SUPPORT/CLIENT); merge legacy activity; cap 1500; tenant isolation |
| `analytics.js` | POST counters + visitor events + profile |
| `login.js` | POST username/password against `login` RTDB (plaintext compare); audit trail |
| `insights.js` | POST: last 50 leads → OpenAI KPI/chart JSON |
| `generate-audit.js` | POST: save audit lead, GPT conversion report, update node (re-inits Firebase instead of shared `lib/firebase`) |
| `generate-email.js` | POST Make.com webhook via integrationTracer |
| `tts.js` | POST Polly neural MP3; maps OpenAI voice `ash` → Polly `Matthew` |
| `upload-logo.js` | **Misnamed** Realtime token mint without session/tools |
| `openai-token copy*.js` | Older token handlers |
| `cron/retention-cleanup.js` | Bearer `CRON_SECRET`; require approved `settings/log_retention`; delete aged logs by category |

### 6.8 Pages (routes)

| File | Logic |
|---|---|
| `_document.jsx` | HTML lang; inline script applies `closeDesk-theme` except `/lg` |
| `_app.jsx` | Global CSS, ThemeProvider, layout, GlobalActivityTracker, visit tracking, cookie banner (not on `/logs`). Popupform commented out |
| `layout.jsx` | Mounts `AicyroChatbot` except `/lg` and `/logs` |
| `index.jsx` | Marketing home: canvas grid FX, Navbar, PopupModal, Hero, NightScene, TheTurn, Problem, Pricing, Compare, NotFor, Trust, Offer, Faq, CTA, Footer, Popupform. `Home/OLD/*` are imported but commented out in the JSX return |
| `lg.jsx` | Pulse shell: session terminate on reload, user vs superadmin login, sidebar views, theme hues, Firebase appearance |
| `logs.jsx` | Auth from localStorage; poll `/api/app-query`; filters, live mode, pagination |
| `free-website-audit.jsx` | 16-step wizard; `/api/generate-audit`; jsPDF; Navbar copy + Footer |
| `privacy.jsx` / `cookie.jsx` / `termofuse.jsx` | Static legal + Seo/Navbar/Footer |
| `404.jsx` | Themed 404 with mouse glow |

### 6.9 Chatbot

**`AicyroChatbot.jsx`** — Widget state machine (`WELCOME` → chat / booking path). Dual loggers (AI + Voice). Loads `chatbot_config`. Text: `fetchWithTrace("/api/chat")` with JSON schema UI (shortcuts, booking calendar). Voice: token → WebRTC Realtime; tools forwarded to `/api/sync-voice`; transcripts/telemetry/errors. Queues emails via `notificationHelper`. Tracks open/start. Global error listeners. Persists leads through `/api/leads`. Industry demo scripts for home-services verticals.

### 6.10 Essential / theme / forms

| File | Logic |
|---|---|
| `ThemeProvider.jsx` | Public vs dashboard theme; live `users/{user}/appearance`; CSS vars / `data-theme` |
| `ThemeToggle.jsx` | localStorage light/dark |
| `GlobalActivityTracker.jsx` | Window error, resource 404, unhandledrejection → Website logger |
| `Seo.jsx` | `next/head` title/description/OG |
| `Navbar.jsx` | Marketing nav, popup callback |
| `Navbar copy.jsx` | Alternate navbar used by audit page |
| `Footer.jsx` | Footer links |
| `CookieConsentBanner.jsx` | Consent cookie + anon id; device label |
| `Popupform.jsx` / `PopupModel.jsx` | Lead popups writing Firebase `push`/`update` |

### 6.11 Home (current)

Marketing sections: Hero (large visual), Problem, NightScene (lead-feed story), TheTurn, Pricing, Compare, NotFor, Trust, Offer, Faq, Cta. Mostly React + lucide + CSS; **no API**.

### 6.12 Home/OLD

Legacy landing blocks still in tree (and imported by `index.jsx`): Speed, Solution, LivePreviewSection, Process, Industries, Pulse, Founding, DoneForYou (framer-motion), TheDifference, FaqAndFooter. Treat as historical UI unless still rendered in the JSX return of `index.jsx`.

### 6.13 Dashboard (Pulse)

| File | Logic |
|---|---|
| `LoginScreen.jsx` | Client login vs `login` node; logger + correlation |
| `superadminlogin.jsx` | Superadmin login vs RTDB |
| `SuperAdminDashboard.jsx` | Superadmin shell |
| `ClientManagement.jsx` | CRUD clients; pulse logger + audit |
| `SuperAdminAppearance.jsx` | Superadmin theme |
| `HomeScreen.jsx` | Analytics summary from RTDB |
| `TerminalScreen.jsx` | Lead terminal; `/api/leads`; audit on actions |
| `NewScreen.jsx` | Alternate/new view stub |
| `Booking.jsx` | Live bookings list; `update` status |
| `Insight.jsx` | KPIs/charts from `/api/insights` + recharts |
| `Conversations.jsx` | Transcript/lead conversations |
| `Report.jsx` | Reporting from RTDB |
| `OperatingHours.jsx` | Hours from Firebase |
| `LiveNotifications.jsx` | Live `notifications` |
| `CookieDataDisplay.jsx` | Visitor cookie/geo analytics + maps |
| `SettingsScreen.jsx` | Combined settings writer |
| `PasswordChange.jsx` | Update `login` passwords |
| `BusinessProfile.jsx` | Business profile + logo fields |
| `Chatbotsetting.jsx` | Writes `settings/chatbot_config` (voice, VAD, identity); audit |
| `notification-settings.jsx` | Email/alert prefs + toast + test push |
| `apearance.jsx` | Theme preview using Home/Terminal/Booking |

---

## 7. Request / data flow (text chat)

1. Widget creates `session_id` matching `lead_{timestamp}_{hash}`.
2. User message → `/api/chat` with history + `current_lead_data`.
3. Server merges `prospects/{session}`, builds policy prompt, calls GPT JSON.
4. Sanitized `context_patch` saved; flags enqueue `session_actions`.
5. Widget may POST `/api/leads` and `queueEmailAlert` → Function emails.

Voice: `/api/openai-token` (kill switch) → browser WebRTC → model tool calls → `/api/sync-voice` same prospect graph.

---

## 8. Notable architectural facts

- **Pages router only** — no `src/app/`.
- **Observability is first-class**: almost every API is `withApiLogger`; UI uses presets; logs land in RTDB and `/logs`.
- **RAG is stubbed**: chat wraps a mock vector search when `retrievedKnowledge` is passed from the client.
- **Auth is not Firebase Auth**: dashboard uses RTDB password tables + `localStorage` (`currentUser`, `currentSuperAdmin`). `/api/app-query` trusts client-supplied `role`/`userId` (server-side RBAC on logs, not cryptographic session).
- **Voice rollback**: `settings/chatbot_config.voiceEnabled = false` hides UI (via config fetch) and 403s token mint.

---

## 9. Suggested reading order for engineers

1. `src/lib/ruleBook.js` — product policy  
2. `src/pages/api/chat.js` + `src/components/Chatbot/AicyroChatbot.jsx`  
3. `src/pages/api/openai-token.js` + `sync-voice.js`  
4. `src/lib/logger.js` + `apiMiddleware.js` + `docs/LOGGING_SCHEMA.md`  
5. `functions/index.js` + `notificationHelper.js`  
6. `src/pages/lg.jsx` + dashboard settings (`Chatbotsetting.jsx`)
