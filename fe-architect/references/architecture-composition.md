# Architecture & Composition

> Splitting, sharing, and migrating frontends at scale. Reference material for the fe-architect skill. Load for micro-frontends, module federation, monorepos, BFF, API gateway, component architecture, incremental migration.

## Microfrontends & Module Federation

**One-liner:** Independently deployable frontends composed at runtime in the browser.

**Key tradeoffs:**
- **Pros:** Teams deploy independently, with no cross-team coordination per release; runtime integration means consumers see remote changes without rebuilding; shared singletons prevent duplicate React or router instances when configured correctly; a crashing remote can be isolated behind an error boundary.
- **Cons:** Version-skew in shared deps causes subtle runtime bugs; cold-load waterfall (host fetches remoteEntry.js, then chunks) adds latency; every remote is a separate CDN deployment to monitor and version; local dev needs all remotes running or mocked, so DX degrades fast.

**When to use:** Build-time vs runtime is the core decision: npm packages are build-time (simpler, but every consumer rebuilds on change); Module Federation is runtime (a remote's latest build is live to all hosts on deploy); for full framework isolation, Next.js Multi-Zones is a simpler alternative.
**When to avoid:** Small teams, or apps where all sections change together. Operational overhead outweighs the autonomy gain; a monorepo with module boundaries is simpler.

**Key terms:** **Host**: the app that consumes remote modules at runtime; declares `remotes` in its federation config. **Remote**: a separately deployed build that exposes modules via `exposes` and a `remoteEntry.js` manifest. **exposes**: federation config key mapping a public name to an internal module path the remote makes consumable. **shared singleton**: a dep declared `singleton: true` so federation loads one copy across all host/remote boundaries. **Multi-Zones**: Next.js feature routing separate Next.js apps by URL prefix via a reverse proxy; no shared JS runtime.

**Pitfalls:**
- If only one side declares React in `shared`, federation cannot negotiate a singleton and loads two copies, breaking hooks context across the boundary.
- Version-skew: host and remote requiring incompatible versions of a shared dep makes federation load both copies, doubling bundle size and breaking shared context. Both sides must declare the dep with matching `requiredVersion` ranges.
- Omitting `output.publicPath: "auto"` in a remote. Without it Webpack can't infer the chunk URL base from where `remoteEntry.js` was served, so chunks fail to resolve across deploy paths.
- The cold-load waterfall (fetch remoteEntry.js, then chunks) adds latency on first render.

**Interview angle:** "Module Federation lets teams deploy independently; the risk is version-skew in shared singletons and a cold-load waterfall."

**Related:** `monorepos`, `bundle-architecture-code-splitting`, `backend-for-frontend`

**Deep dive:** https://fearchitect.com/topics/microfrontends-module-federation

---

## Monorepos (Turborepo / Nx)

**One-liner:** One git repo, many packages, shared tooling and task caching.

**Key tradeoffs:**
- **Pros:** Atomic cross-package refactors land in one commit with one CI run; shared tooling (ESLint, TypeScript, Prettier config) is updated once and propagates everywhere; task caching means CI time grows logarithmically, not linearly, as packages accumulate; a single lockfile eliminates version drift; internal packages ship zero overhead: no npm publish, just import.
- **Cons:** Startup cost is real (pnpm workspace setup, turbo.json, path aliases, CI config); remote cache misconfigurations silently fall back to full rebuilds and are hard to diagnose; a shared lockfile means one package's dependency upgrade affects every app; Nx project graph inference can misread dynamic imports or re-exports, producing a wrong affected set; one repo means one set of git access controls.

**When to use:** Multiple apps share significant code (component library, auth logic, API types); teams do frequent cross-package refactors that currently need multi-repo PRs and version bumps; CI time is growing with repo size; you want to enforce module boundaries between frontend domains (e.g., checkout vs. catalog).
**When to avoid:** Small teams with one app (tooling overhead exceeds benefit); apps needing independent deploy cadences with strict code isolation; orgs where different groups need different git access controls per project.

**Key terms:** **turbo.json tasks**: Turborepo's DAG of named tasks with dependsOn, outputs, and cache settings. **^dependsOn**: caret prefix: run this task in all upstream dependency packages first. **remote cache**: shared artifact store so a Turbo/Nx cache hit works across machines and CI. **nx affected**: runs a task only on packages changed since a base Git ref, plus their dependents. **workspace: protocol**: pnpm syntax pinning a dependency to the local workspace package, not the registry.

**Pitfalls:**
- Skipping `outputs` in turbo.json: Turbo caches nothing and every CI run re-executes all tasks.
- Importing across package boundaries via relative paths instead of package names, making the dependency graph invisible to Nx and Turbo.
- Letting `devDependencies` diverge between packages: type errors that pass locally fail in isolated package builds.
- Running `nx affected` without a stable base ref: comparing the wrong commit produces an over- or under-affected set.
- Putting too much in one internal package; a change to `@acme/ui` that affects every app defeats incremental builds.

**Interview angle:** "Turborepo caches task outputs by hashing inputs. If nothing changed, the output is replayed, not recomputed. Remote caching extends that to every developer and every CI runner."

**Related:** `microfrontends-module-federation`, `component-architecture`, `ci-cd-frontend`, `bundle-architecture-code-splitting`

**Deep dive:** https://fearchitect.com/topics/monorepos

---

## Backend for Frontend (BFF)

**One-liner:** A per-client server layer that shapes and aggregates APIs for one frontend.

**Key tradeoffs:**
- **Pros:** Eliminates chatty client-to-service round trips by fanning out in parallel server-side; each client team controls its own API contract without coordinating with other consumers; auth secrets and service tokens stay on the server, never in browser memory; downstream services can evolve independently because the BFF absorbs breaking changes; reduces payload size (only fields the UI renders are returned).
- **Cons:** Another service to deploy, monitor, and scale for each client type; duplicates logic across BFFs if web and mobile need similar aggregations; adds one network hop, slightly increasing p99 latency; easy to turn into a fat, business-logic-laden service. Scope creep is common.

**When to use:** Multiple clients (web, iOS, Android) with divergent data needs consuming the same services; auth patterns requiring server-side token exchange (client secrets, refresh tokens); UIs making 3+ sequential API calls to assemble one screen; frontend teams that need to iterate on API contracts without blocking backend teams.
**When to avoid:** A single client type (complexity not worth it; call services directly or use a gateway); simple CRUD apps consuming one service with no aggregation; teams without ops capacity to maintain an extra service per client.

**Key terms:** **BFF**: Backend for Frontend, a server scoped to one client type that aggregates downstream APIs. **fan-out**: issuing multiple downstream requests in parallel, then merging results before responding. **token exchange**: swapping a session credential for a short-lived service token server-side, keeping secrets off the client. **API Gateway**: shared infrastructure proxy handling routing, rate limiting, and auth; not client-specific shaping. **Route Handler**: Next.js App Router file (`route.ts`) that runs server-side and can act as a BFF endpoint.

**Pitfalls:**
- Putting business logic (pricing rules, validation) in the BFF. It should aggregate and shape, not own domain rules.
- Forgetting `cache: 'no-store'` on authenticated fetches. Next.js may cache user-specific responses.
- One BFF serving both web and mobile defeats the purpose; clients diverge and the shared layer grows unwieldy.
- Not handling partial failures: decide whether one failed downstream call returns partial data or a 502.
- Storing long-lived tokens in BFF process memory; use short-lived tokens and re-exchange per request.

**Interview angle:** "The BFF is the API the UI wishes the backend exposed, shaped by the frontend team, not negotiated with everyone."

**Related:** `api-gateway`, `server-state-data-fetching`, `auth-oauth-jwt-sessions`

**Deep dive:** https://fearchitect.com/topics/backend-for-frontend

---

## API Gateway (for Frontends)

**One-liner:** Single entry point that routes, authenticates, and rate-limits across services.

**Key tradeoffs:**
- **Pros:** Cross-cutting concerns (auth, rate limiting, TLS) live in one place, not duplicated per service; services receive pre-validated, authenticated requests: less code per service; centralized observability (one place to emit logs, metrics, traces); consumer-level rate limiting without touching service code; routing changes (canary, path rewrites) deploy without redeploying services.
- **Cons:** The gateway is a single point of failure and must be deployed redundantly; adds one network hop and serialization overhead per request; a misconfigured auth plugin exposes all services at once; plugin ecosystems (Kong, AWS) vary in capability and complex transforms may not fit natively; shared config can become a deployment bottleneck when every team needs changes.

**When to use:** Multiple services need consistent auth, rate limiting, or TLS without duplicating logic; you expose an API to third-party consumers needing per-consumer quotas and keys; observability across services must be standardized at the network level; routing traffic across canary or blue/green deployments without client changes.
**When to avoid:** Single-service apps (latency and ops overhead with no benefit); when heavy per-client response shaping is needed (add a BFF instead of bloating the gateway); highly latency-sensitive paths where an extra network hop is unacceptable.

**Key terms:** **API gateway**: reverse proxy handling auth, routing, rate limiting, and TLS for all clients across all services. **BFF (Backend for Frontend)**: per-client server that aggregates and shapes data specifically for one client type. **TLS termination**: gateway decrypts HTTPS at the edge; internal service-to-service traffic may use plain HTTP. **Rate limiting**: caps requests per consumer per time window, usually tracked in Redis via token-bucket or sliding-window. **Edge gateway**: gateway deployed on CDN infrastructure (e.g., Cloudflare Workers) to enforce policy before traffic hits origin.

**Pitfalls:**
- Running a single gateway instance: one process failure takes down every service.
- Treating the gateway as a BFF: adding client-specific response shaping bloats shared config and creates coupling.
- Skipping circuit breakers: a slow upstream stalls gateway connections and degrades unrelated routes.
- Storing rate-limit state in gateway memory instead of Redis: state is lost on restart and wrong across replicas.
- Hardcoding upstream URLs instead of using service discovery: breaks on service renames.

**Interview angle:** "Gateway handles cross-cutting policy for everyone; BFF shapes the response for one client."

**Related:** `backend-for-frontend`, `cdn-edge-caching`, `edge-computing-rendering`, `load-balancing`

**Deep dive:** https://fearchitect.com/topics/api-gateway

---

## Incremental Migration / Strangler Fig

**One-liner:** Replace a legacy frontend route-by-route behind a shared proxy.

**Key tradeoffs:**
- **Pros:** No big-bang cutover: each route is an independent, reversible deployment; old and new apps share one domain so users see no difference during migration; teams can work in parallel (new routes ship independently of legacy freeze); rollback is a one-line rewrite change; progress is measurable (% of routes migrated is an objective metric).
- **Cons:** Running two apps in parallel doubles infrastructure costs until complete; the proxy adds a network hop for unported routes, increasing latency slightly; shared auth and session state must work across both apps simultaneously; cross-zone navigation triggers full page reloads; migration can stall if no deadline forces completion, and partial state becomes permanent.

**When to use:** Replacing a large legacy SPA or server-rendered app without halting feature development; orgs where different teams own different path prefixes and need independent deploys; apps where a full rewrite is too risky to ship in one release; teams adopting Next.js incrementally while keeping an existing Node/Rails/Django frontend alive.
**When to avoid:** Small apps (< 10 routes) where a single rewrite is faster; when legacy and new apps cannot share authentication (routing split makes sessions unworkable); projects where proxy latency overhead is unacceptable at the target performance budget.

**Key terms:** **Strangler Fig**: migration pattern where new code wraps and gradually replaces a legacy system route by route. **fallback rewrite**: Next.js rewrite checked last (after filesystem and dynamic routes), used to proxy unported paths to a legacy origin. **Multi-Zones**: Next.js approach for running multiple independent Next.js apps under one domain, each owning distinct path prefixes. **assetPrefix**: Next.js config option that namespaces a zone's `/_next/static` assets to prevent collisions with other zones. **big-bang rewrite**: replacing an entire app in one release; high risk because the new app must be feature-complete before any cutover.

**Pitfalls:**
- Using `<Link>` across zone boundaries: Next.js tries to soft-navigate and fails; use `<a>` instead.
- Forgetting `assetPrefix` in Multi-Zones: zones collide on `/_next/static` paths.
- Shared cookies with `Domain=` set too narrowly: sessions break mid-migration.
- Letting the migration stall indefinitely: set a hard deadline or the proxy layer becomes permanent tech debt.
- Not testing the fallback rewrite under load: the legacy origin becomes a bottleneck for every unported route.

**Interview angle:** "A fallback rewrite makes every new page file a migration commit: no rule to update, just delete the legacy route when you're done."

**Related:** `microfrontends-module-federation`, `monorepos`, `deployment-strategies-feature-flags`, `backend-for-frontend`

**Deep dive:** https://fearchitect.com/topics/incremental-migration-strangler-fig

---

## Component Architecture & Project Structure

**One-liner:** Structuring components so composition beats configuration.

**Key tradeoffs:**
- **Pros:** Compound components eliminate prop explosion (callers control structure); headless components are independently testable and style-agnostic; the polymorphic `as` prop covers button, anchor, and router link with full TS safety; feature-based folders make feature deletion a single `rm -rf` with no orphaned files; explicit context boundaries make data flow auditable without a global store.
- **Cons:** Compound components add a context per family (many families mean many contexts); polymorphic TS typing is verbose and trips up newer TypeScript developers; headless components shift all styling responsibility to every consumer; feature folders can duplicate code when two features share a primitive; context with frequent updates causes broad rerenders without careful memoization.

**When to use:** Design-system primitives (tabs, select, dialog) needing style-agnostic behavior (headless/compound); shared UI rendering as different HTML tags by context (polymorphic `as`); teams building multiple features in parallel (feature-based folders reduce merge conflicts); a prop passed through 3+ layers untouched (move it to context).
**When to avoid:** Simple one-off components (compound patterns add structure cost that isn't paid back); global frequently-updated state like mouse position or scroll (context rerenders all subscribers; use a signal or ref); monorepos with cross-package sharing (layer-based structure is easier to barrel-export).

**Key terms:** **Compound component**: a family of components sharing state via context; parent owns, children consume. **Headless component**: a hook or renderless component owning behavior but no markup or styles. **Polymorphic `as` prop**: a generic prop letting callers choose the rendered HTML element with correct TS types. **Feature-based colocation**: grouping all files for one feature together; enables atomic feature deletion. **Container/presentational**: pattern separating data-fetching (container) from pure rendering (presentational).

**Pitfalls:**
- Putting all state in a single large context causes every consumer to rerender on any change.
- Making the `as` prop non-generic (typed as `string`) loses all downstream prop inference.
- Placing shared primitives inside a feature folder makes them invisible to other features.
- Container/presentational split applied rigidly produces too many single-use wrapper files.
- Co-locating test files is good; co-locating generated or build artifacts breaks tooling.

**Interview angle:** "Composition beats configuration. Expose slots and children, not a prop for every variant."

**Related:** `react-server-components`, `client-state-management`, `design-system`, `microfrontends-module-federation`

**Deep dive:** https://fearchitect.com/topics/component-architecture

---
