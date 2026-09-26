# The audit report

> Reference material for the design-tokens plugin. How the audit writes its report and how `fix` and `harness` read it. The report's shape is `assets/report.schema.json`. Load before writing or reading a report.

## Files

The audit writes two files into the audited project:
- `design-tokens-audit/<YYYY-MM-DD>.json`: the source. `fix`, `harness` and `compare-reports` read it.
- `design-tokens-audit/<YYYY-MM-DD>.md`: rendered from the JSON by `scripts/render-report.mjs`. Never written by hand.

A second audit on the same day adds a suffix: `<YYYY-MM-DD>-2.json`. The audit never deletes an older report, because comparing two reports is how a fix is verified.

## Top-level fields

| Field | Content |
|---|---|
| `schemaVersion` | `"1"` |
| `tool` | `{ "name": "design-tokens", "version": "<plugin.json version>" }` |
| `project` | `{ "name", "root", "commit" }`; `commit` is the short hash when the project is a git repository |
| `date` | ISO date of the audit |
| `stack` | `profile` (`"terrazzo-tailwind-v4"` or `null`), `tokenFormat`, `styling`, `rulesDocument`, and `versions`: per tool, `installed` and, when checked, `latest` |
| `parts` | The four parts (`naming`, `tiers`, `format`, `docs`), each with `status` and a one-sentence `summary` |
| `findings` | See below |
| `gates` | See below |
| `sources` | Every document the audit relied on: `title`, `url`, and `version` where it applies |

## A finding

```json
{
  "id": "tiers/role-aliases-palette@tokens/themes/dark.tokens.json#color.surface-overlay",
  "ruleId": "tiers/role-aliases-palette",
  "part": "tiers",
  "severity": "error",
  "title": "color.surface-overlay aliases color.surface-container instead of the palette",
  "location": { "file": "tokens/themes/dark.tokens.json", "pointer": "color.surface-overlay" },
  "evidence": [{ "file": "tokens/themes/dark.tokens.json", "line": 41, "excerpt": "\"$value\": \"{color.surface-container}\"" }],
  "why": "A role that points to a role hides the palette entry behind it (principles 2).",
  "source": "https://www.designtokens.org/faq/",
  "fix": "Point it at the palette entry, or record it as a derived role with its rule."
}
```

**The finding `id`** is `<ruleId>@<file>#<pointer>`:
- `pointer` is a token id, a front matter path, or a code symbol;
- for a finding about a whole file, use `#` alone;
- for a finding about the whole project, use `@project#`.

The id must not contain a line number: a line moves when unrelated code changes, and the id must stay the same from one audit to the next. The line goes in `evidence`.

**Grouping:** one finding per rule and place. A rule broken in forty files is one finding per file, capped at the ten files with the most matches. A further finding, `<ruleId>@project#`, gives the total count.

## A gate

```json
{
  "id": "gate/code-lint",
  "does": "Fails a class or style that reads the palette or states a literal colour, size or radius",
  "checks": ["tiers/no-primitive-in-code", "tiers/no-literal-in-code"],
  "closes": ["tiers/no-literal-in-code@src/components/Card.tsx#"],
  "tool": { "name": "ESLint rules token-classes and no-raw-color", "kind": "custom", "basis": "assets/harness/terrazzo-tailwind-v4/eslint-token-rules.mjs" },
  "runs": ["agent-edit", "commit", "ci"],
  "status": "missing"
}
```

- **`tool.kind`:**
  - `existing`: a rule the project's tools already have, to switch on;
  - `custom`: a rule to write.
  
  Recommend `existing` first (principles 9).
- **`runs`:** any of these:
  - `agent-edit`: a hook after an agent's edit;
  - `agent-commit`: a hook before an agent's commit;
  - `commit`: a git pre-commit hook;
  - `ci`.
- **`status`:**
  - `present`: the gate exists and fails on a probe;
  - `partial`: it exists but misses a rule or a place;
  - `missing`.

Every rule in the rubric whose Gate is machine-checkable appears in some gate's `checks`, whether or not it has a finding: the gates are how a clean project stays clean.

## Statuses of parts

Use `rubric.md`, Parts and statuses. The `summary` is one sentence and states the most important finding or, when the part is met, what holds it.

## The Markdown

`render-report.mjs` writes these sections:
1. Header.
2. Summary: parts and statuses.
3. Findings, grouped by part, errors first.
4. Recommended gates.
5. Versions.
6. Sources.

It fails when a required field is missing, so an incomplete report never reaches the user.

## Comparing two reports

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/compare-reports.mjs" <before.json> <after.json>
```

It prints the findings that are new, resolved or unchanged, by `id`. `fix` runs it after re-auditing. `--json` prints the same as JSON.
