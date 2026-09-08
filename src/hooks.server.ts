import type { HandleFetch } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const API_PATH_PREFIX = '/api/';
const API_BASE_URL = env.API_BASE_URL || 'http://localhost:3001/api';

export const handleFetch: HandleFetch = async ({ event, request, fetch }) => {
	const requestUrl = new URL(request.url);
	if (requestUrl.origin !== event.url.origin || !requestUrl.pathname.startsWith(API_PATH_PREFIX)) {
		return fetch(request);
	}

	const headers = new Headers(request.headers);
	headers.delete('cf-connecting-ip');
	headers.delete('x-forwarded-for');
	headers.delete('x-lawcast-client-ip');

	const clientIp = event.request.headers.get('cf-connecting-ip');
	if (clientIp) {
		headers.set('x-lawcast-client-ip', clientIp);
	}

	const targetUrl = `${API_BASE_URL.replace(/\/$/, '')}${requestUrl.pathname.slice('/api'.length)}${requestUrl.search}`;

	return fetch(new Request(targetUrl, request), { headers });
};
