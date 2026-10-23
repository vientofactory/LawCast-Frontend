import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: '../e2e',
	testMatch: 'sitemap.spec.ts',
	workers: 1,
	use: { baseURL: 'http://localhost:5189' },
	webServer: [
		{
			cwd: fileURLToPath(new URL('..', import.meta.url)),
			command: 'node e2e/fixtures/sitemap-backend.mjs',
			url: 'http://127.0.0.1:4319/stats',
			reuseExistingServer: false
		},
		{
			cwd: fileURLToPath(new URL('..', import.meta.url)),
			command: 'npm run dev -- --port 5189 --strictPort',
			url: 'http://localhost:5189/main.xml',
			reuseExistingServer: false,
			env: { API_BASE_URL: 'http://127.0.0.1:4319/api' }
		}
	]
});
