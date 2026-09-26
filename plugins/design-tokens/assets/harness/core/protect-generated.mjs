// PreToolUse, Edit|Write: a file the token build generates is never edited by
// hand. The edit is denied with the reason, through the JSON decision the
// hooks reference documents for PreToolUse
// (https://code.claude.com/docs/en/hooks). The generated files are the
// `generated` globs of design-system/gates.json.

import { editedFile, hookInput, matchesAny, readGates } from "./gates.mjs";

const file = editedFile(hookInput());
if (file === undefined) process.exit(0);
const gates = readGates();
if (matchesAny(file, gates.generated)) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `${file} is generated from the design tokens. Change the token files (or the build's template), then rebuild: ${gates.onSourceEdit?.[0] ?? "the token build"}.`,
      },
    }),
  );
}
process.exit(0);
