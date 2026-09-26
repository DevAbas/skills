// What the profile's checks share: the token settings from the project's
// design-tokens.gates.json (`tokens`), and loading a package from the
// project's own node_modules, so a check runs with the versions the project
// installed wherever the check file lives. No dependencies, Node 20 or later.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** The token settings every check reads, with the defaults a project overrides in design-tokens.gates.json. */
export const TOKEN_DEFAULTS = {
  /** The DTCG resolver, relative to the root. */
  resolver: "tokens/design.resolver.json",
  /** The resolver modifier whose contexts are the themes. */
  modifier: "theme",
  /** The group of literal values (the palette). */
  palette: "palette",
  /** The group of colour roles. */
  roles: "color",
  /** The group of text styles, and the group their family and weight must alias. */
  typography: "typography",
  fonts: "font",
  /** The `$extensions` key a derived rule is recorded under (reverse domain name notation, DTCG Format 5.2.3). */
  extensionKey: "com.example.design",
  /** Where the build writes its outputs, relative to the root. */
  outDir: "src/styles/",
  /** The rules document. */
  rulesDocument: "DESIGN.md",
  /** The token groups a component in the rules document's contract may read. */
  readable: ["color", "typography", "rounded"],
};

/** The project's token settings: TOKEN_DEFAULTS, overridden by the `tokens` object of design-tokens.gates.json. */
export function tokenSettings(root = process.cwd()) {
  let overrides = {};
  try {
    overrides = JSON.parse(readFileSync(join(root, "design-tokens.gates.json"), "utf8")).tokens ?? {};
  } catch {
    overrides = {};
  }
  return { ...TOKEN_DEFAULTS, ...overrides };
}

/** Imports a package the way the project at `root` resolves it; throws with the install hint when it is missing. */
export async function importFromProject(name, root = process.cwd()) {
  const require = createRequire(join(root, "package.json"));
  let path;
  try {
    path = require.resolve(name);
  } catch {
    throw new Error(`${name} is not installed in ${root}. Add it as a devDependency (ask first), then run the check again.`);
  }
  return import(pathToFileURL(path).href);
}
