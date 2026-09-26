#!/usr/bin/env node
// A read-only inventory of a web project's token architecture, as JSON on
// stdout: what the audit reads first, before any judgment.
//
//   node scan.mjs [project-root]
//
// It reports:
// - the token files, resolvers and build configs;
// - the rules document and its front matter keys, and other files that may be one;
// - the styling and token packages, with their installed versions;
// - where raw colours appear in source;
// - which generated outputs and gates exist.
//
// It changes nothing and reads nothing outside the root. It decides nothing
// either: every judgment is the auditor's, against references/rubric.md. No
// dependencies, Node 20 or later.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

/** Folders never walked: dependencies, build output, version control, earlier audits. */
const SKIPPED = new Set(["node_modules", ".git", ".next", ".nuxt", ".svelte-kit", ".turbo", ".vercel", ".output", "dist", "build", "out", "coverage", "storybook-static", "design-tokens-audit"]);
/** Source files scanned for raw colours. */
const SOURCE = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|astro|html|css|scss|sass|less)$/;
/** The packages that say how a project styles and builds tokens. */
export const PACKAGES = [
  "tailwindcss", "@tailwindcss/postcss", "@tailwindcss/vite", "lightningcss",
  "@terrazzo/cli", "@terrazzo/parser", "@terrazzo/plugin-css", "@terrazzo/plugin-tailwind",
  "style-dictionary", "@tokens-studio/sd-transforms", "@google/design.md",
  "sass", "styled-components", "@emotion/react", "@vanilla-extract/css", "@stylexjs/stylex", "@pandacss/dev",
  "eslint", "stylelint", "storybook", "yaml",
];
const HEX = /(?<![\w#&])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/g;
const COLOR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.]/g;

/** Every file under `root`, relative, forward slashes, skipping `SKIPPED` folders. */
export function listFiles(root) {
  const files = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name)) walk(join(dir, entry.name));
      } else if (entry.isFile()) files.push(relative(root, join(dir, entry.name)).split("\\").join("/"));
    }
  };
  walk(root);
  return files.sort();
}

/** The number of raw colour literals in a text: hex values and colour functions with a literal first channel. */
export function countRawColors(text) {
  return (text.match(HEX)?.length ?? 0) + (text.match(COLOR_FUNCTION)?.length ?? 0);
}

/** The top-level keys of a Markdown file's YAML front matter, or null when it has none. */
export function frontMatterKeys(markdown) {
  const lines = markdown.split(/\r?\n/);
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return null;
  return lines
    .slice(1, end)
    .map((line) => /^([A-Za-z_][\w-]*)\s*:/.exec(line)?.[1])
    .filter(Boolean);
}

/**
 * True for a Markdown or MDX file whose name suggests it may hold a design system's rules: DESIGN.md, a design
 * system, design tokens or style guide document, a tokens page, or a docs/ file about design. A candidate only:
 * the auditor reads it and decides (references/rubric.md, docs/rules-document-exists).
 */
export function isRulesDocumentCandidate(file) {
  if (!/\.mdx?$/i.test(file)) return false;
  const name = basename(file).toLowerCase();
  if (name === "design.md" || /design[-_ ]?system|design[-_ ]?tokens|style[-_ ]?guide|^tokens\.mdx?$/.test(name)) return true;
  return /(^|\/)docs\//.test(file) && name.includes("design");
}

/** The installed version of a package: from its own package.json in node_modules, which a range in the project's package.json is not. */
function installedVersion(root, name) {
  try {
    return JSON.parse(readFileSync(join(root, "node_modules", name, "package.json"), "utf8")).version ?? null;
  } catch {
    return null;
  }
}

const readText = (root, file) => {
  try {
    return readFileSync(join(root, file), "utf8");
  } catch {
    return "";
  }
};

/**
 * The inventory of the project at `root`.
 * @param {string} root
 */
