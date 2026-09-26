# Profile: DTCG → Terrazzo → Tailwind CSS v4

> Reference material for the design-tokens plugin. How the rubric's rules are built, checked and gated in a web project that builds DTCG tokens with Terrazzo into a Tailwind CSS v4 theme. Load when the scan reports this profile, or when `setup` chooses it. Every API named here is confirmed in the installed version's documentation before use (`sources.md`).

## When this profile applies

The scan reports `profile: "terrazzo-tailwind-v4"` when the project depends on:
- `tailwindcss` 4.x;
- `@terrazzo/cli` or `@terrazzo/parser`.

When it has Tailwind v4 but no Terrazzo, the profile is still the recommendation for `setup` and `fix`: the audit reports a `format/single-source-build` finding when theme values are written by hand.

## Layout

```
tokens/
  <name>.resolver.json            # sets + the theme modifier (DTCG Resolver)
  foundation/*.tokens.json        # palette (literal values), font families and weights, raw scales
  semantic/*.tokens.json          # roles and styles that are the same in every theme (typography, radius, spacing)
  themes/<context>.tokens.json    # colour roles and shadows, per context
terrazzo.config.ts                # tokens → CSS variables + Tailwind theme
src/styles/theme.template.css     # the Tailwind wiring, filled by Terrazzo (hand-written, holds no values)
src/styles/*.generated.css        # built outputs, never edited
DESIGN.md                         # rules; imports: the resolver
```

Paths are the project's choice. Record them once, in the gates config (`design-tokens.gates.json`), and let every check read them from there.

## Build

`assets/harness/terrazzo-tailwind-v4/terrazzo.config.ts` and `theme.template.css` are the starting point. What they encode:

- **`@terrazzo/plugin-css`:** every token of the default context as `:root` variables. The other contexts produce nothing here, because they reach the page through the Tailwind theme's variant.
- **`@terrazzo/plugin-tailwind`:** the template's `@tz (<modifier>: "<context>")` rules receive each context. The `theme` option maps token groups to Tailwind namespaces, so each group makes its utilities:

  | Token group | Tailwind namespace |
  |---|---|
  | `color.*` | `color` |
  | `typography.*` | `text` |
  | `rounded.*` | `radius` |
  | `spacing.*` | `spacing` |
  | `shadow.*` | `shadow` |

  **The palette group is never mapped**, so no utility can name a primitive (`tiers/no-primitive-in-code`).
- **`--color-*: initial`** inside `@theme` removes Tailwind's default palette (Tailwind docs, theme: overriding a namespace). After this reset, an unknown colour class produces no CSS and no error. That is why the code lint exists.
- **Typography composites** become `--text-<style>` with `--text-<style>--line-height`, `--letter-spacing` and `--font-weight`. One class (`text-body-md`) applies the whole style. A documented borrow reads the other style's part: `leading-(--text-label-lg--line-height)`.
- **Dark (or any second context)** is a `@custom-variant` in the template, `@variant <name> { @tz (theme: "<name>"); }`. Confirm the variant syntax in Tailwind's dark mode docs.
- **An output directory override** (`DESIGN_TOKENS_OUT_DIR`) lets the staleness check build into a temporary folder.

## Checks and gates per rule

