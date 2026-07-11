# AI-Assisted Frontend Engineering

> MCP, design-to-code, and AI-friendly architecture. Reference material for the fe-architect skill. Load when a question touches AI-assisted workflows, MCP tool UIs, design-to-code, or framework MCP servers.

## AI-Assisted Dev Workflow

**One-liner:** Using AI coding agents well without handing them ownership.

**Key tradeoffs:**
- **Pros:** Boilerplate and test generation in seconds, not minutes; faster onboarding to unfamiliar APIs when the agent reads the docs; refactors across many files without manual search-and-replace; frees senior time for architecture, review, and decision-making
- **Cons:** Agent output is plausible, not correct, so review burden shifts, not disappears; agents ignore implicit conventions unless you encode them explicitly; long agentic runs can introduce subtle cross-file inconsistencies; over-relying on agents erodes the team's own understanding of the codebase; security-sensitive diffs (auth, sanitization) carry extra review risk

**When to use:** bounded, well-defined work: boilerplate, test scaffolding, known-pattern refactors, docs generation; one file or one function per agentic run so diffs stay reviewable; after feeding context via a conventions file (CLAUDE.md), TypeScript interfaces/Zod schemas, and tests as a spec
**When to avoid:** cross-cutting concerns: auth flows, perf-sensitive hot paths, API contract changes; anything where "correct" isn't visible in the local file; large multi-file runs that produce diffs too big to review carefully

**Key terms:** **Agentic run**: a multi-step AI session that reads files, makes edits, and executes commands autonomously until the task completes or errors. **CLAUDE.md**: a repo-level conventions file Claude Code reads as persistent context (stack, patterns, banned APIs). **Diff review**: reading every line of AI-generated changes before committing; the primary human quality gate. **Context window**: the maximum tokens the model can read in one session; limits how much repo code an agent sees.

**Pitfalls:**
- The engineer who commits AI code owns correctness. The agent produces plausible output, and reading/understanding every diff is the non-negotiable human gate.
- CI is not a substitute for reading the diff; it catches what your tests cover, not what they don't.
- Never approve a diff you don't understand because the agent said it was correct.
- Treat any change touching auth, CSP headers, or data mutations as high-risk regardless of how clean it looks.
- Long agentic runs compound errors. Review incremental diffs, not just the final state.

**Interview angle:** "AI handles the mechanical work; I own the spec, the context, and every diff that ships."

**Related:** `design-to-code-mcp`, `mcp-tool-uis`, `frontend-testing`, `ci-cd-frontend`

**Deep dive:** https://fearchitect.com/topics/ai-assisted-dev-workflow

---

## Design-to-Code with MCP

**One-liner:** Feed real design tokens to an AI agent via MCP.

**Key tradeoffs:**
- **Pros:** Emits token-aware code that references `spacing-4`, not a hard-coded `16px`; cuts design-code drift by reading the design system's real variable names; faster handoff than reading a spec or measuring a screenshot by eye
- **Cons:** Requires a Figma MCP server and a file-read access token to set up; doesn't handle responsive breakpoints, motion, or accessibility roles; output is a first draft that still needs review before it ships; quality tracks the design file, so unnamed layers and detached styles produce weak output

**When to use:** implementing a selected Figma frame or component; when you want generated code to reference your existing design system tokens (e.g. `color-surface-primary`, `spacing-4`) instead of computed px values; to speed handoff over measuring a screenshot by eye
**When to avoid:** when you need responsive breakpoints, motion, empty states, or accessibility roles handled, because these are outside what the design context provides; when the design file has unnamed layers and detached styles (output degrades); treating output as a shipped component rather than a first draft

**Key terms:** **MCP (Model Context Protocol)**: open standard by Anthropic (Nov 2024) for connecting AI agents to external tools and data over JSON-RPC 2.0. **MCP server**: a process that exposes tools, resources, or prompts to an AI client via the MCP protocol. **Design variables / tokens**: named values (color, spacing, type) stored in Figma's variable collections, resolved by the MCP server. **Code Connect**: Figma's feature that links design components to real framework components, surfaced via Dev Mode and MCP. **stdio transport**: MCP transport using standard input/output; the default for local servers with no network overhead.

**Pitfalls:**
- Always review the output. MCP improves the starting context but doesn't handle responsive logic, motion, empty states, or accessibility; treat it as a first draft, not a shipped component.
- MCP narrows the gap (token names, not screenshots) but is not pixel-perfect and not automatic.
- Output quality tracks the design file: unnamed layers and detached styles produce weak output.
- Setup requires a Figma MCP server plus a file-read access token. It's not zero-config.

**Interview angle:** "MCP gives the agent token names, not pixels. Better input, better output, still needs review."

**Related:** `mcp-tool-uis`, `ai-assisted-dev-workflow`, `design-tokens-theming`, `design-system`

**Deep dive:** https://fearchitect.com/topics/design-to-code-mcp

