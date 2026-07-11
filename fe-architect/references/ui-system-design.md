# UI System-Design Patterns

> Scenario drills for the components interviewers love to ask. Reference material for the fe-architect skill. Load for data tables, modals/dialogs, file upload, autocomplete/typeahead, infinite scroll, rich text editors, and real-time dashboards.

## Autocomplete / Typeahead

**One-liner:** Debounced input, AbortController cancellation, and ARIA combobox.

**Key tradeoffs:**
- **Pros:** Debounce collapses rapid keystrokes into one request per query; AbortController prevents stale/out-of-order responses from overwriting fresh ones; per-query cache renders instantly on a hit and skips the fetch entirely.
- **Cons:** Requires careful AbortError handling so cancels aren't shown as errors; needs a min-char threshold to avoid low-signal results; cache needs a stale-while-revalidate strategy to stay fresh.

**Key approach / when to use:** Per keystroke, reset a debounce timer (200-300 ms); on fire, check a min-char threshold (~2); abort any in-flight request, create a new AbortController, pass `signal` to `fetch`, set loading; render results/empty/error. Check the cache before creating a controller. A hit renders immediately with nothing to abort.
**When to avoid / watch:** Below the min-char threshold show idle, not results; on a cache hit do not fire a network request at all.

**Key terms:** **AbortController**: browser API producing a `signal` for cancelling fetch mid-flight. **debounce**: delay firing until input pauses; collapses rapid events into one call. **ARIA combobox**: `role="combobox"` on the input plus `role="listbox"` on the list; enables screen-reader announcement. **stale-while-revalidate**: return cached data immediately while fetching an update in the background. **aria-activedescendant**: points the input's accessible focus to the highlighted option id.

**Pitfalls:**
- Without aborting the previous request, a slow reply for "ab" can resolve after a fast "abc" and overwrite newer results with stale ones (out-of-order render).
- Treating a deliberate abort as a failure: check `err.name === "AbortError"` in catch and return early without setting error state.
- Single-character queries return too many low-signal results and load the server. Enforce a min-char threshold (~2).
- ARIA contract: Arrow keys move `aria-activedescendant`, Enter selects, Escape closes and returns focus to the input.

**Interview angle:** "Debounce batches keystrokes; AbortController prevents stale responses from overwriting fresh ones."

**Related:** `client-state-management`, `server-state-data-fetching`, `accessibility`

**Deep dive:** https://fearchitect.com/topics/autocomplete-typeahead

---

## Data Table / Data Grid

**One-liner:** Headless table logic separate from rendering, with server-side ops for large datasets.

**Key tradeoffs:**
- **Pros:** Headless split (library owns sort/filter/pagination/selection state, you own the markup); client-side gives instant sort/filter feedback and needs no API contract under ~10k rows; server-side fetches only the current page for fast first paint and each fetch reflects current server state.
- **Cons:** Server-side must encode sort/filter/page in query params (an API contract); client-side data ages until the next fetch and stalls past ~10k rows; virtualization requires a fixed `estimateSize` per row.

**Key approach / when to use:** Client-side works under ~10k rows in memory. Past that (or a slow initial load) set `manualSorting`/`manualPagination` so table state drives the query key and the backend returns one page. Virtualize the visible rows (~20) with TanStack Virtual before you hit 500 visible `<tr>`s.
**When to avoid / watch:** Rendering 1,000+ `<tr>` nodes blocks the main thread on every sort/scroll; virtualizing 50,000 in-memory rows is still 50,000 JS objects. Pair virtualization with server-side pagination to bound the dataset.

**Key terms:** **headless table**: manages table state with no DOM output; you render the markup (`flexRender`). **row virtualization**: render only viewport rows; recycle DOM nodes on scroll. **server-side operations**: sort/filter/pagination run on the backend; only the current page is sent. **column pinning**: sticky columns fixed left/right while the rest scroll horizontally. **aria-sort**: `<th>` attribute communicating sort direction (`ascending`/`descending`/`none`) to screen readers.

**Pitfalls:**
- Rendering 1,000+ rows blocks the main thread. Virtualize to ~20 visible rows with a fixed `estimateSize`.
- `aria-sort` must be set on every sortable `<th>` (inactive ones get `none`), not just the active column; omit it on non-sortable columns.
- Switching to server-side ops without encoding sort/filter/page in the query key means TanStack Query never refetches on change.
- A 200-500 row page can still block scroll even when paginated server-side. Virtualize anyway.

