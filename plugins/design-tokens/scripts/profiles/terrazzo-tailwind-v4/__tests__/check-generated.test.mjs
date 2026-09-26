import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comparable, emptyOutputs, staleOutputs } from "../check-generated.mjs";

describe("emptyOutputs", () => {
  it("names an output without a single custom property: a @tz that matched no context", () => {
    assert.deepEqual(emptyOutputs({ "theme.generated.css": "/* header */\n@theme {\n}\n", "tokens.generated.css": ":root {\n  --color-surface: #fff;\n}" }), ["theme.generated.css"]);
  });

  it("passes outputs that declare tokens", () => {
    assert.deepEqual(emptyOutputs({ "theme.generated.css": "@theme { --text-body--line-height: 1.5; }" }), []);
  });
});

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
