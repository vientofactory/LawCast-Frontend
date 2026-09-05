import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';

const BASE_URL = env.API_BASE_URL || 'http://localhost:3001/api';

async function forwardRequest(
	method: string,
	path: string,
	request: Request,
	fetch: typeof globalThis.fetch,
	url: URL
) {
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
