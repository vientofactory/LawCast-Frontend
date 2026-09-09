import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for client-IP forwarding regression tests.
 *
 * Boots a dedicated Vite dev server (port 5223) with API_BASE_URL pointed at
 * the in-process echo backend (port 3999), so the tests can assert exactly
 * which client-IP headers arrive at the backend from SSR and proxy paths.
 *
 * Usage: npm run test:e2e:ip-forwarding
 */
const baseURL = 'http://127.0.0.1:5223';

export default defineConfig({
	testDir: '../e2e',
	testMatch: 'ip-forwarding.spec.ts',
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
	webServer: [
		{
			command: 'node --experimental-strip-types ../e2e/helpers/ip-echo-backend.ts',
			url: 'http://127.0.0.1:3999',
			reuseExistingServer: false,
			timeout: 30_000
		},
		{
			command: 'npm run dev -- --port 5223 --strictPort',
			url: baseURL,
			reuseExistingServer: false,
			timeout: 120_000,
			env: {
				NODE_ENV: 'development',
				API_BASE_URL: 'http://127.0.0.1:3999/api'
			}
		}
	]
});
