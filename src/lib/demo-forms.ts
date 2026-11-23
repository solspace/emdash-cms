/**
 * Human demo gallery — independent of Freeform "List for AI agents".
 *
 * Agent discovery uses list-public-forms (opt-in). The public showcase must
 * still work when that flag is off, so we load forms via public get-form.
 */

export type DemoForm = {
	id: string;
	handle: string;
	name: string;
	fieldCount?: number;
	cardColor?: string | null;
	description?: string | null;
};

/** Handles shown on the Freeform demo homepage /forms browser. */
export const DEMO_FORM_HANDLES = [
	"contact",
	"job_application",
	"support_ticket",
	"event_rsvp",
	"newsletter_signup",
] as const;

type FetcherLike = { fetch: typeof fetch };

function fieldCountFromRows(rows: unknown): number {
	if (!Array.isArray(rows)) return 0;
	return rows.reduce((n, row) => {
		const fields = row && typeof row === "object" && "fields" in row ? (row as { fields?: unknown }).fields : null;
		return n + (Array.isArray(fields) ? fields.length : 0);
	}, 0);
}

function unwrapForm(json: unknown): Record<string, unknown> | null {
	if (!json || typeof json !== "object") return null;
	const body = json as { success?: boolean; data?: Record<string, unknown> };
	if (body.data && typeof body.data === "object") return body.data;
	if ("handle" in body || "name" in body) return body as Record<string, unknown>;
	return null;
}

/** Load one form for public display / embed (no agentDiscoverable required). */
export async function fetchPublicForm(
	origin: string,
	fetcher: FetcherLike,
	handle: string,
): Promise<DemoForm | null> {
	try {
		const res = await fetcher.fetch(
			`${origin}/_emdash/api/plugins/freeform/get-form?id=${encodeURIComponent(handle)}`,
		);
		if (!res.ok) return null;
		const data = unwrapForm(await res.json());
		if (!data || typeof data.handle !== "string" || typeof data.name !== "string") {
			return null;
		}
		return {
			id: typeof data.id === "string" ? data.id : handle,
			handle: data.handle,
			name: data.name,
			fieldCount: fieldCountFromRows(data.rows),
			cardColor: typeof data.cardColor === "string" ? data.cardColor : null,
			description: typeof data.description === "string" ? data.description : null,
		};
	} catch {
		return null;
	}
}

/** Forms for the human demo gallery (skips missing handles). */
export async function fetchDemoForms(
	origin: string,
	fetcher: FetcherLike,
	handles: readonly string[] = DEMO_FORM_HANDLES,
): Promise<DemoForm[]> {
	const out: DemoForm[] = [];
	for (const handle of handles) {
		const form = await fetchPublicForm(origin, fetcher, handle);
		if (form) out.push(form);
	}
	return out;
}
