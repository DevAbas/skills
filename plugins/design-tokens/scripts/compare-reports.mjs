#!/usr/bin/env node
// Compares two audit reports by finding id: what a fix resolved, what is new,
// what is unchanged.
//
//   node compare-reports.mjs <before.json> <after.json>          Markdown summary
//   node compare-reports.mjs <before.json> <after.json> --json   the same as JSON
//
// A finding's id carries its rule and place and no line number, so the same
// problem keeps its id from one audit to the next (references/report.md).
// Exits 1 when the after report has a new error finding, so a fix that breaks
// something else does not pass as done. No dependencies, Node 20 or later.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { reportProblems } from "./render-report.mjs";

/**
 * @param {{ findings: { id: string }[] }} before
 * @param {{ findings: { id: string }[] }} after
 */
export function compareReports(before, after) {
  const beforeIds = new Map(before.findings.map((finding) => [finding.id, finding]));
  const afterIds = new Map(after.findings.map((finding) => [finding.id, finding]));
  return {
    resolved: [...beforeIds.values()].filter((finding) => !afterIds.has(finding.id)),
    new: [...afterIds.values()].filter((finding) => !beforeIds.has(finding.id)),
    unchanged: [...afterIds.values()].filter((finding) => beforeIds.has(finding.id)),
  };
}

/** The comparison as Markdown, one list per outcome. */
export function renderComparison(comparison, beforeName, afterName) {
  const lines = [`# Audit comparison`, "", `- Before: ${beforeName}`, `- After: ${afterName}`, ""];
  for (const [title, findings] of [["Resolved", comparison.resolved], ["New", comparison.new], ["Unchanged", comparison.unchanged]]) {
    lines.push(`## ${title} (${findings.length})`, "");
    if (findings.length === 0) lines.push("None.");
    for (const finding of findings) lines.push(`- ${finding.severity}: \`${finding.id}\`: ${finding.title}`);
    lines.push("");
  }
  return lines.join("\n");
}

function readReport(path) {
  const report = JSON.parse(readFileSync(path, "utf8"));
  const problems = reportProblems(report);
  if (problems.length > 0) throw new Error(`${path} is not a complete report:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
  return report;
}

function main(argv) {
  const [beforePath, afterPath] = argv.filter((arg) => !arg.startsWith("--"));
  if (!beforePath || !afterPath) {
    console.error("usage: compare-reports.mjs <before.json> <after.json> [--json]");
    return 2;
  }
  let comparison;
  try {
    comparison = compareReports(readReport(beforePath), readReport(afterPath));
  } catch (error) {
    console.error(error.message);
    return 1;
  }
  if (argv.includes("--json")) process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
  else process.stdout.write(renderComparison(comparison, beforePath, afterPath));
  return comparison.new.some((finding) => finding.severity === "error") ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
