import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { countRawColors, frontMatterKeys, listFiles, scanProject } from "../scan.mjs";
import { writeProjectFixture } from "./projectFixture.mjs";

describe("countRawColors", () => {
  it("counts hex values and colour functions with a literal channel", () => {
    assert.equal(countRawColors('a = "#fff"; b = "#1a2b3c80"; c = "rgb(1, 2, 3)"; d = "oklch(0.5 0.1 200)"'), 4);
  });

  it("ignores ids, entities, and colour functions built from variables", () => {
    assert.equal(countRawColors('const id = "#main-nav"; const e = "&#123;"; const c = `rgb(${r}, ${g}, ${b})`; x = "#abcdefg"'), 0);
  });
});

describe("frontMatterKeys", () => {
  it("lists the top-level keys, not nested ones", () => {
    assert.deepEqual(frontMatterKeys("---\nname: A\ncomponents:\n  card:\n    backgroundColor: x\n---\nbody"), ["name", "components"]);
  });

  it("is null without a closed front matter", () => {
    assert.equal(frontMatterKeys("# Title\n"), null);
    assert.equal(frontMatterKeys("---\nname: A\n"), null);
  });
});

describe("scanProject", () => {
  let fixture;
  let scan;
  before(() => {
    fixture = writeProjectFixture();
    scan = scanProject(fixture.root);
  });
  after(() => fixture.cleanup());

  it("never walks node_modules", () => {
    assert.ok(!listFiles(fixture.root).some((file) => file.startsWith("node_modules/")));
  });

  it("reads installed versions from node_modules, not the declared range", () => {
    assert.deepEqual(scan.dependencies.tailwindcss, { declared: "^4.1.0", installed: "4.1.3" });
    assert.equal(scan.dependencies.lodash, undefined);
  });

  it("reports the Terrazzo + Tailwind v4 profile", () => {
    assert.equal(scan.profile, "terrazzo-tailwind-v4");
  });

  it("finds token files, the resolver and the rules document's keys", () => {
    assert.deepEqual(scan.tokens.dtcgFiles, ["tokens/themes/light.tokens.json"]);
    assert.deepEqual(scan.tokens.resolvers, ["tokens/design.resolver.json"]);
    assert.deepEqual(scan.rulesDocument, { path: "DESIGN.md", frontMatterKeys: ["name", "imports", "colors", "components"] });
  });

  it("counts raw colours in source, skipping tests and generated outputs", () => {
    assert.deepEqual(scan.rawColors, { total: 3, files: 1, top: [{ file: "src/components/Card.tsx", count: 3 }] });
    assert.deepEqual(scan.styles.generated, ["src/styles/theme.generated.css"]);
    assert.equal(scan.styles.tailwindThemeFiles.length, 2);
  });

  it("finds the existing gates", () => {
    assert.deepEqual(scan.gates.claudeSettings, [".claude/settings.json"]);
    assert.deepEqual(scan.gates.ciWorkflows, [".github/workflows/ci.yml"]);
    assert.equal(scan.gates.gatesConfig, null);
  });

  it("reports no profile without Terrazzo", () => {
    const plain = writeProjectFixture({ "package.json": JSON.stringify({ name: "plain", dependencies: { tailwindcss: "^4.1.0" } }) });
    try {
      assert.equal(scanProject(plain.root).profile, null);
    } finally {
      plain.cleanup();
    }
  });
});
