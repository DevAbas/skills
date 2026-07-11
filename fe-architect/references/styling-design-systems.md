# Styling & Design Systems

> Tokens, theming, CSS architecture, and the modern platform. Reference material for the fe-architect skill. Load for CSS architecture, utility-first CSS, CSS Modules vs CSS-in-JS vs Tailwind, design tokens, theming, design systems, view transitions.

## Advanced CSS Architecture

**One-liner:** Native CSS features that replace methodology and JS for cascade control.

**Key tradeoffs:**
- **Pros:** `@layer` makes cascade order explicit, removing specificity arms races and ITCSS import-order discipline; `@container` replaces JS resize observers and `:has()` replaces JS event listeners on parents; subgrid removes duplicate grid definitions in nested components
- **Cons:** `:has()` is the newest of the group, so check Baseline/caniuse before dropping fallbacks if you still support older browsers; subgrid is likewise newer, so verify support before relying on it without fallbacks

**When to use:** `@layer` to replace specificity arms races and ITCSS import-order discipline; `@container` for component-scoped breakpoints instead of JS resize observers; `:has()` instead of JS listeners that add classes to parents; `:is()`/`:where()` to replace long comma selector lists with specificity-controlled groupings; subgrid to keep nested components aligned to an ancestor grid
**When to avoid:** Don't drop fallbacks for `:has()` or subgrid before checking Baseline/caniuse if you still support older browser versions

**Key terms:** **@layer**: CSS at-rule that groups rules into named cascade layers, lower layers losing to higher ones regardless of specificity. **container query**: Rule that applies styles based on a parent container's size, not the viewport. **:has()**: Relational pseudo-class that matches an element if it contains a specific descendant or sibling. **:is() / :where()**: Forgiving selector lists; `:is()` takes the highest specificity of its args, `:where()` contributes zero specificity. **subgrid**: CSS Grid value (`grid-template-columns: subgrid`) that lets a child participate in its ancestor's grid tracks.

**Pitfalls:**
- `:where()` contributes zero specificity: using it for a rule you actually want to win means it gets overridden too easily; use `:is()` when you want normal specificity.
- A container query has no effect until you set `container-type: inline-size` (or `size`) on the parent; name it with `container-name` then query with `@container`.
- `:has()` is the newest feature here: widely supported now but verify Baseline/caniuse before dropping fallbacks for older browsers.

**Interview angle:** "`@layer` makes specificity a deliberate decision, not an accidental arms race."

**Related:** `design-tokens-theming`, `atomic-utility-first-css`, `css-modules-vs-css-in-js-vs-tailwind`, `design-system`, `component-architecture`

**Deep dive:** https://fearchitect.com/topics/advanced-css-architecture

---

## Atomic / Utility-First CSS

**One-liner:** Single-purpose classes that compose styles without growing a stylesheet.

**Key tradeoffs:**
- **Pros:** CSS file size plateaus: new components reuse existing atomic classes; design tokens are the only source of truth and arbitrary values need explicit opt-in; no naming collisions (no cascade to override); responsive/state variants (`hover:`, `sm:`, `dark:`) are co-located with markup; dead CSS is structurally impossible
- **Cons:** Markup becomes verbose: a single element may carry 10-20 class names; HTML is harder to diff in code review when class lists change; extracting a reusable variant still needs a component or `@apply`; the token vocabulary must be learned before teammates write idiomatic markup

**When to use:** Use `@apply` only for non-JS contexts (email templates, CMS-rendered HTML); in component frameworks extract a typed component instead. It keeps the token constraint and adds prop-level control
**When to avoid:** Avoid `@apply` in component frameworks. It merges declarations into one authored rule, breaking the atomic property that keeps CSS size bounded

