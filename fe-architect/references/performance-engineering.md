# Performance Engineering

> Core Web Vitals, bundles, render cost, and the network. Reference material for the fe-architect skill. Load for CWV (LCP/INP/CLS), bundle splitting, image strategy, caching, network and render performance.

## Bundle Architecture & Code Splitting

**One-liner:** Ship only the JS a route needs, cache the rest long-term.

**Key tradeoffs:**
- **Pros:** Initial parse time drops when only the current-route chunk loads; vendor chunks cache across deploys if their content hash is stable; large rarely-used widgets load only when rendered; smaller chunks load in parallel over HTTP/2.
- **Cons:** Too many small chunks cause waterfall requests that exceed HTTP/2 multiplexing gains; dynamic imports add a network round-trip on first render (visible loading states); misconfigured splits can duplicate React across chunks; tree-shaking fails silently on CommonJS imports.

**When to use:** Any route-based app: split at the page boundary as the baseline; components over ~30 kB gzipped not needed on first paint (modals, rich editors, charts); large rarely-changed third-party libraries; when a bundle analyzer reveals one chunk dominating parse time.
**When to avoid:** Splitting tiny components (< 5 kB), where the network round-trip costs more than it saves; splitting a component always needed on first paint; over-fragmenting into dozens of tiny chunks.

**Key terms:** **Dynamic import**: a native `import()` call that tells the bundler to cut a new chunk loaded on demand. **Tree-shaking**: dead-code elimination at build time; works on ESM static imports, not CommonJS `require`. **Deterministic chunk ID**: a hash derived from module content/path so a chunk's filename is stable across deploys. **SplitChunksPlugin**: Webpack plugin that extracts shared modules into separate chunks based on size and reuse. **Vendor chunk**: a chunk containing only `node_modules` code, cached independently from fast-changing app code.

**Pitfalls:**
- Lazy-loading a component that always renders above the fold trades parse savings for a visible loading flash.
- Skipping `"sideEffects": false` in a library's `package.json`, blocking tree-shaking of its unused exports.
- Non-deterministic chunk IDs (the default in dev) invalidating the CDN cache on every deploy.
- Importing a barrel file (`index.ts` re-exporting everything) that prevents tree-shaking of individual exports.
- Never running a bundle analyzer. Duplicate React or lodash across chunks goes undetected until users complain.
- Splitting a component under ~5 kB gzipped. Round-trips usually cost more than the parse-time saved.

**Interview angle:** "Split at route boundaries by default, defer heavy widgets with next/dynamic, lock chunk IDs to deterministic hashes so CDN caches survive deploys."

**Related:** `caching-strategies`, `render-performance-patterns`

**Deep dive:** https://fearchitect.com/topics/bundle-architecture-code-splitting

---

## Caching Strategies

**One-liner:** Layer browser, CDN, and app caches to serve responses without re-fetching.

**Key tradeoffs:**
- **Pros:** Eliminates origin requests for repeated assets (bandwidth + latency savings); `immutable` + content hashing lets browsers skip revalidation entirely; `stale-while-revalidate` gives instant responses without perceptible staleness; CDN caches spread load across PoPs; service-worker caches enable offline access and sub-millisecond reads.
- **Cons:** Stale data is the default failure mode: wrong TTL shows outdated content; CDN invalidation needs explicit purge APIs (time-based TTLs lag deploys); `no-store` on large resources eliminates all reuse; service-worker bugs can serve stale code indefinitely; mixing `max-age` and `s-maxage` incorrectly makes browser and CDN disagree on freshness.

**When to use:** Static content-hashed JS/CSS/font assets: `max-age=31536000, immutable`; CDN-served HTML changing between deploys: short `s-maxage` with on-demand purge; API responses tolerating seconds of staleness: `stale-while-revalidate`; PWA offline / flaky-network resilience: service-worker cache layer.
**When to avoid:** Session-specific or sensitive data (tokens, account details): use `no-store`; frequently mutated API responses where stale reads cause bugs; content that must reflect the instant of a user action.

