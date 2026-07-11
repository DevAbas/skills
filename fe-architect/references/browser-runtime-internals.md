# Browser & Runtime Internals

> The pipeline, the main thread, workers, and Wasm. Reference material for the fe-architect skill. Load for the event loop/scheduling, the rendering pipeline, paint/composite optimization, web workers, and WebAssembly.

## Event Loop & scheduler.yield()

**One-liner:** Break long tasks to keep the main thread responsive and hit INP.

**Key tradeoffs:**
- **Pros:** `scheduler.yield()` re-queues the continuation at `user-visible` priority, so it resumes before background tasks; resumes before background tasks, unlike `setTimeout(0)` which has no priority guarantee.
- **Cons:** `scheduler.yield()` is Chromium + Firefox only (not Safari), so it needs a `setTimeout(0)` fallback with no priority guarantee; `setTimeout(0)` and `MessageChannel` join the back of the task queue, so any queued task may run first.

**When to use:** Insert `await scheduler.yield()` mid-task so no single task exceeds the 50 ms long-task threshold; yield every 50 ms (time-based deadline) when processing items in a long loop so the browser can dispatch a pending click before resuming.
**When to avoid:** Don't use `navigator.scheduling.isInputPending()` as a yield heuristic; web.dev recommends against it.

**Key terms:** **macrotask**: A single unit of work the event loop picks from the task queue: a script, event callback, or timer. **microtask**: Work queued via Promise resolution or `queueMicrotask`; drains entirely after each task before rendering. **long task**: Any main-thread task exceeding 50 ms; blocks input handling and increases INP. **INP**: Interaction to Next Paint, the 98th-percentile input-to-paint delay; good ≤200 ms. **scheduler.yield()**: Prioritized Task Scheduling API method that pauses a task and re-queues its continuation at user-visible priority.

**Pitfalls:**
- `isInputPending()` can return `false` even when real user input is pending, and it ignores animation frames. It's discouraged despite early adoption; use `scheduler.yield()` with a time deadline instead.
- A long task already running when a click arrives blocks the browser from dispatching that click until the task finishes. The entire wait counts as input delay toward INP, even if the task started before the click.
- The Safari `setTimeout(0)` fallback still yields but gives no priority guarantee: the continuation joins the back of the queue and any other task may run first.

**Interview angle:** "`scheduler.yield()` pauses a task and re-queues its continuation at user-visible priority, so the browser handles input before resuming your work."

**Related:** `core-web-vitals`, `render-performance-patterns`, `web-workers-off-main-thread`, `paint-composite-optimization`

**Deep dive:** https://fearchitect.com/topics/event-loop-scheduler-yield

---

## Paint & Composite Optimization

**One-liner:** Animate only transform and opacity to skip paint entirely.

**Key tradeoffs:**
- **Pros:** `transform` and `opacity` run on the compositor thread at 60 fps even during a JavaScript-heavy task: no layout, no paint; `content-visibility: auto` skips layout and paint for off-screen sections, and `contain` narrows the scope of style/layout recalculations.
- **Cons:** `will-change` costs GPU memory: one texture per promoted element, even when idle; animating any property other than `transform`/`opacity` (color, width, top, left) forces a repaint at minimum, and geometry properties also trigger layout.

**When to use:** Animate only `transform` and `opacity` (both compositor-only); use `content-visibility: auto` to skip rendering off-screen sections on long pages; use `contain: layout style paint` to isolate a subtree so changes inside don't retrigger outside; apply `will-change: transform` dynamically (add on `mouseenter`, remove on `animationend`), especially when many elements share a class.
**When to avoid:** Don't apply `will-change: transform` statically across dozens of elements. It inflates GPU memory and can cause jank on low-end devices.

**Key terms:** **compositor thread**: Browser thread that combines GPU layers into the final frame, independent of the main thread. **will-change**: CSS hint that promotes an element to its own GPU layer before animation, at a memory cost. **content-visibility: auto**: Skips layout and paint for off-screen elements; browser re-renders them when they scroll into view. **CSS contain**: Property that limits how much a subtree's changes affect the rest of the document's layout and paint. **paint storm**: A single DOM or style change that invalidates and repaints a large, uncontained region of the page.

