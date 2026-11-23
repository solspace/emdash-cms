import path from "node:path";
import { fileURLToPath } from "node:url";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import { cloudflareEmail } from "@emdash-cms/cloudflare/plugins";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { freeformPlugin } from "@local/freeform";
import freeformAstro from "@solspace/freeform-astro";
import { emdashSsrDeps } from "./vite-emdash-ssr-deps.mjs";

/** Cloudflare Email Sending From — must be on an Email Sending–onboarded zone
 *  in the *same* Cloudflare account as this Worker. Override at deploy time. */
const EMAIL_FROM =
  process.env.FREEFORM_EMAIL_FROM?.trim() || "noreply@solspace.net";
const EMAIL_FROM_NAME =
  process.env.FREEFORM_EMAIL_FROM_NAME?.trim() || "Freeform Demo";
const EMAIL_REPLY_TO =
  process.env.FREEFORM_EMAIL_REPLY_TO?.trim() || "hello@solspace.com";

const CMS_ROOT = path.dirname(fileURLToPath(import.meta.url));
const FREEFORM_ROOT = path.resolve(CMS_ROOT, "../freeform");

const REACT_OPTIMIZE = [
  "react",
  "react-dom",
  "react-dom/server.edge",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
];

/** Admin UI shared deps — must be CMS-resolvable + prebundled up front so the
 *  first Freeform Forms visit does not trigger a mid-session optimizeDeps
 *  reload (that reload loads a second React and crashes with useContext null). */
const FREEFORM_ADMIN_OPTIMIZE = [
  "@dnd-kit/core",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
  "@cloudflare/kumo",
  "@phosphor-icons/react",
];

/**
 * Force Freeform admin sources (loaded from ../freeform via @fs) to share the
 * CMS React/Kumo copies instead of freeform/node_modules duplicates.
 */
function sharedAdminDeps() {
  const force = [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "@cloudflare/kumo",
    "@phosphor-icons/react",
  ];
  return {
    name: "shared-admin-deps",
    enforce: "pre",
    async resolveId(id, _importer, opts) {
      const hit = force.some(
        (pkg) => id === pkg || id.startsWith(`${pkg}/`),
      );
      if (!hit) return null;
      return this.resolve(id, path.join(CMS_ROOT, "package.json"), {
        ...opts,
        skipSelf: true,
      });
    },
  };
}

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  image: {
    layout: "constrained",
    responsiveStyles: true,
  },
  integrations: [
    react(),
    emdash({
      database: d1({ binding: "DB", session: "auto" }),
      storage: r2({ binding: "MEDIA" }),
      // Public origin for email links (recovery, invites, magic links), passkeys,
      // CSRF, etc. Overrides the old emdash.marsroversupply.com value left in DB.
      siteUrl: "https://emdash.solspace.net",
      // Enables LOADER sandbox only when wrangler.jsonc has worker_loaders
      // (Workers Paid). Free plans get a build warning and trusted plugins only.
      sandboxRunner: sandbox(),
      registry: "https://registry.emdashcms.com",
      // Skip Astro Font API / Google Fonts download at build time — local proxy
      // often 502s fonts.gstatic.com. Admin falls back to system fonts.
      fonts: false,
      // Trusted plugins — Freeform + Cloudflare Email Sending (wrangler send_email).
      plugins: [
        freeformPlugin(),
        cloudflareEmail({
          from: { email: EMAIL_FROM, name: EMAIL_FROM_NAME },
          replyTo: EMAIL_REPLY_TO,
        }),
      ],
    }),
    freeformAstro(),
    {
      name: "freeform-llms-txt",
      hooks: {
        "astro:config:setup": ({ injectRoute }) => {
          injectRoute({
            pattern: "/llms.txt",
            entrypoint: new URL("./src/llms-txt.ts", import.meta.url).pathname,
          });
        },
      },
    },
    {
      name: "chunk-reload-recovery",
      hooks: {
        "astro:config:setup": ({ injectScript }) => {
          injectScript(
            "head-inline",
            `(() => {
  window.addEventListener('vite:preloadError', () => {
    const last = Number(sessionStorage.getItem('emdash_chunk_reload') || 0);
    if (Date.now() - last > 8000) {
      sessionStorage.setItem('emdash_chunk_reload', String(Date.now()));
      window.location.reload();
    }
  });
})();`
          );
        },
      },
    },
  ],
  devToolbar: { enabled: false },
  vite: {
    plugins: [sharedAdminDeps(), emdashSsrDeps()],
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "@cloudflare/kumo",
        "@phosphor-icons/react",
      ],
      alias: [
        // Prefer the live Freeform repo over the pnpm store copy so admin HMR
        // and native plugin entry track ../freeform without a manual sync.
        {
          find: "@local/freeform/admin",
          replacement: path.join(FREEFORM_ROOT, "src/admin.tsx"),
        },
        {
          find: "@local/freeform/native",
          replacement: path.join(FREEFORM_ROOT, "dist/native-entry.js"),
        },
        {
          find: "@local/freeform/sandbox",
          replacement: path.join(FREEFORM_ROOT, "dist/plugin.mjs"),
        },
        { find: "react-dom/server", replacement: "react-dom/server.edge" },
      ],
    },
    optimizeDeps: {
      include: [...REACT_OPTIMIZE, ...FREEFORM_ADMIN_OPTIMIZE],
      exclude: [
        "@local/freeform",
        "@local/freeform/native",
        "@local/freeform/admin",
        "@local/freeform/sandbox",
        "@solspace/freeform-astro",
      ],
    },
    ssr: {
      // Transform the linked Freeform package (TS admin/native) instead of
      // treating it as a prebundled opaque dependency.
      noExternal: ["@local/freeform", "@solspace/freeform-astro"],
    },
    server: {
      allowedHosts: [".trycloudflare.com"],
      // Admin/native resolve into ../freeform via aliases above.
      fs: {
        allow: [CMS_ROOT, FREEFORM_ROOT],
      },
    },
  },
});
