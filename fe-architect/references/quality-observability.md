# Quality, Observability & Cross-Cutting

> Testing, monitoring, resilience, a11y, i18n, PWA, SEO. Reference material for the fe-architect skill. Load for testing strategy, observability/RUM, error boundaries & resilience, A/B testing, accessibility, internationalization, PWA/offline, and SEO.

## A/B Testing & Experimentation

**One-liner:** Ship variants without flicker using server-side bucketing and guardrail metrics.

**Key tradeoffs:**
- **Pros:** Edge assignment renders the right variant on the first byte, with no flicker and less measurement noise from bots; stable bucketing (hash of user ID + experiment ID) keeps a user in one variant across sessions; CUPED cuts the sample size needed for significance by ~30-50%
- **Cons:** Requires server-side infra (edge middleware or origin handler), not just client JS; cached experiment routes must set `Vary: Cookie` or they break the split; running two experiments on the same surface needs mutex groups to avoid interaction effects

**When to use:** assign at the edge before HTML is generated; hash user ID + experiment ID together so experiments produce independent bucket sequences; use a mutex group when two experiments touch the same UI surface
**When to avoid:** client-side swaps that hide control and inject the variant after load; reading any metric while a sample ratio mismatch is present

**Key terms:** **Stable bucketing**: hashing user ID + experiment ID so the same user always lands in the same variant. **Mutex group**: a shared traffic pool where each user enters at most one experiment in the group. **Sample ratio mismatch (SRM)**: measured variant traffic differing significantly from the intended split, signaling broken assignment. **CUPED**: Controlled-experiment Using Pre-Experiment Data; reduces variance by regressing out a pre-experiment covariate. **Variant assignment**: placing a user in group A or B, done once per experiment before the response is sent.

**Pitfalls:**
- A cached rewrite response that ignores the assignment cookie serves one variant to everyone. Set `Vary: Cookie` on cached experiment routes.
- An SRM (e.g. targeting 50/50 but measuring 47/53) means stop reading metrics; a chi-square p-value < 0.01 means the split is broken.
- Client-side assignment renders the control first, then swaps, a visible flash that harms UX and measurement.

**Interview angle:** "Hash the user ID at the edge, rewrite the URL, and check for SRM before trusting any metric."

**Related:** `deployment-strategies-feature-flags`, `frontend-observability`, `caching-strategies`, `cdn-edge-caching`

**Deep dive:** https://fearchitect.com/topics/ab-testing-experimentation

---

## Accessibility (a11y)

**One-liner:** WCAG 2.2 AA: semantic HTML, keyboard nav, and ARIA done right.

**Key tradeoffs:**
- **Pros:** Semantic HTML is free accessibility: a `<button>` gives keyboard events, focus, and role with zero ARIA; passing AA improves usability for everyone; required by law in many jurisdictions (ADA, EN 301 549)
- **Cons:** Automated axe scanning catches only ~57% of issues; the rest (reading order, focus quality, meaningful alt text) need manual and screen-reader testing; wrong ARIA actively breaks screen readers with no visible signal to sighted users

**When to use:** start with correct semantic HTML; reach for ARIA only when no native element expresses the required role or state (custom combobox, live region); trap focus in modals (WCAG SC 2.1.2)
**When to avoid:** adding a role/state a native element already provides; relying on an icon alone for a button's name

**Key terms:** **WCAG 2.2 AA**: W3C standard with 50 success criteria at AA, the legal minimum in most jurisdictions. **POUR**: the four principles: Perceivable, Operable, Understandable, Robust. **ARIA**: attributes that expose role, state, and properties to assistive tech. **accessible name**: the text a screen reader announces; computed from label, aria-label, or aria-labelledby. **focus trap**: constraining Tab/Shift-Tab within an open modal so keyboard users can't reach content behind it.

**Pitfalls:**
- No ARIA is better than bad ARIA. A wrong role/state breaks screen readers silently; `role="button"` on a `<div>` also needs `tabindex="0"` plus Enter/Space handlers.
- Icon buttons need an `aria-label` (`<button aria-label="Close">`). Never rely on the icon alone.
- Modals must trap Tab/Shift-Tab and honor Escape (no keyboard trap, SC 2.1.2); mark the backdrop `inert`.
- Contrast must be ≥4.5:1 (AA); interactive targets ≥44×44 px (SC 2.5.5).

