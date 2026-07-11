# State & Data

> Reactivity, client/server state, and data paradigms. Reference material for the fe-architect skill. Load for client vs server state, signals, state machines, optimistic UI, data fetching, REST/GraphQL/tRPC, realtime transports.

## Client State Management

**One-liner:** Decide where UI state lives; pick the right tool for the scope.

**Key tradeoffs:**
- **Pros:** useState/useReducer are built-in with zero bundle cost; Zustand (~3 kB) gives selector-scoped re-renders for app-wide UI state; Jotai (~3 kB) atoms are co-located per feature and tree-shaken; Redux Toolkit (~16 kB) suits large teams needing an auditable action log.
- **Cons:** Context re-renders every consumer on any reference change, even unrelated fields; bare `useStore()` (no selector) re-renders on any store mutation; Redux Toolkit carries ~16 kB; storing server data in a client store creates silent stale-data bugs.

**When to use:** Start local: useState owns one value, useReducer owns complex shape or multi-step transitions; lift before you globalise (siblings sharing state go to nearest common ancestor); Context for low-frequency shared values like theme/locale (split contexts by update frequency); Zustand selector `useStore(s => s.count)` to re-render only when count changes; Jotai when state is scattered across many features.
**When to avoid:** Don't put server-fetched data in useState or a Zustand store. It needs background refetch, deduplication, and invalidation that client stores don't provide; use React Query, SWR, or RTK Query instead.

**Key terms:** **useState**: React hook for a single local state value; re-renders the owning component on change. **useReducer**: React hook managing state via a pure `(state, action) => state` function. **Context**: React mechanism to share a value to a subtree without prop-drilling; re-renders all consumers on change. **Zustand `create`**: factory that returns a typed store hook; selectors limit which components re-render. **Jotai `atom`**: smallest unit of Jotai state; atoms compose via derived atoms and are tree-shakeable. **createSlice**: RTK function that generates action creators and a reducer from a single object.

**Pitfalls:**
- Putting API responses in `useState`: server data needs background refetch, dedup, and invalidation. The value goes stale silently.
- Using a single large context object: every consumer re-renders on any reference change, even reading one unrelated field.
- Reaching for a global store when only sibling components need shared state. Lift to the nearest common ancestor first.
- Using bare `useStore()` instead of a selector: the component re-renders on unrelated store mutations.

**Interview angle:** "Start local, lift when siblings need it, add a store only when context's re-render cost becomes the bottleneck."

**Related:** `server-state-data-fetching`, `signals-fine-grained-reactivity`, `optimistic-ui-mutations`, `render-performance-patterns`

**Deep dive:** https://fearchitect.com/topics/client-state-management

---

## Server State & Data Fetching

**One-liner:** Async, shared, remote-owned data that requires a dedicated cache layer.

**Key tradeoffs:**
- **Pros:** A query cache (TanStack Query v5, SWR) tracks loading/error/success so components don't have to; deduplicates concurrent requests by query key; revalidates in the background on focus/reconnect; `staleTime` prevents redundant refetches; RSCs can fetch on the server and ship HTML with no client cache needed.
- **Cons:** Default `staleTime: 0` refetches on every mount, hammering the API; coordinating an RSC fetch and a client `useQuery` for the same resource sends duplicate requests; copying server state into Redux creates a second source of truth and manual sync logic.

**When to use:** Any list/detail view fetching from an API needing loading/error states (TanStack Query or SWR); data shared by sibling components (let the cache dedupe instead of lifting); polling dashboards/feeds via `refetchInterval`; initial page data in Next.js App Router fetched in a Server Component.
**When to avoid:** True client-only state (modals, themes, form values): use useState or Zustand; don't mirror server state into Redux/a global store (the query cache already is the store); RSCs for data that must update in real time without navigation: use a client cache or WebSocket.

**Key terms:** **query key**: serialisable array that identifies a cache entry in TanStack Query or SWR; changing it triggers a new fetch. **staleTime**: duration in ms during which cached data is fresh and no background refetch fires. **gcTime**: how long an unused cache entry is kept in memory before garbage collection (default 5 min). **background revalidation**: refetch triggered silently on focus or reconnect; updates the cache without a loading spinner. **request deduplication**: multiple components calling `useQuery` with the same key share one in-flight network request.

