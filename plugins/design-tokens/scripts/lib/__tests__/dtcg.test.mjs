import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { loadResolver, loadTokenFiles, mergeTokens, pointer, resolveTokens } from "../dtcg.mjs";

const roots = [];
/** Writes JSON files into a fresh folder; returns the folder. */
function write(files) {
  const root = mkdtempSync(join(tmpdir(), "design-tokens-dtcg-"));
  roots.push(root);
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), typeof content === "string" ? content : JSON.stringify(content));
  }
  return root;
}
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const srgb = (hex) => ({ colorSpace: "srgb", components: [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255), hex });
const tokensOf = (files, input) => {
  const root = write(files);
  return resolveTokens(loadTokenFiles(Object.keys(files).map((file) => join(root, file))), input);
};

describe("pointer (RFC 6901)", () => {
  it("walks objects and arrays, and unescapes ~1 and ~0", () => {
    const document = { a: { "b/c": [10, { "d~e": 5 }] } };
    assert.equal(pointer(document, "#/a/b~1c/1/d~0e"), 5);
    assert.equal(pointer(document, "#/a/missing"), undefined);
  });
});

describe("mergeTokens (Resolver §6.2)", () => {
  it("merges groups key by key and replaces a token whole", () => {
    const merged = mergeTokens({ color: { $type: "color", a: { $value: srgb("#000000"), $description: "old" }, b: { $value: srgb("#111111") } } }, { color: { a: { $value: srgb("#ffffff") } } });
    assert.deepEqual(merged.color.a, { $value: srgb("#ffffff") });
    assert.ok(merged.color.b);
    assert.equal(merged.color.$type, "color");
  });
});

describe("resolveTokens: format", () => {
  it("inherits $type from the closest group, and follows alias chains", () => {
    const { tokens, problems } = tokensOf({
      "a.tokens.json": { color: { $type: "color", base: { $value: srgb("#00aa88") }, primary: { $value: "{color.base}" }, action: { $value: "{color.primary}" } } },
    });
    assert.deepEqual(problems, []);
    assert.equal(tokens["color.action"].$type, "color");
    assert.deepEqual(tokens["color.action"].$value, srgb("#00aa88"));
    assert.deepEqual(tokens["color.action"].aliasChain, ["color.primary", "color.base"]);
    assert.equal(tokens["color.action"].aliasOf, "color.base");
  });

  it("takes the type of an aliased token when the alias has none", () => {
    const { tokens } = tokensOf({ "a.tokens.json": { size: { base: { $type: "dimension", $value: { value: 4, unit: "px" } } }, other: { gap: { $value: "{size.base}" } } } });
    assert.equal(tokens["other.gap"].$type, "dimension");
  });

  it("resolves aliases inside composite values, and $ref pointers to a part of a value", () => {
    const { tokens, problems } = tokensOf({
      "a.tokens.json": {
        font: { sans: { $type: "fontFamily", $value: ["Inter", "sans-serif"] }, bold: { $type: "fontWeight", $value: 700 } },
        color: { $type: "color", blue: { $value: srgb("#0000ff") } },
        typography: { body: { $type: "typography", $value: { fontFamily: "{font.sans}", fontWeight: "{font.bold}", fontSize: { value: 16, unit: "px" }, lineHeight: 1.5, letterSpacing: { value: 0, unit: "px" } } } },
        number: { blueness: { $type: "number", $value: { $ref: "#/color/blue/$value/components/2" } } },
      },
    });
    assert.deepEqual(problems, []);
    assert.deepEqual(tokens["typography.body"].$value.fontFamily, ["Inter", "sans-serif"]);
    assert.equal(tokens["typography.body"].$value.fontWeight, 700);
    assert.equal(tokens["typography.body"].originalValue.$value.fontFamily, "{font.sans}");
    assert.equal(tokens["number.blueness"].$value, 1);
  });

  it("gives $root a token id of its own", () => {
    const { tokens } = tokensOf({ "a.tokens.json": { color: { $type: "color", accent: { $root: { $value: srgb("#00aa88") }, light: { $value: srgb("#88ffdd") } }, link: { $value: "{color.accent.$root}" } } } });
    assert.deepEqual(tokens["color.link"].aliasChain, ["color.accent.$root"]);
  });

  it("applies $extends as a deep merge with local overrides", () => {
    const { tokens, problems } = tokensOf({
      "a.tokens.json": {
        button: { $type: "color", background: { $value: srgb("#0000ff") }, text: { $value: srgb("#ffffff") } },
        danger: { $extends: "{button}", background: { $value: srgb("#ff0000") } },
      },
    });
    assert.deepEqual(problems, []);
    assert.deepEqual(tokens["danger.background"].$value, srgb("#ff0000"));
    assert.deepEqual(tokens["danger.text"].$value, srgb("#ffffff"));
    assert.equal(tokens["danger.text"].$type, "color");
  });

  it("reports cycles, aliases to groups or to nothing, missing types, bad names, and token-and-group objects", () => {
    const { problems } = tokensOf({
      "a.tokens.json": {
        color: { $type: "color", a: { $value: "{color.b}" }, b: { $value: "{color.a}" }, c: { $value: "{color}" }, d: { $value: "{color.nope}" } },
        loose: { $value: 4 },
        "bad.name": { $type: "number", $value: 1 },
        both: { $type: "number", $value: 1, child: { $value: 2 } },
        g1: { $extends: "{g2}" },
        g2: { $extends: "{g1}" },
      },
    });
    const has = (pattern) => assert.ok(problems.some((problem) => pattern.test(problem)), `${pattern} in:\n${problems.join("\n")}`);
    has(/circular alias: color\.[ab] → color\.[ab] → color\.[ab]/);
    has(/color\.c aliases \{color\}, which is a group, not a token/);
    has(/color\.d aliases \{color\.nope\}, which does not exist/);
    has(/loose has no \$type/);
    has(/bad\.name: a name must not contain/);
    has(/both has \$value and child tokens/);
    has(/circular \$extends/);
  });
});