**Interview angle:** "Semantic HTML is free accessibility. A `<button>` gives you keyboard events, focus, and role with zero ARIA. Add ARIA only when the native element can't express the state."

**Related:** `frontend-testing`, `frontend-observability`, `ci-cd-frontend`, `seo`

**Deep dive:** https://fearchitect.com/topics/accessibility

---

## Error Boundaries & Resilience

**One-liner:** Isolate render failures so one widget can't crash the page.

**Key tradeoffs:**
- **Pros:** Contains a crash to a subtree instead of unmounting the whole React tree; per-widget placement keeps the rest of the UI alive; Next.js App Router formalizes it with `error.tsx`/`global-error.tsx`; `resetKeys` enables automatic retry on dependency change
- **Cons:** Doesn't catch event-handler errors, async errors, SSR errors, or errors in the boundary itself; a route-level boundary blacks out the whole page on any child error

**When to use:** place the boundary as close to the risky subtree as possible; per-widget so a broken panel doesn't take down the route; use `resetKeys` (e.g. a route param) to retry after navigation
**When to avoid:** relying on a boundary for event handlers (use try/catch) or async code (rethrow via `useErrorBoundary`); expecting browser boundaries to catch server-render errors

**Key terms:** **error boundary**: a class component implementing `getDerivedStateFromError`/`componentDidCatch` that catches render-phase errors in its subtree. **react-error-boundary**: package wrapping the class API into `<ErrorBoundary>` + `useErrorBoundary` for function components. **resetKeys**: props that reset error state when their values change, enabling retry. **error.tsx**: Next.js file that becomes the error boundary for its route segment (gets `error` + `reset`). **global-error.tsx**: root-level file catching root-layout errors; must render its own `<html>` and `<body>`.

**Pitfalls:**
- Boundaries don't catch event handlers, async (`setTimeout`/Promise rejections), SSR, or the boundary's own render. Each needs a different mechanism.
- `global-error.tsx` replaces the root layout, so it must render its own `<html>` and `<body>` or the page is malformed.
- A route-only boundary means any child error blacks out the entire page. Granularity controls blast radius.

**Interview angle:** "An error boundary is a blast-radius control. Place it as close to the risky subtree as possible so a widget crash doesn't take down a working route."

**Related:** `frontend-testing`, `frontend-observability`, `rendering-strategies`, `react-server-components`, `deployment-strategies-feature-flags`

**Deep dive:** https://fearchitect.com/topics/error-boundaries-resilience

---

## Frontend Observability

**One-liner:** Capture errors, measure real-user performance, and trace what breaks in production.

**Key tradeoffs:**
- **Pros:** Source maps turn minified line numbers into actionable file + line references; session replay cuts mean-time-to-reproduce from hours to minutes; RUM with web-vitals gives real-device INP/LCP that Lighthouse can't replicate; distributed tracing links a frontend error to the exact backend span
- **Cons:** Sentry SDK adds ~50 kB gzipped, replay another ~20 kB; source maps on a public CDN expose original code (upload to Sentry only); high replay sample rates can breach storage quotas; `window.onerror` misses cross-origin script errors without CORS headers + `crossorigin`

**When to use:** all three capture layers together: global JS errors, framework error boundaries, and failed fetches; raise `replaysOnErrorSampleRate` to 1.0 but keep session rate low to control cost; use `navigator.sendBeacon` for RUM so the POST survives page unload
**When to avoid:** enabling session replay without masking or a DPA covering GDPR/CCPA; uploading source maps to a public CDN

**Key terms:** **window.onerror**: global handler for uncaught synchronous JS errors. **unhandledrejection**: window event when a Promise rejects with no `.catch()`. **Error boundary**: React component catching render-phase exceptions and rendering a fallback. **RUM**: Real-User Monitoring; performance + error data from actual browsers in production. **Source map**: `.map` file mapping minified output back to original source file, line, and column.

**Pitfalls:**
- Session replay records DOM snapshots that capture passwords, payment fields, and PII. Set `maskAllText: true` and `blockAllMedia: true` and opt elements out, not in.
- `window.onerror` misses cross-origin script errors (needs CORS headers + `crossorigin`), promise rejections (needs `onunhandledrejection`), and try/catch-swallowed errors.
- Without source maps, production stack traces point at line 1, column 50000, which is useless. Upload them to Sentry, never the CDN.

**Interview angle:** "Three layers: global JS errors, framework error boundaries, and failed fetches. Miss any one and you have a blind spot."

