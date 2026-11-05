import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
const cwd = fileURLToPath(new URL('..', import.meta.url));
export default defineConfig({
	testDir: '../e2e',
	testMatch: 'load-failures.spec.ts',
	workers: 1,
	retries: 0,
	use: { baseURL: 'http://127.0.0.1:4195', serviceWorkers: 'block', trace: 'retain-on-failure' },
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', grepInvert: /bounds unanswered upstream/, use: { ...devices['Pixel 7'] } }
	],
	webServer: [
		{
			cwd,
			command: 'node e2e/fixtures/load-failure-backend.mjs',
			url: 'http://127.0.0.1:4331/requests',
			reuseExistingServer: false
		},
		{
			cwd,
			command: 'npm run build:node && node build/index.js',
			url: 'http://127.0.0.1:4195',
			reuseExistingServer: false,
			timeout: 180000,
			env: {
				DIFFCHAIN_UI_MOCK: '0',
				E2E_SEMANTIC_SEARCH: '0',
				PUBLIC_SEMANTIC_SEARCH_ENABLED: '1',
				API_BASE_URL: 'http://127.0.0.1:4331/api',
				PUBLIC_GTM_CONTAINER_ID: '',
				HOST: '127.0.0.1',
				PORT: '4195',
				ORIGIN: 'http://127.0.0.1:4195'
			}
		}
	]
});
