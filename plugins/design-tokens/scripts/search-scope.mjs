#!/usr/bin/env node
// A PreToolUse hook that keeps the plugin's searches inside the project. The
// skills register it in their frontmatter, so it runs for the rest of a
// session in which one of them was invoked. hooks/hooks.json also registers
// it with --auditor-only, for the read-only auditor subagent, since plugin
// agents cannot carry their own hooks. With that flag it acts only when the
// tool call comes from design-tokens:token-auditor.
//
// It blocks a search whose start is outside the allowed places:
// - a Bash `find`, recursive `grep`, `rg`, `fd`, `ls -R`, `mdfind` or `locate`;
// - a Glob or Grep tool call.
// The allowed places are the project, the plugin's files, and the temporary
// folders that hold the session scratchpad.
//
// Reading one file, or listing one folder, is not a search and passes. Why:
// an agent that could not find a tool's output once ran `find /`, and macOS
// asked for access to Downloads, Desktop, Documents and iCloud Drive.
// Exit 2 blocks the call and hands the reason back to the agent
// (https://code.claude.com/docs/en/hooks). No dependencies, Node 20 or later.

import { readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const AUDITOR = "token-auditor";

/** Splits a shell command into simple commands at `;`, `&&`, `||`, `|` and newlines, and each into words, honouring quotes. */
export function simpleCommands(command) {
  const commands = [];
  let words = [];
  let word = "";
  let quote = null;
  const endWord = () => {
    if (word !== "") words.push(word);
    word = "";
  };
  const endCommand = () => {
    endWord();
    if (words.length > 0) commands.push(words);
    words = [];
  };
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (quote) {
      if (char === quote) quote = null;
      else word += char;
    } else if (char === "'" || char === '"') quote = char;
    else if (char === "\\" && i + 1 < command.length) word += command[++i];
    else if (char === ";" || char === "\n" || char === "|" || char === "&") {
      endCommand();
      if ((char === "&" || char === "|") && command[i + 1] === char) i++;
    } else if (char === " " || char === "\t") endWord();
    else word += char;
  }
  endCommand();
  return commands;
}

/** A path as the shell would read it: `~` and `$HOME` expanded, relative paths resolved against `cwd`. */
export function expandPath(path, { home, cwd }) {
  let expanded = path;
  if (expanded === "~" || expanded.startsWith("~/")) expanded = home + expanded.slice(1);
  expanded = expanded.replace(/^\$\{?HOME\}?(?=\/|$)/, home);
  return isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
}

const isFlag = (word) => word.startsWith("-");

/**
 * Where each search in a command starts, before expansion; `null` for a tool that always searches the whole disk.
 * `cd` changes the directory the later searches start from. Words after `--` are paths.
 */
export function searchStarts(command) {
  const starts = [];
  let dir = null;
  for (let words of simpleCommands(command)) {
    while (words.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words = words.slice(1);
    if (words[0] === "sudo" || words[0] === "command" || words[0] === "exec") words = words.slice(1);
    const [name, ...args] = words;
    if (!name) continue;
    const base = name.split("/").pop();
    const at = (paths) => starts.push(...(paths.length > 0 ? paths : ["."]).map((path) => ({ path, dir })));
    if (base === "cd") {
      dir = args[0] ?? "~";
    } else if (base === "mdfind" || base === "locate") {
      starts.push({ path: null, dir });
    } else if (base === "find") {
      const paths = [];
      for (const arg of args) {
        if (isFlag(arg) || arg === "(" || arg === "!") break;
        paths.push(arg);
      }
      at(paths);
    } else if (base === "grep" || base === "egrep" || base === "fgrep") {
      const recursive = args.some((arg) => arg === "--recursive" || arg === "--dereference-recursive" || /^-[A-Za-z]*[rR]/.test(arg));
      if (!recursive) continue;
      const explicitPattern = args.some((arg) => arg === "-e" || arg === "-f" || /^--(regexp|file)=/.test(arg));
      const operands = args.filter((arg, index) => !isFlag(arg) && !["-e", "-f", "--include", "--exclude", "-m", "-A", "-B", "-C"].includes(args[index - 1]));
      at(explicitPattern ? operands : operands.slice(1));
    } else if (base === "rg" || base === "fd") {
      const operands = args.filter((arg, index) => !isFlag(arg) && !["-g", "--glob", "-t", "--type", "-e", "--extension", "-m", "--max-count"].includes(args[index - 1]));
      at(operands.slice(1));
    } else if (base === "ls") {
      if (!args.some((arg) => /^-[A-Za-z]*R/.test(arg) || arg === "--recursive")) continue;
      at(args.filter((arg) => !isFlag(arg)));
    }
  }
  return starts;
}

/** True when `path` is one of `roots` or inside one. */
export function isInside(path, roots) {
  return roots.some((root) => path === root || path.startsWith(root.endsWith(sep) ? root : root + sep));
}

/**
 * Why a tool call searches outside the allowed places, or undefined when it does not.
 * @param {string} toolName `Bash`, `Glob` or `Grep`
 * @param {Record<string, unknown>} toolInput
 * @param {{ roots: string[], home: string, cwd: string }} context
 */
export function outsideSearch(toolName, toolInput, { roots, home, cwd }) {
  const outside = (path) => !isInside(path, roots);
  if (toolName === "Glob" || toolName === "Grep") {
    const path = expandPath(typeof toolInput?.path === "string" && toolInput.path ? toolInput.path : ".", { home, cwd });
    return outside(path) ? `${toolName} searches ${path}` : undefined;
  }
  if (toolName === "Bash" && typeof toolInput?.command === "string") {
    for (const start of searchStarts(toolInput.command)) {
      if (start.path === null) return "the command searches the whole disk";
      const base = start.dir === null ? cwd : expandPath(start.dir, { home, cwd });
      const path = expandPath(start.path, { home, cwd: base });
      if (outside(path)) return `the command searches ${path}`;
    }
  }
  return undefined;
}

function main(argv) {
  let input;
  try {
    const raw = readFileSync(0, "utf8").trim();
    input = raw ? JSON.parse(raw) : {};
  } catch {
    return 0;
  }
  if (argv.includes("--auditor-only") && !String(input.agent_type ?? "").endsWith(AUDITOR)) return 0;
  const home = homedir();
  const cwd = typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  const project = process.env.CLAUDE_PROJECT_DIR || cwd;
  const roots = [project, process.env.CLAUDE_PLUGIN_ROOT, "/tmp", "/private/tmp", tmpdir(), process.env.TMPDIR]
    .filter(Boolean)
    .map((root) => resolve(root));
  const reason = outsideSearch(input.tool_name, input.tool_input, { roots, home, cwd });
  if (!reason) return 0;
  process.stderr.write(
    `Blocked by design-tokens: ${reason}, outside the project. Search only the project (${project}), the plugin's files and the session scratchpad. To find where a tool writes its output, read its config, script or documentation instead of searching the disk.\n`,
  );
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