**Pitfalls:**
- A paint storm happens when one state change invalidates paint for a large, uncontained region of the whole page; `contain: layout style paint` limits the blast radius to inside the box.
- `will-change` is not free: every element with it gets its own idle GPU texture; slapping it on dozens of cards wastes memory and janks low-end devices.
- Animating `top`/`left` triggers layout on every frame and blocks the main thread; use `transform: translate()` to stay compositor-only.

**Interview angle:** "Only `transform` and `opacity` are compositor-only. Everything else forces a repaint at minimum."

**Related:** `rendering-pipeline`, `event-loop-scheduler-yield`, `render-performance-patterns`, `core-web-vitals`

**Deep dive:** https://fearchitect.com/topics/paint-composite-optimization

---

## The Rendering Pipeline

**One-liner:** Style → Layout → Paint → Composite: what triggers each stage.

**Key tradeoffs:**
- **Pros:** `transform`/`opacity` skip Style, Layout, and Paint: they run on the compositor (GPU) thread and never block the main thread, costing far less than a full reflow; `transform: scaleX()` does no geometry recalculation where `width` would.
- **Cons:** Triggering Layout (reflow) is the most expensive path on a large DOM; `width`/`height`/`margin` changes run the full Style + Layout + Paint + Composite chain on the main thread, and excess `will-change` layers waste GPU memory.

**When to use:** Animate `transform` and `opacity` so changes skip the main thread; use `will-change: transform` only on elements that will animate and only when profiling shows a benefit; profile with the Chrome DevTools Performance panel before promoting layers speculatively; use `translate()` instead of animating `top`/`left` with JS.
**When to avoid:** Don't read a geometry value (`offsetWidth`, `getBoundingClientRect()`) after a DOM write inside a loop. It forces a synchronous layout flush per iteration (layout thrash).

**Key terms:** **reflow**: Browser recalculating geometry of every affected element; triggered by dimension or position changes. **layout thrash**: Alternating DOM reads and writes inside a loop, forcing repeated synchronous reflows. **compositor thread**: GPU-side thread that merges pre-painted layers; runs independently of the main thread. **will-change**: CSS hint that promotes an element to its own compositor layer before animation starts. **stacking context**: Isolated z-order subtree created by properties like `opacity < 1`, `transform`, or `isolation: isolate`.

**Pitfalls:**
- Layout thrash: reading a geometry value (`offsetWidth`, `getBoundingClientRect()`) after a DOM write flushes pending layout synchronously, and inside a loop this multiplies reflow cost by iteration count. Batch all reads before writes, or defer writes to `requestAnimationFrame`.
- `getBoundingClientRect()` forces a synchronous Layout to return accurate geometry; calling it inside a write loop causes layout thrash.
- Each `will-change` or `transform` creates a stacking context. Watch for z-index surprises; overusing `will-change` also creates excess GPU layers that increase memory pressure.

**Interview angle:** "`transform` and `opacity` skip Style, Layout, and Paint. They run on the compositor thread and never block the main thread."

**Related:** `paint-composite-optimization`, `event-loop-scheduler-yield`, `core-web-vitals`, `render-performance-patterns`

**Deep dive:** https://fearchitect.com/topics/rendering-pipeline

---

## Web Workers & Off-Main-Thread

**One-liner:** Offload CPU-heavy work to a background thread, keeping the main thread free.

**Key tradeoffs:**
- **Pros:** Each worker has its own event loop, so long tasks in a worker cannot block painting or input handling; transferring an `ArrayBuffer` moves ownership in O(1) zero-copy, and `SharedArrayBuffer` lets both threads see the same memory and write to it.
- **Cons:** Structured clone (the default) is O(n) per call and blocks the sender while cloning; thread startup (~5 ms), serialization, and proxy overhead make workers a poor fit for small, infrequent tasks; workers cannot touch the DOM.

**When to use:** Any task taking >50 ms on the main thread is a candidate (one dropped frame at 60 fps); image/video processing, wasm modules, large JSON parse/stringify, and crypto hashing are natural fits; use a worker pool (e.g. `workerpool`) to amortize startup across repeated calls; use Comlink to wrap a worker in Promise-based RPC and remove postMessage boilerplate.
**When to avoid:** Avoid workers for small, infrequent tasks: thread startup, serialization, and proxy overhead add up; don't try to access the DOM from a worker; pass computed values back to the main thread to apply.

