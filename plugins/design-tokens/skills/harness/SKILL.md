---
name: harness
description: >-
  Write and install the gates that keep a web project on its design tokens: token and rules checks,
  a staleness check for generated outputs, code lint rules, Claude Code hooks, a git pre-commit hook
  and a CI job, all driven by one design-system/gates.json. Existing tools first; custom checks only
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

1. **Read the gates.** From the newest report in `design-system/audits/` (or `design-tokens-audit/` from before 0.4.0) (`${CLAUDE_PLUGIN_ROOT}/references/report.md`, Files), read `gates`. With no report, run the scan (`node ${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs .`) and derive the gates from the rubric's Gate lines.
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

Write `design-system/gates.json`, starting from `${CLAUDE_PLUGIN_ROOT}/assets/harness/core/design-tokens.gates.json`. A project with a 0.3.x `design-tokens.gates.json` at the root moves it there. It is the one place the gates read from:
- `generated`: globs of the outputs an agent may never edit;
- `sources`: globs of the files whose edit runs `onSourceEdit` (tokens, rules document, build template and config);
- `onSourceEdit`: commands run after such an edit;
- `lint`: `files` and `command`, for the linter an edited file gets, and `strictEnv`, the variables that make its rules errors;
- `beforeCommit`: the commands every commit and CI run;
- `tokens` (the checks): `resolver`, `modifier`, `palette`, `roles`, `typography`, `fonts`, `extensionKey`, `outDir`, `rulesDocument` and `readable`. Write every one that differs from the canonical layout, for example the `stack.tokenSettings` the audit recorded. A check that finds an empty roles group fails and names the groups the tokens have. `files` lists plain token files for a project without a resolver. Defaults are in `${CLAUDE_PLUGIN_ROOT}/scripts/lib/project-modules.mjs`.

Every path and command in it is the project's own. None is copied from the example.

**A project off the canonical layout.** When `tokens` differs from the canonical layout (other paths or group names), say so in one line of the final report. Name the optional move (`${CLAUDE_PLUGIN_ROOT}/references/conventions.md`, Moving to the canonical layout), and suggest it as its own `fix` batch after the harness commit. Harness records the project's layout and never moves files itself.

## Step 3: Checks

**Token and rules checks (any stack, no dependencies).** Copy them from the plugin into `design-system/checks/` (`${CLAUDE_PLUGIN_ROOT}/references/conventions.md`), keeping their layout so the relative imports hold:

| File | Rules |
|---|---|
| `scripts/check-tokens.mjs` | DTCG validity (a modifier needs two or more contexts), palette literal, roles alias the palette or are derived, derived values match their rule, every context complete, text styles alias the fonts |
| `scripts/check-rules-contract.mjs` | The rules document's front matter holds no values, imports the resolver, and its contract names existing roles. It reads the front matter with the project's `yaml` |
| `scripts/lib/dtcg.mjs`, `lib/color.mjs`, `lib/project-modules.mjs` | The DTCG reader, the colour maths and the shared settings the checks use |

**Profile checks (Terrazzo + Tailwind v4).**

| File | Rules |
|---|---|
| `scripts/profiles/terrazzo-tailwind-v4/check-generated.mjs` | Generated outputs match a fresh build, and none is empty |
| `assets/harness/terrazzo-tailwind-v4/eslint-token-rules.mjs` | `token-classes` and `no-raw-color` |
| `assets/harness/terrazzo-tailwind-v4/terrazzo.config.ts`, `theme.template.css` | The build, when the project has none |

**When you adapt a copied file:**
- **Read the file first**, and keep its comments, which say what each rule does and why.
- **Change only what the project needs:** names, paths, the class helpers the code uses, the utilities it has. Settings belong in `design-system/gates.json`, not in the copied code.
- **Test what you change.** Write a unit test for each pure function you change, in the project's test framework, with a negative case: the input the rule must reject.
- **Ask before dependencies.** Only `check-rules-contract.mjs` (`yaml`) and the profile's build and lint (Terrazzo, ESLint) need packages. Ask before adding any.

Wire the checks into the project's scripts, for example a `tokens:check` script, and into `beforeCommit` and `onSourceEdit`. Add the ESLint rules to the project's flat config in two severities:
- `recommended` (warn) for a person;
- `strict` (error) when `DESIGN_LINT_STRICT=1` or `CI=true`.

For a stack without a profile, the token and rules checks work as they are. Write the code lint and the build check for that stack's own tools. Follow the same order: existing rule first, custom rule as a plugin of an existing tool second, a standalone script last.

## Step 4: Hooks, pre-commit, CI (core)

From `${CLAUDE_PLUGIN_ROOT}/assets/harness/core/`:

1. **Hooks.** Copy `gates.mjs`, `protect-generated.mjs`, `check-on-edit.mjs`, `guard-commit.mjs`, `run-gates.mjs` and `with-node.sh` to `.claude/hooks/design-tokens/`. Make `with-node.sh` executable. What each hook can do:
   - `protect-generated` (PreToolUse, Edit and Write) denies an edit to a generated output before it happens.
   - `check-on-edit` (PostToolUse, Edit and Write) runs after the file is written. It reports the failure to the agent; it cannot undo the write.
   - A file changed through the shell (`sed`, a heredoc, a script) reaches no edit hook. The commit gate (`guard-commit`, the pre-commit hook and CI) is what catches it, and what enforces every rule.
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

A hook run by hand proves its script, not that Claude Code loads it. The hooks load from `.claude/settings.json` when a session starts, so after the commit ask the person to start a new session, approve the hooks, and ask the agent there for one violation per hook: an Edit with `bg-[#fff]`, and an Edit to a generated output. The transcript line of each hook firing is the proof.

## Step 6: Record

- **Document.** Add the gates to the project's agent instructions (CLAUDE.md or AGENTS.md): what runs, when, and the one command to run them all (`node .claude/hooks/design-tokens/run-gates.mjs before-commit`).
- **Commit message.** Propose one and wait for approval. Add no attribution trailers unless the project asks for them.

## Rules

- **Search inside the project.** Search only the project, the plugin's files and the session scratchpad. Find where a tool writes its output from its config or documentation, never by searching the disk. A hook blocks searches outside those places (`${CLAUDE_PLUGIN_ROOT}/scripts/search-scope.mjs`).
- **Approval before changes** to settings, git hooks, `package.json`, CI or dependencies.
- **No weakening.** Never weaken an existing gate or lint rule to make a new one pass.
- **Existing tools first.** Custom checks only where no tool has the rule.
- **Prove before reporting.** Every gate is shown failing before it is reported as installed.
- **Say what a hook can do.** A PreToolUse hook prevents; a PostToolUse hook reports after the write. Never describe an after-the-fact check as a block.

## Tone

Write for senior engineers. Name the gate, the rule it holds and the proof. No filler.

## About

Built by Abas Turabli. The gates come from a token system where agents, people and CI pass the same checks.

- Website: https://abasturabli.com
- LinkedIn: https://www.linkedin.com/in/turabli/
- License: MIT
