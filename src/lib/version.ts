/**
 * Application version constants.
 *
 * Both values are injected at build time by Vite's `define` option in
 * vite.config.ts. On Cloudflare Pages, process.env is available during
 * the build step but NOT at runtime, so build-time injection is the only
 * reliable way to make these values available in the deployed bundle.
 *
 * Frontend version resolution (build time):
 *  1. `APP_VERSION` env var  (CF Pages dashboard, CI, Docker)
 *  2. `version` field in package.json  (local dev)
 *  3. `'unknown'` fallback
 *
 * Backend version resolution (build time → runtime fallback):
 *  Build time:
 *   1. `BACKEND_VERSION` env var  (CF Pages dashboard, Docker)
 *   2. `'unknown'` placeholder
 *  Runtime (in +layout.server.ts):
 *   3. Fetch from `GET /api/version`
 *   4. `'unknown'` fallback
 */

declare const __APP_VERSION__: string | undefined;
declare const __BACKEND_VERSION__: string | undefined;

function resolveVersion(defineValue: string | undefined, envKey: string): string {
	// 1. Vite build-time injection
	if (typeof defineValue !== 'undefined') {
		return defineValue;
	}

	// 2. SvelteKit public env var (available at build time)
	try {
		// @ts-expect-error — injected by SvelteKit at build time
		if (typeof globalThis[envKey] !== 'undefined') {
			// @ts-expect-error — injected by SvelteKit at build time
			return globalThis[envKey];
		}
	} catch {
		// not available
	}

	// 3. Fallback
	return 'unknown';
}

/** Frontend application version, resolved at build time. */
export const APP_VERSION: string = resolveVersion(__APP_VERSION__, 'PUBLIC_APP_VERSION');

/**
 * Backend version placeholder, resolved at build time.
 * Actual value may be updated at runtime via API call in +layout.server.ts.
 */
export const BACKEND_VERSION_BUILD: string = resolveVersion(
	__BACKEND_VERSION__,
	'PUBLIC_BACKEND_VERSION'
);