**Interview angle:** "TanStack Table owns the state; you own the markup. Push ops to the server once the client can't sort in memory fast enough."

**Related:** `infinite-scroll-feed`, `realtime-dashboard`, `server-state-data-fetching`, `render-performance-patterns`

**Deep dive:** https://fearchitect.com/topics/data-table

---

## File Upload

**One-liner:** Presigned URLs, chunked uploads, progress UI, and retry.

**Key tradeoffs:**
- **Pros:** Presigned URL means the browser PUTs straight to object storage: server never proxies bytes, offloading bandwidth/CPU/memory to the storage service; XHR exposes per-file upload progress; chunked/resumable uploads survive network drops; client-side validation gives immediate feedback.
- **Cons:** Bucket CORS must allow PUT from your origin; `fetch` has no upload-progress hook (forces XHR); chunked uploads add bookkeeping to track completed parts; concurrent uploads must be capped or they saturate the connection.

**Key approach / when to use:** Three-step flow: (1) client POSTs name/size/type, server validates and signs a PUT URL (~15 min TTL); (2) browser PUTs the file binary directly to storage; (3) client notifies the backend with the storage key for metadata and post-processing. Use XHR (`xhr.upload.onprogress`) for progress. For files over ~100 MB use S3 Multipart or TUS; cap concurrent uploads at ~3.
**When to avoid / watch:** Retry only transient failures (5xx, network) with exponential backoff, never retry 4xx; revoke `URL.createObjectURL` object URLs after preview to free memory.

**Key terms:** **Presigned URL**: time-limited signed URL authorising one HTTP op (PUT/GET) on storage without exposing credentials. **S3 Multipart Upload**: splits a file into parts (min 5 MB each), uploads in parallel, assembles server-side. **TUS protocol**: open resumable upload protocol; tracks byte offset server-side so interrupted uploads resume. **DataTransfer.files**: FileList exposed by the drop event for drag-and-drop. **xhr.upload.onprogress**: XHR event firing as upload bytes leave the browser.

**Pitfalls:**
- S3 Multipart parts must be ≥5 MB except the final part. Smaller parts are rejected.
- Bucket CORS must allow PUT (and Content-Type) from your origin or the browser blocks the cross-origin upload.
- `fetch` has no upload-progress equivalent without a TransformStream workaround. Use XHR's `xhr.upload.onprogress`.
- For drag-and-drop you must `preventDefault()` on `dragover` before reading `event.dataTransfer.files` on drop.

**Interview angle:** "Generate a presigned URL server-side, PUT the file straight to S3, then notify the backend. Your server never touches the bytes."

**Related:** `network-performance`, `realtime-websockets-sse-polling`, `caching-strategies`, `backend-for-frontend`

**Deep dive:** https://fearchitect.com/topics/file-upload

---

## Infinite Scroll & Feeds

**One-liner:** Cursor-paginated feed with a bounded DOM and accessible fallback.

**Key tradeoffs:**
- **Pros:** Keyset/cursor pagination is immune to inserts shifting offsets (no skips/duplicates); an IntersectionObserver sentinel fires once off the critical path (no scroll listener); a virtualizer caps DOM nodes (~30) regardless of list length; a "load more" button preserves keyboard/screen-reader access.
- **Cons:** Offset pagination skips/repeats rows on a live feed; scroll-event listeners fire hundreds of times per scroll on the main thread; without windowing every appended page keeps its DOM alive (memory + layout thrash); back-navigation needs explicit scroll restoration.

**Key approach / when to use:** Cursor for correctness, sentinel for triggering, virtualizer for DOM health, "load more" for keyboard users. A keyset cursor encodes the last row's sort key so inserts don't shift it; `rootMargin: "200px"` prefetches before the sentinel is visible. Add TanStack Virtual once the list exceeds ~200 rows.
**When to avoid / watch:** Past 1,000+ items an un-windowed list causes layout thrash and high memory; save `scrollTop` in session storage on `popstate` and restore after the initial page hydrates.

**Key terms:** **keyset pagination**: paginate by encoding the last-seen row's sort key as a cursor; immune to inserts. **sentinel element**: empty node at the list bottom; IntersectionObserver fires when it enters the viewport. **list virtualization**: render only visible rows plus small overscan. **scroll restoration**: save and re-apply scroll position for back-navigation. **IntersectionObserver**: fires a callback when a target crosses a viewport threshold; no scroll listener needed.

