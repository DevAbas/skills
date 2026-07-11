# The 12 Structural Concepts

Each concept includes: a senior-level definition, the documented AI-code violation pattern, the production failure it causes (with source), and what to check.

Every empirical claim links to its source. When the source is a vendor report, the vendor bias is noted.

---

## 1. Control Flow

**Definition:** The set of execution paths through a unit (branches, loops, early returns) and their interaction with readability and testability.

**AI Violation Pattern:** AI generates deeply nested conditionals instead of early returns or guard clauses. Conditions chain 4 to 6 boolean expressions with hard-coded field names.

**Production Failure:** Kashif et al. (2026) analyzed 10 Cursor-generated projects and found 112 Complex Conditional issues, 70.5% in frontend code. A single handler had cyclomatic complexity of 36 with nine if-else branches. Methods like this require dozens of test cases for adequate coverage.

**Source:** [Kashif et al., "Beyond Functional Correctness: Design Issues in AI IDE-Generated Large-Scale Projects," arXiv:2604.06373](https://arxiv.org/abs/2604.06373). Academic, low bias.

**What to check:** Nesting depth >3, nested ternaries in JSX, cyclomatic complexity >10 per function.

---

## 2. Data Flow

**Definition:** How values propagate through a system: transformations, derivations, and the contracts between producer and consumer at each boundary.

**AI Violation Pattern:** AI duplicates transformation logic instead of extracting shared helpers. The same mapping function appears in multiple components with minor differences.

**Production Failure:** GitClear's 2026 analysis of 623M code changes: block duplication up 81% since 2023 (40.3 to 73.0 per million changed lines). Copy/paste code climbed from 9.4% to 15.7% of changed lines. Kashif et al. found one service with 150 duplicated LoC across six methods. A bug fix required changes in three locations.

**Source:** [GitClear, "The Maintainability Gap: 2026 AI Code Quality Research"](https://www.gitclear.com/the_ai_code_quality_maintainability_gap). Vendor (sells code analytics), but longitudinal dataset (2021-2026) is uniquely valuable. [Kashif et al., arXiv:2604.06373](https://arxiv.org/abs/2604.06373). Academic.

**What to check:** Repeated code blocks (>5 lines identical), same data transformation in multiple files, ratio of moved-code to total changes.

---

## 3. Error Flow

**Definition:** The explicit propagation of failure signals through a system: how errors are raised, typed, caught, and surfaced to the appropriate handler.

**AI Violation Pattern:** AI either omits error handling or generates catch blocks that swallow exceptions silently. CodeRabbit's Dec 2025 analysis: error handling gaps nearly 2× more common in AI PRs vs human-written. GitClear found 47% more error masking in 2026.

**Production Failure:** Lightrun's 2026 report: 43% of AI-generated code changes require manual debugging in production even after passing QA. Silent catch blocks mask root cause, escalating from "weird behavior" to outage.

**Source:** [CodeRabbit, "2025 was the year of AI speed. 2026 will be the year of AI quality"](https://www.coderabbit.ai/blog/2025-was-the-year-of-ai-speed-2026-will-be-the-year-of-ai-quality). Vendor (sells AI code review). [Lightrun 2026 via VentureBeat](https://venturebeat.com/technology/43-of-ai-generated-code-changes-need-debugging-in-production-survey-finds/). Vendor (sells production debugging). [GitClear](https://www.gitclear.com/the_ai_code_quality_maintainability_gap). Vendor.

**What to check:** Catch blocks without rethrow/log/report, `.catch(() => {})`, error boundary count vs route count, generic error messages without context.

---

## 4. Scope

**Definition:** The lexical and runtime boundaries that determine variable visibility, lifetime, and capture: closures, modules, block scope.

**AI Violation Pattern:** AI generates components with stale closures in React hooks, captures loop variables incorrectly, and creates auth guards client-side without server-side enforcement.

**Production Failure:** Georgia Tech (April 2026): 86% of AI-generated samples failed to defend against XSS, a scope/boundary problem. CSA tracked 35 new CVEs in March 2026 directly traceable to AI code, many from scope confusion (client-only auth).

**Source:** [Georgia Tech, "Bad Vibes: AI-Generated Code is Vulnerable"](https://news.research.gatech.edu/2026/04/13/bad-vibes-ai-generated-code-vulnerable-researchers-warn). Academic, low bias. [CSA Research Note](https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-generated-code-vulnerability-surge-2026/). Non-profit, low bias.

**What to check:** Client-only auth checks (role/permission in JSX without server enforcement), eslint-disable for exhaustive-deps, variables declared in loop bodies used in async callbacks.

---

## 5. Input/Output

**Definition:** The contract between a system boundary and the outside world: validation, sanitization, encoding, and the assumption that all external input is hostile.

**AI Violation Pattern:** AI omits input sanitization by default. Veracode: 45% of AI-generated code introduces OWASP Top 10 vulnerabilities. XSS has 86% failure rate in AI code benchmarks.

**Production Failure:** Apiiro (June 2025): AI-generated code adding >10,000 new security findings per month, a 10× jump from December 2024. CVSS 7.0+ vulnerabilities 2.5× more frequent in AI code. As of March 2026, 74 CVEs traceable to AI coding tools.

**Source:** [SQ Magazine, "AI Coding Security Vulnerability Statistics 2026"](https://sqmagazine.co.uk/ai-coding-security-vulnerability-statistics/). Aggregator, low bias. [Cycode, "Top AI Security Vulnerabilities 2026"](https://cycode.com/blog/ai-security-vulnerabilities/). Vendor (sells code security).

**What to check:** `dangerouslySetInnerHTML` without DOMPurify, unparameterized SQL/API calls, missing input validation on forms, unescaped template interpolation.

---

## 6. State

**Definition:** The mutable data that persists across time and interactions (component state, shared stores, server cache) and the invariants that must hold when it changes.

**AI Violation Pattern:** AI misunderstands useEffect dependency arrays, creating render loops where state updates trigger effects that update state. Search bars that fire API calls on every keystroke.

**Production Failure:** Faros AI Engineering Report 2026 (22,000 developers, telemetry-based): production incidents per PR tripled at high AI adoption. Code churn grew 10× (lines rewritten shortly after commit). This is the state-management tax: code ships, state bugs surface in production, gets rewritten.

**Source:** [Faros AI Engineering Report 2026](https://www.faros.ai/blog/ai-acceleration-whiplash-takeaways). Vendor (sells engineering intelligence), but telemetry-based (22K devs, 4K teams) not survey.

**What to check:** useState + useEffect circular dependencies, cross-component state via prop drilling (>3 levels), missing debounce on input-driven fetches, stale closures in event handlers.

---

## 7. Abstraction

**Definition:** The act of hiding implementation details behind a stable interface: what to expose vs encapsulate, and at what granularity.

**AI Violation Pattern:** AI doesn't abstract. It generates methods handling multiple responsibilities. Kashif et al.: 171 Large Method issues, mean 171 LoC, 73.7% in frontend. LLMs emit "similar-but-slightly-different code blocks instead of extracting helper functions."

**Production Failure:** GitClear: legacy refactoring fell 74% since 2023. "Moved code" (proxy for extraction) dropped from 21% in 2022 to 3.8% in H1 2026. Abstraction layers never form; maintenance cost compounds quarterly.

**Source:** [Kashif et al., arXiv:2604.06373](https://arxiv.org/abs/2604.06373). Academic. [GitClear](https://www.gitclear.com/the_ai_code_quality_maintainability_gap). Vendor. [LeadDev](https://leaddev.com/technical-direction/how-ai-generated-code-accelerates-technical-debt). Editorial, low bias.

**What to check:** Component files >300 LoC, functions handling >3 responsibilities, repeated logic not extracted to hooks/utils, moved-code % below 15%.

---

## 8. Modularity

**Definition:** The decomposition of a system into independent, replaceable units with explicit interfaces, where changing one module doesn't require changing others.

**AI Violation Pattern:** AI generates tightly coupled monolithic files. Kashif et al. found a PdfController.js at 1,693 LoC violating Separation of Concerns. He et al.: ~41% increase in code complexity and 30% more static analysis warnings after Cursor adoption across 806 repos.

**Production Failure:** Faros 2026: 31.3% more PRs merged without review. When modules are tightly coupled and unreviewed code ships faster, changes cascade. The "Inverse Volume Quality Law": autonomous agents accumulate debt at rates exceeding human developers.

**Source:** [Kashif et al., arXiv:2604.06373](https://arxiv.org/abs/2604.06373). Academic. [He et al., arXiv:2603.28592](https://arxiv.org/abs/2603.28592). Academic. [Faros](https://www.faros.ai/blog/ai-acceleration-whiplash-takeaways). Vendor.

**What to check:** Files >500 LoC, import fan-in >10 (used by too many), circular dependencies, controller/component files doing data fetching + rendering + business logic.

---

## 9. Architecture

**Definition:** The high-level structure of a system (component boundaries, communication protocols, deployment topology) and the constraints that make it evolvable.

**AI Violation Pattern:** AI has no architectural memory across prompts. Each prompt gets an isolated, locally-correct solution. Kashif et al.: 4,498 total design issues (CodeScene + SonarQube) despite 91% functional correctness. "91% correct, structurally broken" is the AI architecture pattern.

**Production Failure:** Uplevel study (~800 devs): Copilot speed gains neutralized by 41% increase in bug rates. Stack Overflow 2025 survey (n=49,000+): 66% of developers spend more time fixing "almost-right" AI code.

**Source:** [Kashif et al., arXiv:2604.06373](https://arxiv.org/abs/2604.06373). Academic. [Keyhole Software, "Vibe Coding Trends 2026"](https://keyholesoftware.com/vibe-coding-trends-2026/). Consultancy, moderate bias. [LeadDev](https://leaddev.com/ai/code-maintainability-plummets-in-the-ai-coding-era). Editorial.

**What to check:** Presence of ADR or ARCHITECTURE.md, consistent directory structure, separation of data fetching from UI, route organization patterns, consistent naming conventions.

---

## 10. Side Effects / Pure Functions

**Definition:** The distinction between computations that return values (pure) and those that interact with the outside world (effects), and pushing effects to the boundary.

**AI Violation Pattern:** AI scatters effects throughout business logic. useEffect with wrong dependencies causes API calls on every render. 76% of AI PRs lacked timeouts on external calls. AI replaces batch operations with per-record calls.

**Production Failure:** Without idempotency keys, retry logic turns one "create order" into three orders. AI agents "retry aggressively, parse errors literally, chain calls without confirmation."

**Source:** [CodeRCops, "7 AI Coding Mistakes Nobody Talks About (2026)"](https://blog.codercops.com/blog/ai-coding-mistakes-nobody-talks-about-2026). Independent blog, low bias. [Karishma Garg, "Common Problems in AI-Generated Frontend Code"](https://medium.com/@jainkarishma76/ai-generated-frontend-code-problems-4102c23602e9). Independent.

**What to check:** Side effects outside dedicated hooks/service layer, fetch without AbortController in useEffect, missing timeout on HTTP client, inline API calls in render logic.

---

## 11. Req/Res Cycle

**Definition:** The full lifecycle of a network request: initiation, headers, payload, timeout, retry, error classification, response parsing, cache invalidation.

**AI Violation Pattern:** AI generates fetch calls without timeouts, without abort controllers, without distinguishing 4xx from 5xx. Hallucinated API endpoints. 76% of AI PRs lacked timeouts.

**Production Failure:** Stack Overflow blog (Jan 2026) documents cache stampedes, connection pool exhaustion, retry storms from AI code. Faros: median review time increased 5×.

**Source:** [Stack Overflow Blog, "Are bugs and incidents inevitable with AI coding agents?"](https://stackoverflow.blog/2026/01/28/are-bugs-and-incidents-inevitable-with-ai-coding-agents/). Low bias. [Faros](https://www.faros.ai/blog/ai-acceleration-whiplash-takeaways). Vendor.

**What to check:** Raw `fetch()` without wrapper, missing AbortController in useEffect, no timeout configuration, no error classification (4xx vs 5xx), no retry strategy.

---

## 12. Concurrency

**Definition:** The coordination of multiple simultaneous operations (promises, workers, event-loop scheduling) and prevention of races, deadlocks, and lost updates.

**AI Violation Pattern:** AI generates async code that works in isolation but fails under concurrent execution. Promise.all without error boundaries, missing race-condition guards, no debouncing.

**Production Failure:** Faros 2026: bugs per developer increased 54%. Production patterns include race conditions, retry storms, connection pool exhaustion. Stack Overflow 2025 survey: 45% of developers say debugging AI code is more time-consuming.

**Source:** [Faros](https://www.faros.ai/blog/ai-acceleration-whiplash-takeaways). Vendor. [DEV.to, "7 Hidden Production Bugs AI Coding Agents Create"](https://dev.to/pockit_tools/7-hidden-production-bugs-ai-coding-agents-create). Community, low bias.

**What to check:** Promise.all without individual error handling, missing debounce/throttle on user input, async functions without try/finally, unhandled promise rejections.
