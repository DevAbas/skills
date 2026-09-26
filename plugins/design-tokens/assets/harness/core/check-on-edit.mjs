// PostToolUse, Edit|Write: the file an agent just wrote is checked at once, so
// a value outside the tokens comes back as the next thing the agent reads
// instead of at commit time.
//
// - A file in `lint.files` is linted with `lint.command`, the design rules as
//   errors (`lint.strictEnv`).
// - A file in `sources` (the tokens, the rules document, the build's template
//   and config) runs `onSourceEdit`: the token checks and the staleness check.
//
// Exit 2 feeds the failure back to the agent.

import { block, editedFile, hookInput, matchesAny, readGates, run, runAll } from "./gates.mjs";

const file = editedFile(hookInput());
if (file === undefined) process.exit(0);
const gates = readGates();

if (gates.lint && matchesAny(file, gates.lint.files)) {
  const result = run(`${gates.lint.command} ${JSON.stringify(file)}`, gates.lint.strictEnv ?? {});
  if (result.status !== 0) block(`The design lint failed for ${file}:\n${result.output}`);
}

if (matchesAny(file, gates.sources)) {
  const failure = runAll(gates.onSourceEdit);
  if (failure) block(`After editing ${file}, \`${failure.command}\` failed:\n${failure.output}\nValues live in the token files; rebuild the outputs instead of editing them.`);
}
process.exit(0);
