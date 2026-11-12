import * as env from '$app/env/private';
import type { RequestHandler } from './$types';
import { getFailureKind, PROXY_CONNECTION_FAILURE_HEADER } from '#lib/utils/request-failure.ts';
import {
	getMockArchiveNoticesResponse,
	getMockDiscussionThread,
	getMockNoticeChanges,
	getMockNoticeDiscussions,
	getMockAllDiscussionThreads,
	getMockAdminNotices,
	PROGRESSIVE_HISTORY_MOCK,
	isDiffchainUiMockEnabled
} from '#lib/server/diffchain-ui-mock.ts';
import { getMockSemanticApiResponse } from '#lib/server/semantic-search-mock.ts';
import { matchForced429, buildForced429Response } from '#lib/server/e2e-rate-limit-sim.ts';
import { resolveClientIp, buildBackendForwardHeaders } from '#lib/server/client-ip.ts';
import { SEARCH_TIMING_HEADER, SEARCH_TRACE_HEADER } from '#lib/utils/search-timing.ts';

import { isSemanticSearchKValid, SEMANTIC_SEARCH_K_ERROR } from '#lib/utils/semantic-search.ts';

const BASE_URL = env.API_BASE_URL || 'http://localhost:3001/api';

function parseNonNegativeInteger(value: string | null, fallback: number): number {
	if (value === null) return fallback;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function getMockResponse(path: string, url: URL): Promise<Response | null> {
	if (!isDiffchainUiMockEnabled()) return null;

	if (path === 'announcements/top') {
		const { items } = getMockAdminNotices();
		const top =
			url.searchParams.get('urgent') === 'true' ? items.find((item) => item.urgent) : items[0];
		return Response.json({
			success: true,
			data: { item: top ? { id: top.id, title: top.title } : null }
		});
	}
	if (path === 'discussions/threads')
		return Response.json({ success: true, data: getMockAllDiscussionThreads() });
	const noticeDiscussions = /^notices\/(\d+)\/discussions$/.exec(path);
	if (noticeDiscussions)
		return Response.json({
			success: true,
			data: getMockNoticeDiscussions(Number(noticeDiscussions[1]))
		});

	const historyMatch = path.match(/^notices\/(\d+)\/changes$/);
	if (historyMatch) {
		const raw = url.searchParams.get('beforeHeight');
		if (raw !== null && (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)))) {
			return Response.json(
				{ success: false, message: '기록 번호가 올바르지 않습니다.' },
				{ status: 400 }
			);
		}
		// Delay only older pages of the manual fixture so its skeleton is observable.
		if (raw !== null && Number(historyMatch[1]) === PROGRESSIVE_HISTORY_MOCK.noticeNum) {
			await new Promise((resolve) => setTimeout(resolve, PROGRESSIVE_HISTORY_MOCK.pageDelayMs));
		}
		return Response.json({
			success: true,
			data: getMockNoticeChanges(Number(historyMatch[1]), {
				limit: parseNonNegativeInteger(url.searchParams.get('limit'), 20),
				beforeHeight: raw === null ? undefined : Number(raw)
			})
		});
	}

	// The board's on-demand keyword-count check is a BROWSER-issued archive read,
	// and `handleFetch` only intercepts server-side calls — so without this branch
	// mock mode answers the seam with a 502 from an absent backend.
	if (path === 'notices/archive') {
		const rawMode = url.searchParams.get('searchMode');
		const isDoneParam = url.searchParams.get('isDone');

		return Response.json({
			success: true,
			data: getMockArchiveNoticesResponse({
				page: parseNonNegativeInteger(url.searchParams.get('page'), 1),
				limit: parseNonNegativeInteger(url.searchParams.get('limit'), 20),
				search: url.searchParams.get('search') ?? '',
				proposer: url.searchParams.get('proposer') ?? '',
				startDate: url.searchParams.get('startDate') ?? '',
				endDate: url.searchParams.get('endDate') ?? '',
				sortOrder: url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc',
				isDone: isDoneParam === 'true' ? true : isDoneParam === 'false' ? false : undefined,
				// Lenient like the API: only the two switching values pick a semantic path.
				searchMode: rawMode === 'semantic' || rawMode === 'auto' ? rawMode : 'keyword'
			})
		});
	}

	const threadDetailMatch = path.match(/^discussions\/threads\/(\d+)$/);
	if (!threadDetailMatch) return null;

	const threadId = Number.parseInt(threadDetailMatch[1], 10);
	const cursor = parseNonNegativeInteger(url.searchParams.get('cursor'), 0);
	const limit = parseNonNegativeInteger(url.searchParams.get('limit'), 20);
	return Response.json({
		success: true,
		data: getMockDiscussionThread(threadId, undefined, { cursor, limit })
	});
}

