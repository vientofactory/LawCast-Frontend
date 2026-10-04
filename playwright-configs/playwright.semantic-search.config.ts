import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the semantic search UI tests.
 * Boots a dedicated dev server (port 5202) with PUBLIC_SEMANTIC_SEARCH_ENABLED=1
 * so the semantic search entry point and route are active in the browser.
 *
 * A separate port (with reuseExistingServer: false) is essential: reusing an
 * already-running dev server would silently skip the feature because the env
 * var is not set on that server.
 *
 * Usage: npm run test:e2e:semantic-search
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5202';

export default defineConfig({
	testDir: '../e2e',
	testMatch: ['semantic-search*.spec.ts'],
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
			PUBLIC_SEMANTIC_SEARCH_ENABLED: '1'
		}
	}
});
