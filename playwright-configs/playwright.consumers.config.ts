import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
const cwd = fileURLToPath(new URL('..', import.meta.url));
export default defineConfig({
	testDir: '../e2e',
	testMatch: 'api-consumers.spec.ts',
	workers: 1,
	use: { baseURL: 'http://127.0.0.1:4197', trace: 'retain-on-failure' },
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } }
	],
	webServer: [
		{
			cwd,
			command: 'node e2e/fixtures/consumer-backend.mjs',
			url: 'http://127.0.0.1:4327/requests',
			reuseExistingServer: false
		},
		{
			cwd,
			command: 'npm run build:node && node build/index.js',
			url: 'http://127.0.0.1:4197',
			reuseExistingServer: false,
			timeout: 180000,
			env: {
				DIFFCHAIN_UI_MOCK: '0',
				API_BASE_URL: 'http://127.0.0.1:4327/api',
				BACKEND_VERSION: 'fixture',
				PUBLIC_GTM_CONTAINER_ID: '',
				PUBLIC_DISCORD_SERVER_ID: '',
				PUBLIC_DISCORD_SERVER_URL: '',
				HOST: '127.0.0.1',
				PORT: '4197',
				ORIGIN: 'http://127.0.0.1:4197'
			}
		}
	]
});
