import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4198';

export default defineConfig({
	testDir: '../e2e',
	testMatch: 'open-layout.spec.ts',
	workers: 1,
	retries: 0,
	reporter: 'list',
	use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
	projects: [
		{
			name: 'open-layout',
			grepInvert: /mobile touch theme from/,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'open-layout-touch',
			grep: /mobile touch theme from/,
			use: { ...devices['Pixel 7'] }
		}
	],
	webServer: {
		cwd: fileURLToPath(new URL('..', import.meta.url)),
		command: 'npm run build:node && node build/index.js',
		url: baseURL,
		reuseExistingServer: false,
		timeout: 180_000,
		env: {
			DIFFCHAIN_UI_MOCK: '1',
			E2E_SEMANTIC_SEARCH: '1',
			PUBLIC_SEMANTIC_SEARCH_ENABLED: '1',
			PUBLIC_GTM_CONTAINER_ID: '',
			PUBLIC_DISCORD_SERVER_ID: '',
			PUBLIC_DISCORD_SERVER_URL: '',
			HOST: '127.0.0.1',
			PORT: '4198',
			ORIGIN: baseURL
		}
	}
});
