import { defineConfig, devices } from '@playwright/test';

/**
 * Integration Playwright config — runs against a live backend.
 *
 * Usage: npm run test:e2e:integration
 *
 * Requires a running dev server with a real backend (or DIFFCHAIN_UI_MOCK=0).
 * Tests that use mock-specific data will skip via their own guard.
 * Tests that do NOT check for mock mode will run against real API responses.
 *
 * To run against a specific URL:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3002 npm run test:e2e:integration
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
	testDir: '../e2e',
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
		command: 'npm run dev',
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			NODE_ENV: 'development',
			// Explicitly disable mock mode for integration tests.
			DIFFCHAIN_UI_MOCK: '0'
		}
	}
});