**Key terms:** **Cache-Control**: HTTP response header carrying directives like `max-age`, `s-maxage`, `no-store`. **ETag**: a validator token the server issues; the browser sends it as `If-None-Match` to revalidate without re-downloading the body. **s-maxage**: CDN-specific TTL that overrides `max-age` for shared caches; the browser ignores it. **stale-while-revalidate**: directive (and SW strategy) that serves a stale response instantly, then refreshes in the background. **immutable**: tells browsers the resource will never change within `max-age`; suppresses revalidation on hard refresh.

**Pitfalls:**
- Setting `max-age=31536000` on HTML documents. Users get the old entry point (and stale hashed asset URLs) after a deploy.
- Omitting `s-maxage`: CDNs fall back to `max-age`, so browser and CDN share one TTL.
- Confusing `no-cache` (revalidate before use) with `no-store` (never cache). Misuse leaks data or kills performance.
- Not versioning service-worker cache names. Stale caches survive after the SW updates.
- Forgetting `Vary: Accept-Encoding` or `Vary: Cookie` on shared caches, causing wrong responses for different users.

**Interview angle:** "Hash asset filenames, cache forever with `immutable`; keep HTML TTLs short or use CDN purge on deploy."

**Related:** `cdn-edge-caching`, `network-performance`, `pwa-offline`

**Deep dive:** https://fearchitect.com/topics/caching-strategies

---

## Core Web Vitals

**One-liner:** Google's three user-experience metrics: LCP, INP, and CLS.

**Key tradeoffs:**
- **Pros:** Ties user perception to measurable numbers, not vague "feels fast" reports; CrUX field data gives a 28-day real-device baseline; INP catches slow interactions FID missed (full input-to-paint delay); three metrics cover load, interactivity, and stability, orthogonal failure modes.
- **Cons:** CrUX requires enough real-user traffic, so low-traffic pages get no field data; lab tools (Lighthouse) can't reproduce session-level INP across many interactions; CLS is easily gamed by deferring all shifts to after user input; LCP origin attribution is hard (hero image, TTFB, render-blocking CSS, or all three).

**When to use:** Setting up RUM in production to catch regressions before they affect rankings; diagnosing which of the three vitals is the bottleneck; validating performance budgets in CI using Lighthouse for LCP and CLS proxies.
**When to avoid:** Don't use Lighthouse CWV scores as the ranking signal: only field CrUX data counts for Search; don't treat lab INP improvements as done (verify in field); don't optimize CLS by suppressing shift detection without fixing the root cause.

**Key terms:** **LCP**: time to render the largest above-the-fold image or text block; good ≤2.5 s. **INP**: 98th-percentile input-to-paint delay across all interactions; good ≤200 ms. **CLS**: sum of impact × distance shift scores for unexpected layout shifts; good ≤0.1. **CrUX**: Chrome UX Report; 28-day rolling field data from real Chrome users, used for ranking. **LoAF**: Long Animation Frame; browser entry identifying frames that exceed 50 ms.

**Pitfalls:**
- Treating Lighthouse CWV numbers as field data. They diverge significantly on interaction-heavy pages.
- Fixing LCP only for desktop; hero images on mobile often have different elements with worse timing.
- Injecting banner or cookie-consent content without reserving space, which tanks CLS after load.
- Forgetting that INP measures the 98th-percentile interaction. One slow handler spikes the score.
- Preloading too many assets to fix LCP while actually worsening it by contending for bandwidth.

**Interview angle:** "FID only measured input delay; INP measures the full interaction-to-paint delay at the 98th percentile. It catches slow event handlers that FID missed."

**Related:** `render-performance-patterns`, `image-and-asset-strategy`, `network-performance`

**Deep dive:** https://fearchitect.com/topics/core-web-vitals

---

## Image & Asset Strategy

**One-liner:** Serve the smallest correct image; preload the LCP one.

