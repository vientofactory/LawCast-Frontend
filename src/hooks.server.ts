import type { HandleFetch } from '@sveltejs/kit';

const API_PATH_PREFIX = '/api/';

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
	const requestUrl = new URL(request.url);
	if (requestUrl.origin !== event.url.origin || !requestUrl.pathname.startsWith(API_PATH_PREFIX)) {
		return fetch(request);
	}

	const clientIp = event.request.headers.get('cf-connecting-ip');
	if (!clientIp) {
		return fetch(request);
	}

	const headers = new Headers(request.headers);
	headers.set('cf-connecting-ip', clientIp);

	return fetch(new Request(request, { headers }));
};
