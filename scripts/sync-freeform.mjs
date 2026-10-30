#!/usr/bin/env node
/**
 * Keep the pnpm `file:../freeform` install in sync with the Freeform repo.
 *
 * Vite resolves `@local/freeform` through the pnpm store copy (separate inodes),
 * so edits under `freeform/` do not show up until we sync (and often clear `.vite`).
 *
 * Usage:
 *   node scripts/sync-freeform.mjs              # sync src + dist
 *   node scripts/sync-freeform.mjs --build      # rebuild Freeform, then sync
 *   node scripts/sync-freeform.mjs --clean      # also wipe cms/node_modules/.vite
 *   node scripts/sync-freeform.mjs --build --clean
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CMS_ROOT = path.resolve(__dirname, "..");
const FREEFORM_ROOT = path.resolve(CMS_ROOT, "../freeform");
const LINK_PATH = path.join(CMS_ROOT, "node_modules/@local/freeform");
const ASTRO_LINK_PATH = path.join(CMS_ROOT, "node_modules/@solspace/freeform-astro");

const args = new Set(process.argv.slice(2));
const doBuild = args.has("--build");
const doClean = args.has("--clean");

function run(cmd, cwd, extraEnv = {}) {
  const res = spawnSync(cmd, {
    cwd,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd}`);
  }
}

function resolvePackageRoot() {
  if (!fs.existsSync(LINK_PATH)) {
    throw new Error(`Missing ${LINK_PATH} — run pnpm install in cms first.`);
  }
  return fs.realpathSync(LINK_PATH);
}

function syncTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  // Prefer rsync when available (macOS/Linux); fall back to cp -R.
  const rsync = spawnSync(
    "rsync",
    ["-a", "--delete", "--exclude", "node_modules", "--exclude", ".tmp", `${from}/`, `${to}/`],
    { stdio: "inherit" },
  );
  if (rsync.status === 0) return;
  run(`rm -rf "${to}" && mkdir -p "${to}" && cp -R "${from}/." "${to}/"`, CMS_ROOT);
}

function main() {
  if (!fs.existsSync(FREEFORM_ROOT)) {
    throw new Error(`Freeform repo not found at ${FREEFORM_ROOT}`);
  }

  if (doBuild) {
    console.log("[freeform:sync] building plugin…");
    run("pnpm run build", FREEFORM_ROOT);
  }

  const pkgRoot = resolvePackageRoot();
  console.log(`[freeform:sync] → ${pkgRoot}`);

  syncTree(path.join(FREEFORM_ROOT, "src"), path.join(pkgRoot, "src"));
  syncTree(path.join(FREEFORM_ROOT, "dist"), path.join(pkgRoot, "dist"));

  for (const name of ["package.json", "emdash-plugin.jsonc", "icon.png", "README.md"]) {
    const src = path.join(FREEFORM_ROOT, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(pkgRoot, name));
    }
  }

  if (fs.existsSync(ASTRO_LINK_PATH)) {
    const astroPkgRoot = fs.realpathSync(ASTRO_LINK_PATH);
    const astroSrc = path.join(FREEFORM_ROOT, "packages/astro");
    if (fs.existsSync(astroSrc)) {
      console.log(`[freeform:sync] → ${astroPkgRoot}`);
      syncTree(path.join(astroSrc, "src"), path.join(astroPkgRoot, "src"));
      if (fs.existsSync(path.join(astroSrc, "dist"))) {
        syncTree(path.join(astroSrc, "dist"), path.join(astroPkgRoot, "dist"));
      }
      const astroPkgJson = path.join(astroSrc, "package.json");
      if (fs.existsSync(astroPkgJson)) {
        fs.copyFileSync(astroPkgJson, path.join(astroPkgRoot, "package.json"));
      }
    }
  }

  // Drop stale renamed modules that break Vite ESM imports.
  for (const stale of [
    "src/admin-ui/nav.ts",
    "src/admin-ui/freeform-nav.ts",
    "src/admin-ui/freeform-api.ts",
    "src/admin-ui/ff-client-api.ts",
    "src/admin-ui/api.ts",
  ]) {
    const p = path.join(pkgRoot, stale);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  if (doClean) {
    const viteDir = path.join(CMS_ROOT, "node_modules/.vite");
    if (fs.existsSync(viteDir)) {
      fs.rmSync(viteDir, { recursive: true, force: true });
      console.log("[freeform:sync] cleared node_modules/.vite");
    }
  }

  console.log("[freeform:sync] done");
}

try {
  main();
} catch (err) {
  console.error("[freeform:sync]", err instanceof Error ? err.message : err);
  process.exit(1);
}