**Pitfalls:**
- Leaving `staleTime` at default `0` refetches on every mount, hammering the API for stable data.
- Forgetting to include all variables in `queryKey` returns the previous id's cached response for a new id.
- Using `gcTime: 0` to "disable" caching breaks deduplication. Concurrent mounts each send their own request.
- Fetching the same resource in both an RSC and a client `useQuery` without coordination sends duplicate requests (App Router only dedupes identical fetches within one render; the Data Cache is off by default).

**Interview angle:** "Server state is remote-owned and stale by default. A dedicated cache layer beats manual `useEffect` wiring every time."

**Related:** `client-state-management`, `optimistic-ui-mutations`, `realtime-websockets-sse-polling`

**Deep dive:** https://fearchitect.com/topics/server-state-data-fetching

---

## Optimistic UI & Mutations

**One-liner:** Update the UI before the server replies; roll back on error.

**Key tradeoffs:**
- **Pros:** Eliminates perceived latency: UI responds in under 16 ms; works well for idempotent mutations (toggles, likes, reorders); TanStack Query's `onSettled` invalidation keeps the cache correct after any outcome; React 19 `useOptimistic` needs no manual rollback; pairs naturally with Next.js 15 App Router server actions.
- **Cons:** Rollbacks are jarring when mutations fail often (optimism only wins on high success rates); `onMutate` cache manipulation adds per-query-key maintenance; race conditions are subtle (forgetting `cancelQueries` lets stale data overwrite); idempotency must be enforced at the API layer; multiple optimistic list items complicate rollback targeting.

**When to use:** Toggle actions (like, follow, bookmark) with near-100% success; list mutations (add/delete/reorder) that should feel instant; form submissions inside React 19 async action props (`useOptimistic` removes boilerplate); any mutation where latency is perceptible and a stale read during the round-trip is acceptable.
**When to avoid:** Payments or irreversible operations: a false optimistic confirmation is worse than a spinner; mutations with high server error rates (constant rollbacks erode trust); endpoints without idempotency guarantees where retries produce duplicate records.

**Key terms:** **onMutate**: TanStack Query callback that runs before the fetch; returns a context snapshot for rollback. **onError**: mutation callback receiving the `onMutate` context; restores the cache snapshot on failure. **onSettled**: fires after success or error; the right place to call `invalidateQueries`. **useOptimistic**: React 19 hook that applies an optimistic reducer and auto-reverts when the transition settles. **idempotency**: property where repeating a request produces the same result; required for safe retries.

**Pitfalls:**
- Forgetting `cancelQueries` in `onMutate`: an in-flight refetch resolves after your optimistic write and silently reverts it.
- Not returning the snapshot from `onMutate`: `onError` receives `undefined` as context and cannot roll back.
- Calling `setOptimistic` outside `startTransition`: React warns and the optimistic state may flicker or not revert.
- Optimistic-adding items without a stable temporary ID: key conflicts remount the wrong node on reconciliation.
- Skipping `onSettled` invalidation after a successful mutation: the cache drifts from server state indefinitely.

**Interview angle:** "Write optimistically in `onMutate`, roll back in `onError` with the snapshot, and always invalidate in `onSettled`."

**Related:** `server-state-data-fetching`, `client-state-management`, `realtime-websockets-sse-polling`

**Deep dive:** https://fearchitect.com/topics/optimistic-ui-mutations

---

## Signals & Fine-Grained Reactivity

**One-liner:** Observable values that re-run only their exact dependents.

**Key tradeoffs:**
- **Pros:** Only changed dependents update: no VDOM diff, no full component re-render; derived state is memoized automatically (no manual `useMemo`); effects subscribe precisely (no stale-closure or missing-dependency bugs); scales to large reactive graphs without cascading re-renders; TC39 Stage 1 proposal may land `Signal.State`/`Signal.Computed` in JS itself.
- **Cons:** Reading a signal outside a tracked scope silently skips subscription; circular dependencies between computeds cause infinite loops at runtime; debugging reactive graphs is harder than stepping through a call stack; React's ecosystem (hooks, RSC, Suspense) doesn't map to signals without shims.

**When to use:** Frameworks built on signals (SolidJS, Preact, Angular 17+, Vue 3 via `ref()`); high-frequency state (live data, sliders, canvas controls) where re-renders are expensive; derived state that fans out across many consumers (computed handles it for free).
**When to avoid:** React codebases: signals require framework-level support; the React Compiler is the native alternative. Simple state with few consumers where a reactive graph adds complexity. When you need React's concurrent features (transitions, Suspense boundaries) that don't exist in signal-based runtimes.

