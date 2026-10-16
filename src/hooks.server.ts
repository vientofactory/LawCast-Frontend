import type { HandleFetch } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { matchForced429, buildForced429Response } from '$lib/server/e2e-rate-limit-sim';
import { resolveClientIp, buildBackendForwardHeaders } from '$lib/server/client-ip';
import { resolveE2eReadClientIp } from '$lib/server/e2e-client-ip';
import { getMockSemanticApiResponse } from '$lib/server/semantic-search-mock';

const API_PATH_PREFIX = '/api/';
const API_BASE_URL = env.API_BASE_URL || 'http://localhost:3001/api';

// NOTE: there is intentionally no `handle` hook in this file. SSR HTML used
// to be re-parsed and minified per request (html-minifier-terser), which
// burned edge-function CPU on every page view and correlated with
// intermittent Cloudflare 1102/plain-404 failures, so the hook was removed
// and responses now pass through untouched.
// Cloudflare challenge 403 simulation for e2e tests is handled by
// `cf-challenge-test/+page.server.ts`, which throws inside a page loader.

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
	const requestUrl = new URL(request.url);
	if (requestUrl.origin !== event.url.origin || !requestUrl.pathname.startsWith(API_PATH_PREFIX)) {
		return fetch(request);
	}

	// Test-only: deterministic 429 simulation for e2e suites (see e2e-rate-limit-sim.ts).
	const forced429 = matchForced429(requestUrl.pathname);
	if (forced429) {
		return buildForced429Response(forced429.retryAfter);
	}

	// Test-only: canned semantic search responses (see
	// lib/server/semantic-search-mock.ts). Search runs in `+page.server.ts`,
	// so this hook — not the browser-level `page.route` — is the only place a
	// spec can stand in for the backend. Engine status is fetched by the
	// browser, so a spec can also stub it client-side; this mock keeps
	// unstubbed runs on a deterministic ready engine.
	const semanticMock = getMockSemanticApiResponse(requestUrl);
	if (semanticMock) {
		return semanticMock;
	}

	// Forward the original visitor's IP so the backend rate-limits per user
	// instead of per edge/proxy address (see lib/server/client-ip.ts). The
	// integration suite swaps in a distinct IP per read (see
	// lib/server/e2e-client-ip.ts) so one machine is not one rate-limit bucket.
	const clientIp = resolveE2eReadClientIp(request) ?? resolveClientIp(event.request);
	const headers = buildBackendForwardHeaders(request, clientIp);

	const targetUrl = `${API_BASE_URL.replace(/\/$/, '')}${requestUrl.pathname.slice('/api'.length)}${requestUrl.search}`;

	// IMPORTANT: the sanitized headers must be passed in the Request init —
	// SvelteKit's handleFetch normalization ignores a separate fetch() init
	// when the first argument is already a Request object, which silently
	// dropped every forwarded header (and collapsed all users into the edge
	// IP's shared rate-limit bucket).
	const body =
		request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

	return fetch(
		new Request(targetUrl, {
			method: request.method,
			headers,
			body
		})
	);
};