async function forwardRequest(
	method: string,
	path: string,
	request: Request,
	fetch: typeof globalThis.fetch,
	url: URL
) {
	if (method === 'GET') {
		if (path === 'notices/semantic-search' || path === 'notices/semantic-search/') {
			const values = url.searchParams.getAll('k');
			if (values.length > 1 || (values[0] !== undefined && !isSemanticSearchKValid(values[0]))) {
				return Response.json(
					{ success: false, message: SEMANTIC_SEARCH_K_ERROR },
					{ status: 400, headers: { 'cache-control': 'no-store' } }
				);
			}
		}
		const mockResponse = await getMockResponse(path, url);
		if (mockResponse) return mockResponse;
		// This proxy is the seam for BROWSER-issued /api requests (handleFetch
		// never sees them: the forward below goes cross-origin to the backend),
		// so the semantic engine status must be mocked here — otherwise mock
		// mode answers with a 502 from an absent backend, which the semantic
		// search page correctly reads as "status cannot be fetched".
		const semanticMock = getMockSemanticApiResponse(url);
		if (semanticMock) return semanticMock;
	}

	// Test-only: deterministic 429 simulation for e2e suites (see e2e-rate-limit-sim.ts).
	const forced429 = matchForced429(url.pathname);
	if (forced429) {
		return buildForced429Response(forced429.retryAfter);
	}

	const targetUrl = `${BASE_URL}/${path}${url.search}`;

	try {
		// Forward the original visitor's IP so the backend rate-limits per user
		// instead of per edge/proxy address (see lib/server/client-ip.ts).
		const headers = buildBackendForwardHeaders(request, resolveClientIp(request));
		headers.delete(SEARCH_TRACE_HEADER);

		// Body stream forwarding
		const body = method === 'GET' || method === 'HEAD' ? undefined : await request.blob();

		const response = await fetch(targetUrl, {
			method,
			signal: request.signal,
			headers,
			body
		});

		const responseHeaders = new Headers(response.headers);
		responseHeaders.delete(PROXY_CONNECTION_FAILURE_HEADER);
		responseHeaders.delete(SEARCH_TIMING_HEADER);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders
		});
	} catch (err) {
		console.error(`Proxy error: ${err}`);
		const kind = getFailureKind(err);
		const failureHeaders = new Headers({ 'cache-control': 'no-store' });
		if (kind === 'network' || kind === 'timeout')
			failureHeaders.set(PROXY_CONNECTION_FAILURE_HEADER, kind);
		return Response.json(
			{
				message:
					kind === 'network' ? '데이터 서버에 연결하지 못했습니다.' : '요청을 처리하지 못했습니다.'
			},
			{ status: 502, headers: failureHeaders }
		);
	}
}

export const GET: RequestHandler = async ({ params, request, fetch, url }) => {
	return forwardRequest('GET', params.path, request, fetch, url);
};

export const POST: RequestHandler = async ({ params, request, fetch, url }) => {
	return forwardRequest('POST', params.path, request, fetch, url);
};

export const PUT: RequestHandler = async ({ params, request, fetch, url }) => {
	return forwardRequest('PUT', params.path, request, fetch, url);
};

export const PATCH: RequestHandler = async ({ params, request, fetch, url }) => {
	return forwardRequest('PATCH', params.path, request, fetch, url);
};

export const DELETE: RequestHandler = async ({ params, request, fetch, url }) => {
	return forwardRequest('DELETE', params.path, request, fetch, url);
};
