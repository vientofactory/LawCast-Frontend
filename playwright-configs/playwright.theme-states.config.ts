import { defineConfig, devices } from '@playwright/test';
import base from './playwright.open-layout.config';

const desktopCases =
	/theme palette frames and interactive contrast|loading palette stays synchronized|cross-page content card hierarchy/;
const mobileCases =
	/(?:theme palette frames and interactive contrast|cross-page content card hierarchy).*390px|loading palette stays synchronized|mobile touch theme/;

export default defineConfig({
	...base,
	// Network-hold fixtures must not be bypassed by an active service worker.
	use: { ...base.use, serviceWorkers: 'block' },
	reporter: [
		['list'],
		['json', { outputFile: process.env.THEME_REPORT_PATH || 'test-results/theme-states.json' }]
	],
	projects: [
		{ name: 'firefox-theme', grep: desktopCases, use: { ...devices['Desktop Firefox'] } },
		{ name: 'webkit-theme', grep: desktopCases, use: { ...devices['Desktop Safari'] } },
		{
			name: 'firefox-touch',
			grep: mobileCases,
			use: { ...devices['Desktop Firefox'], viewport: { width: 390, height: 844 }, hasTouch: true }
		},
		{ name: 'webkit-touch', grep: mobileCases, use: { ...devices['iPhone 13'] } }
	]
});
