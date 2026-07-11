# Network & Infrastructure

> CDNs, the edge, balancing, containers, and shipping safely. Reference material for the fe-architect skill. Load for CDN/edge caching, edge compute, load balancing, containers/k8s, CI/CD, deployment strategies and feature flags.

## CDN & Edge Caching

**One-liner:** Serve cached responses from PoPs near users, sparing the origin.

**Key tradeoffs:**
- **Pros:** Hits return from PoP memory in single-digit ms; shield/tiered caching collapses many parallel misses into one origin fetch worldwide; content hashing + `immutable` removes the need to ever purge static assets; `stale-while-revalidate` serves stale instantly while refreshing in the background (zero-latency deploys)
- **Cons:** Invalidation by TTL expiry can take up to the full TTL; query strings are in the cache key by default, fragmenting entries; long `s-maxage` on HTML breaks pages post-deploy

**When to use:** `s-maxage` for edge TTL on slowly-changing content; surrogate keys / cache tags to purge CMS pages sharing a tag; content hashing + `immutable` for JS/CSS/image assets; `stale-while-revalidate` for zero-latency deploys
**When to avoid:** Don't cache HTML with a long `s-maxage`. Keep it ≤60s or purge on deploy

**Key terms:** **PoP (Point of Presence)**: a CDN edge data center geographically near users where responses are cached. **s-maxage**: Cache-Control directive setting TTL for shared caches (CDNs); overrides max-age for them. **Surrogate key**: a tag attached to cached responses (via header) enabling bulk purge by label, not URL. **Cache key**: the lookup key (URL plus selected Vary headers) that identifies a cached entry. **Shield / tiered caching**: a designated PoP that absorbs origin traffic; other PoPs fill from it instead of the origin.

**Pitfalls:**
- Long `s-maxage` on HTML: after a deploy, cached HTML references old hashed asset filenames that may have been removed, breaking the page for every cached user until the cache expires. Keep HTML TTL short and purge on deploy.
- Query strings are included in the cache key by default, which can silently fragment/duplicate cache entries.
- Relying on TTL expiry as the only invalidation strategy delays changes up to the full TTL. Use on-demand URL purge or surrogate-key purge for content that must update fast.

**Interview angle:** "Hash filenames for immutable caching; use surrogate keys to purge mutable content by tag, not URL."

**Related:** `caching-strategies`, `network-performance`, `edge-computing-rendering`

**Deep dive:** https://fearchitect.com/topics/cdn-edge-caching

---

## CI/CD for Frontend

**One-liner:** Automated pipeline from commit to production with quality gates.

**Key tradeoffs:**
- **Pros:** Catches regressions in minutes, not after a user files a bug; the same already-built, already-tested artifact ships to production (no rebuild); rollback is just a re-promotion of the previous artifact
- **Cons:** A gate that blocks when a human wouldn't always revert is noise; visual diffs are noisy as blocking gates; install/build/Lighthouse steps add pipeline time (mitigated by lockfile-keyed caching)