**Key terms:** **atomic CSS**: CSS architecture where each class sets exactly one declaration, bounding stylesheet growth by token count. **utility class**: A single-purpose class derived from a design-token value, e.g. `mt-4` → `margin-top: 1rem`. **design token**: A named design decision (color, spacing, type scale) that maps to a concrete CSS value. **Tailwind v4 engine**: Rust-based, single-pass source scanner that generates only the Tailwind classes present in scanned files. **@apply**: Tailwind escape hatch that composes utilities into an authored CSS rule; breaks atomic CSS property.

**Pitfalls:**
- Using `@apply` in a component framework merges declarations into one authored rule, breaking the atomic property that keeps CSS bounded. Extract a typed component instead.
- Markup gets verbose (10-20 classes per element) and harder to diff in code review when class lists change.
- Arbitrary values require explicit bracket syntax (`mt-[13px]`), which makes one-off values visible but signals you've left the token vocabulary.
- Teammates must learn the token vocabulary before they can write idiomatic markup.

**Interview angle:** "Utility-first CSS turns styling into token composition. The stylesheet stops growing because every new component reuses existing atomic classes."

**Related:** `design-tokens-theming`, `design-system`, `advanced-css-architecture`, `css-modules-vs-css-in-js-vs-tailwind`

**Deep dive:** https://fearchitect.com/topics/atomic-utility-first-css

---

## CSS Modules vs CSS-in-JS vs Tailwind

**One-liner:** CSS Modules, runtime vs zero-runtime CSS-in-JS, and utility-first, by runtime cost and RSC fit.

**Key tradeoffs:**
- **Pros:** CSS Modules, zero-runtime CSS-in-JS (vanilla-extract, StyleX, Linaria), and Tailwind all compile to static CSS with no runtime JS cost and are RSC-compatible; zero-runtime is type-safe and colocated; runtime CSS-in-JS (styled-components, Emotion) gives props-driven variants and full TS colocation
- **Cons:** Runtime CSS-in-JS has high cost (style insertion per render) and is not RSC-compatible; CSS Modules give scoped classes but no colocated variants; zero-runtime can't use dynamic props at runtime; Tailwind produces verbose JSX

**When to use:** Greenfield RSC app: Tailwind (fast, zero overhead) or vanilla-extract (type-safe, colocated); legacy SPA on client-only React: runtime CSS-in-JS is fine; design-system package shared across RSC and non-RSC consumers: zero-runtime (vanilla-extract or StyleX); thin component library with no styling opinions: CSS Modules
**When to avoid:** Avoid runtime CSS-in-JS (styled-components, Emotion) in React Server Components. They insert styles via `document.createElement('style')` at render time and throw where there is no DOM

**Key terms:** **Runtime CSS-in-JS**: Styles generated and injected into the DOM by JavaScript executing in the browser. **Zero-runtime CSS-in-JS**: CSS-in-JS tooling (vanilla-extract, StyleX, Linaria) that compiles styles to static files at build time. **CSS Modules**: Locally-scoped CSS via build-time class-name hashing; no JS at runtime. **Utility-first CSS**: Tailwind's approach: a fixed set of single-purpose classes; unused ones are purged at build. **JIT (Tailwind)**: Just-in-time compiler that scans source files and emits only the utility classes actually used.

**Pitfalls:**
- styled-components and Emotion inject styles via `document.createElement('style')` at render time. That throws in React Server Components, which run server-side with no DOM.
- Wrapping every styled component in `'use client'` works but defeats RSC's bundle-splitting goal.
- vanilla-extract is RSC-compatible but cannot use dynamic runtime props (no `color={primary}` at render); styled-components supports per-render props at the cost of client JS overhead.
- Migrating a Pages Router app on Emotion to the App Router means replacing each styled component with a zero-runtime/Modules alternative or wrapping it in `'use client'`, forfeiting RSC's server-rendering and bundle benefits.

**Interview angle:** "Runtime CSS-in-JS writes styles via JavaScript. That's incompatible with a server that has no DOM."

**Related:** `design-system`, `design-tokens-theming`, `atomic-utility-first-css`, `advanced-css-architecture`, `render-performance-patterns`, `bundle-architecture-code-splitting`

