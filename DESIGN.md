# Design: CloseDesk (Final Aicyro Pro)

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System
- Genre: modern-minimal
- Public site: shape "night shift" (`src/styles/site.css`, scoped under `.site`)
- Operator app (`/lg`, super admin, chatbot widget): shape "app screen" (`src/styles/closedesk.css`, scoped under `.cd-app`, widget under `.cdw`)
- Theme: brand. CloseDesk violet `#8a2be2` is the default signal, and every tenant hue (Appearance: mode, hue, shade) replaces it through `--primary`
- Axes: light/grotesk-sans/chromatic-violet · posture: restrained (the accent marks the primary action, the current selection, focus and the one chart series that argues, nothing else)

## Tokens
`src/styles/tokens.css` is the source of truth. It maps every role onto the tenant theme variables in `globals.css`, so never hard-code a colour.
```css
:root {
  --color-paper: var(--background);  --color-paper-2: mix(card, background);  --color-paper-3: var(--card-bg);
  --color-ink: var(--foreground);  --color-ink-2: var(--foreground-muted);  --color-muted: var(--foreground-muted);  --color-rule: var(--border-color);
  --color-accent: var(--primary);  --color-accent-ink: var(--on-primary);  --color-focus: var(--primary);
}
.cd-app, .cdw {   /* closedesk.css */
  --font-body: Instrument Sans;  --font-display: Bricolage Grotesque (wordmark only);  --font-mono: system mono (code, IDs, timestamps only);
  --text-2xs 12px · --text-xs 13 · --text-sm 14 (app body) · --text-md 16 · --text-lg 19.2 · --text-xl 23 (screen title) · --text-2xl 27.6 (figures)
  --radius-panel: 12px;  --radius-control: 8px;  --radius-chip: 6px;  --control-h: 36px;  --control-h-sm: 30px;
  --color-danger, --color-warn, --color-success (+ -wash), --color-hover, --color-selected;
}
```
Tailwind names: `bg-paper`, `bg-paper-2`, `bg-paper-3`, `text-ink`, `text-ink-2`, `border-rule`, `text-signal`, `bg-signal`, `text-signal-ink`, `bg-signal-wash`, `text-danger`, `text-success`, `text-warn`, `bg-hover`, `bg-selected`, `rounded-panel`, `rounded-control`, `rounded-chip`, `font-body`, `font-display`, `font-mono`. Spacing uses Tailwind's 4px steps.

## Kit (closedesk.css)
Shell `cd-shell`, `cd-side`, `cd-nav-item` (`aria-current="page"`), `cd-top`, `cd-main`. Page `cd-page`, `cd-page__head`, `cd-h1`, `cd-h2`, `cd-h3`, `cd-sub`, `cd-meta`, `cd-num`, `cd-grid` with `cd-span-*`. Surfaces `cd-panel` (`__head`, `__body`, `__foot`), `cd-well`, `cd-divider`. Figures `cd-stats` (`--cols`) with `cd-stat`, `__label`, `__value`, `__note`; `cd-dl`; `cd-bar`. Tables `cd-table-wrap`, `cd-table`. Controls `cd-btn` (primary), `--quiet`, `--ghost`, `--danger`, `--sm`, `--block`; `cd-icon-btn`; `cd-link`; `cd-seg` and `cd-tabs` (state on `aria-pressed`, `aria-selected` or `data-active`). Fields `cd-field`, `cd-label`, `cd-input`, `cd-select`, `cd-textarea`, `cd-help` (`--error`), `cd-check`, `cd-switch`. Status `cd-badge` (`--signal`, `--success`, `--danger`, `--warn`), `cd-alert`, `cd-empty`, `cd-skel`, `cd-spinner keep-motion`. Overlays `cd-overlay`, `cd-dialog`, `cd-popover`, `cd-toast`. Login `cd-auth`.

## Rules
- Surface ladder: page paper, then a `cd-panel` (one 1px rule, no shadow), then a `cd-well` or hairlines inside it. Never a panel inside a panel, never a border and a shadow together, no glows, blurs, glass or gradients.
- Figures sit in a `cd-stats` row parted by hairlines, never a wall of cards. Tables have rules only, sentence-case heads, tabular numerals.
- Labels, table heads, badges and nav are sentence case, never uppercase, never tracked. Mono only for codes, IDs and timestamps.
- One filled primary button per screen or dialog. Delete and destructive actions use `cd-btn--danger`.
- Icons are inline SVG with `aria-hidden="true"` (or lucide-react); never emoji. No decorative status dots or pinging dots.
- Motion is state only: `transition-colors`, `transition-opacity` or `transition-transform`, never `transition-all`; no hover lifts or scales on cards; every keyframe has a reduced-motion fallback (`motion-safe:` / `motion-reduce:`).
- Every region that loads data keeps the loading, empty and error states it already has logic for.

## Controls
- Primary: accent fill · 8px radius · 36px (30px small)
- Secondary: paper-3 with a rule border, same radius and height

## Motion
- Character: brisk, state only; under reduced motion everything ends at once.

## Exports
`tokens.css` and `closedesk.css` in this project; Tailwind names in `tailwind.config.js`.
