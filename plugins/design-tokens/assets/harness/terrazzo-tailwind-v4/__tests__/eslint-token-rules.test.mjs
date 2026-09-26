import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declaredVariables, hasRawColor, judgeClass, parseClass, parseThemeTokens } from "../eslint-token-rules.mjs";

const theme = parseThemeTokens(`
@theme { --color-*: initial; }
@theme {
  --color-surface: #fff;
  --color-on-surface: #111;
  --text-body-md: 1rem;
  --text-body-md--line-height: 1.5;
  --radius-md: 0.5rem;
  --shadow-raised: 0 1px 2px #0002;
}`);
const tokens = { theme, variables: new Set(["color-surface", "motion-duration-short", "palette-gray-9"]), palette: "palette" };
const verdict = (raw) => {
  const parsed = parseClass(raw);
  return judgeClass(parsed.base, tokens, parsed.modifier)?.messageId;
};

describe("parseThemeTokens", () => {
  it("registers each namespace's names and skips a reset", () => {
    assert.deepEqual([...theme.get("color")], ["surface", "on-surface"]);
    assert.deepEqual([...theme.get("text")], ["body-md", "body-md--line-height"]);
  });
});

describe("parseClass", () => {
  it("splits variants, keeps colons inside brackets, and reads the modifier", () => {
    assert.deepEqual(parseClass("dark:hover:bg-surface/50"), { raw: "dark:hover:bg-surface/50", variants: ["dark", "hover"], base: "bg-surface", modifier: "50" });
    assert.equal(parseClass("[&:hover]:text-[color:var(--color-surface)]").base, "text-[color:var(--color-surface)]");
    assert.equal(parseClass("!-mt-2").base, "mt-2");
  });
});

describe("judgeClass", () => {
  it("accepts tokens, static keywords, layout utilities and token variables", () => {
    for (const raw of ["bg-surface", "text-on-surface", "text-body-md", "rounded-md", "shadow-raised", "text-center", "border-b", "ring-2", "bg-linear-to-b", "p-4", "grid-cols-3", "duration-(--motion-duration-short)", "bg-[var(--color-surface)]", "leading-(--text-body-md--line-height)"]) {
      assert.equal(verdict(raw), undefined, raw);
    }
  });

  it("refuses unknown tokens, Tailwind defaults and bare utilities", () => {
    assert.equal(verdict("bg-red-500"), "unknownToken");
    assert.equal(verdict("text-body-md--line-height"), "unknownToken");
    assert.equal(verdict("rounded"), "bareUtility");
    assert.equal(verdict("shadow"), "bareUtility");
  });

  it("refuses arbitrary values, modifiers and the palette", () => {
    assert.equal(verdict("text-[13px]"), "arbitraryValue");
    assert.equal(verdict("bg-[#ffffff]"), "arbitraryValue");
    assert.equal(verdict("bg-surface/60"), "modifier");
    assert.equal(verdict("text-(--palette-gray-9)"), "paletteReference");
    assert.equal(verdict("bg-[var(--palette-gray-9)]"), "paletteReference");
  });
});

describe("hasRawColor", () => {
  it("finds hex values and colour functions with literal channels", () => {
    for (const text of ["#fff", "color: #1a2b3c80", "rgb(1 2 3)", "oklch(0.5 0.1 200)", "color-mix(in srgb, red 50%, blue)"]) assert.ok(hasRawColor(text), text);
  });

  it("ignores ids, entities and colours built from variables", () => {
    for (const text of ["#main", "&#123;", "rgb(\u0000, \u0000, \u0000)", "var(--color-surface)"]) assert.ok(!hasRawColor(text), text);
  });
});

describe("declaredVariables", () => {
  it("lists declared custom properties, not their uses", () => {
    assert.deepEqual([...declaredVariables(":root{--a:1;--b-c: var(--a);}")], ["a", "b-c"]);
  });
});
