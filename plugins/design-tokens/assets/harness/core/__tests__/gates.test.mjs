import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { editProblems, editedFile, gatesProblems, globToRegExp, isGitCommit, matchesAny } from "../gates.mjs";

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
      "lint needs files (globs) and command (the linter, which receives the edited files as its last arguments)",
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

describe("editProblems", () => {
  const gates = { lint: { files: ["src/**/*.tsx"], command: "eslint", strictEnv: { DESIGN_LINT_STRICT: "1" } }, sources: ["design-system/tokens/**/*.json", "DESIGN.md"], onSourceEdit: ["tokens:build", "tokens:check"] };
  const recorder = ({ lintStatus = 0, failing } = {}) => {
    const calls = [];
    return {
      calls,
      options: {
        root: "/repo",
        exists: (file) => file !== "src/deleted.tsx",
        runCommand: (command, env) => (calls.push({ command, env }), { status: lintStatus, output: "1:1 error design/no-raw-color" }),
        runCommands: (commands) => (calls.push({ commands }), failing ? { command: failing, output: "3 problems" } : undefined),
      },
    };
  };

  it("lints the files in lint.files that still exist, in one call with the strict environment", () => {
    const { calls, options } = recorder();
    assert.equal(editProblems(["src/a.tsx", "src/b.tsx", "src/deleted.tsx", "README.md"], gates, options), undefined);
    assert.deepEqual(calls, [{ command: 'eslint "src/a.tsx" "src/b.tsx"', env: { DESIGN_LINT_STRICT: "1" } }]);
  });

  it("runs onSourceEdit once however many sources changed", () => {
    const { calls, options } = recorder();
    editProblems(["DESIGN.md", "design-system/tokens/semantic/colors.tokens.json"], gates, options);
    assert.deepEqual(calls, [{ commands: ["tokens:build", "tokens:check"] }]);
  });

  it("returns the lint failure, and the source failure, as the message the agent reads", () => {
    assert.match(editProblems(["src/a.tsx"], gates, recorder({ lintStatus: 1 }).options), /^The design lint failed for src\/a\.tsx:\n1:1 error design\/no-raw-color/);
    assert.match(editProblems(["DESIGN.md"], gates, recorder({ failing: "tokens:check" }).options), /^After editing DESIGN\.md, `tokens:check` failed:\n3 problems/);
  });

  it("runs nothing for files no gate covers", () => {
    const { calls, options } = recorder();
    assert.equal(editProblems(["README.md", "src/deleted.tsx"], gates, options), undefined);
    assert.deepEqual(calls, []);
  });
});