**Pitfalls:**
- Offset pagination (`LIMIT n OFFSET k`) skips or repeats items when rows are inserted mid-scroll. Use a keyset cursor.
- A scroll-event listener fires continuously on the main thread; an IntersectionObserver sentinel fires one callback, no throttling needed.
- Keyboard and screen-reader users can't scroll to trip the observer. A visible "load more" button is mandatory.
- Without windowing, appended pages keep their DOM nodes alive. Virtualize past ~200 rows to ~30 nodes.

**Interview angle:** "Cursor for correctness, sentinel for triggering, virtualizer for DOM health, 'load more' for keyboard users."

**Related:** `server-state-data-fetching`, `render-performance-patterns`, `data-table`, `accessibility`

**Deep dive:** https://fearchitect.com/topics/infinite-scroll-feed

---

## Modal & Dialog System

**One-liner:** Native <dialog> vs portal pattern: focus trap, top-layer, a11y.

**Key tradeoffs:**
- **Pros:** Native `<dialog>` + `showModal()` gives a focus trap, top-layer stacking (above all z-index), a `::backdrop` pseudo-element, and Esc-to-close for free. Baseline across modern browsers, no library.
- **Cons:** Native entry/exit animation is limited (needs `@starting-style`) and it does not scroll-lock automatically; a custom portal gives full animation control but must hand-roll focus trap, top-layer simulation, backdrop, and Esc handling.

**Key approach / when to use:** Reach for `<dialog>` + `showModal()` first. Build a custom portal only when you need entry/exit animations requiring DOM presence while invisible, or multi-step stacked dialogs needing fine stacking control. Every dialog must satisfy all five a11y rules: focus moves in on open; Tab/Shift-Tab stays trapped; Esc closes and returns focus to the trigger; accessible name via `aria-labelledby`; background marked `inert`.
**When to avoid / watch:** Scroll lock: `overflow: hidden` on `<body>` stops background scroll but shifts layout by the scrollbar width (~15-17 px); measure `window.innerWidth - document.documentElement.clientWidth` and apply it as `padding-right`. Native `<dialog>` does not do this for you.

**Key terms:** **top layer**: browser-managed stacking context above all z-index; `showModal()` promotes into it. **focus trap**: Tab/Shift-Tab cycles only inside the open modal. **inert attribute**: marks a subtree non-interactive and invisible to assistive tech without hiding it visually. **::backdrop**: pseudo-element behind a top-layer dialog; style with CSS to dim the page. **aria-modal**: tells screen readers the dialog is modal so virtual-cursor nav stays inside.

**Pitfalls:**
- Native `<dialog>` does not scroll-lock; `overflow: hidden` on body shifts layout by scrollbar width. Compensate with `padding-right`.
- Background content must be marked `inert`, or the screen-reader virtual cursor escapes the modal even with a focus trap.
- Focus must return to the triggering element on close, or keyboard/SR users re-orient from the top of the page.
- Never leave focus on the trigger behind the modal. Move it to the first focusable element (or the dialog itself) on open.

**Interview angle:** "showModal() promotes the dialog to the top layer and traps focus automatically. The only reasons to build a custom portal are animation control or IE-era constraints that no longer apply."

**Related:** `accessibility`, `component-architecture`, `infinite-scroll-feed`

**Deep dive:** https://fearchitect.com/topics/modal-dialog-system

---

## Realtime Dashboard

**One-liner:** Design a live data dashboard without overwhelming the main thread.

**Key tradeoffs:**
- **Pros:** rAF coalescing limits renders to one per frame regardless of message rate; SSE auto-reconnects with `Last-Event-ID` replay and works behind any HTTP proxy; canvas draws 50,000+ points per frame with no layout cost; OffscreenCanvas + a Web Worker moves rendering fully off the main thread.
- **Cons:** Canvas loses per-node interactivity (needs manual hit-testing); WebSocket reconnect is manual and needs sticky sessions or a broker; polling has high overhead; under backpressure you must drop stale frames.

