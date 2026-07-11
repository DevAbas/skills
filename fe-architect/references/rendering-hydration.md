# Rendering & Hydration

> Where and when HTML is generated, and how it comes alive. Reference material for the fe-architect skill. Load for SSR, CSR, SSG, ISR, streaming, RSC, hydration, islands, PPR, resumability questions.

## Rendering Strategies: CSR / SSR / SSG / ISR

**One-liner:** Where and when HTML is generated: build, request, browser, or revalidated.

**Key tradeoffs:**
- **Pros:** Per-route choice optimizes each page for its real freshness/personalization needs; SSG/ISR push work to build/CDN, the lowest latency and server cost at scale; SSR/ISR give crawlable HTML for SEO without a separate prerender service.
- **Cons:** More strategies = more mental overhead and more ways to ship a subtly stale or accidentally-dynamic page; ISR adds cache-invalidation complexity (the hardest problem); CSR alone hurts LCP/SEO and shifts data-fetching waterfalls to the client.

**When to use:** SSG for content identical for all users that changes only at deploy time (docs, marketing); ISR for mostly-static content that changes between deploys (product pages, blogs) where some staleness is fine; SSR for per-request freshness or personalization that must be crawlable; CSR for highly interactive, auth-gated views where first paint and SEO don't matter.
**When to avoid:** SSG for per-user or rapidly-changing data (stale or wrong); SSR for content that never changes (paying request-time compute for nothing); CSR for content pages that need SEO or fast LCP; ISR when you need strict consistency (banking balances). Bounded staleness is still staleness.

**Key terms:** **TTFB**: Time To First Byte, how long until the server starts sending HTML; SSR raises it, CDN-served SSG minimizes it. **Revalidation**: Re-generating a cached page either after a time window (time-based) or via an explicit trigger (on-demand). **Hydration**: Attaching React event handlers and state to server-rendered HTML so it becomes interactive.

**Pitfalls:**
- Reading `cookies()`/`headers()` in a shared layout silently turns routes dynamic, disabling static optimization site-wide.
- Treating CSR-only SPAs as fine for content pages, then wondering why LCP and SEO suffer.
- Setting `revalidate` but mutating data without on-demand revalidation, so users see stale pages far longer than expected.
- Forgetting that `params` and `searchParams` are async in current Next.js and must be awaited.

**Interview angle:** "Rendering is a per-route call on two axes: how fresh, how personal. Static + ISR default; dynamic where I read request data; CSR for interactive auth-gated parts."

**Related:** `streaming-ssr`

**Deep dive:** https://fearchitect.com/topics/rendering-strategies

---

## Streaming SSR

**One-liner:** Flush the HTML shell immediately, then stream the rest as Suspense resolves.

**Key tradeoffs:**
- **Pros:** Low TTFB and fast first paint: the shell isn't blocked by the slowest query; per-region loading states instead of one whole-page spinner; selective/progressive hydration prioritizes what the user touches first.
- **Cons:** Layout shift if fallbacks aren't sized like their content (hurts CLS); streaming + a non-200 status is awkward because headers/status are already sent once you start flushing; harder to reason about (error and loading boundaries multiply; some CDNs/proxies buffer streams).

**When to use:** Pages with a fast, important shell plus slower independent sections (dashboards, feeds, product pages with reviews); when one slow data source shouldn't block everything else; to improve perceived performance and TTFB without removing SSR's SEO benefits.
**When to avoid:** Tiny pages where all data is fast (streaming adds complexity for no gain); when you must set an HTTP status or redirect based on data (do that before streaming starts); behind infrastructure that buffers the whole response and defeats streaming.

**Key terms:** **Suspense boundary**: A React region that shows a fallback while its children's data is pending, then swaps in real content. **Selective hydration**: React hydrating streamed regions independently and prioritizing the part the user interacts with first. **renderToPipeableStream**: The Node.js React API that streams SSR output as a pipeable stream (Web runtimes use renderToReadableStream).

**Pitfalls:**
- Unsized fallbacks cause layout shift when real content swaps in (bad CLS). Match the skeleton dimensions to the real content.
- Wrapping everything in one giant Suspense boundary loses the granularity that makes streaming useful.
- Trying to set status codes or redirect after the stream has started: the response head is already sent.
- Assuming streaming works in production when a CDN/proxy buffers the response; verify end-to-end.

**Interview angle:** "Stream the shell first, wrap the slow, independent regions in Suspense, and size the fallbacks so nothing shifts. One slow query becomes one skeleton, not a blank page."

**Related:** `rendering-strategies`

**Deep dive:** https://fearchitect.com/topics/streaming-ssr

---

## React Server Components

**One-liner:** Server-rendered components that ship zero JS to the browser.

