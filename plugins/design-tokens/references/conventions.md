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
        colors.tokens.json                   colors.<role>: only when the interface has one context
      themes/                                only when there are two or more contexts
        <context>.tokens.json                colors.<role> and shadow.<name> for that context
    checks/                                  the checks harness copies from the plugin (check-tokens.mjs, lib/, …)
    audits/                                  the audit reports, named by UTC stamp
    gates.json                               the gates and the token settings
  <framework path>/theme.css                 the generated output, where the framework reads it (app/, src/styles/)
```

## Contexts

- **One context** (for example, dark only): the roles go in `semantic/colors.tokens.json`, and the resolver has sets and no modifier. A modifier needs two or more contexts (Resolver §4.1.5.1).
- **Two or more contexts:** the roles and shadows that change go in `themes/<context>.tokens.json`, and the resolver has one modifier, `theme`, with a context per file and a `default`.

`assets/setup/design-system/tokens/` holds both resolver forms.

## Group names

| Group | Tier | Holds | Tailwind v4 namespace |
|---|---|---|---|
| `palette` | Palette | Literal colours | None: the palette is never a utility |
| `font` | Palette | Families and weights | None: wired separately (profile, Pitfalls) |
| `colors` | Role | Colour roles, aliases into `palette` or derived | `color` |
| `typography` | Role | Text styles | `text` |
| `spacing` | Role | Spacing steps | `spacing` |
| `rounded` | Role | Radii | `radius` |
| `shadow` | Role | Elevation, per context | `shadow` |

The role groups take the names of the rules document's sections. `DESIGN.md` is written in the design.md format, whose front matter has fixed sections: `colors`, `typography`, `rounded`, `spacing` and `components` (https://github.com/google-labs-code/design.md, spec: Schema and Token References). Its `components:` contract cites ids in those sections (`{colors.primary}`, `{typography.label-md}`, `{rounded.full}`), and the contract check requires each to be a token id. So the token groups carry the same names, and an id reads the same in the tokens, the contract and the design.md linter. `palette`, `font` and `shadow` have no design.md section, and keep plain names.

Before 0.5.0 the roles group was `color`. A project that has it sets `tokens.roles` (and `readable`) in `design-system/gates.json`, or moves (below).

## A project that differs

An existing project may already use other names (`color`, `radius`) or paths (`tokens/` at the root). Since DTCG does not prescribe them, **the audit does not report this as a finding**. Instead:
1. The auditor reads the files, and passes the project's names to the checks explicitly (`--roles color`). The report records them in `stack.tokenSettings`.
2. `harness` writes them into `design-system/gates.json` (`tokens.resolver`, `tokens.roles`, `tokens.palette` …), so every later check reads the same names.
3. Moving to the canonical names and paths is an optional `fix` batch, with its own commit (below). `harness` says when a project differs, and never moves files itself.

Before 0.4.0 the config was `design-tokens.gates.json` at the root and reports went to `design-tokens-audit/`. Both are still read.

## Moving to the canonical layout

The procedure a `fix` batch follows, first run on a real project (a DTCG token set with a sets-only resolver, moved from `tokens/` at the root). It moves and renames; it never changes a value, and never adds a missing tier (a palette or font group is a tier finding, fixed in its own batch).

1. **Token files.** `git mv` each file into `design-system/tokens/`: `foundation/` for the palette and fonts, `semantic/` for roles and styles with one context, `themes/<context>.tokens.json` for what changes per context. The resolver goes to the tokens root, where the checks look by default, and only its `$ref`s change. Every token file stays byte-identical.
2. **The rest.** `git mv` the build template to `design-system/`, and the audit reports to `design-system/audits/`.
3. **Paths.** Update every file that names a moved one: the build config, the rules document's `imports:` and prose, the agent instructions, lint plugins and scripts that read the tokens, the generated output's own comment in the template, and `design-system/gates.json` (`sources`; remove each `tokens` setting that now equals the default).
4. **Names.** Rename a group only when it differs from the table above. A rename changes the token ids, the rules document's contract and the build's group selectors; the utilities stay, since the build maps groups to namespaces.
5. **Edit tools.** Make content changes with the agent's Edit and Write tools, not `sed` or a heredoc, so the hooks check each one.
6. **Proof.**
   - The rebuilt output differs in comment lines only (the build writes the template's path into its header). Compare it with comments stripped: every declaration is identical.
   - `check-tokens` reports the same problems as before the move, under the new names and paths. A different count means the move lost or added something.
   - The gates and the project's own checks pass.
