import { isDiffchainUiMockEnabled } from './diffchain-ui-mock';
import type { SemanticEngineHealthResponse, SemanticSearchResponse } from '#lib/types/api.ts';
import { SEARCH_TIMING_HEADER } from '#lib/utils/search-timing.ts';

/**
 * Test-only canned responses for the semantic search API.
 *
 * The search runs inside `+page.server.ts`, so the browser never issues the
 * request and Playwright's `page.route` cannot reach it: server-side fetches
 * are answered by `handleFetch` (hooks.server.ts), which is where this mock is
 * consulted. The engine status request is the mirror case: the browser DOES
 * issue it, so specs can override it with `page.route`, while this mock keeps
 * unstubbed runs deterministic (a ready engine) instead of depending on a
 * real backend being reachable.
 *
 * A query picks its fixture through a marker substring, so a spec chooses a
 * scenario by choosing what it searches for:
 *
 * - `레이트리밋` -> 429 with `Retry-After` (rate-limit overlay)
 * - `오류`       -> 500 (error alert)
 * - `않는`       -> empty result list (empty state)
 * - `약한`       -> empty clear tier + one weak hit (reveal-button state)
 * - `약한 여러`  -> empty clear tier + a weak band longer than one page (paging state)
 * - `혼합 결과` -> one clear hit plus a paged weak band
 * - `키워드`     -> `keyword_fallback` response (fallback banner)
 * - anything else -> one sample result
 *
 * Enabled together with the rest of the mock mode (`DIFFCHAIN_UI_MOCK=1`).
 */
const RATE_LIMIT_MARKER = '레이트리밋';
const ERROR_MARKER = '오류';
const EMPTY_MARKER = '않는';
const WEAK_MARKER = '약한';
const MANY_WEAK_MARKER = '여러';
const MIXED_TIERS_MARKER = '혼합 결과';
const FALLBACK_MARKER = '키워드';

const HEALTH_PATH = '/api/notices/semantic-search/health';

// Ready engine: the default so the search-unavailable overlay stays out of
// the way unless a spec explicitly stubs a not-ready or failing status.
const ENGINE_HEALTH: SemanticEngineHealthResponse = {
	status: 'ready',
	indexedChunks: 93031,
	lastUpdateAt: '2026-10-02T12:00:00+00:00',
	lastUpdateTriggeredAt: '2026-10-02T13:00:00+00:00'
};

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

/**
 * Weak band longer than `WEAK_RESULT_PAGE_SIZE`, so the paged reveal has a
 * fixture: the live engine returns its whole below-threshold pool (up to 100).
 */
function buildManyWeakResults(): SemanticSearchResponse['weakResults'] {
	return Array.from({ length: 12 }, (_, index) => ({
		...WEAK_RESULT,
		noticeNum: WEAK_RESULT.noticeNum + index * 1000,
		subject: `${WEAK_RESULT.subject} (${index + 1})`,
		score: Math.max(0.26, 0.31 - index * 0.004)
	}));
}

const FALLBACK_REASON = '의미 검색 엔진을 사용할 수 없어 키워드 검색 결과를 반환합니다.';

export function getMockSemanticApiResponse(url: URL, traceId?: string): Response | null {
	if (!isDiffchainUiMockEnabled()) return null;
	if (url.pathname === HEALTH_PATH) {
		return Response.json({ success: true, data: ENGINE_HEALTH });
	}
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
	const mixedTiers = query.includes(MIXED_TIERS_MARKER);
	const weakBand =
		mixedTiers || query.includes(MANY_WEAK_MARKER) ? buildManyWeakResults() : [WEAK_RESULT];
	const results = empty || weakOnly ? [] : [SAMPLE_RESULT];
	const payload: SemanticSearchResponse = {
		query,
		mode: fallback ? 'keyword_fallback' : 'semantic',
		fallbackReason: fallback ? FALLBACK_REASON : null,
		lastUpdateAt: null,
		results: fallback
			? results.map((result) => ({ ...result, score: null, section: null, excerpt: null }))
			: results,
		weakResults: !fallback && (weakOnly || mixedTiers) ? weakBand : []
	};

	const response = Response.json({ success: true, data: payload });
	if (traceId && (query === '검색 타이밍 검증' || query === 'gRPC 타이밍 검증')) {
		const status = (httpCode: number, grpcCode: number) =>
			query === 'gRPC 타이밍 검증'
				? { transport: 'grpc', grpcCode }
				: { transport: 'http', status: httpCode };
		response.headers.set(
			SEARCH_TIMING_HEADER,
			JSON.stringify({
				traceId,
				backendMs: 25.5,
				omittedCalls: 0,
				sidecarCalls: [
					{ path: '/health', ...status(200, 0), outcome: 'ok', startMs: 1, roundTripMs: 1 },
					{
						path: '/search',
						chunkK: 30,
						...status(422, 11),
						outcome: 'error',
						startMs: 3,
						roundTripMs: 2
					},
					{
						path: '/search',
						chunkK: 10,
						...status(200, 0),
						outcome: 'ok',
						startMs: 7,
						roundTripMs: 14,
						timings: {
							denseMs: 8,
							admissionMs: 0.25,
							rankWaitMs: 0,
							annotateMs: 2,
							totalMs: 10,
							denseStages: {
								embedding: { startMs: 0.5, durationMs: 4 },
								faiss: { startMs: 5, durationMs: 1.5 },
								classification: { startMs: 6.5, durationMs: 1 }
							}
						}
					}
				]
			})
		);
	}
	return response;
}