**Deep dive:** https://fearchitect.com/topics/css-modules-vs-css-in-js-vs-tailwind

---

## Design Systems

**One-liner:** A shared product (tokens, components, docs, and governance) at scale.

**Key tradeoffs:**
- **Pros:** Consistent UI across products without per-team CSS drift; accessibility handled once in the library instead of per component per team; tokens let a single theming change propagate everywhere instantly; frees product teams from low-level UI work once adoption is high; shared vocabulary speeds design-to-engineering handoff
- **Cons:** Requires 2-4 dedicated engineers: an unmaintained system is worse than none; breaking changes need codemods and deprecation cycles, so releasing slows down; product teams must wait for support or fork; adoption is voluntary until mandated (long tail of inconsistent usage); wrong abstractions calcify fast and early API mistakes compound migration work

**When to use:** Ship it as a versioned npm package (e.g. `@acme/ui`) with semver and a changelog: "without semver and a changelog, it is not a design system; it is a shared folder"; have tokens, an accessible component library, a docs site, and a governance/contribution model in place
**When to avoid:** Don't build one if you can't name an owner, publish a roadmap, and commit to a contribution SLA: an unmaintained library fragments within six months; adopting Radix UI or shadcn/ui with custom tokens is a valid alternative for smaller orgs

**Key terms:** **Design tokens**: Named, platform-agnostic values (color, spacing, type) stored as JSON and compiled to CSS custom properties or platform constants. **Semver**: Semantic versioning (patch.minor.major). Major bumps signal breaking API changes that require a migration. **Codemod**: An automated script (jscodeshift, ts-morph) that rewrites source code to migrate a breaking API change. **Contribution model**: The RFC and review process defining who can add or change components and under what conditions. **Adoption rate**: Percentage of product surfaces using the system's components; tracked to justify maintenance cost and deprecate forks.

**Pitfalls:**
- The maintenance trap: teams build a library, then dissolve the working group. Within six months product teams fork components and the system fragments. It needs a named owner, public roadmap, and contribution SLA, or it should not be built.
- An unmaintained custom system is worse than none. It fragments faster than a well-chosen open-source base (Radix/shadcn) with custom tokens.
- Track whether a deprecated API is fully removed with a custom ESLint rule or import analysis in CI; block the major deprecation until usage hits zero.
- Wrong abstractions calcify fast. Early API mistakes cost compounding migration work.

**Interview angle:** "A design system is a product with consumers; ship it like one: semver, changelogs, codemods for breaking changes."

**Related:** `design-tokens-theming`, `atomic-utility-first-css`, `component-architecture`, `monorepos`

**Deep dive:** https://fearchitect.com/topics/design-system

---

## Design Tokens & Theming

**One-liner:** Named design decisions that flow from source to every platform.

**Key tradeoffs:**
- **Pros:** The three-tier model (primitive → semantic → component) means a theme swap only touches the semantic layer, not every component; runtime CSS custom properties switch themes instantly with zero JS rerenders or class churn; a single token JSON source compiles via Style Dictionary to CSS, Swift, Android XML, and more
- **Cons:** Build-time theming requires a page reload or stylesheet swap to switch themes; JS-in-CSS / CSS-in-JS theming re-runs style computation per render (~20 ms overhead at scale); a JS-set theme risks a flash of the default theme before the active one applies

**When to use:** Runtime CSS custom properties when you need instant theme switching plus user preference + OS sync (toggle `data-theme` on `<html>`); build-time theming when themes are fixed at deploy (e.g. white-label SaaS with per-tenant builds) and you want zero runtime overhead: ship only the active theme's CSS file
**When to avoid:** Don't set the active theme by JS after HTML parse without a guard. Users see a flash of the default theme before the active one applies

