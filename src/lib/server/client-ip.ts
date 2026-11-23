import * as env from '$app/env/private';

const FORWARDED_IP_HEADERS = [
	'cf-connecting-ip',
	'true-client-ip',
	'x-real-ip',
	'x-forwarded-for'
] as const;

/**
 * Resolves the original visitor's IP from the SSR request so it can be
 * forwarded to the backend for per-user rate limiting.
 *
 * Without this, every SSR-originated API call reaches the backend with the
 * reverse-proxy/edge IP as its peer address and all users end up sharing a
 * single rate-limit bucket.
 *
 * Header priority (first present wins):
 *  1. `cf-connecting-ip`  — set by Cloudflare to the real visitor IP
 *  2. `true-client-ip`    — Cloudflare Enterprise / generic LBs
 *  3. `x-real-ip`         — common nginx convention
 *  4. `x-forwarded-for`   — leftmost entry (the original client, per the
 *                           de-facto convention; the frontend is the last hop
 *                           it controls, so spoofing was already stripped by
 *                           trusted intermediaries)
 *
 * Returns `null` when no header is present (direct dev access); the backend
 * then falls back to the connection's peer address.
 */
export function resolveClientIp(request: Request): string | null {
	for (const header of FORWARDED_IP_HEADERS) {
		const raw = request.headers.get(header);
		if (!raw) continue;

		const candidate = raw.split(',')[0].trim();
		if (candidate) return candidate;
	}
	return null;
}

/**
 * Builds the outbound headers for an SSR→backend request.
 *
 * - Copies the inbound headers, but replaces service credentials with server-only configuration.
 * - Strips hop-by-hop headers and every client-IP header, then re-adds a
 *   single `x-lawcast-client-ip` resolved from the original request. This
 *   prevents stale or spoofed values from surviving the hop and gives the
 *   backend exactly one authoritative header to key on.
 */
export function buildBackendForwardHeaders(request: Request, clientIp: string | null): Headers {
	const headers = new Headers(request.headers);

	headers.delete('host');
	headers.delete('connection');
	headers.delete('cf-connecting-ip');
	headers.delete('true-client-ip');
	headers.delete('x-real-ip');
	headers.delete('x-forwarded-for');
	headers.delete('x-lawcast-client-ip');
	headers.delete('x-lawcast-service-token');
	if (env.API_SERVICE_URL) {
		getBackendBaseUrl();
		headers.set('x-lawcast-service-token', env.API_SERVICE_TOKEN);
	}

	if (clientIp) {
		headers.set('x-lawcast-client-ip', clientIp);
	}

	return headers;
}

/** Selects the authenticated origin only when its server-only credentials are configured. */
export function getBackendBaseUrl(): string {
	if (env.API_SERVICE_URL) {
		const url = new URL(env.API_SERVICE_URL);
		if (!env.API_SERVICE_TOKEN || (url.protocol !== 'https:' && !import.meta.env.DEV)) {
			throw new Error('The backend service origin requires credentials and HTTPS');
		}
		return env.API_SERVICE_URL.replace(/\/$/, '');
	}
	return (env.API_BASE_URL || 'http://localhost:3001/api').replace(/\/$/, '');
}
