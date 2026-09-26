#!/usr/bin/env node
// format/single-source-build: the stylesheets Terrazzo builds from the tokens
// match what the tokens give now. It builds into a temporary folder
// (terrazzo.config.ts reads DESIGN_TOKENS_OUT_DIR) and compares every file of
// that build with the file of the same name in the project's output folder.
//
//   node check-generated.mjs        exit 1 naming each stale or missing output
//
// An output with no token at all fails too: Terrazzo builds an empty theme,
// with exit 0, when a template's @tz(...) matches no context.
//
// Terrazzo's header names the template relative to the output folder, which
// differs for the temporary build, so that line is ignored. The output folder
// comes from design-tokens.gates.json (`tokens.outDir`, lib/project-modules.mjs).

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tokenSettings } from "../../lib/project-modules.mjs";

/** A generated file without the header line that names the template's relative path. */
export const comparable = (css) => css.replace(/^ \*\s+template: .*$/m, "");

/** The outputs whose content differs from the fresh build, or that are missing. */
/**
 * The outputs that declare no custom property. A `@tz(...)` argument that matches no context builds an empty theme
 * and Terrazzo still exits 0 (with a "matched 0 tokens" warning), so an empty output fails here instead of passing
 * as "unchanged" when the committed file is empty too.
 */
export function emptyOutputs(fresh) {
  return Object.keys(fresh).filter((file) => !/--[a-zA-Z0-9-]+\s*:/.test(fresh[file]));
}

export function staleOutputs(fresh, committed) {
  return Object.keys(fresh).filter((file) => committed[file] === undefined || comparable(committed[file]) !== comparable(fresh[file]));
}

function main() {
  const root = process.cwd();
  const settings = tokenSettings(root);
  const outDir = mkdtempSync(join(tmpdir(), "design-tokens-"));
  try {
    const result = spawnSync("tz", ["build", "--silent"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: `${resolve(root, "node_modules/.bin")}:${process.env.PATH ?? ""}`, DESIGN_TOKENS_OUT_DIR: `${outDir}/` },
    });
    if (result.status !== 0) {
      console.error(`Terrazzo failed:\n${result.stdout}${result.stderr}`);
      return 1;
    }
    const fresh = Object.fromEntries(readdirSync(outDir).map((file) => [file, readFileSync(join(outDir, file), "utf8")]));
    if (Object.keys(fresh).length === 0) {
      console.error(`Terrazzo built nothing into ${outDir}: does terrazzo.config.ts read DESIGN_TOKENS_OUT_DIR for outDir?`);
      return 1;
    }
    const committed = Object.fromEntries(
      Object.keys(fresh)
        .map((file) => [file, join(root, settings.outDir, file)])
        .filter(([, path]) => existsSync(path))
        .map(([file, path]) => [file, readFileSync(path, "utf8")]),
    );
    const empty = emptyOutputs(fresh);
    if (empty.length > 0) {
      console.error(`Terrazzo built ${empty.join(", ")} without a single token. Check the template's @tz(...) arguments: a modifier or context that matches nothing empties the output, and Terrazzo exits 0 with only a "matched 0 tokens" warning.`);
      return 1;
    }
    const stale = staleOutputs(fresh, committed);
    if (stale.length > 0) {
      console.error(`Out of date: ${stale.map((file) => join(settings.outDir, file)).join(", ")}. The values live in the token files: change them there and rebuild (never edit the outputs by hand).`);
      return 1;
    }
    console.log(`check-generated: ${Object.keys(fresh).length} outputs match the tokens`);
    return 0;
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
