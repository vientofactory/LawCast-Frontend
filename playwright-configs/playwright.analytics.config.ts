import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: '../e2e',
	testMatch: 'analytics-consent.spec.ts',
	workers: 1,
	reporter: 'list',
	projects: [
		{
			name: 'analytics-consent',
			use: { baseURL: 'http://localhost:5193', ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'npm run dev -- --port 5193 --strictPort',
		url: 'http://localhost:5193',
		reuseExistingServer: false,
		env: {
			DIFFCHAIN_UI_MOCK: '1',
			PUBLIC_GTM_CONTAINER_ID: 'GTM-TEST123'
		}
	}
});
