# EmDash CMS + Freeform (Solspace example)

Public reference site showing how to run **[EmDash](https://emdashcms.com)** with **[Freeform](https://plugins.emdashcms.com/plugins/@solspace.com/freeform)** — Solspace’s form builder for EmDash.

The front end is a **Solspace Freeform product demo** (same idea as [demo.solspace.com](https://demo.solspace.com) for Craft) — try forms, AI chat intake, submissions, and theming without a fictional brand story.

| Piece | Role |
| --- | --- |
| **EmDash** | Headless CMS (Astro + Cloudflare) |
| **Freeform plugin** (`@solspace.com/freeform`) | Admin builder, submissions, notifications, webhooks |
| **`@solspace/freeform-astro`** | Public form routes + `<FreeformForm>` / `<FreeformChat>` |

Plugin source & deeper docs: [solspace/emdash-freeform](https://github.com/solspace/emdash-freeform)

---

## What this demo shows

- Install Freeform from the EmDash plugin registry
- Wire `@solspace/freeform-astro` into `astro.config.mjs`
- Embed a form by handle (`<FreeformForm formId="contact" />`)
- Optional AI concierge chat that can fill and submit the same form
- Theme unstyled Freeform markup with `data-freeform-*` CSS (see `/contact`)
- Machine-readable discovery via `/.well-known/freeform.json` and `/llms.txt`

---

## Requirements

- Node.js **≥ 22.16**
- pnpm **≥ 11**
- Cloudflare account (D1 + R2) for deploy; local `astro dev` works for exploring the UI

---

## Quick start

```bash
git clone https://github.com/solspace/emdash-cms.git
cd emdash-cms
pnpm install
pnpm dev
```

Open:

- Site — [http://127.0.0.1:4321/](http://127.0.0.1:4321/)
- Admin — [http://127.0.0.1:4321/_emdash/admin](http://127.0.0.1:4321/_emdash/admin)
- Contact form — [http://127.0.0.1:4321/contact](http://127.0.0.1:4321/contact)

On first admin visit, complete EmDash setup (or use the printed **dev bypass** URL from the terminal).

### 1. Install the Freeform plugin

In admin: **Plugins → Registry** → search **`freeform`** → **Install**.  
Approve capabilities (`network:request`, `email:send` as requested).

Confirm from a terminal if you like:

```bash
npx @emdash-cms/plugin-cli info solspace.com freeform
```

### 2. Astro integration (already in this repo)

```bash
pnpm add @solspace/freeform-astro
```

```js
// astro.config.mjs
import emdash from "emdash/astro";
import freeformAstro from "@solspace/freeform-astro";

export default defineConfig({
  integrations: [
    emdash({
      registry: "https://registry.emdashcms.com",
      // …database / storage…
    }),
    freeformAstro(),
  ],
});
```

### 3. Create a form & embed it

1. Admin → **Freeform** → create a form with handle `contact` (or use a starter).
2. Embed anywhere:

```astro
---
import { FreeformForm } from "@solspace/freeform-astro/components";
---

<FreeformForm formId="contact" />
```

Components are **unstyled by design**. Style via `data-freeform-*` attributes — this site’s `/contact` page is a full themed example.

Optional AI chat on the same form:

```astro
---
import { FreeformChat } from "@solspace/freeform-astro/components";
---

<FreeformChat
  formHandle="contact"
  siteName="Solspace Freeform"
  salesContext="Short product/context blurb for the concierge…"
/>
```

### 4. Optional AI features

Form generation, spam scoring, and submission briefs need your own **OpenAI** API key under **Freeform → Settings → AI & spam**. Without a key, hand-built forms, submissions, email, and webhooks still work.

---

## Project layout

```
astro.config.mjs          EmDash + Freeform Astro integrations
src/pages/contact.astro   Themed FreeformForm + FreeformChat example
src/pages/forms/[handle]  Generic form pages by handle
src/pages/demo.astro      Minimal light-theme Freeform embed
src/llms-txt.ts           /llms.txt for agents
seed/seed.json            Demo content & site identity
scripts/                  Optional local Freeform sync (maintainers)
```

---

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start Astro (syncs local Freeform if a sibling `../freeform` checkout exists) |
| `pnpm freeform:sync` | Rebuild/sync local Freeform + clear Vite cache |
| `pnpm build` | Production build |
| `pnpm deploy` | Build and deploy with Wrangler |

---

## Developing next to Freeform source

Solspace maintainers often keep this site beside [emdash-freeform](https://github.com/solspace/emdash-freeform):

```
emdash/
  freeform/     ← emdash-freeform clone
  cms/          ← this repo
```

With that layout, `package.json` can use `file:../freeform` dependencies and `scripts/dev.mjs` will rebuild/sync the plugin when Freeform changes. Public clones should use the published `@solspace/freeform-astro` package and the registry plugin (as above).

---

## Links

- [Freeform on the EmDash plugin registry](https://plugins.emdashcms.com/plugins/@solspace.com/freeform)
- [emdash-freeform on GitHub](https://github.com/solspace/emdash-freeform)
- [`@solspace/freeform-astro` on npm](https://www.npmjs.com/package/@solspace/freeform-astro)
- [EmDash documentation](https://emdashcms.com)

---

## License

MIT © [Solspace](https://solspace.com)
