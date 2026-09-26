import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { editedFile, gatesProblems, globToRegExp, isGitCommit, matchesAny } from "../gates.mjs";

describe("globToRegExp", () => {
  it("lets ** span folders, including none", () => {
    assert.ok(matchesAny("tokens/a.json", ["tokens/**/*.json"]));
    assert.ok(matchesAny("tokens/themes/dark.tokens.json", ["tokens/**/*.json"]));
    assert.ok(matchesAny("src/styles/deep/x.css", ["src/**"]));
  });

  it("keeps * and ? inside one folder", () => {
    assert.ok(matchesAny("src/styles/theme.generated.css", ["src/styles/*.generated.css"]));
    assert.ok(!matchesAny("src/styles/old/theme.generated.css", ["src/styles/*.generated.css"]));
    assert.ok(matchesAny("a1.css", ["a?.css"]));
    assert.ok(!matchesAny("a/1.css", ["a?.css"]));
  });

  it("expands {a,b} and escapes dots", () => {
    assert.ok(matchesAny("src/Card.tsx", ["src/**/*.{ts,tsx}"]));
    assert.ok(!matchesAny("src/Card.jsx", ["src/**/*.{ts,tsx}"]));
    assert.ok(!matchesAny("DESIGNxmd", ["DESIGN.md"]));
    assert.equal(globToRegExp("DESIGN.md").test("DESIGN.md"), true);
  });
});

describe("isGitCommit", () => {
  it("finds a commit at the start, after an operator, or with -c options", () => {
    assert.ok(isGitCommit("git commit -m 'x'"));
    assert.ok(isGitCommit("npm test && git commit -am x"));
    assert.ok(isGitCommit("git -c user.name=a commit -m x"));
  });

  it("ignores other git commands and the words inside a message", () => {
    assert.ok(!isGitCommit("git status"));
    assert.ok(!isGitCommit('echo "run git commit later"'));
    assert.ok(!isGitCommit("git log --grep=commit"));
    assert.ok(!isGitCommit(undefined));
  });
});

describe("gatesProblems", () => {
  it("accepts the example config", async () => {
    const { readFileSync } = await import("node:fs");
    const example = JSON.parse(readFileSync(new URL("../design-tokens.gates.json", import.meta.url), "utf8"));
    assert.deepEqual(gatesProblems(example), []);
  });

  it("refuses wrong shapes, and sources that run nothing", () => {
    assert.deepEqual(gatesProblems({ generated: "a.css", lint: { files: ["x"] }, sources: ["tokens/**"] }), [
      "generated must be a list of non-empty strings",
      "lint needs files (globs) and command (the linter, which receives the edited file as its last argument)",
      "sources is set but onSourceEdit runs nothing",
    ]);
    assert.deepEqual(gatesProblems(null), ["design-system/gates.json is not a JSON object"]);
  });
});

describe("editedFile", () => {
  it("makes the tool's path relative to the root", () => {
    assert.equal(editedFile({ tool_input: { file_path: "/repo/src/a.tsx" } }, "/repo"), "src/a.tsx");
    assert.equal(editedFile({ tool_input: {} }, "/repo"), undefined);
  });
});