**Key tradeoffs:**
- **Pros:** AVIF/WebP reduce image payload 30-50%, directly improving LCP on slow connections; `fetchPriority="high"` on the LCP image can cut LCP by 200-500 ms without code changes; native lazy-loading is zero-JS; `next/image` automates format negotiation and srcset generation; width/height attributes eliminate image-driven CLS at the HTML level.
- **Cons:** AVIF encoding is slow, so build-time generation at multiple sizes raises deploy times; misconfigured `sizes` fetches a larger image than needed; preloading too many images wastes bandwidth and delays more important resources; `font-display: swap` causes a flash of unstyled text (FOUT) until the web font loads.

**When to use:** Any page where images appear above the fold and LCP is failing; content-heavy pages (editorial, e-commerce) where images dominate payload; images at varying widths per breakpoint (srcset/sizes); any web font: preconnect + font-display: swap on every project.
**When to avoid:** Don't add `fetchPriority="high"` to more than one or two images; don't lazy-load the hero/LCP image; don't skip width/height even for dynamically sized images: use CSS `aspect-ratio` as the fallback.

**Key terms:** **LCP (Largest Contentful Paint)**: the time until the largest above-fold image or text block renders. **fetchpriority / fetchPriority**: HTML attribute (JSX prop) that raises ("high") or lowers ("low") a resource fetch priority. **srcset / sizes**: HTML attributes that list candidate image URLs and layout widths so the browser picks the best fit. **CLS (Cumulative Layout Shift)**: score for unexpected layout movement; images without dimensions are a top cause. **font-display: swap**: CSS descriptor that renders text in a fallback font immediately, swapping the web font when loaded.

**Pitfalls:**
- Lazy-loading the LCP image. `loading="lazy"` waits until near-viewport, too late for LCP; use `fetchPriority="high"` instead.
- Omitting `sizes`. The browser defaults to 100vw and fetches a full-screen image on every device.
- Adding `fetchPriority="high"` to every above-fold image. Only the single LCP element should get it.
- Missing width/height on dynamically sourced images. CLS fires when the image finally loads and pushes content down.
- `font-display: block` without a preconnect link. Text stays invisible until the font loads (FOIT).
- `next/image` defaults to WebP only; opt into AVIF via `formats: ['image/avif', 'image/webp']` in next.config. (Note: `priority` prop is deprecated in Next.js 16. Use `preload` + `fetchPriority`.)

**Interview angle:** "LCP image gets preload and fetchPriority high, never lazy. Everything else gets lazy-loading and explicit dimensions. next/image defaults to WebP; opt into AVIF via next.config."

**Related:** `core-web-vitals`, `network-performance`

**Deep dive:** https://fearchitect.com/topics/image-and-asset-strategy

---

## Network Performance

**One-liner:** Hint, prioritize, and pre-navigate to cut request latency.

**Key tradeoffs:** *(derived from key points)*
- **Pros:** `preconnect` opens TCP+TLS early, saving ~150 ms per cold connection; `preload` fetches critical current-page resources (LCP image, font) early while `prefetch` warms future pages at idle priority; Speculation Rules prerender makes the next navigation instant; `fetchpriority="high"` on the LCP `<img>` stops the browser deprioritizing it.
- **Cons:** Speculation Rules is Chromium-only (Firefox unshipped, Safari behind an off-by-default flag), so feature-detect and treat it as progressive enhancement; a preloaded font without `crossorigin` is fetched twice; domain-sharding hurts HTTP/2 (extra TLS handshakes, separate congestion windows); eager prerender spends bandwidth on pages the user may never visit.

**When to use:** Warm third-party origins early with `preconnect` (or cheaper `dns-prefetch` for low-priority third parties); `preload` the LCP image, font, or late script with the correct `as=`; `prefetch`/`modulepreload` to prepare a likely next navigation; Speculation Rules prerender for high-probability next pages (feature-detected).
**When to avoid:** Speculation Rules is Chromium-only as of 2026. Always feature-detect with `HTMLScriptElement.supports('speculationrules')` before injecting; pages must load correctly without it (progressive enhancement).

