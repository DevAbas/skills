import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { derivedRuleOf, readProjectTokens, tierProblems } from "../check-tokens.mjs";
import { TOKEN_DEFAULTS } from "../lib/project-modules.mjs";

const settings = { ...TOKEN_DEFAULTS, extensionKey: "com.example.design" };
const color = (hex, extra = {}) => ({ $type: "color", $value: { hex }, ...extra });
const derived = (hex, rule) => color(hex, { $extensions: { "com.example.design": { derived: rule } } });
const hoverRule = { kind: "lightness", from: "primary", lightness: -0.07 };

/** Two contexts that keep every rule; `derive` below returns what each rule "gives". */
function contexts() {
  const palette = { "palette.gray-1": color("#fcfcfc"), "palette.accent-9": color("#00aa88") };
  const context = (surfaceHex) => ({
    ...palette,
    "color.surface": color(surfaceHex, { aliasOf: "palette.gray-1", aliasChain: ["palette.gray-1"] }),
    "color.primary": color("#00aa88", { aliasOf: "palette.accent-9", aliasChain: ["palette.accent-9"] }),
    "color.primary-hover": derived("#008866", hoverRule),
    "typography.body": { $type: "typography", originalValue: { $value: { fontFamily: "{font.sans}", fontWeight: "{font.weight.400}" } } },
  });
  return { light: context("#fcfcfc"), dark: context("#111111") };
}
const derive = () => "#008866";

describe("derivedRuleOf", () => {
  it("reads both rule kinds under the project's key", () => {
    assert.deepEqual(derivedRuleOf({ k: { derived: hoverRule } }, "k"), hoverRule);
    assert.deepEqual(derivedRuleOf({ k: { derived: { kind: "mix", from: "a", weight: 0.6, over: "b" } } }, "k"), { kind: "mix", from: "a", weight: 0.6, over: "b" });
    assert.equal(derivedRuleOf({ other: { derived: hoverRule } }, "k"), undefined);
  });

  it("names a malformed rule instead of accepting it", () => {
    assert.match(derivedRuleOf({ k: { derived: { kind: "mix", from: "a", weight: 1.5, over: "b" } } }, "k"), /^malformed derived rule/);
    assert.match(derivedRuleOf({ k: { derived: { kind: "darken", from: "a" } } }, "k"), /^malformed derived rule/);
  });
});

describe("tierProblems", () => {
  it("passes tokens that keep every rule", () => {
    assert.deepEqual(tierProblems(contexts(), settings, derive), []);
  });

  it("refuses a palette alias, a role pointing to a role, and a literal role", () => {
    const tokens = contexts();
    tokens.light["palette.gray-1"] = color("#fcfcfc", { aliasOf: "palette.accent-9", aliasChain: ["palette.accent-9"] });
    tokens.dark["color.surface"] = color("#00aa88", { aliasOf: "palette.accent-9", aliasChain: ["color.primary", "palette.accent-9"] });
    tokens.dark["color.primary"] = color("#00aa88");
    assert.deepEqual(tierProblems(tokens, settings, derive), [
      "tiers/palette-literal: palette.gray-1 is an alias of palette.accent-9; the palette holds values only",
      "tiers/role-aliases-palette: dark: color.surface points to color.primary; a role points to the palette, or is derived by a recorded rule",
      "tiers/role-aliases-palette: dark: color.primary is a literal; a role points to the palette, or is derived by a recorded rule",
    ]);
  });

  it("refuses a derived value its rule does not give, and a rule reading a missing role", () => {
    const tokens = contexts();
    tokens.light["color.primary-hover"] = derived("#123456", hoverRule);
    tokens.dark["color.primary-hover"] = derived("#008866", { kind: "mix", from: "primary", weight: 0.5, over: "missing" });
    const problems = tierProblems(tokens, settings, derive);
    assert.ok(problems.includes("tiers/derived-rule-recorded: light: color.primary-hover is #123456, but its rule gives #008866"));
    assert.ok(problems.includes("tiers/derived-rule-recorded: dark: color.primary-hover derives from missing, which is not a role"));
    assert.ok(problems.includes("format/themes-complete: color.primary-hover is derived differently across light, dark"));
  });

  it("refuses a role missing from one context", () => {
    const tokens = contexts();
    delete tokens.dark["color.surface"];
    assert.deepEqual(tierProblems(tokens, settings, derive), ["format/themes-complete: color.surface is defined in light only"]);
  });

  it("refuses a text style with a literal family or weight", () => {
    const tokens = contexts();
    tokens.light["typography.body"].originalValue.$value.fontFamily = ["Inter", "sans-serif"];
    assert.deepEqual(tierProblems(tokens, settings, derive), ["tiers/styles-alias-foundation: typography.body.fontFamily is a literal; a text style takes its fontFamily from font.*"]);
  });
});

describe("readProjectTokens", () => {
  const write = (files) => {
    const root = mkdtempSync(join(tmpdir(), "design-tokens-check-"));
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), JSON.stringify(content));
    }
    return root;
  };
  const palette = { palette: { $type: "color", "gray-1": { $value: { colorSpace: "srgb", components: [0.99, 0.99, 0.99], hex: "#fcfcfc" } }, "gray-12": { $value: { colorSpace: "srgb", components: [0.07, 0.07, 0.07], hex: "#111111" } } } };
  const theme = (surface) => ({ color: { $type: "color", surface: { $value: `{palette.${surface}}` } } });

  it("resolves each context of the theme modifier, and the tier rules pass on them", () => {
    const root = write({
      "tokens/palette.tokens.json": palette,
      "tokens/light.tokens.json": theme("gray-1"),
      "tokens/dark.tokens.json": theme("gray-12"),
      "tokens/design.resolver.json": { version: "2025.10", sets: { base: { sources: [{ $ref: "palette.tokens.json" }] } }, modifiers: { theme: { contexts: { light: [{ $ref: "light.tokens.json" }], dark: [{ $ref: "dark.tokens.json" }] }, default: "light" } }, resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme" }] },
    });
    try {
      const { contexts, problems } = readProjectTokens(root, settings);
      assert.deepEqual(problems, []);
      assert.deepEqual(Object.keys(contexts), ["light", "dark"]);
      assert.deepEqual(contexts.dark["color.surface"].aliasChain, ["palette.gray-12"]);
      assert.deepEqual(tierProblems(contexts, settings), []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports a modifier with one context as format/dtcg-valid", () => {
    const root = write({
      "tokens/palette.tokens.json": palette,
      "tokens/dark.tokens.json": theme("gray-12"),
      "tokens/design.resolver.json": { version: "2025.10", sets: { base: { sources: [{ $ref: "palette.tokens.json" }] } }, modifiers: { theme: { contexts: { dark: [{ $ref: "dark.tokens.json" }] }, default: "dark" } }, resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme" }] },
    });
    try {
      const { problems } = readProjectTokens(root, settings);
      assert.ok(problems.some((problem) => problem.startsWith("format/dtcg-valid: modifier theme declares 1 context")), problems.join("\n"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("says where to point it when there is no resolver and no files", () => {
    const root = write({});
    try {
      assert.match(readProjectTokens(root, settings).problems[0], /no resolver at tokens\/design.resolver.json/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
