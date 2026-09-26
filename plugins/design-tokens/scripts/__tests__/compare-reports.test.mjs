import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareReports, renderComparison } from "../compare-reports.mjs";
import { sampleReport } from "./sampleReport.mjs";

describe("compareReports", () => {
  it("sorts findings into resolved, new and unchanged by id", () => {
    const before = sampleReport();
    const after = sampleReport();
    after.findings = [after.findings[1], { ...after.findings[0], id: "tiers/role-aliases-palette@tokens/themes/light.tokens.json#color.outline" }];
    const comparison = compareReports(before, after);
    assert.deepEqual(comparison.resolved.map((finding) => finding.id), ["tiers/role-aliases-palette@tokens/themes/dark.tokens.json#color.surface-overlay"]);
    assert.deepEqual(comparison.new.map((finding) => finding.id), ["tiers/role-aliases-palette@tokens/themes/light.tokens.json#color.outline"]);
    assert.deepEqual(comparison.unchanged.map((finding) => finding.id), ["docs/rules-hold-no-values@DESIGN.md#colors"]);
  });

  it("treats a finding whose evidence moved as unchanged: the id carries no line", () => {
    const after = sampleReport();
    after.findings[0].evidence[0].line = 99;
    const comparison = compareReports(sampleReport(), after);
    assert.equal(comparison.unchanged.length, 2);
    assert.equal(comparison.new.length + comparison.resolved.length, 0);
  });
});

describe("renderComparison", () => {
  it("prints a count and a line per finding for each outcome", () => {
    const after = sampleReport();
    after.findings = [];
    const markdown = renderComparison(compareReports(sampleReport(), after), "before.json", "after.json");
    assert.match(markdown, /## Resolved \(2\)/);
    assert.match(markdown, /## New \(0\)\n\nNone\./);
    assert.match(markdown, /- error: `tiers\/role-aliases-palette@/);
  });
});
