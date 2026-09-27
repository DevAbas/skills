// PostToolUse, Edit|Write: the file an agent just wrote is checked at once, so
// a value outside the tokens comes back as the next thing the agent reads
// instead of at commit time.
//
// - A file in `lint.files` is linted with `lint.command`, the design rules as
//   errors (`lint.strictEnv`).
// - A file in `sources` (the tokens, the rules document, the build's template
//   and config) runs `onSourceEdit`: the token checks and the staleness check.
//
// Exit 2 feeds the failure back to the agent. The edit has already been
// written: the hook reports it, and the commit gate is what enforces.
// check-after-bash.mjs gives a Bash command's edits the same checks.

import { block, editProblems, editedFile, hookInput, readGates } from "./gates.mjs";

const file = editedFile(hookInput());
if (file === undefined) process.exit(0);
const problem = editProblems([file], readGates());
if (problem) block(problem);
process.exit(0);
