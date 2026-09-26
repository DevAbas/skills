import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { derivedRuleOf, ruleCss, tierProblems } from "../check-tokens.mjs";
import { TOKEN_DEFAULTS } from "../project-modules.mjs";

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

describe("ruleCss", () => {
  it("writes a relative OKLCH colour or a color-mix", () => {
    assert.equal(ruleCss(hoverRule, () => "#00aa88"), "oklch(from #00aa88 calc(l - 0.07) c h)");
    assert.equal(ruleCss({ kind: "mix", from: "a", weight: 0.6, over: "b" }, (role) => (role === "a" ? "#111111" : "#ffffff")), "color-mix(in srgb, #111111 60%, #ffffff)");
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