**Key terms:** **Critical path**: resources that block first paint; shortening it cuts LCP. **preconnect**: opens TCP+TLS to an origin before the browser needs a resource from it. **fetchpriority**: HTML attribute hinting high/low fetch urgency to the browser's scheduler. **Speculation Rules API**: Chrome API to prerender or prefetch future navigations via inline JSON. **modulepreload**: fetches, parses, and compiles an ES module graph ahead of first import.

**Pitfalls:**
- Preloading a font without `crossorigin`. Font requests use CORS, so the preload and `@font-face` fetch use different modes and the browser fetches the font twice.
- Domain-sharding with HTTP/2. Multiplexing over one connection means extra domains add needless TLS handshakes and separate congestion windows, net slower.
- Injecting Speculation Rules without feature-detecting. Firefox is unshipped and Safari is behind an off-by-default flag as of 2026.
- `preload` without the correct `as=` request context, so the resource is fetched in the wrong mode (or twice).

**Interview angle:** "Preconnect warms origins, preload unlocks early fetches, Speculation Rules prerenders the next page. Chrome only, so always feature-detect."

**Related:** `caching-strategies`, `image-and-asset-strategy`, `cdn-edge-caching`

**Deep dive:** https://fearchitect.com/topics/network-performance

---

## Render Performance

**One-liner:** Skip renders, defer slow work, and virtualize long lists.

**Key tradeoffs:**
- **Pros:** `useMemo`/`useCallback` skip renders when upstream identity is stable; `useTransition` keeps input latency under 200 ms even during heavy state updates; `useVirtualizer` holds DOM node count near-constant for arbitrarily long lists; the React Compiler automates memoization on Rules-of-React-compliant code.
- **Cons:** Memoization adds overhead and helps only when the render it prevents costs more; `useTransition` requires identifying which updates are truly deferrable; virtualization complicates focus management, scroll-restoration, and accessibility; React Compiler requires strict Rules of React (existing codebases need cleanup first).

**When to use:** `useTransition` when a state change triggers an expensive render that delays input; `useDeferredValue` when a derived value (search results, chart data) re-renders slowly per keystroke; `useVirtualizer` for lists/grids exceeding ~200 items; `React.memo`/`useMemo`/`useCallback` only after profiling confirms a render is the bottleneck.
**When to avoid:** Adding `React.memo` to every component by default; `useTransition` for fast updates finishing well within 200 ms; virtualization for short lists; manual memoization in greenfield codebases adopting React Compiler.

**Key terms:** **useTransition**: hook that marks a state update as interruptible so urgent events (typing) run first. **useDeferredValue**: hook that exposes a lagging value; background re-render is restartable on new input. **useVirtualizer**: TanStack Virtual hook that renders only visible list items, keeping DOM size constant. **INP**: Interaction to Next Paint; Core Web Vital measuring input-to-visual-update latency, budget 200 ms. **React Compiler**: build-time tool (stable v1.0, Oct 2025) that auto-inserts memoization for compliant code.

**Pitfalls:**
- Wrapping unstable objects/arrays in `useMemo` with no deps makes memoization a no-op.
- Calling `useCallback` inside a loop or conditional violates Rules of React.
- `useDeferredValue` does not debounce. It defers rendering, not the event itself.
- Virtualizer `position:absolute` requires the scroll container to have explicit height and `overflow:auto`.
- React Compiler cannot optimize components that mutate props or break Rules of React.
- `React.memo` fails to prevent a re-render when a prop fails `Object.is` equality each render (new object/array/inline function from the parent).

**Interview angle:** "Profile first. Most renders are cheap. For slow ones: memo to skip, useTransition to defer, virtual to shrink the DOM."

**Related:** `core-web-vitals`, `event-loop-scheduler-yield`

**Deep dive:** https://fearchitect.com/topics/render-performance-patterns
