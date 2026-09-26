#!/usr/bin/env node
// The rules document (DESIGN.md) as rules only:
//
// - docs/rules-hold-no-values: its front matter holds only its identity,
//   `imports:` and the `components:` contract, never token values;
// - `imports:` names the project's resolver;
// - tiers/components-read-roles: every contract property names a token
//   (`{color.primary}`), never a value and never the palette;
// - docs/rules-reference-existing-tokens: every token it names exists.
//
//   node check-rules-contract.mjs        exit 1 and one line per problem
//
// Reads the front matter with the project's `yaml`, and the token ids with the
// plugin's own DTCG reader (lib/dtcg.mjs). The settings come from
// design-tokens.gates.json (`tokens`, lib/project-modules.mjs).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readProjectTokens } from "./check-tokens.mjs";
import { importFromProject, tokenSettings } from "./lib/project-modules.mjs";

/** The keys a rules document's front matter may hold: identity, the import, the contract. */
export const ALLOWED_KEYS = ["version", "name", "description", "imports", "components"];
const REFERENCE = /^\{([a-z][a-z0-9-]*)\.([a-z0-9][a-z0-9.-]*)\}$/;

/** The YAML text between a Markdown file's opening and closing `---`, or undefined. */
export function frontMatterText(markdown) {
  const lines = markdown.split(/\r?\n/);
  if (lines[0] !== "---") return undefined;
  const end = lines.indexOf("---", 1);
  return end === -1 ? undefined : lines.slice(1, end).join("\n");
}

/**
 * Every broken contract rule, one sentence each, prefixed with its rubric rule id.
 * @param {Record<string, unknown>} front the parsed front matter
 * @param {ReadonlySet<string>} tokenIds every token id in the tokens (`color.primary`)
 * @param {typeof import("./lib/project-modules.mjs").TOKEN_DEFAULTS} settings
 */
export function contractProblems(front, tokenIds, settings) {
  const problems = [];
  for (const key of Object.keys(front)) {
    if (!ALLOWED_KEYS.includes(key)) problems.push(`docs/rules-hold-no-values: the front matter holds \`${key}:\`; values live in the token files it imports, the rules document holds rules`);
  }
  const imports = String(front.imports ?? "").replace(/^\.\//, "");
  if (imports !== settings.resolver.replace(/^\.\//, "")) problems.push(`docs/rules-reference-existing-tokens: \`imports:\` is ${front.imports ?? "missing"}; it names the tokens at ./${settings.resolver}`);
  const components = front.components ?? {};
  if (typeof components !== "object" || Array.isArray(components)) return [...problems, "tiers/components-read-roles: `components:` is not a map of component → property → token"];
  for (const [component, properties] of Object.entries(components)) {
    for (const [property, value] of Object.entries(properties ?? {})) {
      const where = `components.${component}.${property}`;
      const reference = REFERENCE.exec(String(value));
      if (!reference) {
        problems.push(`tiers/components-read-roles: ${where} is ${JSON.stringify(value)}; a component names a token ({group.name}), it does not state a value`);
        continue;
      }
      const [, group, name] = reference;
      if (group === settings.palette) problems.push(`tiers/components-read-roles: ${where} reads the palette entry ${name}; components read roles`);
      else if (!settings.readable.includes(group)) problems.push(`tiers/components-read-roles: ${where} reads ${group}.*; a component reads ${settings.readable.join(", ")}`);
      else if (!tokenIds.has(`${group}.${name}`)) problems.push(`docs/rules-reference-existing-tokens: ${where} names {${group}.${name}}, which the tokens do not define`);
    }
  }
  return problems;
}

async function main() {
  const root = process.cwd();
  const settings = tokenSettings(root);
  const { parse: parseYaml } = await importFromProject("yaml", root);
  const markdown = readFileSync(join(root, settings.rulesDocument), "utf8");
  const yaml = frontMatterText(markdown);
  if (yaml === undefined) {
    console.error(`docs/rules-reference-existing-tokens: ${settings.rulesDocument} has no front matter; it needs \`imports:\` and the \`components:\` contract`);
    return 1;
  }
  const { contexts, problems: tokenProblems } = readProjectTokens(root, settings);
  if (tokenProblems.length > 0) {
    console.error(`The tokens cannot be read:\n${tokenProblems.map((problem) => `  - ${problem}`).join("\n")}`);
    return 1;
  }
  const tokenIds = new Set(Object.values(contexts).flatMap((tokens) => Object.keys(tokens)));
  const problems = contractProblems(parseYaml(yaml) ?? {}, tokenIds, settings);
  if (problems.length > 0) {
    console.error(`${settings.rulesDocument} breaks the rules document's contract:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    return 1;
  }
  console.log(`check-rules-contract: ${settings.rulesDocument} holds no values and names ${tokenIds.size > 0 ? "existing" : "no"} tokens`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => (process.exitCode = code), (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
