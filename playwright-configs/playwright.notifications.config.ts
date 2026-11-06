import { defineConfig, devices } from '@playwright/test';
import base from './playwright.open-layout.config';
export default defineConfig({
	...base,
	testMatch: 'notifications.spec.ts',
	use: { ...base.use, serviceWorkers: 'block' },
	webServer: { ...base.webServer, env: { ...base.webServer.env, E2E_NOTIFICATIONS: '1' } },
	projects: [
		{
			name: 'chromium',
			grepInvert: /touch notification close/,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'firefox',
			grepInvert: /touch notification close/,
			use: { ...devices['Desktop Firefox'] }
		},
		{
			name: 'webkit',
			grepInvert: /touch notification close/,
			use: { ...devices['Desktop Safari'] }
		},
		{ name: 'touch', grep: /touch notification close/, use: { ...devices['iPhone 13'] } }
	]
});
