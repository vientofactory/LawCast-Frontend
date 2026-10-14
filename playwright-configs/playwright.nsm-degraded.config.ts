import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the stalled NSM collector branch of /status.
 * Boots a dedicated dev server (port 5202) with DIFFCHAIN_UI_MOCK_NSM_DEGRADED=1,
 * so the mock payload reports consecutive zero-row list scans.
 *
 * A separate port (with reuseExistingServer: false) is essential: reusing an
 * already-running dev server would serve the healthy mock and silently skip the
 * degraded rendering this spec exists to check.
 *
 * Usage: npm run test:e2e:nsm-degraded
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5202';

export default defineConfig({
	testDir: '../e2e',
	testMatch: ['status-nsm-degraded.spec.ts'],
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
		command: 'npm run dev -- --port 5202 --strictPort',
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			NODE_ENV: 'development',
			DIFFCHAIN_UI_MOCK: process.env.DIFFCHAIN_UI_MOCK ?? '1',
			DIFFCHAIN_UI_MOCK_NSM_DEGRADED: '1'
		}
	}
});
