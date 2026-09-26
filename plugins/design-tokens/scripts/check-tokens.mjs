#!/usr/bin/env node
// The tier rules DTCG leaves to a team ("leaving organizational strategy to
// design system teams", https://www.designtokens.org/faq/), checked on every
// context the resolver declares, and the token files checked against the
// format itself:
//
// - format/dtcg-valid: what the reader finds wrong with the files or the
//   resolver (lib/dtcg.mjs), including a modifier with fewer than two contexts;
// - tiers/palette-literal: a palette entry is a colour value, never an alias;
// - tiers/role-aliases-palette: a colour role points to the palette itself,
//   not to another role and not a literal, or it is derived;
// - tiers/derived-rule-recorded: a derived role records its rule under the
//   project's `$extensions` key, and its value is what the rule gives in that
//   context (lib/color.mjs);
// - format/themes-complete: every context defines the same roles, derived the
//   same way;
// - tiers/styles-alias-foundation: a text style's family and weight alias the
//   font group.
//
//   node check-tokens.mjs [--root <project>]   exit 1 and one line per problem
//
// No dependencies: it runs from the plugin on any project with DTCG files, and
// the same file runs from a project that copied it. The settings come from the
// project's design-tokens.gates.json (`tokens`, lib/project-modules.mjs).

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { colorHex, derivedHex } from "./lib/color.mjs";
import { loadResolver, loadTokenFiles, modifiersOf, resolveTokens } from "./lib/dtcg.mjs";
import { tokenSettings } from "./lib/project-modules.mjs";

/**
 * The derived rule a token records, undefined when it has none, or a string saying why the rule is malformed.
 * Two kinds: `lightness` moves the OKLCH lightness of `from` by `lightness` (−1 to 1), hue and chroma kept;
 * `mix` puts `from` at `weight` (0 to 1) over `over` in sRGB.
 * @returns {{ kind: "lightness", from: string, lightness: number } | { kind: "mix", from: string, weight: number, over: string } | undefined | string}
 */
export function derivedRuleOf(extensions, key) {
  const rule = extensions?.[key]?.derived;
  if (rule === undefined) return undefined;
  if (rule?.kind === "lightness" && typeof rule.from === "string" && typeof rule.lightness === "number" && Math.abs(rule.lightness) <= 1) return rule;
  if (rule?.kind === "mix" && typeof rule.from === "string" && typeof rule.over === "string" && typeof rule.weight === "number" && rule.weight >= 0 && rule.weight <= 1) return rule;
  return `malformed derived rule ${JSON.stringify(rule)}: expected { kind: "lightness", from, lightness } or { kind: "mix", from, weight, over }`;
}

const hexOf = (value) => {
  try {
    return colorHex(value);
  } catch {
    return "";
  }
};
const inGroup = (tokens, group) => Object.entries(tokens).filter(([id]) => id.startsWith(`${group}.`)).map(([id, token]) => [id.slice(group.length + 1), token]);

/**
 * Every broken tier rule, one sentence each, prefixed with its rubric rule id.
 * @param {Record<string, Record<string, any>>} contexts context name → resolved tokens (lib/dtcg.mjs resolveTokens)
 * @param {typeof import("./lib/project-modules.mjs").TOKEN_DEFAULTS} settings
 * @param {(rule: object, roleHex: (role: string) => string) => string} [derive] the hex a rule gives
 */