**Key terms:** **signal**: a reactive cell: reads subscribe the caller; writes notify all current subscribers. **computed**: a derived, read-only signal that lazily re-evaluates when any dependency changes. **effect**: a side-effectful callback that re-runs eagerly whenever its signal dependencies change. **fine-grained reactivity**: updates propagate to individual expressions or DOM nodes, not entire components. **TC39 Signals proposal**: a Stage 1 proposal to add `Signal.State` and `Signal.Computed` as native JS primitives.

**Pitfalls:**
- Reading a signal outside effect/computed returns the value but creates no subscription. Future changes are missed.
- In SolidJS, passing `count` instead of `count()` passes the signal object, not the reactive value.
- Creating an effect inside a loop or conditional shifts subscriptions between runs, corrupting the graph.
- Migrating React context to a signal-based store requires restructuring consumers. There's no drop-in adapter.

**Interview angle:** "Signals make the dependency graph explicit at runtime. Only the expressions that read a changed value re-run, with no diff needed."

**Related:** `client-state-management`, `render-performance-patterns`, `state-machines`, `optimistic-ui-mutations`

**Deep dive:** https://fearchitect.com/topics/signals-fine-grained-reactivity

---

## State Machines

**One-liner:** Model UI as explicit states with typed transitions to kill impossible states.

**Key tradeoffs:**
- **Pros:** Impossible states become unrepresentable: no `isLoading && isError` bugs; transitions are explicit so any developer can read every valid path; XState actors isolate async side effects from render logic for independent testing; `useReducer` machines need zero dependencies and add no bundle weight; statecharts visualise in Stately Studio for design-dev handoff.
- **Cons:** XState v5 adds ~15 KB min+gzip, overkill for simple flag toggles; setup cost is higher than ad-hoc state (requires upfront state enumeration); teams must learn `invoke`, `entry`/`exit`, and guard semantics; `setup().createMachine()` verbosity feels heavy for a two-state toggle.

**When to use:** Async flows with loading/error/success branches; multi-step forms or wizards where back-navigation and validation guard each step; media players, drag-and-drop, or any component with a well-defined lifecycle; team codebases where ad-hoc boolean flags have already caused bugs.
**When to avoid:** Simple open/closed toggles: `useState(false)` is clearer; server state (pagination, caching): use TanStack Query or SWR; bundles where 15 KB for XState is prohibitive: `useReducer` covers most cases for free.

**Key terms:** **finite state machine**: a model with a fixed set of states, one active at a time, and explicit transitions. **statechart**: an extended state machine with hierarchy, parallel regions, and entry/exit actions. **discriminated union**: a TypeScript union where a shared `type` or `status` field narrows each branch. **actor (XState)**: a running process that receives events, holds state, and can spawn child actors. **guard**: a boolean function on context and event that conditionally allows a transition.

**Pitfalls:**
- Encoding flags instead of states: `{ isLoading: true, isError: false }` is not a machine; use a `status` discriminant.
- Forgetting to ignore invalid transitions: a reducer that returns current state unchanged prevents impossible state jumps.
- Putting side effects directly in the reducer or machine `context` updater: use XState actions/actors or dispatch from `useEffect`.
- Using XState for server cache state (pagination, invalidation): TanStack Query owns that problem better.
- Naming states with adjectives (`isLoading`) instead of nouns (`loading`) makes `state.matches()` awkward.

**Interview angle:** "Four booleans give 16 states; only 4 are valid. Model the 4, and the compiler kills the other 12."

**Related:** `client-state-management`, `optimistic-ui-mutations`, `error-boundaries-resilience`

**Deep dive:** https://fearchitect.com/topics/state-machines

---

## REST vs GraphQL vs tRPC

**One-liner:** Three API styles with distinct fetch, type, and caching trade-offs.

**Key tradeoffs:**
- **Pros:** REST gets standard HTTP/CDN caching with zero extra tooling and is consumable by any HTTP client or language; GraphQL fetches deeply nested cross-resource data in one round-trip with clients declaring exactly the fields they need (no over-fetching); tRPC gives end-to-end TypeScript types with no codegen: a server change surfaces instantly as a client type error.
- **Cons:** REST over/under-fetches (bloated responses or multiple round-trips) and demands versioning discipline; GraphQL has N+1 query problems needing DataLoader, and POST queries bypass HTTP caching (persisted queries add setup); tRPC only works in a shared TypeScript monorepo, no external consumers.

