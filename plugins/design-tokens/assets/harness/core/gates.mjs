// What the design-token gates share: the project's gates config
// (design-system/gates.json; design-tokens.gates.json at the root before 0.4.0),
// glob matching, the hook's
// JSON input, and running a command. Copied into a project by
// /design-tokens:harness; the config, not this file, is what a project edits.
//
// Claude Code hooks read exit code 2 as "blocked", and feed stderr back to the
// agent (https://code.claude.com/docs/en/hooks). No dependencies, Node 20 or
// later.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const CONFIG_FILES = ["design-system/gates.json", "design-tokens.gates.json"];
export const CONFIG_FILE = CONFIG_FILES[0];

/**
 * A glob as a regular expression over a relative, forward-slash path:
 * `**` spans folders, `*` and `?` stay within one, `{a,b}` is either.
 * @param {string} glob
 */
export function globToRegExp(glob) {
  let pattern = "";
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === "*" && glob[i + 1] === "*") {
      // `**/` matches zero or more folders; a trailing `**` matches the rest.
      if (glob[i + 2] === "/") {
        pattern += "(?:.*/)?";
        i += 2;
      } else {
        pattern += ".*";
        i += 1;
      }
    } else if (char === "*") pattern += "[^/]*";
    else if (char === "?") pattern += "[^/]";
    else if (char === "{") {
      const close = glob.indexOf("}", i);
      if (close === -1) pattern += "\\{";
      else {
        pattern += `(?:${glob.slice(i + 1, close).split(",").map((option) => option.replace(/[.+^$()|[\]\\]/g, "\\$&")).join("|")})`;
        i = close;
      }
    } else pattern += char.replace(/[.+^$()|[\]\\{}]/g, "\\$&");
  }
  return new RegExp(`^${pattern}$`);
}

/** True when `file` (relative, forward slashes) matches any of the globs. */
export function matchesAny(file, globs = []) {
  return globs.some((glob) => globToRegExp(glob).test(file));
}

/** True when a shell command runs `git commit`: at the start, or after `;`, `&&`, `||` or a pipe. */
export function isGitCommit(command) {
  return typeof command === "string" && /(^|[;&|]\s*|\n\s*)git(\s+-[cC]\s+\S+)*\s+commit\b/.test(command);
}

/**
 * Where a gates config breaks its shape, as one sentence each; empty when it holds.
 * @param {unknown} config
 */
export function gatesProblems(config) {
  const problems = [];
  if (!config || typeof config !== "object") return [`${CONFIG_FILE} is not a JSON object`];
  const c = /** @type {Record<string, any>} */ (config);
  const list = (key) => {
    if (c[key] === undefined) return;
    if (!Array.isArray(c[key]) || c[key].some((item) => typeof item !== "string" || !item.trim())) problems.push(`${key} must be a list of non-empty strings`);
  };
  for (const key of ["generated", "sources", "onSourceEdit", "beforeCommit"]) list(key);
  if (c.lint !== undefined) {
    if (!Array.isArray(c.lint?.files) || typeof c.lint?.command !== "string") problems.push("lint needs files (globs) and command (the linter, which receives the edited file as its last argument)");
    if (c.lint?.strictEnv !== undefined && (typeof c.lint.strictEnv !== "object" || Object.values(c.lint.strictEnv).some((value) => typeof value !== "string"))) problems.push("lint.strictEnv must map variable names to strings");
  }
  if ((c.sources?.length ?? 0) > 0 && (c.onSourceEdit?.length ?? 0) === 0) problems.push("sources is set but onSourceEdit runs nothing");
  return problems;
}

/** The project's gates config; throws with every problem when it is malformed. */
export function readGates(root = process.cwd()) {
  const file = CONFIG_FILES.find((candidate) => existsSync(join(root, candidate)));
  if (!file) throw new Error(`no gates config: write ${CONFIG_FILE} (references/conventions.md)`);
  const config = JSON.parse(readFileSync(join(root, file), "utf8"));
  const problems = gatesProblems(config);
  if (problems.length > 0) throw new Error(`${file}:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
  return config;
}

/** The hook's JSON input from stdin; `{}` when stdin is empty. */
export function hookInput() {
  const raw = readFileSync(0, "utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

/** The edited file relative to `root`, forward slashes; undefined when the tool call has none. */
export function editedFile(input, root = process.cwd()) {
  const file = input?.tool_input?.file_path;
  if (typeof file !== "string" || !file) return undefined;
  return relative(root, resolve(root, file)).split("\\").join("/");
}

/** Runs a shell command at `root`, the project's node_modules/.bin first on PATH. */
export function run(command, env = {}, root = process.cwd()) {
  const result = spawnSync(command, {
    shell: true,
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: `${resolve(root, "node_modules/.bin")}:${process.env.PATH ?? ""}`, ...env },
  });
  return { status: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

/** Runs commands in order; the first failure, or undefined when all pass. */
export function runAll(commands = [], env = {}, root = process.cwd()) {
  for (const command of commands) {
    const result = run(command, env, root);
    if (result.status !== 0) return { command, output: result.output };
  }
  return undefined;
}

/** Blocks the action: the message reaches the agent as the reason. */
export function block(message) {
  process.stderr.write(`${message.trimEnd()}\n`);
  process.exit(2);
}