describe("resolveTokens: resolver", () => {
  const resolverFiles = (modifiers, order) => ({
    "tokens/base.tokens.json": { color: { $type: "color", surface: { $value: srgb("#ffffff") }, ink: { $value: srgb("#111111") } } },
    "tokens/dark.tokens.json": { color: { surface: { $value: srgb("#111111") } } },
    "tokens/light.tokens.json": { color: { surface: { $value: srgb("#fcfcfc") } } },
    "tokens/design.resolver.json": { version: "2025.10", sets: { base: { sources: [{ $ref: "base.tokens.json" }] } }, modifiers, resolutionOrder: order },
  });
  const theme = { contexts: { light: [{ $ref: "light.tokens.json" }], dark: [{ $ref: "dark.tokens.json" }] }, default: "light" };
  const order = [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme" }];

  it("applies sets, then the chosen context, later sources winning", () => {
    const root = write(resolverFiles({ theme }, order));
    const source = loadResolver(join(root, "tokens/design.resolver.json"));
    assert.deepEqual(source.problems, []);
    assert.deepEqual(resolveTokens(source, { theme: "dark" }).tokens["color.surface"].$value, srgb("#111111"));
    assert.deepEqual(resolveTokens(source, {}).tokens["color.surface"].$value, srgb("#fcfcfc"));
    assert.deepEqual(resolveTokens(source, { theme: "dark" }).tokens["color.ink"].$value, srgb("#111111"));
  });

  it("validates the input (Resolver §6.1)", () => {
    const root = write(resolverFiles({ theme: { ...theme, default: undefined } }, order));
    const source = loadResolver(join(root, "tokens/design.resolver.json"));
    assert.match(resolveTokens(source, { mode: "x" }).problems.join("\n"), /modifier mode, which the resolver does not declare/);
    assert.match(resolveTokens(source, { theme: "sepia" }).problems.join("\n"), /"sepia" is not one of its contexts/);
    assert.match(resolveTokens(source, {}).problems.join("\n"), /modifier theme has no default/);
  });

  it("refuses a modifier with one context, a wrong version, and a remote reference", () => {
    const files = resolverFiles({ theme: { contexts: { dark: [{ $ref: "dark.tokens.json" }] } } }, [{ $ref: "#/sets/base" }, { $ref: "https://example.com/t.json" }]);
    files["tokens/design.resolver.json"].version = "2024";
    const root = write(files);
    const source = loadResolver(join(root, "tokens/design.resolver.json"));
    const problems = resolveTokens(source, {}).problems.join("\n");
    assert.match(problems, /modifier theme declares 1 context; a modifier needs two or more/);
    assert.match(problems, /version is "2024"/);
    assert.match(problems, /remote reference https:\/\/example.com\/t.json is not supported/);
  });

  it("follows a file fragment reference and reports a missing file", () => {
    const root = write({
      "tokens/all.tokens.json": { brand: { color: { $type: "color", accent: { $value: srgb("#00aa88") } } } },
      "tokens/design.resolver.json": { version: "2025.10", sets: { base: { sources: [{ $ref: "all.tokens.json#/brand" }, { $ref: "missing.tokens.json" }] } }, resolutionOrder: [{ $ref: "#/sets/base" }] },
    });
    const { tokens, problems } = resolveTokens(loadResolver(join(root, "tokens/design.resolver.json")), {});
    assert.ok(tokens["color.accent"]);
    assert.match(problems.join("\n"), /cannot read .*missing\.tokens\.json/);
  });
});
