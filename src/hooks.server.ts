import type { HandleFetch } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { matchForced429, buildForced429Response } from '$lib/server/e2e-rate-limit-sim';
import { resolveClientIp, buildBackendForwardHeaders } from '$lib/server/client-ip';

const API_PATH_PREFIX = '/api/';
const API_BASE_URL = env.API_BASE_URL || 'http://localhost:3001/api';

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

	// Forward the original visitor's IP so the backend rate-limits per user
	// instead of per edge/proxy address (see lib/server/client-ip.ts).
	const headers = buildBackendForwardHeaders(request, resolveClientIp(event.request));

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
