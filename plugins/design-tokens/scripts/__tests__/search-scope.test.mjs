import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { outsideSearch, searchStarts, simpleCommands } from "../search-scope.mjs";

const context = { roots: ["/Users/me/app", "/Users/me/.claude/plugins/cache/x/design-tokens/0.2.1", "/tmp", "/private/tmp"], home: "/Users/me", cwd: "/Users/me/app" };
const bash = (command) => outsideSearch("Bash", { command }, context);

describe("simpleCommands", () => {
  it("splits at operators and keeps quoted words whole", () => {
    assert.deepEqual(simpleCommands(`ls; find . -name "a b.png" && grep -r 'x|y' src | head`), [["ls"], ["find", ".", "-name", "a b.png"], ["grep", "-r", "x|y", "src"], ["head"]]);
  });
});

describe("searchStarts", () => {
  it("reads find paths up to the first expression", () => {
    assert.deepEqual(searchStarts("find / ~/x -name y -mmin -10").map((start) => start.path), ["/", "~/x"]);
    assert.deepEqual(searchStarts("find -name y").map((start) => start.path), ["."]);
  });

  it("ignores grep without recursion, and skips the pattern", () => {
    assert.deepEqual(searchStarts("grep foo /etc/hosts"), []);
    assert.deepEqual(searchStarts("grep -rn foo src app").map((start) => start.path), ["src", "app"]);
    assert.deepEqual(searchStarts("grep -r -e foo /Users").map((start) => start.path), ["/Users"]);
  });
});

describe("outsideSearch", () => {
  it("blocks searches that start outside the project", () => {
    for (const command of ['find / -name "discover.png" -mmin -10', "find ~ -name x", "find $HOME/Downloads", "grep -r foo /Users/me", "rg foo ~", "fd png /", "ls -R ~", "mdfind discover.png", "cd / && find . -name x", "npm test; find /Users -name y"]) {
      assert.ok(bash(command), command);
    }
    assert.ok(outsideSearch("Glob", { pattern: "**/*.png", path: "/" }, context));
    assert.ok(outsideSearch("Grep", { pattern: "x", path: "/Users/me/Documents" }, context));
  });

  it("allows searches in the project, the plugin and the scratchpad", () => {
    for (const command of ["find . -name x", "find src -type f", "grep -rn foo src", "rg foo", "find /tmp/claude/scratchpad -name y", "find /Users/me/.claude/plugins/cache/x/design-tokens/0.2.1/references -name '*.md'", "cd src && find . -name z"]) {
      assert.equal(bash(command), undefined, command);
    }
    assert.equal(outsideSearch("Glob", { pattern: "**/*.tsx" }, context), undefined);
    assert.equal(outsideSearch("Grep", { pattern: "x", path: "src" }, context), undefined);
  });

  it("never blocks reading or listing one path", () => {
    for (const command of ["ls ~/Downloads/file.png", "cat /etc/hosts", "grep foo /etc/hosts", "head -5 ~/Desktop/notes.txt"]) {
      assert.equal(bash(command), undefined, command);
    }
  });

  it("does not treat a folder that only shares a prefix as inside", () => {
    assert.ok(bash("find /Users/me/app-old -name x"));
  });
});

describe("the hook", () => {
  const script = fileURLToPath(new URL("../search-scope.mjs", import.meta.url));
  const run = (input, args = []) => spawnSync(process.execPath, [script, ...args], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: "/Users/me/app" } });

  it("exits 2 with the reason for a search outside the project, 0 otherwise", () => {
    const blocked = run({ tool_name: "Bash", tool_input: { command: "find / -name x" }, cwd: "/Users/me/app" });
    assert.equal(blocked.status, 2);
    assert.match(blocked.stderr, /Search only the project/);
    assert.equal(run({ tool_name: "Bash", tool_input: { command: "find . -name x" }, cwd: "/Users/me/app" }).status, 0);
  });

  it("with --auditor-only, acts only for the auditor subagent", () => {
    const outside = { tool_name: "Grep", tool_input: { pattern: "x", path: "/Users/me/Documents" }, cwd: "/Users/me/app" };
    assert.equal(run(outside, ["--auditor-only"]).status, 0);
    assert.equal(run({ ...outside, agent_type: "design-tokens:token-auditor" }, ["--auditor-only"]).status, 2);
  });
});
