import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
	testDir: '../e2e',
	testMatch: '**/dark-mode-color-scheme.spec.ts',
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
			name: 'chromium-auto-dark',
			use: {
				...devices['Desktop Chrome'],
				launchOptions: {
					args: [
						'--enable-features=AutoDarkModeForWebContents',
						'--force-prefers-color-scheme=light'
					]
				}
			}
		}
	],
	webServer: {
		command: 'npm run dev',
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			NODE_ENV: 'development',
			DIFFCHAIN_UI_MOCK: process.env.DIFFCHAIN_UI_MOCK ?? '1'
		}
	}
});