**Related:** `error-boundaries-resilience`, `core-web-vitals`, `frontend-testing`, `network-performance`

**Deep dive:** https://fearchitect.com/topics/frontend-observability

---

## Frontend Testing Strategy

**One-liner:** Test what the user sees, not how the code is wired.

**Key tradeoffs:**
- **Pros:** The testing trophy weights integration tests highest for the best confidence-to-maintenance ratio; behavior tests (query by role/label/text) survive safe refactors; MSW runs the same fetch code path in tests and production
- **Cons:** Implementation-detail unit tests break on refactors and erode trust without catching bugs; snapshot tests of large trees break on any change and give no signal; mocking `fetch` directly tests the mock, not your code

**When to use:** spend most effort on integration tests (Testing Library + MSW); Playwright for E2E and real-browser needs (CSS layout, scroll, browser APIs jsdom lacks); test all network states: loading, success, error, empty
**When to avoid:** testing library internals (state, private methods); snapshotting large component trees; `await sleep(n)`. Always await a condition

**Key terms:** **Testing trophy**: weighting model prioritizing integration over unit tests. **Testing Library**: DOM query library forcing interaction through accessible roles, labels, and text. **MSW (Mock Service Worker)**: network interception via a Service Worker; tests fire real fetches, handlers return fakes. **Playwright component testing**: mounts a single component in a real browser for E2E-grade accuracy. **server.use**: MSW v2 API to override a handler per test; `server.resetHandlers()` restores defaults.

**Pitfalls:**
- Replacing `global.fetch` with `vi.fn()`/`jest.mock` tests the transport mock, not your code. Swap the MSW handler, not the transport.
- Never `await sleep(n)`; await a condition (`findByText`, `waitFor`, Playwright auto-wait) or tests go flaky.
- MSW v2 renamed `rest.get` → `http.get` and `ctx.json` → `HttpResponse.json`; v1 patterns silently fail to intercept.
- Quarantine and diagnose a flaky test (fix the race), never disable and forget.

**Interview angle:** "Test behavior from the user's perspective. Query by role, intercept the network with MSW, and treat a flaky test as a bug, not a skip."

**Related:** `frontend-observability`, `error-boundaries-resilience`, `ci-cd-frontend`

**Deep dive:** https://fearchitect.com/topics/frontend-testing

---

## Internationalization (i18n)

**One-liner:** Ship UI that works correctly in any locale without code changes.

**Key tradeoffs:**
- **Pros:** The native `Intl` API formats numbers, dates, relative times, and plural categories locale-aware; ICU MessageFormat expresses a full sentence as one translatable unit with plural/select built in; CSS logical properties mirror for RTL at zero runtime cost
- **Cons:** String concatenation breaks word order, plural rules, and grammatical gender in most languages; `dir="rtl"` alone doesn't flip physical CSS properties; getting it wrong at the data layer is expensive to fix late

**When to use:** one ICU message per sentence with embedded slots; format with `Intl.NumberFormat`/`DateTimeFormat` passing the locale explicitly; locale routing via URL prefix (`/fr/`) or `Accept-Language` negotiation at the edge; run pseudo-localization in CI
**When to avoid:** concatenating translated fragments; `toLocaleString()` without a locale argument; physical CSS side properties (`margin-left`) for RTL layouts

**Key terms:** **ICU MessageFormat**: syntax with `{var}`, `{count, plural, …}`, `{gender, select, …}`; one translatable unit per sentence. **Intl API**: browser namespace: `NumberFormat`, `DateTimeFormat`, `RelativeTimeFormat`, `PluralRules`, `Collator`. **locale routing**: serving locale content via URL prefix or `Accept-Language` negotiation at the edge. **CSS logical properties**: flow-relative CSS (`margin-inline-start`) that mirrors for RTL automatically. **pseudo-localization**: expanded, accented string variants in CI to surface layout bugs before translations exist.

**Pitfalls:**
- `"You have " + count + " items"` breaks on word order, plurals, and gender. Use one ICU message per sentence.
- `dir="rtl"` flips text but not `margin-left`/`padding-right`/`border-left`. Replace every physical side property with its logical equivalent.
- `toLocaleString()` without a locale argument silently uses the runtime's locale, producing inconsistent output.

**Interview angle:** "Concatenated translations break word order and plurals. One ICU message per sentence, formatted by `Intl`, is the only safe model."

