import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderReport, reportProblems } from "../render-report.mjs";
import { sampleReport } from "./sampleReport.mjs";

describe("reportProblems", () => {
  it("accepts a complete report", () => {
    assert.deepEqual(reportProblems(sampleReport()), []);
  });

  it("refuses a report missing a part, a field or a valid status", () => {
    const report = sampleReport();
    report.parts = report.parts.filter((part) => part.id !== "docs");
    report.parts[0].status = "good";
    delete report.findings[1].fix;
    assert.deepEqual(reportProblems(report), [
      "parts.naming.status is \"good\", expected one of met, partial, missing",
      "parts has no entry for docs",
      "findings[1].fix is missing",
    ]);
  });

  it("refuses a finding whose id, part or rule does not match the rubric", () => {
    const report = sampleReport();
    report.findings[0].part = "docs";
    report.findings[1].id = "docs/rules-hold-no-values:DESIGN.md";
    report.findings.push({ ...sampleReport().findings[0], ruleId: "tiers/Unknown Rule" });
    report.findings.push(sampleReport().findings[0]);
    const problems = reportProblems(report);
    assert.ok(problems.includes("findings[0].part is \"docs\", but its rule belongs to tiers"));
    assert.ok(problems.includes("findings[1].id must be <ruleId>@<file>#<pointer>"));
    assert.ok(problems.includes("findings[2].ruleId \"tiers/Unknown Rule\" is not a rubric rule id"));
    assert.ok(problems.some((problem) => problem.startsWith("findings[3].id") && problem.endsWith("is not unique")));
  });

  it("refuses a gate without checks, with an unknown place to run, or a bad kind", () => {
    const report = sampleReport();
    report.gates[0].checks = [];
    report.gates[0].runs = ["nightly"];
    report.gates[0].tool.kind = "script";
    assert.deepEqual(reportProblems(report), [
      "gates[0].checks names no rule",
      "gates[0].tool needs a name and kind existing or custom",
      "gates[0].runs must list agent-edit, agent-commit, commit, ci",
    ]);
  });

  it("refuses what is not a report at all", () => {
    assert.deepEqual(reportProblems(null), ["the report is not a JSON object"]);
    assert.ok(reportProblems({}).length > 5);
  });
});

describe("renderReport", () => {
  const markdown = renderReport(sampleReport());

  it("writes every section, the parts in rubric order", () => {
    const sections = markdown.split("\n").filter((line) => line.startsWith("## "));
    assert.deepEqual(sections, ["## Summary", "## Findings", "## Recommended gates", "## Versions", "## Sources"]);
    assert.ok(markdown.indexOf("| naming |") < markdown.indexOf("| tiers |"));
    assert.match(markdown, /Findings: 1 error, 1 warning, 0 info\./);
  });

  it("lists each finding with its id, evidence and fix", () => {
    assert.match(markdown, /#### error: color\.surface-overlay aliases a role/);
    assert.match(markdown, /- Id: `tiers\/role-aliases-palette@tokens\/themes\/dark\.tokens\.json#color\.surface-overlay`/);
    assert.match(markdown, /- Evidence: `tokens\/themes\/dark\.tokens\.json:41`/);
    assert.match(markdown, /- Fix: Point it at the palette entry/);
  });

  it("escapes a pipe inside a table cell", () => {
    const report = sampleReport();
    report.parts[0].summary = "a | b";
    assert.match(renderReport(report), /\| naming \| met \| a \\\| b \|/);
  });

  it("credits the author, not a tool vendor", () => {
    assert.match(markdown, /Audited with design-tokens 0\.1\.0, by \[Abas Turabli\]\(https:\/\/abasturabli\.com\)\./);
  });
});
