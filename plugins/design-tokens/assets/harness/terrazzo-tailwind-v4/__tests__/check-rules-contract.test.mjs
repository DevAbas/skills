import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contractProblems, frontMatterText } from "../check-rules-contract.mjs";
import { TOKEN_DEFAULTS } from "../project-modules.mjs";

const tokenIds = new Set(["color.surface", "color.on-surface", "typography.body-md", "rounded.md", "palette.gray-1"]);
const valid = {
  version: "alpha",
  name: "App",
  imports: "./tokens/design.resolver.json",
  components: { page: { backgroundColor: "{color.surface}", textColor: "{color.on-surface}", typography: "{typography.body-md}", rounded: "{rounded.md}" } },
};

describe("frontMatterText", () => {
  it("returns the YAML between the fences, or undefined", () => {
    assert.equal(frontMatterText("---\nname: A\n---\n# A"), "name: A");
    assert.equal(frontMatterText("# A\n"), undefined);
  });
});

describe("contractProblems", () => {
  it("passes a document that holds no values and names existing roles", () => {
    assert.deepEqual(contractProblems(valid, tokenIds, TOKEN_DEFAULTS), []);
  });

  it("refuses values in the front matter and an import of anything but the resolver", () => {
    const front = { ...valid, colors: { primary: "#00aa88" }, imports: "./tokens.json" };
    assert.deepEqual(contractProblems(front, tokenIds, TOKEN_DEFAULTS), [
      "docs/rules-hold-no-values: the front matter holds `colors:`; values live in the token files it imports, the rules document holds rules",
      "docs/rules-reference-existing-tokens: `imports:` is ./tokens.json; it names the tokens at ./tokens/design.resolver.json",
    ]);
  });

  it("refuses a component that states a value, reads the palette or another group, or names a missing token", () => {
    const front = { ...valid, components: { card: { backgroundColor: "#ffffff", textColor: "{palette.gray-1}", typography: "{typography.huge}", rounded: "{spacing.md}" } } };
    assert.deepEqual(contractProblems(front, tokenIds, TOKEN_DEFAULTS), [
      'tiers/components-read-roles: components.card.backgroundColor is "#ffffff"; a component names a token ({group.name}), it does not state a value',
      "tiers/components-read-roles: components.card.textColor reads the palette entry gray-1; components read roles",
      "docs/rules-reference-existing-tokens: components.card.typography names {typography.huge}, which the tokens do not define",
      "tiers/components-read-roles: components.card.rounded reads spacing.*; a component reads color, typography, rounded",
    ]);
  });
});
