#!/usr/bin/env node
/**
 * Local CMS dev with Freeform always kept fresh:
 *  1. Rebuild + sync Freeform into the pnpm package
 *  2. Clear Vite cache
 *  3. Watch Freeform — re-sync (and rebuild plugin when backend changes)
 *  4. Run Astro
 *
 * Usage: pnpm dev   (from cms/)
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CMS_ROOT = path.resolve(__dirname, "..");
const FREEFORM_ROOT = path.resolve(CMS_ROOT, "../freeform");
const SYNC_SCRIPT = path.join(__dirname, "sync-freeform.mjs");

const children = [];
let syncTimer = null;
let rebuilding = false;
let syncQueued = false;

function runSync(flags) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SYNC_SCRIPT, ...flags], {
      cwd: CMS_ROOT,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sync-freeform exited ${code}`));
    });
  });
}

function isBackendPath(rel) {
  // Anything that ships inside dist/plugin.mjs
  return (
    rel.startsWith("src/routes/") ||
    rel.startsWith("src/ai/") ||
    rel.startsWith("src/lib/") ||
    rel.startsWith("src/admin/") ||
    rel === "src/plugin.ts" ||
    rel === "src/types.ts" ||
    rel === "src/index.ts" ||
    rel === "src/native-entry.ts" ||
    rel === "emdash-plugin.jsonc"
  );
}

async function syncSoon(filePath) {
  const rel = path.relative(FREEFORM_ROOT, filePath).replaceAll("\\", "/");
  if (
    !rel ||
    rel.startsWith("..") ||
    rel.includes("node_modules") ||
    rel.includes(".tmp") ||
    rel.startsWith("dist/")
  ) {
    return;
  }

  const needBuild = isBackendPath(rel);
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    if (rebuilding) {
      syncQueued = true;
      return;
    }
    rebuilding = true;
    try {
      console.log(
        `[freeform:watch] ${needBuild ? "rebuild+sync" : "sync"} ← ${rel}`,
      );
      await runSync(needBuild ? ["--build"] : []);
    } catch (err) {
      console.error("[freeform:watch]", err instanceof Error ? err.message : err);
    } finally {
      rebuilding = false;
      if (syncQueued) {
        syncQueued = false;
        void syncSoon(path.join(FREEFORM_ROOT, "src/plugin.ts"));
      }
    }
  }, 400);
}

function watchFreeform() {
  const roots = [
    path.join(FREEFORM_ROOT, "src"),
    path.join(FREEFORM_ROOT, "emdash-plugin.jsonc"),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    try {
      fs.watch(root, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const full = fs.statSync(root).isDirectory()
          ? path.join(root, filename)
          : root;
        void syncSoon(full);
      });
    } catch (err) {
      console.warn(
        "[freeform:watch] could not watch",
        root,
        err instanceof Error ? err.message : err,
      );
    }
  }
  console.log("[freeform:watch] watching", path.join(FREEFORM_ROOT, "src"));
}

function spawnChild(cmd, args, cwd) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || "4321";

const hasLocalFreeform = fs.existsSync(
  path.join(FREEFORM_ROOT, "package.json"),
);

if (hasLocalFreeform) {
  await runSync(["--build", "--clean"]);
  watchFreeform();
} else {
  console.log(
    "[freeform:dev] No sibling ../freeform checkout — starting Astro only.\n" +
      "  Public setup: install Freeform from Plugins → Registry and use\n" +
      "  @solspace/freeform-astro from npm (see README).",
  );
}

const astro = spawnChild(
  "pnpm",
  ["exec", "astro", "dev", "--host", host, "--port", String(port)],
  CMS_ROOT,
);

astro.on("exit", (code) => shutdown(code ?? 0));
