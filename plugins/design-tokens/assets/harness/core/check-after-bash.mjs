// PostToolUse, Bash: the files a shell command changed (`sed -i`, a heredoc, a
// script) get the checks an Edit or Write gets in check-on-edit.mjs, so an
// agent cannot step around them by editing through the shell.
//
// Claude Code lists the changed files in `tool_response.bashEditDiff`
// (https://code.claude.com/docs/en/hooks, Bash; v2.1.269 or later). It records
// them in auto and bypassPermissions mode, and in every mode when the person's
// own settings set `bashEditDiffEnabled: true`; a project's .claude/settings.json
// cannot turn it on (settings reference, bashEditDiffEnabled). The docs call the
// list best effort and a public beta, for finding what to review, not for
// enforcing a policy. That is this hook's job: it reports, and the commit gate
// enforces. With no list, it passes.
//
// A generated output that a command rewrote is not checked here: the build
// writes it legitimately. The commit gate's staleness check catches a hand edit.

import { bashChangedFiles, block, editProblems, hookInput, readGates } from "./gates.mjs";

const files = bashChangedFiles(hookInput());
if (files.length === 0) process.exit(0);
const problem = editProblems(files, readGates());
if (problem) block(problem);
process.exit(0);
