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
  ],
  devToolbar: { enabled: false },
  vite: {
    plugins: [emdashSsrDeps()],
    resolve: {
      dedupe: ["react", "react-dom"],
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
      include: REACT_OPTIMIZE,
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
