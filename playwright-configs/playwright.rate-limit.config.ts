import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for SSR rate-limit simulation tests.
 * Boots a dedicated dev server (port 5199) with E2E_FORCE_429_PATHS so every
 * matching API request deterministically returns a 429 with a Retry-After.
 *
 * A separate port (with reuseExistingServer: false) is essential: reusing an
 * already-running dev server would silently skip the 429 simulation because
 * that server does not have the env var set.
 *
 * Usage: npm run test:e2e:rate-limit
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5199';

const FORCE_429_PATHS = [
	// Short cooldown (5s) so the retry-button test can wait out the countdown
	// in real time instead of relying on Playwright's clock emulation.
	'/api/notices/changes:5',
	'/api/notices/recent:90',
	'/api/notices/archive:90',
	'/api/stats:90',
	'/api/discussions/threads:90',
	'/api/crawling-transparency:90',
	'/api/stats/proposals:90'
].join(',');

export default defineConfig({
	testDir: '../e2e',
	testMatch: 'rate-limit-ssr.spec.ts',
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
		}
	],
	webServer: {
		command: 'npm run dev -- --port 5199 --strictPort',
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			NODE_ENV: 'development',
			E2E_FORCE_429_PATHS: FORCE_429_PATHS
		}
	}
});
