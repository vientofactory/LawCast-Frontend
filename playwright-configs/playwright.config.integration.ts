import { defineConfig, devices } from '@playwright/test';

/**
 * Runs the complete integration suite against a configured real backend.
 * PLAYWRIGHT_BACKEND_URL selects the API base, including `/api`.
 * The default frontend target is isolated; an explicitly supplied frontend URL
 * retains the existing caller-owned-server behavior for manual integration runs.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4218';
// Reuse only a server the caller named explicitly (CI/staging target): it owns
// its own env. The default local target must be launched by this config so the
// env below is guaranteed to be in effect.
const reuseExistingServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
	testDir: '../e2e',
	testMatch: 'backend-integration.spec.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'chromium-touch',
			use: { ...devices['Pixel 7'] }
		}
	],
	webServer: {
		command: `npm run dev -- --host 127.0.0.1 --port ${new URL(baseURL).port || '4218'} --strictPort`,
		url: baseURL,
		reuseExistingServer,
		timeout: 120_000,
		env: {
			NODE_ENV: 'development',
			API_BASE_URL:
				process.env.PLAYWRIGHT_BACKEND_URL ??
				process.env.API_BASE_URL ??
				'http://localhost:3001/api',
			// Explicitly disable mock mode for integration tests.
			DIFFCHAIN_UI_MOCK: '0',
			// One machine would otherwise be one per-visitor rate-limit bucket and
			// the run trips the backend read limit mid-suite (see
			// src/lib/server/e2e-client-ip.ts).
			E2E_DISTINCT_CLIENT_IPS: '1'
		}
	}
});