**Key tradeoffs:**
- **Pros:** Zero JS shipped for server-only components: smaller bundles, faster parse; data fetching co-located with the component, no API route required; DB credentials and secrets stay on the server by default; async server components eliminate client-side data-fetching waterfalls.
- **Cons:** Props crossing the boundary must be serializable, no functions; no `useState`, `useEffect`, or browser APIs inside server components; two component types add mental overhead for teams new to RSC; server render and client hydration are separate phases, harder to debug.

**When to use:** Large, data-heavy subtrees that don't need interactivity: keep them server-side to shrink the JS bundle; when you fetch data directly (DB/ORM/internal fetch) and want credentials and secrets to stay on the server with no API route.
**When to avoid:** Components needing `useState`, `useEffect`, browser APIs, or event handlers (those must be `"use client"`); when props would have to be functions or class instances that can't be serialized across the boundary.

**Key terms:** **RSC payload**: React's compact wire format encoding the server-rendered component tree, streamed to the client. **"use client"**: Directive marking the file as a client component boundary; bundler includes it in the JS bundle. **Serializable props**: Props that survive JSON serialization (strings, numbers, plain objects, arrays), not functions. **Client island**: A `"use client"` subtree embedded inside a server-rendered tree that hydrates independently.

**Pitfalls:**
- Marking too many components `"use client"` ships their full dependency graph and kills bundle savings. Keep client components small and at the leaves.
- Passing non-serializable props (functions, class instances) across the boundary crashes at runtime.
- Server components can't consume React context; context providers must be client components.
- In Next.js 15+, `params` and `searchParams` are async Promises and must be awaited.

**Interview angle:** "Server components run once on the server, ship zero JS, and fetch data directly. Client components are the interactive islands. Keep them small and at the leaves."

**Related:** `streaming-ssr`, `partial-prerendering`, `hydration-and-islands`, `rendering-strategies`

**Deep dive:** https://fearchitect.com/topics/react-server-components

---

## Partial Prerendering (PPR)

**One-liner:** Static CDN shell plus dynamic Suspense holes in one response.

**Key tradeoffs:**
- **Pros:** CDN-speed first byte for every visitor, even on pages with dynamic data; no all-or-nothing route decision: static and dynamic mix per component; Suspense fallbacks give instant perceived content without a blank page; one HTTP response, no client waterfall to fetch the dynamic parts.
- **Cons:** Requires `cacheComponents: true`, not a drop-in for existing Next.js 15 setups; every dynamic component must be wrapped in `<Suspense>` or the build fails; unsized Suspense fallbacks cause layout shift when content streams in; CDN caching logic is more complex: shell and dynamic data have different TTLs.

**When to use:** A route with a stable shell (nav, branding, cached product data) plus per-user dynamic sections: e-commerce product pages, dashboards with live widgets.
**When to avoid:** When the entire page is personalized (no shell to prerender); when you need to set an HTTP status code or redirect based on request data (the shell is already flushed before that data is available).

**Key terms:** **Static shell**: The prerendered HTML served from the CDN, containing cached components and Suspense fallbacks. **Dynamic hole**: A Suspense boundary whose content reads request-time data and streams in per request. **`use cache`**: A Next.js directive that caches a component or function's output for inclusion in the static shell. **`cacheComponents`**: The Next.js 16 config flag that enables PPR as the default rendering model. **Chunked transfer encoding**: HTTP mechanism that lets the server send a response in pieces, enabling streaming.

**Pitfalls:**
- Unsized Suspense fallbacks shift layout when streamed content swaps in. Size skeleton fallbacks to match the real content's dimensions.
- A component reading `cookies()`, `headers()`, `searchParams`, or calling `connection()` becomes dynamic and must be wrapped in `<Suspense>` or the build fails.
- You can only redirect or set an HTTP status before prerendering starts; once the static shell is flushed, headers are already sent.
- PPR requires `cacheComponents: true`; the old `experimental.ppr` flag and `experimental_ppr` route segment were removed in Next.js 16.

**Interview angle:** "PPR streams the CDN shell instantly and fills dynamic holes via Suspense in the same response."

**Related:** `streaming-ssr`, `react-server-components`, `rendering-strategies`

**Deep dive:** https://fearchitect.com/topics/partial-prerendering

---

## Hydration Strategies & Islands

**One-liner:** Pay JS cost only for interactive regions, not the whole page.

**Key tradeoffs:**
- **Pros:** Islands ship the minimum JS needed: static sections send nothing; each island hydrates independently, so one slow island doesn't block others; lazy strategies defer off-screen work until the browser is idle; `client:visible` avoids hydrating below-the-fold content at all on short sessions.
- **Cons:** Islands can't share React state across island boundaries without a separate store; multiple small bundles mean more network round-trips if not colocated or cached; hydration mismatches are silent in production and hard to debug; progressive hydration requires careful orchestration to avoid UX gaps on interaction.