---

## Framework MCP Servers (Live Docs for AI Agents)

**One-liner:** Stop agents from hallucinating APIs by feeding them the framework's current types and conventions.

**Key tradeoffs:** (no tradeoffs block in source; derived from keyPoints, the decision callout, and the pitfall flashcard)
- **Pros:** Agent reads the current API reference as a resource, not its training-time snapshot; version-aware: the server knows the installed version and filters docs accordingly; codemods exposed as tools migrate code instead of the agent guessing new syntax; compiler/type-checker output as a resource or tool result gives real error messages instead of hallucinated ones
- **Cons:** No vendor servers yet for most frameworks, so you ship a project-specific server yourself (achievable in under 100 lines); exposing too many resources fills the agent's context window and crowds out what it needs; the server must track the installed version, so it has to stay in sync with the toolchain

**When to use:** when agents keep citing stale or changed APIs because of the model's training cutoff; ship a project-specific server today scoped to your actual problem (e.g. if agents misuse your internal design-system API, expose that API's types as a resource); use stdio transport for a local co-located server, Streamable HTTP for a remote server serving many clients
**When to avoid:** (no warning callout; derived from the decision callout + pitfall) don't build a broad aspirational catalogue, since one accurate resource beats ten aspirational ones; avoid exposing many marginally relevant resources that bloat the context window

**Key terms:** **MCP**: Model Context Protocol, an open JSON-RPC 2.0 standard for connecting AI agents to external data and tools. **resource**: an MCP primitive exposing read-only data (docs, config, file contents) that an agent can pull on demand. **tool**: an MCP primitive exposing a callable function (codemod, compiler run, API call) the agent can invoke. **stdio transport**: MCP transport using stdin/stdout to communicate with a co-located server process; zero network overhead. **knowledge cutoff**: the date after which an LLM has no training data; APIs released after this date are unknown to the model.

**Pitfalls:**
- Exposing too many resources fills the agent's context window with marginally relevant content and crowds out the specific information it needs. Expose only what the agent actually uses.
- Relying on the model's memory for framework APIs: training has a cutoff, so any API added/changed/removed after it is unknown and the model guesses from older patterns.
- Asking the agent to rewrite syntax from memory instead of running a codemod tool.
- Building a broad aspirational catalogue rather than one accurate, scoped resource ("don't boil the ocean").

**Interview angle:** "An LLM's knowledge is frozen at training time; an MCP server is how you inject the current truth at inference time."

**Related:** `mcp-tool-uis`, `ai-assisted-dev-workflow`, `design-to-code-mcp`

**Deep dive:** https://fearchitect.com/topics/framework-mcp-servers

---

## AI Chat UIs & MCP Tools

**One-liner:** Render tool calls, stream results, and gate risky actions behind human consent.

**Key tradeoffs:**
- **Pros:** One protocol to integrate any compliant tool server, not a bespoke client per API; vendor-neutral: swap or add servers without rewriting the chat UI; composable: a host can run many servers and expose their tools together; explicit consent model puts the user in control of what the model executes
- **Cons:** Protocol overhead is overkill for a single hard-coded integration; rendering diverse tool results (text, images, tables) adds real UI complexity; error handling spans server boundaries, so failures can surface far from their cause; young ecosystem: servers, auth patterns, and UI conventions are still settling

**When to use:** building an AI chat UI that calls external tools and you want one protocol across any compliant server; when you need vendor-neutral, swappable tool servers without rewriting the UI; when a host must run many servers and expose their tools together (one MCP client per server)
**When to avoid:** a single hard-coded integration where the protocol overhead isn't worth it

**Key terms:** **MCP host**: the AI application that owns the conversation and manages one or more MCP client connections. **MCP client**: a connector inside the host that holds one persistent JSON-RPC session to one MCP server. **MCP server**: a process that exposes tools, resources, and prompts to any compliant MCP client. **Tool (MCP)**: a named callable function on an MCP server; the model can invoke it with JSON arguments. **Resource (MCP)**: read-only data exposed by an MCP server (file, DB row, API response) the model can reference.

**Pitfalls:**
- Silent tool calls erode trust. Render a pending tool-call card (name + arguments) before the result arrives so the action is visible and the user can intervene.
- Never auto-approve tool calls that write, delete, or send on the user's behalf; present the tool name, server origin, and arguments in a confirmation dialog first.
- Read-only tools (resources, search) can run silently, but mutations need explicit approval. This is a UX contract, not just a policy.
- Show which MCP server and tool name fired; users need provenance to trust AI actions.
- Handle tool errors gracefully. Failures can surface far from their cause across server boundaries.

**Interview angle:** "The UI's job is to make tool calls legible and keep the user in control of what the model actually does."

**Related:** `design-to-code-mcp`, `framework-mcp-servers`, `ai-assisted-dev-workflow`

**Deep dive:** https://fearchitect.com/topics/mcp-tool-uis