**Key terms:** **Design token**: A named design decision (color, spacing, radius) stored as a platform-agnostic value and transformed to target outputs. **Primitive token**: A raw value with no semantic meaning, e.g. `--color-blue-500: #3b82f6`. **Semantic token**: A token expressing intent by referencing a primitive, e.g. `--color-action-primary`. **Style Dictionary**: Amazon's open-source build tool that transforms a token JSON source into CSS, Swift, Android XML, and other platform outputs. **CSS custom property**: A variable declared with `--name: value` and read with `var(--name)`; reassignable at any scope for runtime theming.

**Pitfalls:**
- Flash of unstyled theme (FOUT): when JS sets the theme after HTML parse, users see the default theme flash. Inline a `<script>` that reads `localStorage` and sets `data-theme` before first paint, or default to `prefers-color-scheme` and only override on explicit choice.
- JS-in-CSS / CSS-in-JS theming re-runs style computation per render (~20 ms overhead at scale).
- Components should reference only semantic (or component) tokens, never primitives directly. The indirection is what makes a theme swap touch only the semantic layer.

**Interview angle:** "Semantic tokens decouple intent from value. Change the theme file, not every component."

**Related:** `design-system`, `atomic-utility-first-css`, `advanced-css-architecture`, `css-modules-vs-css-in-js-vs-tailwind`

**Deep dive:** https://fearchitect.com/topics/design-tokens-theming

---

## View Transitions & Scroll Animations

**One-liner:** CSS-native page transitions and scroll-driven animations without JavaScript.

**Key tradeoffs:**
- **Pros:** Cross-document (MPA) transitions need only `@view-transition { navigation: auto; }`, no JS at all; scroll-driven animations bind `animation-timeline` to scroll/element position and run on the compositor with no JS and no `IntersectionObserver`; view-transition crossfades run on the compositor with no JS animation loop
- **Cons:** Cross-document transitions work in Chromium + Safari (Firefox not yet); scroll-driven animations ship in Chromium and recent Safari but are behind a flag in Firefox, so treat as progressive enhancement; same-document transitions still need JS to wrap the DOM mutation

**When to use:** Same-document `document.startViewTransition()` for SPA route changes, modals, and in-page updates; cross-document `@view-transition { navigation: auto; }` for full page navigations between URLs on an MPA; `animation-timeline: view()` for scroll reveal effects, `scroll()` to tie an animation to a container's total scroll progress
**When to avoid:** Don't rely on view transitions without unique `view-transition-name` values (duplicates silently skip the morph) or without a `prefers-reduced-motion` guard (the browser does not suppress them automatically); treat cross-document and scroll-driven features as progressive enhancement until Baseline/caniuse confirms support

**Key terms:** **view-transition-name**: CSS property that opts an element into a named transition layer, pairing old and new states for morphing. **::view-transition-old / ::view-transition-new**: Pseudo-elements holding the captured screenshot of the outgoing and incoming state during a transition. **animation-timeline: scroll()**: Links an animation's progress to a scroll container's scroll position; no JS required. **animation-timeline: view()**: Links animation progress to how much of an element is visible inside a scroll container. **@view-transition**: CSS at-rule that enables cross-document (MPA) view transitions without any JavaScript.

**Pitfalls:**
- Every `view-transition-name` on the page must be unique at the moment the transition fires; duplicates can't form an unambiguous old/new pair, so the browser silently drops the morph.
- The browser does not suppress these animations for reduced motion automatically. Inside `@media (prefers-reduced-motion: reduce)` set `animation: none` on `::view-transition-old(*)` and `::view-transition-new(*)`, and reset scroll-driven animations to their end state.
- Cross-document transitions and scroll-driven animations are newer (Firefox lags). Check Baseline/caniuse and treat them as progressive enhancement before relying on them.

**Interview angle:** "`startViewTransition` snapshots the old and new state; the browser runs the crossfade on the compositor, zero JS animation loop needed."

**Related:** `advanced-css-architecture`, `render-performance-patterns`, `paint-composite-optimization`

**Deep dive:** https://fearchitect.com/topics/view-transitions-scroll-animations
