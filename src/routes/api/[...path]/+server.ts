import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getMockDiscussionThread, isDiffchainUiMockEnabled } from '$lib/server/diffchain-ui-mock';

const BASE_URL = env.API_BASE_URL || 'http://localhost:3001/api';

function parseNonNegativeInteger(value: string | null, fallback: number): number {
	if (value === null) return fallback;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getMockResponse(path: string, url: URL): Response | null {
	if (!isDiffchainUiMockEnabled()) return null;

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
		const mockResponse = getMockResponse(path, url);
		if (mockResponse) return mockResponse;
	}

	const targetUrl = `${BASE_URL}/${path}${url.search}`;

	try {
		const headers = new Headers(request.headers);
		headers.delete('host');
		headers.delete('connection');

		// Body stream forwarding
		const body = method === 'GET' || method === 'HEAD' ? undefined : await request.blob();

		const response = await fetch(targetUrl, {
			method,
			headers,
			body
		});

		return response;
	} catch (err) {
		console.error(`Proxy error: ${err}`);
		throw error(502, 'Bad Gateway');
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
