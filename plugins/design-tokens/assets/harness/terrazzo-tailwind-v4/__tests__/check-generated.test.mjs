import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comparable, staleOutputs } from "../check-generated.mjs";

describe("staleOutputs", () => {
  it("ignores only the header line that names the template's path", () => {
    const fresh = { "theme.generated.css": "/*\n *  template: ../../tmp/x/theme.template.css\n */\n@theme { --color-surface: #fff; }" };
    const committed = { "theme.generated.css": "/*\n *  template: ./theme.template.css\n */\n@theme { --color-surface: #fff; }" };
    assert.deepEqual(staleOutputs(fresh, committed), []);
    assert.equal(comparable("a\n *  template: x\nb"), "a\n\nb");
  });

  it("names an output whose content differs, and one that is missing", () => {
    const fresh = { "tokens.generated.css": ":root { --a: 1; }", "theme.generated.css": "@theme {}" };
    assert.deepEqual(staleOutputs(fresh, { "tokens.generated.css": ":root { --a: 2; }" }), ["tokens.generated.css", "theme.generated.css"]);
  });
});