**Key approach / when to use:** SSE for one-way push, rAF to coalesce, canvas when node count exceeds the DOM budget. Buffer incoming messages in a ref (never setState per message); flush once per `requestAnimationFrame` with last-value-per-id winning. DOM/SVG is fine up to ~500 points and degrades past ~2,000; switch to canvas beyond that. Reconnect with exponential backoff (1 s → cap 30 s); fetch a snapshot then resume the stream.
**When to avoid / watch:** Do not coalesce with `setInterval`: a fixed-interval flush can fire mid-paint and cause tearing; rAF fires before compositing, the correct flush point. Don't store incoming data in React state. Buffer it in a ref.

**Key terms:** **requestAnimationFrame (rAF)**: schedules a callback before the next paint, used to coalesce high-frequency updates into one render per frame. **Backpressure**: producer sends faster than the consumer can render; handle by dropping stale frames. **Coalescing**: merge many events into one state update per frame so the UI paints once. **EventSource**: SSE API: persistent GET firing `message` events, auto-reconnects with `Last-Event-ID`. **Canvas 2D API**: imperative drawing API rendering thousands of points without DOM nodes.

**Pitfalls:**
- Calling setState per message at 100 msg/s triggers 100 renders/s, overrunning the 60 fps budget. Buffer in a ref, flush once per rAF.
- `setInterval` flushing can fire mid-paint and tear. Flush inside `requestAnimationFrame`, which runs before the browser composites.
- Reset backoff on the first successful message, not on connection open. A connection can open then immediately close before data flows.
- After a drop, fetch a snapshot first then resume the stream from a cursor, or you miss events that arrived during the gap.

**Interview angle:** "SSE for one-way push, rAF to coalesce, canvas when node count exceeds DOM budget."

**Related:** `realtime-websockets-sse-polling`, `render-performance-patterns`, `web-workers-off-main-thread`, `event-loop-scheduler-yield`

**Deep dive:** https://fearchitect.com/topics/realtime-dashboard

---

## Rich Text Editor

**One-liner:** Own a document model; never trust raw contentEditable output.

**Key tradeoffs:**
- **Pros:** A document-model editor keeps a typed in-memory tree as source of truth and renders the DOM from it, making serialization deterministic, validation tractable, and collaborative editing possible; framework choice tunes bundle size, schema strictness, and collab maturity.
- **Cons:** Raw `contentEditable` lets the browser own the DOM, producing cross-browser dirty HTML that is XSS-dangerous; each framework trades off: Lexical is small (~22 kB) but newer, ProseMirror/TipTap are strict and mature but heavier, Slate is flexible but largest (~100 kB) with ad-hoc schema.

**Key approach / when to use:** Choose **Lexical** for a React-first project where bundle size matters and you want first-party Meta support; **TipTap** (over raw ProseMirror) for a batteries-included extension library and proven Yjs collaboration; **Slate** when you need deep data-model control with a custom JSON schema. Avoid raw `contentEditable` always. Use the editor's Selection API (not `window.getSelection()`); serialize to your own schema; collab via Yjs/CRDTs with a separate awareness layer for presence.
**When to avoid / watch:** Never store or render raw `contentEditable` HTML: it's XSS-dangerous and browser-dependent; if you must accept raw HTML (paste from Word), run a server-side sanitizer with a strict allowlist. Safe default: store the JSON model and derive HTML at render time.

**Key terms:** **document model**: typed in-memory tree the editor owns; DOM is derived from it, not the reverse. **ProseMirror**: low-level toolkit with a strict schema-validated node/mark graph; foundation of TipTap. **Lexical**: Meta's extensible framework; typed node classes, immutable state, small core. **CRDT**: data structure that merges concurrent edits from multiple clients without coordination. **Yjs**: CRDT library; y-prosemirror and y-lexical adapt it to editor operations.

**Pitfalls:**
- Storing or rendering raw `contentEditable` HTML is XSS-dangerous and browser-dependent. Store the JSON model and derive HTML from your own serializer.
- Using `window.getSelection()` instead of the editor's Selection API exposes cross-browser range quirks the model would normalize.
- Serializing to `innerHTML` instead of your own schema: derive HTML from the model at read time.
- Presence (other users' cursors and selections) is separate from the document CRDT. It needs a Yjs awareness layer (`y-protocols/awareness`).

**Interview angle:** "The editor owns the model; the DOM is just a view of it."

**Related:** `realtime-websockets-sse-polling`, `xss-csrf-clickjacking`, `csp-trusted-types`, `state-machines`

**Deep dive:** https://fearchitect.com/topics/rich-text-editor