**When to use:** REST for public APIs consumed by third parties / non-TS clients, and read-heavy CDN-cacheable resources where HTTP semantics map cleanly; GraphQL for product APIs with diverse clients (mobile, web) needing different field sets; tRPC for full-stack TypeScript monorepos wanting compile-time safety with no schema ceremony.
**When to avoid:** tRPC when any consumer is outside the monorepo or not TypeScript; GraphQL when most queries are simple CRUD (the overhead rarely pays off); REST when clients need ad-hoc field selection across many resource types in one request.

**Key terms:** **Over-fetching**: receiving more fields than the client needs from a REST endpoint. **Under-fetching**: needing multiple REST round-trips because one endpoint lacks required data. **N+1 problem**: one query for a list plus one query per item, O(N) DB calls instead of two. **DataLoader**: batches and caches per-tick GraphQL resolver calls into a single DB query. **Persisted query**: stores a query by hash server-side so clients send a GET with just the hash.

**Pitfalls:**
- GraphQL N+1: resolvers fetching child rows one-by-one kill DB performance. Always add DataLoader.
- tRPC in a multi-repo setup: types can't cross the package boundary without publishing, defeating the point.
- REST over-fetching on mobile: returning full objects when only 2 fields are needed inflates payloads on slow networks.
- GraphQL caching gap: queries sent as HTTP POST bypass CDN caches; use persisted queries for GET-based caching.
- REST versioning neglect: making breaking changes to `/v1` shapes instead of adding `/v2` breaks existing clients silently.

**Interview angle:** "GraphQL gives clients control over shape at the cost of HTTP caching; tRPC gives TypeScript control over types at the cost of portability."

**Related:** `server-state-data-fetching`, `client-state-management`, `network-performance`, `backend-for-frontend`, `caching-strategies`

**Deep dive:** https://fearchitect.com/topics/rest-vs-graphql-vs-trpc

---

## Real-time: WebSockets vs SSE vs Polling

**One-liner:** Match the right real-time transport to your data-flow direction.

**Key tradeoffs:**
- **Pros:** Short polling works behind every proxy and CDN with zero server changes; SSE reuses HTTP, getting browser auto-reconnect and `Last-Event-ID` replay for free, and scales behind stateless servers with a pub-sub broker (Redis, Postgres LISTEN); WebSockets have the lowest per-message overhead and true bidirectional push; long polling cuts empty round-trips while staying HTTP-compatible.
- **Cons:** Short polling wastes bandwidth and server threads on empty responses; SSE is one-way (client→server still needs separate HTTP); WebSockets need sticky sessions or a message broker (stateless deploys break them) and don't auto-reconnect (you write backoff logic); HTTP/1.1 limits SSE to 6 connections per origin per tab (lifted in HTTP/2).

**When to use:** SSE for stock tickers, notifications, live feeds (unidirectional, auto-reconnect, HTTP-friendly); WebSocket for chat, collaborative editing, multiplayer games (both sides push frequently); short polling behind corporate proxies that block SSE/WS, or intervals > 30 s; long polling when SSE is unavailable and you need lower latency than a fixed interval.
**When to avoid:** WebSockets when the server can't hold stateful connections (serverless functions with short timeouts); SSE for bidirectional flows (you'll end up with hybrid SSE + REST, which WebSocket handles cleanly); short polling under 5 s at scale (thundering-herd effect).

**Key terms:** **EventSource**: browser API for SSE: opens a persistent GET, fires `message` events, auto-reconnects with `Last-Event-ID`. **WebSocket upgrade**: HTTP 101 handshake that switches a TCP connection to the WebSocket frame protocol. **Long polling**: server holds a request open until data is ready, reducing empty responses vs fixed-interval polling. **Sticky session**: load-balancer rule routing one client to the same server node, needed for stateful WebSocket connections. **Heartbeat / ping-pong**: periodic frames sent to keep a TCP connection alive through idle-timeout proxies.

**Pitfalls:**
- Forgetting WebSocket heartbeats: idle connections are killed silently by load balancers after 60-120 s.
- Sending auth tokens in the WebSocket URL query string: they appear in server logs and browser history.
- Using SSE over HTTP/1.1 with multiple tabs open: the 6-connection cap starves other requests.
- No `Last-Event-ID` handling on the SSE server: clients lose events during reconnect gaps.
- Scaling WebSocket servers without sticky sessions or a broker: messages land on the wrong node.

**Interview angle:** "SSE for one-way push behind HTTP; WebSocket when the client sends too."

**Related:** `realtime-dashboard`, `server-state-data-fetching`, `optimistic-ui-mutations`, `cdn-edge-caching`

**Deep dive:** https://fearchitect.com/topics/realtime-websockets-sse-polling
