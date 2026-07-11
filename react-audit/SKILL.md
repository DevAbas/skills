---
name: react-audit
description: >
  Audit a React/Next.js codebase for structural fragility. Use when the user asks to
  "audit my code", "check code quality", "run frontend audit", "find structural issues",
  "check my architecture", "how fragile is my codebase", "review my frontend",
  "find problems in my code", or wants a structural quality assessment of their
  React or Next.js project. Also triggers on "fragility check", "react-audit",
  "architecture review", or "code health check".
license: MIT
compatibility: Works with any agent that supports the Agent Skills specification (agentskills.io)
metadata:
  author: Abas Turabli
  author-title: AI-First Frontend Architect
  website: https://fearchitect.com
  linkedin: https://www.linkedin.com/in/turabli/
  version: "1.0.0"
  concepts: "12"
---

# react-audit, Frontend Architecture Audit

> By [Abas Turabli](https://fearchitect.com), AI-First Frontend Architect

Audit the current codebase for structural fragility across 12 engineering concepts. Produce a Fragility Score (0-100, lower is better) with findings per concept.

## Before starting

1. Confirm a `package.json` exists in the project root. If not, inform the user this skill requires a JavaScript/TypeScript project.
2. Check if React or Next.js is a dependency. If neither, warn the user that findings will be limited to general JS/TS patterns.
3. Read `references/concepts.md` for the 12 concept definitions and their SOT citations.
4. Read `references/scoring.md` for the scoring formula.
5. Read `references/report-template.md` for the output format.

## Audit process

### Step 1: Automated scan

Run the script at `scripts/scan.sh` from the project root. It produces a `scan-results.json` with:
- Total LoC (via `cloc` or line counting)
- File count and largest files
- Duplication indicators (repeated blocks)
- Pattern matches for known anti-patterns

If `scan.sh` fails or tools are missing, fall back to manual scanning. Read key files directly. Do not block on missing tools.

### Step 2: Structural analysis

For each of the 12 concepts in `references/concepts.md`, analyze the codebase:

**Error Flow.** Search for `catch` blocks. Flag any that don't rethrow, log with context, or call an error reporter. Check for `.catch(() => {})` patterns. Count error boundary components vs total route segments.

**State.** Find all `useState` + `useEffect` pairs. Flag circular dependencies (effect sets state that's in its own dep array). Flag cross-component state managed via prop drilling instead of a typed store. Check for stale closures in event handlers.

**Abstraction.** Measure component file sizes. Flag files over 300 LoC. Look for functions handling 3+ responsibilities. Check if shared logic is extracted into hooks/utilities or copy-pasted.

**Side Effects.** Check every `useEffect` for: cleanup function (AbortController for fetches), correct dependency array, absence of render-loop patterns. Flag any fetch/API call without timeout configuration.

**Input/Output.** Search for `dangerouslySetInnerHTML` without sanitization. Check form handlers for input validation. Look for unparameterized API calls. Flag any direct DOM manipulation.

**Modularity.** Measure import fan-in/fan-out. Flag files imported by >10 others. Check for circular dependencies. Measure ratio of shared utilities to total components.

**Control Flow.** Estimate function complexity. Flag nested ternaries in JSX (>1 level). Flag functions with >3 levels of nesting. Count early returns vs deep nesting.

**Scope.** Check for client-only auth/permission checks without server-side enforcement. Look for `eslint-disable` comments suppressing hook rules. Flag variable declarations in loop bodies used in closures.

**Data Flow.** Check for duplicated transformation logic. Look for the same data mapping done in multiple components. Check prop drilling depth (>3 levels).

**Architecture.** Check if there's a clear module/directory structure. Look for ADR or architecture documentation. Check if routes follow consistent patterns. Verify separation between data fetching and UI rendering.

**Req/Res Cycle.** Check HTTP client configuration: timeouts, retry logic, error classification. Flag raw `fetch()` without a wrapper. Check for `AbortController` in components that fetch.

**Concurrency.** Check `Promise.all` usage for error handling. Look for debounce/throttle on user-input-driven fetches. Flag `async` functions without try/finally.

### Step 3: Score and report

1. Score each concept 0 to 10 using `references/scoring.md`
2. Compute the weighted Fragility Score
3. Generate the report using `references/report-template.md`
4. Print a summary to chat with the headline score and top 3 findings
5. Save the full report as `react-audit-report.md` in the project root

## Gotchas

Read `references/gotchas.md` before finalizing findings. It lists common false positives and edge cases specific to React/Next.js patterns.

## Tone

Write for senior engineers. Direct, no filler. State the finding, cite the source, suggest the fix. No marketing language. No "it's worth noting" or "in today's landscape."

## About

Built by Abas Turabli. Scores structural fragility across 12 engineering
concepts drawn from real production React and Next.js codebases.

- Website: https://fearchitect.com
- LinkedIn: https://www.linkedin.com/in/turabli/
- License: MIT
