import type { BoardSearchMode } from '$lib/types/api';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

/** Board search-mode options, in display order. */
export const BOARD_SEARCH_MODES: BoardSearchMode[] = ['auto', 'keyword', 'semantic'];

/** Korean labels for the board search-mode segmented control. */
export const BOARD_SEARCH_MODE_LABELS: Record<BoardSearchMode, string> = {
	auto: '자동',
	keyword: '키워드',
	semantic: '의미'
};

/**
 * Normalize a raw `?searchMode=` value for the `/notices` board. Unknown or
 * absent values fall back to the feature-flag default: `auto` (semantic-first)
 * when semantic search is enabled, plain `keyword` otherwise.
 */
export function normalizeBoardSearchMode(
	raw: string | null | undefined,
	semanticEnabled: boolean
): BoardSearchMode {
	const value = (raw || '').trim().toLowerCase();
	if (value === 'keyword' || value === 'semantic' || value === 'auto') {
		return value;
	}
	return semanticEnabled ? 'auto' : 'keyword';
}

/** Human label for a chunk section; the engine labels unsectioned text 'body'. */
export function formatSectionLabel(section: string): string {
	return section === 'body' ? '본문' : section;
}

/**
 * Plain-language description of what each board search mode does.
 *
 * The board is used by readers who have never seen an "embedding" — the labels
 * `자동`/`키워드`/`의미` alone cannot tell them which mode to pick, and a reader who needs
 * the exhaustive list (e.g. a legal professional verifying coverage) has to know
 * that only keyword mode is exhaustive. Shown as the visible hint under the
 * segmented control and as each option's tooltip.
 */
export const BOARD_SEARCH_MODE_HINTS: Record<BoardSearchMode, string> = {
	auto: '질문처럼 입력하면 뜻이 비슷한 법률안까지 찾고, 못 찾으면 키워드로 찾아요',
	keyword: '법률안명·소관위원회·제안자를 그대로 찾고 해당하는 결과를 빠짐없이 보여줘요',
	semantic: '질문처럼 입력하면 뜻이 비슷한 법률안까지 관련도순으로 찾아요'
};

/**
 * Explanations for the relevance chips on a semantic result.
 * Without these, a similarity percentage reads as a verdict rather than a hint.
 */
export const BOARD_RELEVANCE_HINTS = {
	score: '검색어와 이 법률안 문단이 얼마나 비슷한지 나타내는 참고 지표예요(높을수록 비슷함).',
	section: '검색어와 가장 비슷한 부분이에요.',
	excerpt: '원문에서 검색어와 가장 비슷한 문장을 발췌했어요.'
} as const;

/**
 * How many weak-tier results the reveal renders at a time.
 *
 * The engine hands back its whole below-threshold candidate pool, which on the
 * `/notices` board is `semanticSearch.hybridMaxNotices` (100). Rendering that
 * pool in full buries the reader: a nonsense query (`달빛조각사`) measured on the
 * live index returned exactly 100 weak hits sitting in a 0.33-0.39 score band,
 * i.e. a page of equally unrelated bills. The reveal therefore pages in batches
 * of this size and keeps the total visible instead of quoting a number nobody
 * can act on.
 */
export const WEAK_RESULT_PAGE_SIZE = 10;

/**
 * Copy for the weak-tier reveal offer, used before the reader asks for it.
 * Kept here so the board and the dedicated semantic page cannot drift.
 */
export function describeWeakReveal(total: number): string {
	const formatted = total.toLocaleString('ko-KR');
	return total > WEAK_RESULT_PAGE_SIZE
		? `관련도가 낮은 결과가 ${formatted}건 있어요. 관련도가 높은 ${WEAK_RESULT_PAGE_SIZE}건부터 보여드려요.`
		: `관련도가 낮은 결과 ${formatted}건이 있어요. 확인하려면 아래 버튼을 눌러 주세요.`;
}

/** Progress label while paging a long weak tier, e.g. "100건 중 10건 표시 중". */
export function describeWeakProgress(shown: number, total: number): string {
	return `${total.toLocaleString('ko-KR')}건 중 ${shown.toLocaleString('ko-KR')}건 표시 중`;
}

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
 *
 * A per-request random draw is the intended behavior: the chips exist to show
 * the range of questions this box accepts, so a visitor who reloads should meet
 * a different slice of the pool. A deterministic per-KST-day variant (a fixed
 * set for every visitor until midnight) was tried in this session and reverted
 * on 2026-10-13 — do not reintroduce day-determinism without owner sign-off.
 * The draw stays on the server for the reason above; the SSR HTML of a given
 * navigation is what both the server and the client render, so randomizing here
 * never swaps chips after paint (pinned by `semantic-search.spec.ts`,
 * `captureSsrChips`).
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