**When to use:** Content-heavy pages (blogs, docs, marketing) with a few isolated interactive widgets; when TTI on low-end devices matters and most content is static; Astro sites needing interactivity above a static baseline; Next.js lazy-loading heavy below-the-fold components with `dynamic` + `ssr: false` (in the App Router, call `dynamic` from a Client Component).
**When to avoid:** Highly interactive apps where most of the page is stateful (islands add complexity for little gain); when islands need fine-grained shared reactive state (crossing boundaries requires a global store); if RSC covers the use case, prefer zero client JS over a hydrated island.

**Key terms:** **Hydration**: Attaching React's event system to server-rendered HTML so it becomes interactive. **Islands architecture**: Static-HTML page with isolated interactive components that each carry their own JS bundle. **client:visible**: Astro directive that hydrates an island only when it enters the viewport via IntersectionObserver. **Hydration mismatch**: Server HTML differs from client render; React discards SSR work and re-renders from scratch. **Selective hydration**: React 18 feature: Suspense subtrees hydrate independently; user interaction prioritises which hydrates first.

**Pitfalls:**
- Hydration mismatch from `Date.now()` or `Math.random()` in render: React warns in dev and bails to a full client re-render in production, discarding SSR work. Seed deterministic values (or `suppressHydrationWarning` for browser-only DOM values).
- In the App Router, `dynamic(() => import('./C'), { ssr: false })` is not allowed in a Server Component. Wrap the `dynamic` call in a `"use client"` file and import that.
- Making a component an island when it could be RSC: check if it actually needs browser APIs.
- `client:load` on every island defeats the purpose; most islands belong on `client:visible` or `client:idle`.

**Interview angle:** "Islands ship JS only for interactive widgets; RSC eliminates the component from the client entirely. Pick RSC first, island when you need browser APIs."

**Related:** `react-server-components`, `resumability-qwik`, `streaming-ssr`

**Deep dive:** https://fearchitect.com/topics/hydration-and-islands

---

## Resumability (Qwik)

**One-liner:** Skip hydration by serializing state and listeners directly into HTML.

**Key tradeoffs:**
- **Pros:** O(1) Time to Interactive regardless of app size: no JS runs on load; fine-grained lazy loading: only the triggered handler's chunk is downloaded; eliminates hydration waterfalls common in large SSR apps; server state is already the source of truth, so no double-data problem.
- **Cons:** First interaction adds a network round-trip to fetch the handler chunk; the optimizer and dollar-boundary rules add build complexity; ecosystem is smaller than React/Vue: fewer libraries, less community tooling; mental model shift: developers must internalize the `$` boundary and serialization rules.

**When to use:** Content-heavy apps where most users read more than they interact; high-traffic public pages where fast Time to Interactive directly impacts conversion; apps targeting low-end devices or slow networks where hydration cost is unacceptable.
**When to avoid:** Highly interactive, data-heavy UIs (spreadsheets, rich editors) where most clicks load chunks anyway; teams already deep in a React or Vue codebase (high migration cost); projects that need a mature ecosystem of third-party UI libraries.

**Key terms:** **Resumability**: Skipping hydration by serializing app state and listener references into HTML for instant startup. **QRL (Qwik URL)**: A lazy, serializable reference to a code chunk encoded as a URL + exported symbol (e.g. `./chunk.js#Symbol`), stored as a DOM attribute so Qwik lazy-loads code without running JS upfront. **Dollar boundary ($)**: The Qwik optimizer marker that splits a function into its own lazy-loaded chunk. **useSignal**: A Qwik hook that returns a reactive `Signal<T>` whose `.value` is serialized into HTML. **qwikloader**: A ~1 KB global script that intercepts DOM events and fetches the matching handler chunk on demand.

**Pitfalls:**
- Crossing the `$` boundary with non-serializable values (closures, class instances) causes runtime errors.
- Importing a large library inside a `$` callback pulls it into that chunk, defeating lazy loading.
- Third-party React components require a compatibility layer (`qwik-react`) and re-introduce hydration cost.
- Forgetting that `useSignal` values are accessed via `.value`, not directly. This is a common source of missed reactivity.
- Over-splitting with excessive `$` boundaries creates too many small chunks and raises waterfall risk on interaction.

**Interview angle:** "Resumability serializes state and listeners into HTML so the browser resumes, not replays: O(1) startup, pay-per-interaction JS cost."

**Related:** `hydration-and-islands`, `react-server-components`

**Deep dive:** https://fearchitect.com/topics/resumability-qwik
