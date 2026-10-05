import { isDiffchainUiMockEnabled } from './diffchain-ui-mock';
import type { SemanticSearchResponse } from '$lib/types/api';

/**
 * Test-only canned responses for the semantic search API.
 *
 * The search runs inside `+page.server.ts`, so the browser never issues the
 * request and Playwright's `page.route` cannot reach it: server-side fetches
 * are answered by `handleFetch` (hooks.server.ts), which is where this mock is
 * consulted.
 *
 * A query picks its fixture through a marker substring, so a spec chooses a
 * scenario by choosing what it searches for:
 *
 * - `레이트리밋` -> 429 with `Retry-After` (rate-limit overlay)
 * - `오류`       -> 500 (error alert)
 * - `않는`       -> empty result list (empty state)
 * - `약한`       -> empty clear tier + one weak hit (reveal-button state)
 * - `키워드`     -> `keyword_fallback` response (fallback banner)
 * - anything else -> one sample result
 *
 * Enabled together with the rest of the mock mode (`DIFFCHAIN_UI_MOCK=1`).
 */
const RATE_LIMIT_MARKER = '레이트리밋';
const ERROR_MARKER = '오류';
const EMPTY_MARKER = '않는';
const WEAK_MARKER = '약한';
const FALLBACK_MARKER = '키워드';

const RETRY_AFTER_SECONDS = 5;

const SAMPLE_RESULT: SemanticSearchResponse['results'][number] = {
	noticeNum: 2220607,
	subject: '상가건물 임대차보호법 일부개정법률안',
	committee: '법무부',
	section: '주요내용',
	score: 0.586,
	excerpt: '점유를 회복할 필요가 있는 경우에 임대인이 계약을 해지할 수 있도록 함.'
};

// Below CLEAR_SIMILARITY (0.45) but above the relatedness floor (0.25):
// exactly the band the empty state hides behind its reveal button.
const WEAK_RESULT: SemanticSearchResponse['weakResults'][number] = {
	noticeNum: 2220901,
	subject: '노후 주거지 재건축 촉진 법률안',
	committee: '국토교통위원회',
	section: '제안이유',
	score: 0.31,
	excerpt: '관련도가 낮아 기본 결과에는 표시되지 않는 검색 결과입니다.'
};

const FALLBACK_REASON = '의미 검색 엔진을 사용할 수 없어 키워드 검색 결과를 반환합니다.';

export function getMockSemanticSearchResponse(url: URL): Response | null {
	if (!isDiffchainUiMockEnabled()) return null;
	if (url.pathname !== '/api/notices/semantic-search') return null;

	const query = (url.searchParams.get('query') || '').trim();
	if (!query) return null;

	if (query.includes(RATE_LIMIT_MARKER)) {
		return new Response(
			JSON.stringify({
				statusCode: 429,
				message: 'Too many requests. Please retry shortly.',
				retryAfter: RETRY_AFTER_SECONDS
			}),
			{
				status: 429,
				headers: {
					'content-type': 'application/json',
					'retry-after': String(RETRY_AFTER_SECONDS)
				}
			}
		);
	}

	if (query.includes(ERROR_MARKER)) {
		return Response.json(
			{
				success: false,
				statusCode: 500,
				message: '검색 서비스를 일시적으로 사용할 수 없습니다.'
			},
			{ status: 500 }
		);
	}
	const fallback = query.includes(FALLBACK_MARKER);
	const empty = query.includes(EMPTY_MARKER);
	const weakOnly = query.includes(WEAK_MARKER);
	const results = empty || weakOnly ? [] : [SAMPLE_RESULT];
	const payload: SemanticSearchResponse = {
		query,
		mode: fallback ? 'keyword_fallback' : 'semantic',
		fallbackReason: fallback ? FALLBACK_REASON : null,
		lastUpdateAt: null,
		results: fallback
			? results.map((result) => ({ ...result, score: null, section: null, excerpt: null }))
			: results,
		weakResults: fallback ? [] : weakOnly ? [WEAK_RESULT] : []
	};

	return Response.json({ success: true, data: payload });
}
