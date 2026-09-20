import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Cloudflare Under Attack challenge tests.
 * Boots a dedicated dev server (port 5201) with PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED=true
 * so the challenge detection and recovery flow is active in the browser.
 *
 * A separate port (with reuseExistingServer: false) is essential: reusing an
 * already-running dev server would silently skip the feature because the env
 * var is not set on that server.
 *
 * Usage: npm run test:e2e:cloudflare-challenge
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5201';

export default defineConfig({
	testDir: '../e2e',
	testMatch: ['cloudflare-challenge.spec.ts'],
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
		command: 'npm run dev -- --port 5201 --strictPort',
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			NODE_ENV: 'development',
			DIFFCHAIN_UI_MOCK: process.env.DIFFCHAIN_UI_MOCK ?? '1',
			PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED: 'true',
			E2E_FORCE_403: '1'
		}
	}
});
