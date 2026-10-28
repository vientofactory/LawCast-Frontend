import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.WEB_VITALS_BASE_URL ?? 'http://127.0.0.1:4196';

export default defineConfig({
	testDir: '../e2e',
	testMatch: 'web-vitals.spec.ts',
	fullyParallel: false,
	workers: 1,
	reporter: 'list',
	use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
	projects: [
		{ name: 'desktop-vitals', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile-vitals', use: { ...devices['Pixel 7'] } }
	],
	webServer: process.env.WEB_VITALS_BASE_URL
		? undefined
		: {
				cwd: fileURLToPath(new URL('..', import.meta.url)),
				command: 'npm run build:node && node build/index.js',
				url: baseURL,
				reuseExistingServer: false,
				timeout: 180_000,
				env: {
					DIFFCHAIN_UI_MOCK: '1',
					BACKEND_VERSION: 'web-vitals-test',
					PUBLIC_GTM_CONTAINER_ID: 'GTM-TEST123',
					PUBLIC_DISCORD_SERVER_URL: 'https://discord.gg/example',
					PUBLIC_DISCORD_SERVER_ID: '1498753343122837544',
					HOST: '127.0.0.1',
					PORT: '4196',
					ORIGIN: baseURL
				}
			}
});
