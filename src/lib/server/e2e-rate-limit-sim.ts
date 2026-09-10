import { env } from '$env/dynamic/private';

/**
 * Test-only hook: when `E2E_FORCE_429_PATHS` is set, requests whose path
 * matches one of the comma-separated prefixes get a 429 response without
 * touching the backend. Used by Playwright to exercise the frontend's
 * rate-limit handling deterministically.
 *
 * Entry format: `/api/some/path` or `/api/some/path:seconds` where
 * `seconds` overrides the default Retry-After (60).
 *
 * Example: E2E_FORCE_429_PATHS=/api/notices/changes:120,/api/stats
 * The changes page default limit is 20 now, matching the frontend changes.
 */
export function matchForced429(pathname: string): { retryAfter: number } | null {
	const raw = env.E2E_FORCE_429_PATHS?.trim();
	if (!raw) return null;

	const entries = raw
		.split(',')
		.map((value) => value.trim())
		.filter((value) => value.length > 0);

	for (const entry of entries) {
		let retryAfter = 60;
		let pathPart = entry;
		const colonIdx = entry.lastIndexOf(':');
		if (colonIdx > 0) {
			const parsed = Number.parseInt(entry.slice(colonIdx + 1), 10);
			if (Number.isFinite(parsed) && parsed > 0) {
				retryAfter = parsed;
				pathPart = entry.slice(0, colonIdx);
			}
		}

		if (pathname === pathPart || pathname.startsWith(`${pathPart}/`)) {
			return { retryAfter };
		}
	}
	return null;
}

export function buildForced429Response(retryAfter: number): Response {
	return new Response(
		JSON.stringify({
			statusCode: 429,
			message: 'Too many requests. Please retry shortly.',
			retryAfter
		}),
		{
			status: 429,
			headers: {
				'content-type': 'application/json',
				'retry-after': String(retryAfter)
			}
		}
	);
}
