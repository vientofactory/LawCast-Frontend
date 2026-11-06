import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
	testDir: '../e2e',
	testIgnore: [
		'sitemap.spec.ts',
		'floating-prompts.spec.ts',
		'analytics-consent.spec.ts',
		'pwa.spec.ts',
		'web-vitals.spec.ts',
		'api-consumers.spec.ts',
		'open-layout.spec.ts',
		'notifications.spec.ts',
		'load-failures.spec.ts'
	],
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
			grepInvert: /touch screenshot viewport/,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'chromium-touch',
			grep: /touch screenshot viewport/,
			use: { ...devices['Pixel 7'] }
		}
	],
	webServer: {
		command: `npm run dev -- --host 127.0.0.1 --port ${new URL(baseURL).port || '5173'} --strictPort`,
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			NODE_ENV: 'development',
			// Analytics-enabled flows have their own dedicated regression suites.
			PUBLIC_GTM_CONTAINER_ID: '',
			// Default to mock mode so e2e tests never hit the real backend.
			// Set DIFFCHAIN_UI_MOCK=0 to disable (see playwright.config.integration.ts).
			DIFFCHAIN_UI_MOCK: process.env.DIFFCHAIN_UI_MOCK ?? '1'
		}
	}
});
