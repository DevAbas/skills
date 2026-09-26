#!/usr/bin/env node
// Runs one stage of design-system/gates.json outside an agent: the git
// pre-commit hook and CI call it, so a person, an agent and CI pass the same
// gates.
//
//   node .claude/hooks/design-tokens/run-gates.mjs before-commit
//   node .claude/hooks/design-tokens/run-gates.mjs on-source-edit

import { readGates, runAll } from "./gates.mjs";

const STAGES = { "before-commit": "beforeCommit", "on-source-edit": "onSourceEdit" };
const stage = process.argv[2];
if (!(stage in STAGES)) {
  console.error(`usage: run-gates.mjs ${Object.keys(STAGES).join(" | ")}`);
  process.exit(2);
}
const commands = readGates()[STAGES[stage]] ?? [];
const failure = runAll(commands, { DESIGN_LINT_STRICT: "1" });
if (failure) {
  console.error(`\`${failure.command}\` failed:\n${failure.output}`);
  process.exit(1);
}
console.log(`design-tokens gates (${stage}): ${commands.length} passed`);
