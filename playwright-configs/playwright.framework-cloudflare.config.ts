import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4191';

export default defineConfig({
	testDir: '../e2e',
	testMatch: [
		'framework-migration.spec.ts',
		'proxy-encoding.spec.ts',
		'navigation-scroll.spec.ts',
		'revision-workspace.spec.ts',
		'legal.spec.ts'
	],
	workers: 1,
	retries: 0,
	reporter: 'list',
	use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
	projects: [{ name: 'cloudflare-framework', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			cwd: fileURLToPath(new URL('..', import.meta.url)),
			command: 'node e2e/fixtures/consumer-backend.ts',
			url: 'http://127.0.0.1:4327/requests',
			reuseExistingServer: false
		},
		{
			cwd: fileURLToPath(new URL('..', import.meta.url)),
			command:
				'npm run build && npx --no-install wrangler pages dev .svelte-kit/cloudflare --ip 127.0.0.1 --port 4191 --inspector-port 9241 --binding DIFFCHAIN_UI_MOCK=1 --binding API_BASE_URL=http://127.0.0.1:4327/api',
			url: baseURL,
			reuseExistingServer: false,
			timeout: 180000,
			env: { DIFFCHAIN_UI_MOCK: '1', PUBLIC_GTM_CONTAINER_ID: '' }
		}
	]
});
