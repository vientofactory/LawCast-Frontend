import { defineConfig, devices } from '@playwright/test';

/**
 * Integration Playwright config — runs against a live backend.
 *
 * Usage: npm run test:e2e:integration
 *
 * Requires a running backend (see API_BASE_URL); the dev server itself is
 * started by this config with the env below. Tests that use mock-specific data
 * skip via their own guard; everything else runs against real API responses.
 *
 * Reusing an already-running dev server is refused for the default target
 * (reuseExistingServer: false, like the dedicated-env configs): such a server
 * was not started with the env below, so the run would silently regress into
 * 429 failures mid-suite — the rate-limit overlay blocks clicks while every
 * 429 stays hidden in the dev server's log. Point PLAYWRIGHT_BASE_URL at a
 * server you started yourself to reuse one on purpose.
 *
 * To run against a specific URL:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3002 npm run test:e2e:integration
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
// Reuse only a server the caller named explicitly (CI/staging target): it owns
// its own env. The default local target must be launched by this config so the
// env below is guaranteed to be in effect.
const reuseExistingServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
	testDir: '../e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'npm run dev',
		url: baseURL,
		reuseExistingServer,
		timeout: 120_000,
		env: {
			NODE_ENV: 'development',
			// Explicitly disable mock mode for integration tests.
			DIFFCHAIN_UI_MOCK: '0',
			// One machine would otherwise be one per-visitor rate-limit bucket and
			// the run trips the backend read limit mid-suite (see
			// src/lib/server/e2e-client-ip.ts).
			E2E_DISTINCT_CLIENT_IPS: '1'
		}
	}
});
