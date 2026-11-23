import { buildBackendForwardHeaders, getBackendBaseUrl } from '#lib/server/client-ip.ts';
import type { LayoutServerLoad } from './$types';
import { APP_VERSION, BACKEND_VERSION_BUILD } from '#lib/version.ts';

/**
 * Server-side layout loader that provides both frontend and backend versions.
 *
 * Frontend version: always resolved at build time (Vite define).
 * Backend version:
 *  1. Build-time injection via `BACKEND_VERSION` env var (CF Pages dashboard)
 *  2. Runtime fetch from `GET /api/version` (handles env var not set)
 *  3. `'unknown'` fallback
 *
 * On Cloudflare Pages, process.env is NOT available at runtime, so the
 * build-time value is the primary source. The API fetch serves as a safety
 * net for environments where the env var was not configured.
 */

const FETCH_TIMEOUT_MS = 3000;

async function resolveBackendVersion(): Promise<string> {
	// 1. Build-time value (from BACKEND_VERSION env var via Vite define)
	if (BACKEND_VERSION_BUILD && BACKEND_VERSION_BUILD !== 'unknown') {
		return BACKEND_VERSION_BUILD;
	}

	// 2. Runtime fetch from backend API

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		const res = await fetch(`${getBackendBaseUrl()}/version`, {
			signal: controller.signal,
			redirect: 'error',
			headers: buildBackendForwardHeaders(new Request('https://law.viento.me/'), null)
		});
		clearTimeout(timeout);

		if (res.ok) {
			const body = (await res.json()) as {
				data?: { version?: string };
				version?: string;
			};
			const version = body?.data?.version ?? body?.version;
			if (typeof version === 'string' && version) {
				return version;
			}
		}
	} catch {
		// Backend unavailable — fall through to fallback
	}

	// 3. Fallback
	return 'unknown';
}

export const load: LayoutServerLoad = async () => ({
	frontendVersion: APP_VERSION,
	backendVersion: await resolveBackendVersion()
});
