# design-tokens

A Claude Code plugin by [Abas Turabli](https://abasturabli.com) that sets up, audits, fixes and gates a web project's design-token architecture:
- W3C Design Tokens (DTCG) as the one source of values;
- a rules document (`DESIGN.md`) that explains the tokens and holds no values;
- code that reads roles, never the palette;
- gates that hold agents, people and CI to all of it.

## Install

```bash
claude plugin marketplace add DevAbas/skills
```

```bash
claude plugin install design-tokens@fearchitect
```

## Skills

| Skill | What it does |
|---|---|
| `/design-tokens:setup` | Plans a token architecture for a new project, waits for approval, then builds it: resolver, palette from seeds, roles per theme, derived states, `DESIGN.md`, and the build |
| `/design-tokens:audit` | Scans the project and checks it against the Token Architecture rubric: naming, tiers, format, docs. Writes `design-tokens-audit/<date>.json` and its Markdown. Changes nothing else |
| `/design-tokens:fix` | Takes finding ids from a report, plans each fix, waits for approval, implements, then re-audits and compares the reports to show what closed |
| `/design-tokens:harness` | Installs the gates a report recommends: token and rules checks, a staleness check, ESLint rules, Claude Code hooks, a git pre-commit hook and CI, all from one `design-tokens.gates.json`. Proves each gate by making it fail once |

The audit runs its analysis in a read-only subagent, `design-tokens:token-auditor`.

## The rubric

Four parts, each `met`, `partial` or `missing`. Every finding names a rule id that stays stable across audits:

| Part | Checks |
|---|---|
| `naming` | Roles named by purpose, one case convention, one name from tokens to code |
| `tiers` | Palette holds values, roles alias the palette or record a derived rule, text styles alias the fonts, code never reads the palette or states a literal, the component contract names roles |
| `format` | Valid DTCG, every theme complete, outputs generated and checked for staleness, a machine-readable contract |
| `docs` | The rules document holds no values, cites existing tokens, explains how to read them, stays current |

See `references/rubric.md`. The reasons behind each rule, with sources, are in `references/principles.md` and `references/decisions.md`.

## Profiles

The core rules hold in any web stack. A profile says how to build and gate them with specific tools:
- `terrazzo-tailwind-v4`: DTCG → Terrazzo → Tailwind CSS v4.

## Knowledge that stays current

The plugin records procedures and sources, not version facts:
- **New project:** the skills read the latest stable documentation of each tool.
- **Existing project:** they read the documentation of the version it has installed.
- **The gap:** the difference between the two is reported.

See `references/sources.md`.

## Requirements

- Claude Code.
- Node.js 20 or later.

The plugin's own scripts have no dependencies. The profile's checks use the project's own packages, and the skills ask before adding any.

## Tests

```bash
node --test plugins/design-tokens
```

## About

Built by Abas Turabli.

- Website: https://abasturabli.com
- LinkedIn: https://www.linkedin.com/in/turabli/
- License: MIT
