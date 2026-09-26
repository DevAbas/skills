#!/usr/bin/env node
// The tier rules DTCG leaves to a team ("leaving organizational strategy to
// design system teams", https://www.designtokens.org/faq/), checked on every
// context the resolver declares:
//
// - tiers/palette-literal: a palette entry is a colour value, never an alias;
// - tiers/role-aliases-palette: a colour role points to the palette itself,
//   not to another role and not a literal, or it is derived;
// - tiers/derived-rule-recorded: a derived role records its rule under the
//   project's `$extensions` key, and its value is what the rule gives in that
//   context;
// - format/themes-complete: every context defines the same roles, derived the
//   same way;
// - tiers/styles-alias-foundation: a text style's family and weight alias the
//   font group.
//
//   node check-tokens.mjs        exit 1 and one line per problem when a rule breaks
//
// Reads the resolver with the project's @terrazzo/parser and computes derived
// colours with the project's lightningcss (a Tailwind v4 dependency). The
// settings come from design-tokens.gates.json (`tokens`, project-modules.mjs).
// Why a script and not a Terrazzo lint rule: a lint rule receives one resolved
// token set, and these rules need every context.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { importFromProject, tokenSettings } from "./project-modules.mjs";

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

/** The rule as a CSS colour, the roles it reads resolved to hex; lightningcss resolves it to sRGB. */
export function ruleCss(rule, roleHex) {
  if (rule.kind === "lightness") return `oklch(from ${roleHex(rule.from)} calc(l ${rule.lightness < 0 ? "-" : "+"} ${Math.abs(rule.lightness)}) c h)`;
  return `color-mix(in srgb, ${roleHex(rule.from)} ${Math.round(rule.weight * 100)}%, ${roleHex(rule.over)})`;
}

const hexOf = (value) => String(value?.hex ?? "").toLowerCase();
const inGroup = (tokens, group) => Object.entries(tokens).filter(([id]) => id.startsWith(`${group}.`)).map(([id, token]) => [id.slice(group.length + 1), token]);

/**
 * Every broken tier rule, one sentence each, prefixed with its rubric rule id.
 * @param {Record<string, Record<string, any>>} contexts context name → resolved tokens (id → @terrazzo/parser normalized token)
 * @param {typeof import("./project-modules.mjs").TOKEN_DEFAULTS} settings
 * @param {(rule: object, roleHex: (role: string) => string) => string} derive the hex a rule gives
 */
export function tierProblems(contexts, settings, derive) {
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

async function main() {
  const root = process.cwd();
  const settings = tokenSettings(root);
  const { defineConfig, parse } = await importFromProject("@terrazzo/parser", root);
  const { transform } = await importFromProject("lightningcss", root);
  const filename = pathToFileURL(join(root, settings.resolver));
  const source = readFileSync(filename, "utf8");
  const document = JSON.parse(source);
  const contextNames = Object.keys(document.modifiers?.[settings.modifier]?.contexts ?? {});
  const { resolver } = await parse([{ filename, src: source }], { config: defineConfig({}, { cwd: pathToFileURL(`${root}/`) }) });
  const contexts = contextNames.length > 0
    ? Object.fromEntries(contextNames.map((context) => [context, resolver.apply({ [settings.modifier]: context })]))
    : { default: resolver.apply({}) };

  const derive = (rule, roleHex) => {
    // A target without relative colours or color-mix makes lightningcss resolve the value to a hex fallback.
    const { code } = transform({ filename: "derived.css", code: Buffer.from(`a{color:${ruleCss(rule, roleHex)}}`), targets: { chrome: 80 << 16 } });
    const hex = /color:\s*(#[0-9a-f]{3,8})\b/i.exec(code.toString())?.[1];
    if (!hex) throw new Error(`lightningcss did not resolve ${ruleCss(rule, roleHex)} to a hex colour`);
    const digits = hex.slice(1).toLowerCase();
    return `#${digits.length === 3 ? [...digits].map((d) => d + d).join("") : digits}`;
  };

  const problems = tierProblems(contexts, settings, derive);
  if (problems.length > 0) {
    console.error(`The tokens break the tier rules:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    return 1;
  }
  console.log(`check-tokens: the tier rules hold in ${Object.keys(contexts).join(", ")}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => (process.exitCode = code), (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
