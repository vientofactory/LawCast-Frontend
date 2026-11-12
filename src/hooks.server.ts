import { markResponseFailure } from '#lib/server/response-cache.ts';
import type { Handle, HandleFetch } from '@sveltejs/kit/hooks';
import { PROXY_CONNECTION_FAILURE_HEADER } from '#lib/utils/request-failure.ts';
import * as env from '$app/env/private';
import { matchForced429, buildForced429Response } from '#lib/server/e2e-rate-limit-sim.ts';
import { resolveClientIp, buildBackendForwardHeaders } from '#lib/server/client-ip.ts';
import { resolveE2eReadClientIp } from '#lib/server/e2e-client-ip.ts';
import { getMockSemanticApiResponse } from '#lib/server/semantic-search-mock.ts';
import { SEARCH_TIMING_HEADER, SEARCH_TRACE_HEADER } from '#lib/utils/search-timing.ts';

const API_PATH_PREFIX = '/api/';
const API_BASE_URL = env.API_BASE_URL || 'http://localhost:3001/api';

// Only response metadata changes here; never parse or minify rendered HTML.
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const liveApi =
		/^\/api\/(?:push(?:\/|$)|discussions(?:\/|$)|notices\/[^/]+\/discussions(?:\/|$)|announcements\/top$)/.test(
			event.url.pathname
		);
	if (response.status < 400 && !event.locals.responseFailureStatus && !liveApi) return response;
	const headers = new Headers(response.headers);
	headers.set('cache-control', 'private, no-store');
	headers.set('cdn-cache-control', 'no-store');
	headers.set('cloudflare-cdn-cache-control', 'no-store');
	// Existing production status-code TTL overrides no-store on HTTP 200 HTML.
	// Keep SvelteKit's data protocol status intact; its URLs already bypass CDN cache.
	const status =
		response.status === 200 && headers.get('content-type')?.includes('text/html')
			? (event.locals.responseFailureStatus ?? 200)
			: response.status;
	return new Response(response.body, { status, headers });
};

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
	const requestUrl = new URL(request.url);
	if (requestUrl.origin !== event.url.origin || !requestUrl.pathname.startsWith(API_PATH_PREFIX)) {
		return fetch(request);
	}

	// Test-only: deterministic 429 simulation for e2e suites (see e2e-rate-limit-sim.ts).
	const forced429 = matchForced429(requestUrl.pathname);
	if (forced429) {
		markResponseFailure(event.locals, { status: 429 });
		return buildForced429Response(forced429.retryAfter);
	}

	// Test-only: canned semantic search responses (see
	// lib/server/semantic-search-mock.ts). Search runs in `+page.server.ts`,
	// so this hook — not the browser-level `page.route` — is the only place a
	// spec can stand in for the backend. Engine status is fetched by the
	// browser, so a spec can also stub it client-side; this mock keeps
	// unstubbed runs on a deterministic ready engine.
	const semanticMock = getMockSemanticApiResponse(
		requestUrl,
		import.meta.env.DEV ? (request.headers.get(SEARCH_TRACE_HEADER) ?? undefined) : undefined
	);
	if (semanticMock) {
		if (!semanticMock.ok) markResponseFailure(event.locals, { status: semanticMock.status });
		// Keep fixture processing durations inside the measured frontend window.
		if (import.meta.env.DEV && semanticMock.headers.has(SEARCH_TIMING_HEADER))
			await new Promise((resolve) => setTimeout(resolve, 35));
		return semanticMock;
	}

	// Forward the original visitor's IP so the backend rate-limits per user
	// instead of per edge/proxy address (see lib/server/client-ip.ts). The
	// integration suite swaps in a distinct IP per read (see
	// lib/server/e2e-client-ip.ts) so one machine is not one rate-limit bucket.
	const clientIp = resolveE2eReadClientIp(request) ?? resolveClientIp(event.request);
	const headers = buildBackendForwardHeaders(request, clientIp);
	if (!import.meta.env.DEV) headers.delete(SEARCH_TRACE_HEADER);

	const targetUrl = `${API_BASE_URL.replace(/\/$/, '')}${requestUrl.pathname.slice('/api'.length)}${requestUrl.search}`;

	// IMPORTANT: the sanitized headers must be passed in the Request init —
	// SvelteKit's handleFetch normalization ignores a separate fetch() init
	// when the first argument is already a Request object, which silently
	// dropped every forwarded header (and collapsed all users into the edge
	// IP's shared rate-limit bucket).
	const body =
		request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

	const response = await fetch(
		new Request(targetUrl, {
			method: request.method,
			signal: request.signal,
			headers,
			body
		})
	);
	if (!response.ok) markResponseFailure(event.locals, { status: response.status });
	const responseHeaders = new Headers(response.headers);
	responseHeaders.delete(PROXY_CONNECTION_FAILURE_HEADER);
	if (!import.meta.env.DEV) responseHeaders.delete(SEARCH_TIMING_HEADER);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: responseHeaders
	});
};
