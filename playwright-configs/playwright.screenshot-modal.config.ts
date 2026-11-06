import { defineConfig, devices } from '@playwright/test';
import base from './playwright.open-layout.config';

export default defineConfig({
	...base,
	testMatch: 'notice-screenshot.spec.ts',
	use: { ...base.use, serviceWorkers: 'block' },
	projects: [
		{
			name: 'chromium',
			grepInvert: /touch screenshot viewport/,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'firefox',
			grepInvert: /touch screenshot viewport/,
			use: { ...devices['Desktop Firefox'] }
		},
		{
			name: 'webkit',
			grepInvert: /touch screenshot viewport/,
			use: { ...devices['Desktop Safari'] }
		},
		{ name: 'webkit-touch', grep: /touch screenshot viewport/, use: { ...devices['iPhone 13'] } }
	]
});