**Related:** `accessibility`, `seo`, `frontend-testing`, `frontend-observability`

**Deep dive:** https://fearchitect.com/topics/internationalization

---

## PWA & Offline

**One-liner:** Installable, offline-capable web apps via service workers and manifests.

**Key tradeoffs:**
- **Pros:** Adds installability (manifest + 192×192 icon) and offline capability (SW fetch handler) on top of a normal site; Workbox/Serwist handle the strategy boilerplate; `navigationPreload` fetches in parallel with SW boot to cut response time; IndexedDB persists structured data across SW restarts
- **Cons:** `skipWaiting` races with open tabs: new SW code runs against old page assets; caches grow unbounded without an expiration plugin; a manifest alone doesn't make a site offline-capable, only the SW fetch handler does

**When to use:** pick the strategy per asset: cache-first for versioned static assets, network-first for API data that must be fresh, stale-while-revalidate for non-critical assets tolerating a one-request lag, network-only for analytics/POSTs; IndexedDB for queryable structured offline data
**When to avoid:** calling `skipWaiting` without a user prompt; cache-first where stale results cause user errors (inventory, auth)

**Key terms:** **Service worker**: background JS thread intercepting fetches; enables offline responses and push. **Web App Manifest**: JSON declaring name, icons, display mode, start URL; required for installability. **Cache Storage API**: browser store for Request/Response pairs the SW reads/writes. **skipWaiting**: forces the waiting SW to activate immediately, bypassing the waiting state. **IndexedDB**: queryable key-value object store for structured offline data that survives SW restarts.

**Pitfalls:**
- `skipWaiting` activates the new SW while old tabs are still open, causing version mismatches (broken API calls, missing chunks). Prompt to reload, then reload all clients.
- Caches grow unbounded without an `ExpirationPlugin` (or manual cleanup on activate).
- A valid manifest makes a site installable but not offline. Only the SW's `fetch` handler does that.

**Interview angle:** "Cache-first maximises speed but serves stale content; stale-while-revalidate gives speed without stale risk for assets that tolerate a one-request lag."

**Related:** `caching-strategies`, `network-performance`, `error-boundaries-resilience`

**Deep dive:** https://fearchitect.com/topics/pwa-offline

---

## SEO for Frontend

**One-liner:** Rendering choices, metadata, structured data, and CWV for search ranking.

**Key tradeoffs:**
- **Pros:** SSR/SSG put full HTML in the first-fetch response so crawlers index immediately with no render queue; the Next.js Metadata API generates `<head>` tags at build or request time; JSON-LD adds rich results; Core Web Vitals are a direct ranking signal
- **Cons:** CSR pages sit in Google's separate JS render queue and may be indexed days later with an empty `<title>`; blocking CSS/JS in `robots.txt` makes Googlebot index a broken page; duplicate titles/descriptions dilute ranking

**When to use:** SSG when content is the same for all users; SSR when content varies by user or URL; partial prerendering for mostly-static pages with a few dynamic slots; `generateMetadata` (async) to fetch dynamic `<title>`/`<meta>` at request time
**When to avoid:** CSR for public pages that need SEO (use it only for auth-gated content); `robots.txt` rules that block CSS/JS needed to render

**Key terms:** **SSR**: server-side rendering; HTML generated per request, visible to crawlers on first fetch. **JSON-LD**: script tag embedding schema.org data; enables rich results. **canonical URL**: `<link rel="canonical">` signaling the authoritative URL for duplicate content. **Core Web Vitals**: LCP, INP, CLS; Google ranking signals for load, responsiveness, and layout stability.

**Pitfalls:**
- CSR hurts SEO even though Googlebot runs JS. Rendering is queued separately, so the page can be indexed days late with no content.
- A `robots.txt` `Disallow` on CSS/JS makes Googlebot index a broken render. Keep it permissive for assets, block only auth-gated paths.
- Large unoptimized hero images wreck LCP. Use Next.js `<Image>` and `fetchpriority="high"`; measure CWV with CrUX field data, not Lighthouse lab scores (INP replaced FID in March 2024).

**Interview angle:** "Googlebot renders JS but queues it. SSR guarantees crawlers see your content on first fetch."

**Related:** `core-web-vitals`, `rendering-strategies`, `streaming-ssr`, `image-and-asset-strategy`

**Deep dive:** https://fearchitect.com/topics/seo
