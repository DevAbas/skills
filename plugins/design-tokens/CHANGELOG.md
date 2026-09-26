# Changelog

The plugin follows Semantic Versioning. Its version lives in `.claude-plugin/plugin.json` only. Each release is tagged `design-tokens--v<version>`.

A version bump means:
- **Major:** a change to the rubric or the report schema that makes a new report incomparable with an older one.
- **Minor:** a new rule, gate, profile or skill.
- **Patch:** a fix or a clarification.

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
