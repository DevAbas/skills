// A complete audit report for the report scripts' tests; each test changes a
// copy to make the case it needs.

export function sampleReport() {
  return {
    schemaVersion: "1",
    tool: { name: "design-tokens", version: "0.1.0" },
    project: { name: "fixture-app", root: ".", commit: "abc1234" },
    date: "2026-09-26",
    stack: { profile: "terrazzo-tailwind-v4", tokenFormat: "DTCG 2025.10", styling: ["tailwindcss"], rulesDocument: "DESIGN.md", versions: { tailwindcss: { installed: "4.1.3", latest: "4.1.3" } } },
    parts: [
      { id: "naming", status: "met", summary: "Roles are named by purpose." },
      { id: "tiers", status: "partial", summary: "One role aliases another role." },
      { id: "format", status: "met", summary: "The tokens are valid DTCG." },
      { id: "docs", status: "partial", summary: "DESIGN.md states a colour value." },
    ],
    findings: [
      {
        id: "tiers/role-aliases-palette@tokens/themes/dark.tokens.json#color.surface-overlay",
        ruleId: "tiers/role-aliases-palette",
        part: "tiers",
        severity: "error",
        title: "color.surface-overlay aliases a role",
        location: { file: "tokens/themes/dark.tokens.json", pointer: "color.surface-overlay" },
        evidence: [{ file: "tokens/themes/dark.tokens.json", line: 41, excerpt: '"$value": "{color.surface-container}"' }],
        why: "A role that points to a role hides the palette entry behind it.",
        source: "https://www.designtokens.org/faq/",
        fix: "Point it at the palette entry, or record a derived rule.",
      },
      {
        id: "docs/rules-hold-no-values@DESIGN.md#colors",
        ruleId: "docs/rules-hold-no-values",
        part: "docs",
        severity: "warning",
        title: "DESIGN.md holds colours",
        location: { file: "DESIGN.md", pointer: "colors" },
        why: "Values live in the tokens.",
        fix: "Remove `colors:` and import the tokens.",
      },
    ],
    gates: [
      {
        id: "gate/token-check",
        does: "Fails a role that does not alias the palette",
        checks: ["tiers/role-aliases-palette", "format/themes-complete"],
        closes: ["tiers/role-aliases-palette@tokens/themes/dark.tokens.json#color.surface-overlay"],
        tool: { name: "check-tokens.mjs", kind: "custom", basis: "assets/harness/terrazzo-tailwind-v4/check-tokens.mjs" },
        runs: ["agent-edit", "commit", "ci"],
        status: "missing",
      },
    ],
    sources: [{ title: "DTCG Format", url: "https://www.designtokens.org/tr/2025.10/format/", version: "2025.10" }],
  };
}
