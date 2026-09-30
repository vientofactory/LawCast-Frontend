const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

/**
 * `PUBLIC_SEMANTIC_SEARCH_ENABLED` feature flag.
 * The semantic search entry points must never render unless this is enabled.
 */
export function isSemanticSearchEnabled(raw: string | null | undefined): boolean {
	return ENABLED_VALUES.has((raw || '').trim().toLowerCase());
}
