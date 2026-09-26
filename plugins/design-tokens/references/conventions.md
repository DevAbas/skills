# Conventions: the canonical layout

> Reference material for the design-tokens plugin. Where a project's design-system files live and what its token groups are called. `setup` creates exactly this, and the checks default to it, so a project that follows it needs no configuration. Load before creating, moving or reading token files.

DTCG does not prescribe file names or group names: the spec "defines the format for token exchange while leaving organizational strategy to design system teams" (https://www.designtokens.org/faq/). This layout is the plugin's convention. It exists so that every skill reads and writes the same places.

## Layout

```
<project root>/
  DESIGN.md                                  the rules document; at the root, where agents look for it
  design-system/
    tokens/
      design.resolver.json                   the one entry point (DTCG Resolver 2025.10)
      foundation/
        palette.tokens.json                  palette.<scale>-<step>: literal colours only; the generator and seeds in $extensions
        font.tokens.json                     font.family.<name>, font.weight.<name>
      semantic/
        typography.tokens.json               typography.<style>: family and weight alias font.*
        spacing.tokens.json                  spacing.<step>
        rounded.tokens.json                  rounded.<step>
        color.tokens.json                    color.<role>: only when the interface has one context
      themes/                                only when there are two or more contexts
        <context>.tokens.json                color.<role> and shadow.<name> for that context
    checks/                                  the checks harness copies from the plugin (check-tokens.mjs, lib/, …)
    audits/                                  the audit reports, named by UTC stamp
    gates.json                               the gates and the token settings
  <framework path>/theme.css                 the generated output, where the framework reads it (app/, src/styles/)
```

## Contexts

- **One context** (for example, dark only): the roles go in `semantic/color.tokens.json`, and the resolver has sets and no modifier. A modifier needs two or more contexts (Resolver §4.1.5.1).
- **Two or more contexts:** the roles and shadows that change go in `themes/<context>.tokens.json`, and the resolver has one modifier, `theme`, with a context per file and a `default`.

`assets/setup/design-system/tokens/` holds both resolver forms.

## Group names

| Group | Tier | Holds | Tailwind v4 namespace |
|---|---|---|---|
| `palette` | Palette | Literal colours | None: the palette is never a utility |
| `font` | Palette | Families and weights | None: wired separately (profile, Pitfalls) |
| `color` | Role | Colour roles, aliases into `palette` or derived | `color` |
| `typography` | Role | Text styles | `text` |
| `spacing` | Role | Spacing steps | `spacing` |
| `rounded` | Role | Radii | `radius` |
| `shadow` | Role | Elevation, per context | `shadow` |

The names are singular, as in the DTCG spec's examples (`color.*`). The rules document's `components:` contract names the same ids (`{color.primary}`, `{typography.label-md}`, `{rounded.full}`).

## A project that differs

An existing project may already use other names (`colors`, `radius`) or paths (`tokens/` at the root). Since DTCG does not prescribe them, **the audit does not report this as a finding**. Instead:
1. The auditor reads the files, and passes the project's names to the checks explicitly (`--roles colors`). The report records them in `stack.tokenSettings`.
2. `harness` writes them into `design-system/gates.json` (`tokens.resolver`, `tokens.roles`, `tokens.palette` …), so every later check reads the same names.
3. Moving to the canonical names and paths is an optional `fix` batch. It renames token ids, the rules document's contract and the code that reads them, so it is proposed, never assumed.

Before 0.4.0 the config was `design-tokens.gates.json` at the root and reports went to `design-tokens-audit/`. Both are still read.
