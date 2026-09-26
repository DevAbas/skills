// Terrazzo builds the project's CSS from its W3C Design Tokens
// (https://terrazzo.app/docs/integrations/tailwind/). A starting point from
// the design-tokens plugin; confirm every option in the installed version's
// documentation before relying on it.
//
// - plugin-css: every token of the default context as a `:root` variable. The
//   other contexts reach the page through the Tailwind theme's variant, so
//   their permutation writes nothing here; plugin-tailwind still needs it.
// - plugin-tailwind: the Tailwind v4 theme, from theme.template.css, whose
//   `@tz` rules receive each context. `theme` maps each token group to the
//   Tailwind namespace that makes its utilities. The palette group is not
//   mapped, so no class can name a primitive.
//
// DESIGN_TOKENS_OUT_DIR builds elsewhere, for check-generated.mjs.
// This is the two-context form (a `theme` modifier with light and dark). With
// one context the resolver has no modifier: drop the plugin-css permutations
// and write `@tz(tzMode: ".")` in the template (profile, Pitfalls).
// Replace the output folder with the framework's, and keep the paths and group
// names of references/conventions.md unless the project has its own.

import { resolve } from "node:path";
import { defineConfig } from "@terrazzo/cli";
import { RECOMMENDED_CONFIG } from "@terrazzo/parser";
import css from "@terrazzo/plugin-css";
import tailwind from "@terrazzo/plugin-tailwind";

export default defineConfig({
  tokens: ["./design-system/tokens/design.resolver.json"],
  outDir: process.env.DESIGN_TOKENS_OUT_DIR ?? "./src/styles/",
  lint: {
    // Setting lint.rules replaces Terrazzo's recommended rules instead of adding to them (it applies
    // RECOMMENDED_CONFIG only when lint.rules is undefined), so the recommended set is spread in first.
    rules: {
      ...RECOMMENDED_CONFIG,
      "core/consistent-naming": ["error", { format: "kebab-case" }],
      "core/descriptions": ["warn", { ignore: ["palette.*"] }],
    },
  },
  plugins: [
    css({
      filename: "tokens.generated.css",
      permutations: [
        { input: { theme: "light" }, prepare: (contents) => `:root {\n${contents}\n}` },
        { input: { theme: "dark" }, prepare: () => "" },
      ],
    }),
    tailwind({
      template: resolve("design-system/theme.template.css"),
      filename: "theme.generated.css",
      theme: {
        color: ["color.*"],
        text: ["typography.*"],
        radius: ["rounded.*"],
        spacing: ["spacing.*"],
        shadow: ["shadow.*"],
      },
    }),
  ],
});