| Rule | Existing tool first | Custom (asset) |
|---|---|---|
| `format/dtcg-valid` | `tz check`, which checks the files and runs the lint rules | none |
| `naming/consistent-case` | Terrazzo `core/consistent-naming` (`["error", { format: "kebab-case" }]`) | none |
| `docs/token-descriptions` | Terrazzo `core/descriptions`, with `ignore` for the palette | none |
| Contrast pairs (rules document) | Terrazzo `a11y/min-contrast` with `pairs`. Confirm whether it checks every resolver context or only the default one | `check-tokens.mjs` covers each context if not |
| `tiers/palette-literal`, `tiers/role-aliases-palette`, `tiers/derived-rule-recorded`, `tiers/styles-alias-foundation`, `format/themes-complete` | none: DTCG leaves tier rules to the team | `check-tokens.mjs`: parses the resolver with `@terrazzo/parser`, applies every context, checks the tiers, recomputes derived values with lightningcss (a Tailwind v4 dependency) |
| `tiers/components-read-roles`, `docs/rules-hold-no-values`, `docs/rules-reference-existing-tokens` | @google/design.md `lint` on a document composed in memory (until `imports:` is supported) | `check-rules-contract.mjs`: front matter keys, `imports:`, every contract reference is a known role |
| `tiers/no-primitive-in-code`, `tiers/no-literal-in-code` | Tailwind's theme mapping and the palette reset | `eslint-token-rules.mjs`: `token-classes` (a token utility must name a token the generated theme defines; no arbitrary values, no modifiers, no palette variables) and `no-raw-color` (no hex or literal colour functions in source) |
| `format/single-source-build` | `tz build` | `check-generated.mjs`: builds into a temporary folder and compares with the committed outputs. `protect-generated.mjs` (core hook) denies an agent's edit to an output |

**Why the tier rules are a script, not a Terrazzo lint rule:** a Terrazzo lint rule receives one resolved token set (`LintRuleContext.tokens`). The tier and completeness rules need every context of the resolver, which `parse(...).resolver.apply(input)` gives. Before copying `check-tokens.mjs`, confirm this in the installed version's types. If a later version lints each context, a lint rule is the better home (principles 9).

## Wiring the checks

The project's `package.json` gets two scripts; the names are the project's choice, and are recorded in `design-tokens.gates.json`:
- `tokens:build`: runs `tz build`;
- `tokens:check`: runs `check-tokens.mjs`, then `check-rules-contract.mjs`, then `check-generated.mjs`, then `tz check`.

The ESLint rules join the project's flat config twice, once in each severity (`decisions.md`, Gate severity):
- `recommended`: `warn`;
- `strict`: `error`, selected by an environment variable that the hooks and CI set.

## Dependencies this profile adds

Ask before adding each one:
- `@terrazzo/cli`, `@terrazzo/parser`, `@terrazzo/plugin-css`, `@terrazzo/plugin-tailwind`;
- `yaml`, which the contract check uses to read the front matter;
- `@google/design.md`, only when the project wants its contrast and structure lint.

`lightningcss` comes with Tailwind v4. Confirm it resolves before relying on it (`node -e "import('lightningcss')"`).

## Pitfalls

Found while migrating a real project, and confirmed in Terrazzo 2.7.1. Re-check each one in the installed version.

- **`lint.rules` replaces the recommended rules.** Terrazzo applies its recommended set only when `lint.rules` is undefined, so a config that sets any rule runs only those rules. Spread the recommended set first: `rules: { ...RECOMMENDED_CONFIG, … }`, with `RECOMMENDED_CONFIG` from `@terrazzo/parser`. The template config does this.
- **A relative template path resolves against `outDir`, not the project root.** The build then fails with "Could not locate template". Pass the path through `resolve()`, as the template config does.
- **One context still gets a modifier.** For a single theme, give the resolver one modifier with one context (`"theme": { "contexts": { "dark": [...] }, "default": "dark" }`) and write `@tz(theme: "dark")`.
  - A resolver without a modifier builds with `@tz(tzMode: ".")`, but `tzMode` is Terrazzo's internal modifier name, not a documented argument.
  - A missing or wrong argument (`@tz()`, `@tz(tzMode: "nope")`) builds an empty `@theme` with exit 0 and only a "matched 0 tokens" warning. `check-generated.mjs` fails on an output with no tokens for this reason.
- **A DTCG `lineHeight` is a unitless ratio** (`36/28` is `1.2857…`). CSS inherits a unitless line height as a ratio, so a child that changes font size without its own text style gets a different line height than it did with a px value.
  - Keep the ratio: a px `lineHeight` is not valid DTCG, even though Terrazzo accepts it.
  - When a migration changes rendering, give that element its own `text-<role>` class (decisions, Text styles).
