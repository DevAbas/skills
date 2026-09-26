# Changelog

The plugin follows Semantic Versioning. Its version lives in `.claude-plugin/plugin.json` only. Each release is tagged `design-tokens--v<version>`.

A version bump means:
- **Major:** a change to the rubric or the report schema that makes a new report incomparable with an older one.
- **Minor:** a new rule, gate, profile or skill.
- **Patch:** a fix or a clarification.

## 0.3.0

The checks no longer depend on the build tool.

- **An in-house DTCG 2025.10 reader, `scripts/lib/dtcg.mjs`.**
  - It covers the resolver with sets, modifiers, input validation and `$ref`s; alias chains and cycles; `$type` inheritance; `$root`; `$extends`; and JSON Pointer references.
  - Its resolved values match `@terrazzo/parser` on a real token set of 138 tokens in two contexts.
- **In-house colour maths, `scripts/lib/color.mjs`.**
  - It gives the same hex as lightningcss for derived roles: identical on 19,865 random lightness and mix rules, with a committed reference table.
  - Unlike reading lightningcss's output, it never breaks on a named colour (`indigo`).
- **`scripts/check-tokens.mjs` is now a core check with no dependencies.**
  - `audit` runs it on any project with DTCG files, as deterministic evidence.
  - It also reports what the reader finds wrong with the files (`format/dtcg-valid`), and accepts plain token files (`tokens.files`).
- **The checks moved to `scripts/`, keeping their relative imports:** `check-rules-contract.mjs`, `lib/`, and `profiles/terrazzo-tailwind-v4/check-generated.mjs`. `harness` copies them with that layout. The profile assets keep the ESLint rules and the build templates.
- **Correction to 0.2.1.** A modifier needs two or more contexts (Resolver §4.1.5.1), so a single theme is a set in a resolver without modifiers, built with `@tz(tzMode: ".")`. The 0.2.1 advice, a one-context modifier, was invalid DTCG.
- **README** gains a "Stack and dependencies" section: the standards the plugin applies, what each part needs and adds, and the profile's packages with licence and tested version.

## 0.2.1

Lessons from migrating a real project to DTCG with Terrazzo.

- **Fix: the Terrazzo config template now keeps the recommended lint rules.** Terrazzo applies its recommended rules only when `lint.rules` is undefined, so the 0.2.0 template, which set two rules, ran none of the recommended ones. It now spreads `RECOMMENDED_CONFIG` from `@terrazzo/parser`.
- **`check-generated.mjs`** fails an output that declares no token. A template `@tz(...)` that matches no context builds an empty theme with exit 0.
- **Profile: new Pitfalls section.**
  - `lint.rules` replaces the recommended rules.
  - A relative template path resolves against `outDir`.
  - A single context still gets a resolver modifier, not Terrazzo's internal `tzMode`.
  - A DTCG `lineHeight` is a ratio that children inherit.
- **Decisions, Text styles:** the line height ratio, and the fix when a migration changes rendering.
- **Sources:** `designmd export --format dtcg` (0.4.0) is not a migration source. It loses alpha, turns a px line height into a ratio, and renames `colors` to `color`.
- **`fix`:** a batch that must not change rendering is proven with the project's own visual check, whose output location comes from its config, never from a disk search.
- **Search guardrail.**
  - `scripts/search-scope.mjs` blocks a search outside the project, the plugin and the scratchpad: Bash `find`, recursive `grep`, `rg`, `fd`, `ls -R`, `mdfind`, `locate`, and Glob or Grep.
  - The four skills register it in their frontmatter, for the rest of a session that uses them.
  - `hooks/hooks.json` registers it for the auditor subagent only.

## 0.2.0

Changes from the first audits of real projects.

- **New rule `docs/rules-document-exists`.** A project without a rules document gets one finding that `fix` can act on, and `docs` is `missing` exactly then.
- **Scan:** reports `rulesDocumentCandidates`, the Markdown and MDX files that may be a rules document under another name. The auditor reads them before deciding a project has none.
- **Report:**
  - a group's total is `<ruleId>@project#total` with severity `info`, so its errors are not counted twice;
  - `render-report.mjs` refuses a total with another severity, and a cited source URL missing from `sources`;
  - it warns about a part summary of more than one sentence.
- **Rubric:** a value written in both the rules document and code is one `docs/rules-hold-no-values` finding; `format/single-source-build` is about generated outputs only.
- **`fix`:** a new rules document starts from `assets/setup/DESIGN.md`; an existing one of another name is kept and brought to the rules.
- **`audit`:** looks for earlier reports with Glob, so a first audit shows no failing `ls`.
- **Report names:** a report is named by its UTC stamp (`2026-09-26T143005Z.json`), so name order is time order. 0.1.0 used `<date>-2.json`, which sorts before `<date>.json`. That made a comparison run in the wrong order, and the "newest report" come out as an older one. `fix` and `harness` read the rule for 0.1.0 names from `references/report.md`.
- **README:** the test command is `node --test` run from the plugin folder. The 0.1.0 command, `node --test plugins/design-tokens`, fails on Node 21 and later, which read the path as a file.

## 0.1.0

- Skills `setup`, `audit`, `fix` and `harness`, and the read-only `token-auditor` subagent.
- The Token Architecture rubric (naming, tiers, format, docs), with stable rule ids.
- Principles, decisions with sources, and a sources index for version checks.
- Report schema 1: JSON source, Markdown rendered by `render-report.mjs`, compared by `compare-reports.mjs`.
- `scan.mjs`: a read-only inventory of a project.
- Core gates: `design-tokens.gates.json`, Claude Code hooks, git pre-commit, CI.
- Profile `terrazzo-tailwind-v4`:
  - token, rules-contract and staleness checks;
  - ESLint rules `token-classes` and `no-raw-color`;
  - Terrazzo config and Tailwind template.
