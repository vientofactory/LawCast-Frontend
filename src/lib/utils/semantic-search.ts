const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

/** URL query parameter that carries the semantic search query. */
export const SEMANTIC_SEARCH_QUERY_PARAM = 'search';

/** Query length cap shared by the input, the URL parameter, and the API call. */
export const SEMANTIC_MAX_QUERY_LENGTH = 120;

/**
 * `PUBLIC_SEMANTIC_SEARCH_ENABLED` feature flag.
 * The semantic search entry points must never render unless this is enabled.
 */
export function isSemanticSearchEnabled(raw: string | null | undefined): boolean {
	return ENABLED_VALUES.has((raw || '').trim().toLowerCase());
}

/**
 * Normalize a raw `?search=` value into a runnable query.
 * Trims whitespace and truncates to the shared cap so a hand-edited URL can
 * never bypass the input's own length limit.
 */
export function parseSemanticSearchQuery(raw: string | null | undefined): string {
	return (raw || '').trim().slice(0, SEMANTIC_MAX_QUERY_LENGTH);
}

/**
 * Build the semantic search href, carrying the caller's current keyword so
 * users can continue into semantic search with the words they already typed.
 */
export function buildSemanticSearchHref(query?: string | null): string {
	const parsed = parseSemanticSearchQuery(query);
	if (!parsed) return '/notices/semantic-search';
	return `/notices/semantic-search?${SEMANTIC_SEARCH_QUERY_PARAM}=${encodeURIComponent(parsed)}`;
}

/**
 * Cosine similarity (0..1) as a whole-number percentage, which reads far more
 * intuitively in the result chip than a raw decimal score.
 */
export function formatSimilarityPercent(score: number): string {
	const clamped = Math.min(1, Math.max(0, score));
	return `${Math.round(clamped * 100)}%`;
}