export function tierProblems(contexts, settings, derive = derivedHex) {
  const problems = [];
  const names = Object.keys(contexts);
  const first = contexts[names[0]] ?? {};

  for (const [name, token] of inGroup(first, settings.palette)) {
    if (token.$type !== "color") continue;
    if (token.aliasOf) problems.push(`tiers/palette-literal: ${settings.palette}.${name} is an alias of ${token.aliasOf}; the palette holds values only`);
  }

  /** context → role → { kind, rule?, hex } */
  const roles = {};
  for (const context of names) {
    const inContext = new Map();
    for (const [role, token] of inGroup(contexts[context], settings.roles)) {
      const rule = derivedRuleOf(token.$extensions, settings.extensionKey);
      if (typeof rule === "string") {
        problems.push(`tiers/derived-rule-recorded: ${context}: ${settings.roles}.${role} has a ${rule}`);
        continue;
      }
      const hex = hexOf(token.$value);
      if (rule) {
        inContext.set(role, { kind: "derived", rule, hex });
        continue;
      }
      // What the token points to itself: a role that points to another role hides the palette entry behind it.
      const target = token.aliasChain?.[0];
      if (!target?.startsWith(`${settings.palette}.`)) {
        problems.push(`tiers/role-aliases-palette: ${context}: ${settings.roles}.${role} ${target ? `points to ${target}` : "is a literal"}; a role points to the palette, or is derived by a recorded rule`);
      }
      inContext.set(role, { kind: "alias", hex });
    }
    for (const [role, entry] of inContext) {
      if (entry.kind !== "derived") continue;
      const reads = [entry.rule.from, ...(entry.rule.kind === "mix" ? [entry.rule.over] : [])];
      const missing = reads.filter((from) => !inContext.has(from));
      if (missing.length > 0) {
        problems.push(`tiers/derived-rule-recorded: ${context}: ${settings.roles}.${role} derives from ${missing.join(", ")}, which is not a role`);
        continue;
      }
      const expected = derive(entry.rule, (from) => inContext.get(from).hex);
      if (expected !== entry.hex) problems.push(`tiers/derived-rule-recorded: ${context}: ${settings.roles}.${role} is ${entry.hex}, but its rule gives ${expected}`);
    }
    roles[context] = inContext;
  }

  const all = new Set(names.flatMap((context) => [...roles[context].keys()]));
  for (const role of all) {
    const defined = names.filter((context) => roles[context].has(role));
    if (defined.length !== names.length) {
      problems.push(`format/themes-complete: ${settings.roles}.${role} is defined in ${defined.join(", ")} only`);
      continue;
    }
    const shapes = new Set(defined.map((context) => JSON.stringify(roles[context].get(role).rule ?? null)));
    if (shapes.size > 1) problems.push(`format/themes-complete: ${settings.roles}.${role} is derived differently across ${names.join(", ")}`);
  }

  for (const [name, token] of inGroup(first, settings.typography)) {
    if (token.$type !== "typography") continue;
    const authored = token.originalValue?.$value;
    for (const part of ["fontFamily", "fontWeight"]) {
      const value = authored?.[part];
      if (typeof value !== "string" || !value.startsWith(`{${settings.fonts}.`)) problems.push(`tiers/styles-alias-foundation: ${settings.typography}.${name}.${part} is a literal; a text style takes its ${part} from ${settings.fonts}.*`);
    }
  }
  return problems;
}

/**
 * The project's tokens, read through its resolver (or its plain token files), resolved once per context of the
 * theme modifier; and every problem the reader found, as format/dtcg-valid.
 */
export function readProjectTokens(root, settings) {
  const resolverPath = join(root, settings.resolver);
  let source;
  if (existsSync(resolverPath)) source = loadResolver(resolverPath);
  else if (settings.files.length > 0) source = loadTokenFiles(settings.files.map((file) => join(root, file)));
  else return { contexts: {}, problems: [`format/dtcg-valid: no resolver at ${settings.resolver}; set tokens.resolver, or tokens.files for plain token files, in design-tokens.gates.json`] };
  const contextNames = modifiersOf(source)[settings.modifier]?.contexts ?? [];
  const inputs = contextNames.length > 0 ? contextNames.map((context) => [context, { [settings.modifier]: context }]) : [["default", {}]];
  const problems = new Set();
  const contexts = {};
  for (const [name, input] of inputs) {
    const { tokens, problems: found } = resolveTokens(source, input);
    contexts[name] = tokens;
    for (const problem of found) problems.add(`format/dtcg-valid: ${problem}`);
  }
  return { contexts, problems: [...problems] };
}

function main(argv) {
  const at = argv.indexOf("--root");
  const root = at === -1 ? process.cwd() : argv[at + 1];
  const settings = tokenSettings(root);
  const { contexts, problems: formatProblems } = readProjectTokens(root, settings);
  const problems = [...formatProblems, ...(Object.keys(contexts).length > 0 ? tierProblems(contexts, settings) : [])];
  if (problems.length > 0) {
    console.error(`The tokens break the rules:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    return 1;
  }
  console.log(`check-tokens: the format and tier rules hold in ${Object.keys(contexts).join(", ")}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
