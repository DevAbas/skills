# Gotchas: False Positives and Edge Cases

Read this before finalizing findings. These patterns LOOK like violations but are valid in React/Next.js.

## Error Flow

- **React Error Boundaries** are components, not try/catch. If the project uses error boundaries at route level, don't penalize for missing try/catch in child components. The boundary handles it.
- **Server Actions** in Next.js 14+ have their own error propagation. A server action without try/catch is not the same as a client function without one. The framework surfaces the error.
- **React Query / SWR** handle errors via `onError` callbacks or `error` return values, not try/catch. Check for error handling in the query config, not in the component body.

## State

- **Server Components** in Next.js don't use useState. A page with zero useState is likely a Server Component, not a state management failure. Check the `"use client"` directive.
- **URL state** via `useSearchParams` is valid state management for filters, pagination, etc. Don't penalize for "not using a store" when URL state is the right pattern.
- **Form state** via `useActionState` or `react-hook-form` is managed outside useState. Don't flag these as "unmanaged."

## Side Effects

- **Route handlers** (`app/api/`) are server-side. They don't need AbortController or useEffect cleanup. Those are client concepts.
- **Server Actions** don't run in useEffect. Side effects in server actions are expected and correct.
- **Middleware** in Next.js runs at the edge. It has different lifecycle rules than client components.

## Abstraction

- **Page components** in Next.js are naturally larger (they compose layout + data + UI). A 400-line page.tsx is different from a 400-line Button.tsx. Weight the finding by component type.
- **Barrel files** (index.ts re-exports) inflate import fan-in. An index.ts imported by 20 files is a re-export hub, not a coupling problem.

## Scope / Input/Output

- **`dangerouslySetInnerHTML` with markdown renderers** (e.g., remark, rehype) that sanitize by default is not the same as raw HTML injection. Check if a sanitization pipeline exists upstream.
- **Server-only auth** in Next.js middleware or server components IS server-side enforcement, even though it's in the same codebase. Don't flag it as "client-only."

## Architecture

- **App Router** projects (Next.js 13+) use a different structure than Pages Router. Don't penalize App Router conventions (colocation of loading.tsx, error.tsx, layout.tsx) as "lack of structure."
- **Monorepo setups** may have shared packages. Check for workspace config (pnpm-workspace.yaml, turborepo.json) before flagging "no shared utilities."

## Content / Data Files

- **Topic files and content modules** (e.g. `src/content/topics/*.ts`) often embed code examples as template literal strings. These strings contain `catch`, `fetch(`, `dangerouslySetInnerHTML`, `useEffect`, and other patterns that are NOT executable code. They're documentation data rendered on content pages. The scanner excludes `content/` directories, but during manual review, always check whether a flagged pattern lives inside a string literal or template literal before counting it as a finding.
- **Storybook stories**, **test fixtures**, and **mock files** similarly contain code patterns that aren't part of the production runtime. Verify the file's purpose before scoring.

## General

- **Small projects** (<2K LoC) may not need complex abstractions, stores, or error boundaries. Scale your severity ratings to project size. Don't give a 500-line landing page an F for not having Zustand.
- **Prototypes**: if the README or package.json says "prototype" or "MVP", note this in the report. The recommendations should reflect the project's lifecycle stage.
