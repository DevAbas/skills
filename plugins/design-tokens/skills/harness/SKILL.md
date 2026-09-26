---
name: harness
description: >-
  Write and install the gates that keep a web project on its design tokens: token and rules checks,
  a staleness check for generated outputs, code lint rules, Claude Code hooks, a git pre-commit hook
  and a CI job, all driven by one design-tokens.gates.json. Existing tools first; custom checks only
  where no tool has the rule. Use when the user asks to "add design-token gates", "enforce the
  tokens", "set up the token lint", "install the hooks", or after /design-tokens:audit reports
  missing gates.
license: MIT
compatibility: Claude Code, as part of the design-tokens plugin. Node.js 20 or later.
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs *)
hooks:
  PreToolUse:
    - matcher: "Bash|Glob|Grep"
      hooks:
        - type: command
          command: node
          args: ["${CLAUDE_PLUGIN_ROOT}/scripts/search-scope.mjs"]
metadata:
  author: Abas Turabli
  author-title: AI-First Frontend Architect
  website: https://abasturabli.com
  linkedin: https://www.linkedin.com/in/turabli/
---

# design-tokens:harness, Design-Token Gates

> By [Abas Turabli](https://abasturabli.com), AI-First Frontend Architect

This skill installs the gates an audit recommends, or the ones the user asks for. A gate is a check that fails when a token rule breaks. The same gate runs in four places:
- after an agent's edit;
- before an agent's commit;
- before a person's commit;
- in CI.

A rule that nobody enforces is a rule that drifts (principles 8).

## Before starting

1. **Read the gates.** From the newest report in `design-tokens-audit/` (`${CLAUDE_PLUGIN_ROOT}/references/report.md`, Files), read `gates`. With no report, run the scan (`node ${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs .`) and derive the gates from the rubric's Gate lines.
2. **Read the references:**
   - `${CLAUDE_PLUGIN_ROOT}/references/principles.md` (8 and 9);
   - the profile the scan reports, for example `${CLAUDE_PLUGIN_ROOT}/references/profiles/terrazzo-tailwind-v4.md`.
3. **Read the project's rules and harness:**
   - its CLAUDE.md or AGENTS.md;
   - its `.claude/settings.json`;
   - its git hooks (`.githooks`, `.husky`, lefthook);
   - its CI workflows;
   - its lint config.

   New gates join what exists. They never replace it.

## Step 1: Choose the gates with the user

List each gate with:
- what it does;
- the rules it checks;
- the tool: `existing` or `custom`;
- where it runs;
- what it adds (files, scripts, dependencies).

Ask which to install. Existing tools come first (principles 9):
- the build tool's check and lint rules (for example `tz check`, `core/consistent-naming`, `core/descriptions`, `a11y/min-contrast`);
- the rules document's linter;
- the framework's lint ecosystem.

A custom check is written only for a rule no installed tool has.

Before configuring a tool, confirm its options in the documentation for the installed version (`${CLAUDE_PLUGIN_ROOT}/references/sources.md`).

## Step 2: One config

Write `design-tokens.gates.json` at the project root, starting from `${CLAUDE_PLUGIN_ROOT}/assets/harness/core/design-tokens.gates.json`. It is the one place the gates read from:
- `generated`: globs of the outputs an agent may never edit;
- `sources`: globs of the files whose edit runs `onSourceEdit` (tokens, rules document, build template and config);
- `onSourceEdit`: commands run after such an edit;
- `lint`: `files` and `command`, for the linter an edited file gets, and `strictEnv`, the variables that make its rules errors;
- `beforeCommit`: the commands every commit and CI run;
- `tokens` (profile checks): `resolver`, `modifier`, `palette`, `roles`, `typography`, `fonts`, `extensionKey`, `outDir`, `rulesDocument` and `readable`. Defaults are in `assets/harness/terrazzo-tailwind-v4/project-modules.mjs`.

Every path and command in it is the project's own. None is copied from the example.

## Step 3: Custom checks (profile)

For the Terrazzo + Tailwind v4 profile, the assets in `${CLAUDE_PLUGIN_ROOT}/assets/harness/terrazzo-tailwind-v4/` are the starting point:

| Asset | Rules |
|---|---|
| `check-tokens.mjs` | Palette literal, roles alias the palette or are derived, derived values match their rule, every context complete, text styles alias the fonts |
| `check-rules-contract.mjs` | The rules document's front matter holds no values, imports the resolver, and its contract names existing roles |
| `check-generated.mjs` | Generated outputs match a fresh build |
| `eslint-token-rules.mjs` | `token-classes` and `no-raw-color` |
| `project-modules.mjs` | What the checks share |
| `terrazzo.config.ts`, `theme.template.css` | The build, when the project has none |

Copy them to a folder the project chooses, for example `scripts/design-tokens/`, and adapt them:
- **Read the asset first**, and keep its comments, which say what each rule does and why.
- **Adapt only what the project needs:** names, paths, the class helpers the code uses, the utilities it has.
- **Write a unit test** for each pure function you change, in the project's test framework, with a negative case: the input the rule must reject.
- **Ask before dependencies.** A check needs the project's own packages (`@terrazzo/parser`, `yaml`, `lightningcss`). Ask before adding any.

Wire the checks into the project's scripts, for example a `tokens:check` script, and into `beforeCommit` and `onSourceEdit`. Add the ESLint rules to the project's flat config in two severities:
- `recommended` (warn) for a person;
- `strict` (error) when `DESIGN_LINT_STRICT=1` or `CI=true`.

For a stack without a profile, write the same rules for its tools. Follow the same order: existing rule first, custom rule as a plugin of an existing tool second, a standalone script last.

## Step 4: Hooks, pre-commit, CI (core)

From `${CLAUDE_PLUGIN_ROOT}/assets/harness/core/`:

1. **Hooks.** Copy `gates.mjs`, `protect-generated.mjs`, `check-on-edit.mjs`, `guard-commit.mjs`, `run-gates.mjs` and `with-node.sh` to `.claude/hooks/design-tokens/`. Make `with-node.sh` executable.
2. **Settings.** Merge `settings.hooks.json` into `.claude/settings.json`. Show the merged `hooks` object and wait for approval: settings change what runs on every edit.
3. **Pre-commit.** Add `pre-commit` to the project's git hooks. If a pre-commit hook exists, add its last line to that hook instead. Ask before changing `core.hooksPath` or `package.json`.
4. **CI (optional).** Copy `design-tokens.yml` to `.github/workflows/`, with the project's Node version and install command. Confirm the action versions in their documentation.

## Step 5: Prove each gate

A gate that never failed is not yet a gate. For each installed gate:
1. Make one known violation in a scratch copy or a temporary file. Examples:
   - a role aliasing another role;
   - a hex value in a component;
   - a `bg-[#fff]` class;
   - a value in the rules document's front matter;
   - an edit to a generated output.
2. Run the gate and confirm it fails with a message that names the rule.
3. Remove the violation and confirm the gate passes.

Report each gate as proven, with the command and both results. Leave no violation behind.

## Step 6: Record

- **Document.** Add the gates to the project's agent instructions (CLAUDE.md or AGENTS.md): what runs, when, and the one command to run them all (`node .claude/hooks/design-tokens/run-gates.mjs before-commit`).
- **Commit message.** Propose one and wait for approval. Add no attribution trailers unless the project asks for them.

## Rules

- **Search inside the project.** Search only the project, the plugin's files and the session scratchpad. Find where a tool writes its output from its config or documentation, never by searching the disk. A hook blocks searches outside those places (`${CLAUDE_PLUGIN_ROOT}/scripts/search-scope.mjs`).
- **Approval before changes** to settings, git hooks, `package.json`, CI or dependencies.
- **No weakening.** Never weaken an existing gate or lint rule to make a new one pass.
- **Existing tools first.** Custom checks only where no tool has the rule.
- **Prove before reporting.** Every gate is shown failing before it is reported as installed.

## Tone

Write for senior engineers. Name the gate, the rule it holds and the proof. No filler.

## About

Built by Abas Turabli. The gates come from a token system where agents, people and CI pass the same checks.

- Website: https://abasturabli.com
- LinkedIn: https://www.linkedin.com/in/turabli/
- License: MIT
