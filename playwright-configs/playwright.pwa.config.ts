import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Production output exercises the same static worker used on Cloudflare Pages.
const baseURL = 'http://127.0.0.1:4185';

export default defineConfig({
	testDir: '../e2e',
	testMatch: 'pwa.spec.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	workers: 1,
	reporter: 'list',
	use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
	projects: [{ name: 'chromium-pwa', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		cwd: fileURLToPath(new URL('..', import.meta.url)),
		command: 'npm run build:node && node build/index.js',
		url: baseURL,
		reuseExistingServer: false,
		timeout: 180_000,
		env: {
			DIFFCHAIN_UI_MOCK: '1',
			BACKEND_VERSION: 'pwa-test',
			HOST: '127.0.0.1',
			PORT: '4185',
			ORIGIN: baseURL
		}
	}
});
