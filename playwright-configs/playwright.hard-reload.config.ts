import { defineConfig, devices } from '@playwright/test';
import base from './playwright.open-layout.config';

export default defineConfig({
	...base,
	testMatch: ['hard-reload-styles.spec.ts', 'brand-animation.spec.ts'],
	use: { ...base.use, serviceWorkers: 'block' },
	projects: [
		{ name: 'desktop-hard-reload', use: { ...devices['Desktop Chrome'] } },
		{ name: 'touch-hard-reload', use: { ...devices['Pixel 7'] } }
	]
});
