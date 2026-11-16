import handler from "@astrojs/cloudflare/entrypoints/server";

// EmDash 1.5 — co-editing Durable Objects + plugin sandbox bridge.
// Enable with `coEditing: true` in astro.config once EMDASH_ROOMS is bound.
export { EmDashRoom, EmDashRoomSite } from "@emdash-cms/cloudflare/worker";
export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";

export default handler;