**When to use (block the merge):** typecheck failures; lint errors; failing unit tests; size-limit budget breaches; Lighthouse CI score drops
**When to avoid (don't block):** visual regression diffs (post as a PR comment instead); Lighthouse best-practices warnings that don't affect users

**Key terms:** **size-limit**: npm tool that measures JS/CSS bundle size after build and fails CI if a configurable byte budget is exceeded. **Lighthouse CI**: Google tool that runs Lighthouse against a built app in CI and asserts thresholds on performance, a11y, and SEO scores. **preview deploy**: an isolated, publicly accessible build of a PR branch; each push gets its own URL for manual and automated review. **visual regression**: pixel-level or component-level screenshot comparison between a baseline and the current build, catching unintended UI changes. **promotion**: swapping the production CDN target from the current build to a new one; zero-downtime if done via atomic swap.

**Pitfalls:**
- Slow `npm ci`: cache `~/.npm` (or `node_modules` for pnpm) keyed on the lockfile hash with `actions/cache`, otherwise every run re-downloads packages.
- Running Lighthouse against localhost has no network latency or throttling. Scores aren't reproducible; run it against the CDN-served preview URL.
- Blocking on visual regression diffs by default creates noise. Only block when a diff exceeds an always-wrong threshold (e.g. >5% pixel change on a design-system component).
- Rebuilding on promotion instead of promoting the artifact that passed the gates. Promote the same binary, no rebuild.

**Interview angle:** "A gate is only worth blocking on if a human would always revert the merge. Otherwise it's noise. Bundle-size budgets and Lighthouse performance thresholds are always worth blocking on; visual diffs are better as non-blocking review aids."

**Related:** `cdn-edge-caching`, `deployment-strategies-feature-flags`, `bundle-architecture-code-splitting`, `core-web-vitals`, `frontend-testing`

**Deep dive:** https://fearchitect.com/topics/ci-cd-frontend

---

## Containers & Kubernetes

**One-liner:** Package apps in containers; orchestrate them with Kubernetes.

**Key tradeoffs:**
- **Pros:** Containers eliminate environment drift via a portable image; multi-stage builds keep the production image small (~120 MB vs ~800 MB); Kubernetes handles restarts, rolling deploys, and load-balancing across replicas; Next.js `standalone` output cuts image size further
- **Cons:** Containers add ops overhead that static hosting eliminates; only worthwhile for stateful Node servers at scale; static sites and serverless functions skip Docker and Kubernetes entirely

**When to use:** When you run a stateful Node process at scale: SSR servers, BFF APIs, or WebSocket servers needing always-on replicas and rolling deploys; when the app needs long-running processes (WebSockets, background queues), persistent connections, or more runtime control and the team can accept the ops overhead
**When to avoid:** Static sites (export to S3/CDN) and serverless functions (Vercel, AWS Lambda). The platform handles packaging and scaling for you

**Key terms:** **Image layer**: read-only filesystem diff from one Dockerfile instruction; shared across builds to speed pulls. **Multi-stage build**: Dockerfile pattern: compile in one stage, copy only the output to a lean runtime stage. **Pod**: Kubernetes scheduling unit; one or more containers sharing a network namespace. **Ingress**: Kubernetes HTTP router mapping hostnames and URL paths to backend Services. **Standalone output**: Next.js build mode (`output: 'standalone'`) that bundles only the runtime Node modules needed to run the server.

**Pitfalls:**
- Dockerfile layer order: put infrequently changing steps (`npm ci`) before frequently changing ones (`COPY . .`) to maximize cache reuse; the wrong order busts the cache every build.
- Shipping a single-stage image bundles source, build tools, and devDependencies. That bloats the image (~800 MB vs ~120 MB); use a multi-stage build.
- Adopting containers/Kubernetes for a frontend that doesn't need them adds ops overhead that static hosting or serverless would eliminate.
- For a Next.js Docker image, forgetting `output: "standalone"` means copying the full `node_modules` instead of the traced runtime modules.

**Interview angle:** "Containers solve environment parity and scaling for stateful servers, but most frontends never need them."

**Related:** `cdn-edge-caching`, `edge-computing-rendering`, `ci-cd-frontend`, `backend-for-frontend`

**Deep dive:** https://fearchitect.com/topics/containers-kubernetes

---

## Deployment Strategies & Feature Flags

**One-liner:** Decouple deploy from release using blue-green, canary, and flags.

**Key tradeoffs:**
- **Pros:** Separating deploy from release lets you ship code continuously and release when ready; feature flags give an instant kill-switch with no redeploy; canary limits blast radius (only the canary cohort is exposed); blue-green gives instant rollback (flip LB/DNS weight back to blue)
- **Cons:** Blue-green doubles compute (two full environments live); after a blue-green cutover all users hit the new build at once; flag debt accrues fast (stale flags = dead branches + review cost); client-side flag evaluation causes flicker

**When to use:** Blue-green for short-lived releases, DB migrations, and compliance freezes (atomic cutover); canary for gradual feature rollout with real-traffic validation; feature flags for percentage rollouts (1%→100% while monitoring error rates) and kill switches. Evaluate server-side or at the edge to avoid flicker
**When to avoid:** Blue-green when running two full environments isn't cost-effective; client-side flag evaluation (flicker); leaving flags in code after rollout (delete within one sprint of 100%)

**Key terms:** **Blue-green deployment**: two identical environments; traffic flips 100% from old (blue) to new (green) atomically. **Canary deployment**: new build receives a small traffic slice (e.g. 5%) before gradual promotion to 100%. **Feature flag**: a runtime boolean (or multivariate value) that gates code paths without a redeploy. **Kill switch**: a feature flag set to off for all users instantly; stops an incident without rollback. **Flag debt**: stale flags that remain in code after full rollout, adding dead branches and review cost.

**Pitfalls:**
- Client-side flag evaluation causes a flicker: the page renders the default variant first, then re-renders after the SDK resolves; evaluate server-side or at the edge so the correct variant is baked into the initial HTML.
- Flag debt: flags left in the codebase after a full rollout add dead branches and review cost. Set a policy to delete them within one sprint of reaching 100%.
- Blue-green doubles compute because two full environments run live, which is costly if unplanned.
- After a blue-green cutover, all users hit the new build simultaneously (full blast radius), unlike canary.

**Interview angle:** "Deploy the code dark, release with a flag. Rollback is a config change, not a redeploy."

**Related:** `ci-cd-frontend`, `edge-computing-rendering`, `ab-testing-experimentation`

**Deep dive:** https://fearchitect.com/topics/deployment-strategies-feature-flags

---

## Edge Computing & Rendering

**One-liner:** Run code at CDN PoPs to cut latency before origin is hit.

**Key tradeoffs:**
- **Pros:** Geolocation and A/B decisions in < 5 ms with no origin round-trip; auth token verification (JWT, signed cookie) is pure CPU, ideal for isolates; streaming edge SSR starts sending HTML bytes before origin data returns; no cold-start tax: isolates are always warm at busy PoPs
- **Cons:** Every DB query adds a cross-region round-trip, erasing latency gains; no Node.js native modules, so Postgres/Redis drivers need HTTP/WebSocket wrappers; CPU time limits (50 ms on Vercel) block long-running or CPU-heavy work; debugging is harder (no local parity for the real PoP topology); stateful session stores must be edge-replicated (e.g. Upstash Redis) to avoid centrality

**When to use:** Auth, personalisation, A/B, and geo decisions; when data is already at the edge: an edge KV store, a cookie, or a short-TTL CDN cache at the PoP; streaming HTML from the edge while data is fetched in parallel
**When to avoid:** When the handler queries a single-region DB (the edge must phone home: no latency gain, lost Node APIs); heavy DB queries or file I/O; long-running or CPU-heavy work (CPU limit)

**Key terms:** **V8 isolate**: a sandboxed JS execution context inside a single V8 process; no OS process overhead, starts in microseconds. **Edge Function**: Vercel's name for a serverless function running in V8 isolates at CDN PoPs, using the Web API surface. **Routing Middleware**: Vercel's `middleware.ts`, runs at the edge on every matched request before any page handler. **PoP**: Point of Presence, a CDN datacenter geographically close to users where edge code runs. **Edge KV**: a globally replicated key-value store (e.g. Cloudflare KV, Vercel KV) readable from edge code without a round-trip to the origin region.

**Pitfalls:**
- Running edge SSR when the handler queries a single-region DB. The edge-to-origin round-trip adds latency on top of the user-to-edge leg, and you lose Node APIs for nothing.
- Not setting the `matcher` in `middleware.ts`. The middleware runs on `_next/static` assets, wasting compute; scope it to the paths that need it.
- The CPU time limit (50 ms on Vercel) blocks long-running or CPU-heavy work at the edge.
- Node native DB drivers (Postgres, Redis) don't exist at the edge. You need HTTP/WebSocket wrappers.
- Stateful session stores must be edge-replicated or you reintroduce a central round-trip.

**Interview angle:** "Edge is fast only when the data is already at the edge. Otherwise you just moved the round-trip."

**Related:** `cdn-edge-caching`, `caching-strategies`, `streaming-ssr`, `network-performance`

**Deep dive:** https://fearchitect.com/topics/edge-computing-rendering

---

## Load Balancing (for Frontends)

**One-liner:** Spread traffic across servers; keep WebSocket apps sticky.

**Key tradeoffs:**
- **Pros:** Removes the single point of failure and performance ceiling of one server; health checks remove unhealthy nodes and re-add them on recovery; L7 reads HTTP headers/paths/cookies for smart routing and cookie-based affinity (and terminates TLS); L4 is very low overhead with no parsing and pass-through TLS
- **Cons:** L7 parses each request (higher performance cost); L4 supports only IP-hash stickiness and can't inspect content; IP-hash breaks when the pool changes; WebSocket/stateful apps break without sticky sessions

**When to use:** L7 for path-based routing and cookie affinity; L4 for raw TCP throughput, pass-through TLS, or non-HTTP protocols (e.g. database connections); round-robin for equally-capable servers; weighted round-robin when instance sizes differ; least-connections for long-lived requests like uploads; P2C (power of two choices) for near-optimal low-overhead routing; sticky sessions for WebSocket/SSE/in-memory-session apps
**When to avoid:** Plain round-robin or IP-hash for WebSocket/SSE/in-memory-session apps without sticky affinity; IP-hash when the server pool changes frequently

**Key terms:** **L4 load balancer**: routes by IP/port without inspecting HTTP content; low overhead, no TLS termination. **L7 load balancer**: inspects HTTP headers, paths, and cookies to route requests; terminates TLS. **Sticky session**: affinity rule that pins a client to the same backend node across requests. **Health check**: periodic probe (HTTP GET or TCP connect) that removes unhealthy backends from the pool. **Least-connections**: algorithm routing each new request to the backend with the fewest open connections.

**Pitfalls:**
- WebSocket/SSE/in-memory-session apps break without sticky sessions. A reconnect to a different node has no record of the client's state and the session starts from scratch or fails; use cookie-based affinity on an L7 balancer.
- Round-robin for long-lived connections (file uploads) overloads busy servers. It ignores per-server load; use least-connections.
- IP-hash breaks when you add or remove servers. The hash table shifts and all existing clients get re-routed, losing their sessions.

**Interview angle:** "L7 for path-based routing and cookie affinity; L4 when you need raw TCP throughput with no parsing cost."

**Related:** `cdn-edge-caching`, `edge-computing-rendering`, `realtime-websockets-sse-polling`, `containers-kubernetes`

**Deep dive:** https://fearchitect.com/topics/load-balancing
