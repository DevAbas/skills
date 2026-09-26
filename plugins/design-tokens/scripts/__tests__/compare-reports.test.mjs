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

describe("compareReports: moved findings", () => {
  it("pairs a finding at a new location with the id it names in previousIds", () => {
    const before = sampleReport();
    const after = sampleReport();
    const oldId = before.findings[0].id;
    after.findings[0] = { ...after.findings[0], id: "tiers/role-aliases-palette@tokens/colors.tokens.json#color.surface-overlay", previousIds: [oldId] };
    const comparison = compareReports(before, after);
    assert.deepEqual(comparison.moved.map((finding) => [finding.id, finding.movedFrom]), [["tiers/role-aliases-palette@tokens/colors.tokens.json#color.surface-overlay", oldId]]);
    assert.deepEqual(comparison.resolved, []);
    assert.deepEqual(comparison.new, []);
  });

  it("treats a previousIds that names nothing in the earlier report as new", () => {
    const after = sampleReport();
    after.findings[0] = { ...after.findings[0], id: "tiers/role-aliases-palette@x.json#y", previousIds: ["tiers/role-aliases-palette@nowhere#z"] };
    const comparison = compareReports(sampleReport(), after);
    assert.equal(comparison.new.length, 1);
    assert.equal(comparison.resolved.length, 1);
  });
});

describe("renderComparison", () => {
  it("prints a count and a line per finding for each outcome", () => {
    const after = sampleReport();
    after.findings = [];
    const markdown = renderComparison(compareReports(sampleReport(), after), "before.json", "after.json");
    assert.match(markdown, /## Resolved \(2\)/);
    assert.match(markdown, /## New \(0\)\n\nNone\./);
    assert.match(markdown, /## Moved \(0\)/);
    assert.match(markdown, /- error: `tiers\/role-aliases-palette@/);
  });
});
