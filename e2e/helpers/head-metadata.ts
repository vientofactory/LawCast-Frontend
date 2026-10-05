import { expect, type Page } from '@playwright/test';

/**
 * Share-facing head tags that must exist exactly once and, on a result view,
 * name the query behind the results. `twitter:card` / `og:site_name` live in
 * the shared layout head, so they are not part of this per-page contract.
 */
const QUERY_BEARING_TAGS = [
	{ selector: 'meta[name="description"]', attribute: 'content' },
	{ selector: 'meta[property="og:title"]', attribute: 'content' },
	{ selector: 'meta[property="og:description"]', attribute: 'content' }
] as const;

/** Test queries are literal user text, so escape them before building a RegExp. */
function literal(text: string): RegExp {
	return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

/**
 * Pins the head contract of a search-facing page: exactly one `<title>` and
 * one copy of every share-facing tag, with a canonical URL that stays on the
 * clean route (filtered views are not indexed separately). Pass `query` on a
 * result view to additionally require title, description and og tags to echo
 * that query.
 */
export async function expectHeadMetadata(
	page: Page,
	{ query, canonical }: { query?: string; canonical: RegExp }
): Promise<void> {
	await expect(page.locator('title')).toHaveCount(1);
	if (query) await expect(page).toHaveTitle(literal(query));

	const canonicalTag = page.locator('link[rel="canonical"]');
	await expect(canonicalTag).toHaveCount(1);
	await expect(canonicalTag).toHaveAttribute('href', canonical);

	for (const { selector, attribute } of QUERY_BEARING_TAGS) {
		const tag = page.locator(selector);
		await expect(tag).toHaveCount(1);
		if (query) await expect(tag).toHaveAttribute(attribute, literal(query));
	}
}