**Key terms:** **Structured clone**: Default postMessage serialization; it deep-copies the value between threads, O(n) in data size. **Transferable**: An object (e.g. `ArrayBuffer`) whose ownership moves to the receiver thread in O(1) with zero copy. **SharedArrayBuffer**: A fixed-length binary buffer visible to both threads simultaneously; writes on one are visible on the other. **Atomics**: Built-in API for lock-free, thread-safe operations on `SharedArrayBuffer` (`Atomics.wait`, `Atomics.notify`). **Comlink**: Library that wraps a Worker with a Proxy, exposing its methods as awaitable async functions via postMessage RPC.

**Pitfalls:**
- `SharedArrayBuffer` requires cross-origin isolation: without `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on every document response it is `undefined` at runtime even in modern browsers. Verify `self.crossOriginIsolated === true` before using it.
- Structured clone deep-copies large payloads and blocks the sender thread while cloning. Use a transferable (`postMessage(data, [data.buffer])`) to move ownership in O(1) instead.
- Workers cannot access the DOM (the DOM API is single-threaded by design); concurrent access would require locking every node operation.

**Interview angle:** "Transfer `ArrayBuffer` ownership in O(1) for data pipelines; reach for `SharedArrayBuffer` only when both threads write, and only once you've set COOP/COEP headers."

**Related:** `event-loop-scheduler-yield`, `paint-composite-optimization`

**Deep dive:** https://fearchitect.com/topics/web-workers-off-main-thread

---

## WebAssembly on the Frontend

**One-liner:** Portable bytecode that runs near-native in a sandboxed browser VM.

**Key tradeoffs:**
- **Pros:** Near-native throughput for tight compute loops: no dynamic type checks mid-loop; deterministic performance with no GC pauses on the hot path; ports existing C++/Rust libraries without a full rewrite; sandboxed: no file system or network access beyond explicit JS imports.
- **Cons:** `.wasm` bundles must download and compile before first use, adding startup cost; no direct DOM or Web API access, so every UI mutation crosses the JS boundary; debugging tools are less mature than JS DevTools (source maps help but aren't universal); linear memory management is manual in C/Rust and leaks don't surface as JS errors; toolchain complexity (Emscripten or wasm-pack) adds build steps most JS teams don't know.

**When to use:** Transcoding video or audio in the browser (ffmpeg.wasm, ~30 MB); encoding/decoding image formats (WebP, AVIF, JPEG-XL via native C libraries); cryptographic operations (SHA-256 or AES over large buffers); physics/simulation loops with tight arithmetic; porting an existing C++/Rust codebase (e.g. SQLite via sql.js, pdfium) to avoid a rewrite.
**When to avoid:** Don't use Wasm as a general JS replacement: UI-heavy code crosses the boundary constantly and gains nothing, and JS starts faster since `.wasm` bundles must download and compile first; don't make thousands of boundary calls per frame passing strings/objects; batch into one buffer-in/buffer-out call.

**Key terms:** **Wasm module**: A compiled .wasm binary: a structured binary encoding of a validated module that browsers parse and compile. **JS↔Wasm boundary**: The call site where JS invokes a Wasm export or vice versa; each crossing incurs marshalling overhead. **linear memory**: A flat, resizable ArrayBuffer Wasm uses as its heap; JS can read and write it directly. **Emscripten**: Toolchain that compiles C/C++ to Wasm, generating the JS glue code needed to drive the module. **wasm-bindgen**: Rust tool that generates JS bindings for Wasm modules compiled from Rust via wasm-pack.

**Pitfalls:**
- Wasm is not a general JS replacement: it has no direct DOM or Web API access, so every DOM mutation goes through a JS import and UI-heavy code crossing the boundary constantly gains nothing.
- Each JS↔Wasm boundary crossing marshals arguments: numbers are cheap, but strings/objects must be encoded into linear memory; calling Wasm thousands of times per frame is costly, so batch a buffer of inputs and get a buffer of outputs back in one call.
- Linear memory management is manual in C/Rust; memory leaks don't surface as JS errors, and `.wasm` bundles add download + compile startup cost before first use.

**Interview angle:** "Wasm wins on raw compute; JS wins on DOM and startup time."

**Related:** `web-workers-off-main-thread`, `event-loop-scheduler-yield`, `bundle-architecture-code-splitting`, `render-performance-patterns`

**Deep dive:** https://fearchitect.com/topics/webassembly
