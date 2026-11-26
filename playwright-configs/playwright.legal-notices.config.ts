import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: '../e2e',
	testMatch: 'legal-notices.spec.ts',
	workers: 1,
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI ? 'github' : 'list'
});
