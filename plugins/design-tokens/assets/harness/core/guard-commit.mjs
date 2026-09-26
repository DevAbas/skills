// PreToolUse, Bash: an agent's `git commit` runs the `beforeCommit` commands
// of design-system/gates.json first, and is refused when any fails. Any other
// command passes at once. A person's commit runs the same commands through
// the git pre-commit hook (run-gates.mjs before-commit).

import { block, hookInput, isGitCommit, readGates, runAll } from "./gates.mjs";

if (!isGitCommit(hookInput().tool_input?.command)) process.exit(0);
const failure = runAll(readGates().beforeCommit, { DESIGN_LINT_STRICT: "1" });
if (failure) block(`Commit refused: \`${failure.command}\` failed.\n${failure.output}`);
process.exit(0);