export function scanProject(root) {
  const files = listFiles(root);
  const has = (file) => files.includes(file);

  let pkg = null;
  try {
    pkg = JSON.parse(readText(root, "package.json"));
  } catch {
    pkg = null;
  }
  const declared = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const dependencies = Object.fromEntries(
    PACKAGES.filter((name) => name in declared).map((name) => [name, { declared: declared[name], installed: installedVersion(root, name) }]),
  );
  const lockfile = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"].find(has) ?? null;

  const tokenFiles = files.filter((file) => /\.tokens(\.json)?$/.test(file));
  const resolvers = files.filter((file) => /\.resolver\.json$/.test(file));
  const otherTokenJson = files.filter((file) => /(^|\/)tokens?\.json$/.test(file) && !tokenFiles.includes(file));
  const configs = {
    terrazzo: files.filter((file) => /(^|\/)terrazzo\.config\.[cm]?[jt]s$/.test(file)),
    styleDictionary: files.filter((file) => /(^|\/)(style-dictionary|sd)\.config\.[cm]?[jt]s(on)?$/.test(file) || /(^|\/)config\.json$/.test(file) && /style-dictionary/.test(readText(root, file))),
    tailwind: files.filter((file) => /(^|\/)tailwind\.config\.[cm]?[jt]s$/.test(file)),
  };

  const designMd = files.find((file) => basename(file) === "DESIGN.md") ?? null;
  const rulesDocument = designMd ? { path: designMd, frontMatterKeys: frontMatterKeys(readText(root, designMd)) } : null;
  const rulesDocumentCandidates = files.filter(isRulesDocumentCandidate).map((path) => ({ path, frontMatterKeys: frontMatterKeys(readText(root, path)) }));

  const cssFiles = files.filter((file) => /\.(css|scss|sass|less)$/.test(file));
  const themeBlocks = cssFiles.filter((file) => /@theme\b/.test(readText(root, file)));
  const generated = files.filter((file) => /\.generated\.[a-z]+$/.test(file) || /(^|\/)tokens\.generated\//.test(file));

  const perFile = [];
  for (const file of files) {
    if (!SOURCE.test(file) || generated.includes(file) || /(^|\/)(__tests__|__mocks__)\//.test(file) || /\.(test|spec|stories)\.[cm]?[jt]sx?$/.test(file)) continue;
    const count = countRawColors(readText(root, file));
    if (count > 0) perFile.push({ file, count });
  }
  perFile.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));

  const gates = {
    claudeSettings: [".claude/settings.json", ".claude/settings.local.json"].filter(has),
    claudeHooks: files.filter((file) => file.startsWith(".claude/hooks/")),
    gatesConfig: has("design-tokens.gates.json") ? "design-tokens.gates.json" : null,
    gitHooks: files.filter((file) => /^(\.githooks|\.husky)\//.test(file) || /^(lefthook|\.lefthook)\.ya?ml$/.test(file)),
    ciWorkflows: files.filter((file) => /^\.github\/workflows\/.+\.ya?ml$/.test(file)),
    eslintConfig: files.filter((file) => /^eslint\.config\.[cm]?[jt]s$/.test(file) || /^\.eslintrc/.test(file)),
    stylelintConfig: files.filter((file) => /^(stylelint\.config\.[cm]?js|\.stylelintrc)/.test(file)),
  };

  const tailwindMajor = /^(\d+)\./.exec(dependencies.tailwindcss?.installed ?? "")?.[1] ?? /(\d+)/.exec(dependencies.tailwindcss?.declared ?? "")?.[1];
  const terrazzo = Boolean(dependencies["@terrazzo/cli"] || dependencies["@terrazzo/parser"]);

  return {
    root,
    packageJson: pkg ? { name: pkg.name ?? null, scripts: Object.keys(pkg.scripts ?? {}), lockfile } : null,
    dependencies,
    profile: terrazzo && tailwindMajor === "4" ? "terrazzo-tailwind-v4" : null,
    tokens: { dtcgFiles: tokenFiles, resolvers, otherTokenJson, configs },
    rulesDocument,
    rulesDocumentCandidates,
    styles: { cssFiles: cssFiles.length, tailwindThemeFiles: themeBlocks, generated },
    rawColors: { total: perFile.reduce((sum, entry) => sum + entry.count, 0), files: perFile.length, top: perFile.slice(0, 20) },
    gates,
  };
}

function main(argv) {
  const root = argv[0] ?? process.cwd();
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(`Not a directory: ${root}`);
    return 2;
  }
  process.stdout.write(`${JSON.stringify(scanProject(root), null, 2)}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
