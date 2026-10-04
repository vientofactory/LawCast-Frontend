const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

/** URL query parameter that carries the semantic search query. */
export const SEMANTIC_SEARCH_QUERY_PARAM = 'search';

/** Query length cap shared by the input, the URL parameter, and the API call. */
export const SEMANTIC_MAX_QUERY_LENGTH = 120;

/** Everyday-language example queries offered as one-tap chips on first load. */
export const SEMANTIC_EXAMPLE_QUERIES = [
	'집주인이 보증금 안돌려줌',
	'전세 사기 피해자 구제',
	'퇴근 후 카톡 업무 지시',
	'직장 내 괴롭힘 신고',
	'딥페이크 처벌 강화',
	'AI가 만든 그림 저작권',
	'가짜 뉴스 유포 처벌',
	'카페 일회용컵 사용 규제',
	'플라스틱 사용 줄이기',
	'반려동물 학대 처벌',
	'배달라이더 산재 보험',
	'플랫폼 노동자 처우 개선',
	'미세먼지 기준 강화',
	'소상공인 임대료 부담',
	'청소년 스마트폰 중독',
	'전기차 충전소 늘리기',
	'병원비 부담 줄이기',
	'개인정보 유출 피해 구제'
];

/** How many examples the initial state shows at once. */
export const SEMANTIC_EXAMPLE_COUNT = 3;

/**
 * Draw `SEMANTIC_EXAMPLE_COUNT` distinct example queries at random.
 *
 * Runs in `+page.server.ts` so the SSR HTML already carries the chosen set and
 * the client paints exactly what it hydrates — picking on the client instead
 * would swap the chips right after first paint and make them flicker.
 */
export function pickExampleQueries(): string[] {
	const pool = [...SEMANTIC_EXAMPLE_QUERIES];
	const picked: string[] = [];
	while (picked.length < SEMANTIC_EXAMPLE_COUNT && pool.length > 0) {
		const index = Math.floor(Math.random() * pool.length);
		picked.push(pool.splice(index, 1)[0]);
	}
	return picked;
}

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
