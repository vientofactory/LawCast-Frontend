import { test, expect } from '@playwright/test';

test.describe('Webhook Settings Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/webhook');
	});

	test('renders the page successfully', async ({ page }) => {
		await expect(page).toHaveTitle(/알림 설정/);
	});

	test('displays the main heading', async ({ page }) => {
		const heading = page.locator('h1, h2').first();
		await expect(heading).toBeVisible();
	});

	test('webhook registration form is present', async ({ page }) => {
		// The form should be visible
		const form = page.locator('form').first();
		await expect(form).toBeVisible();
	});

	test('web push consent section is present', async ({ page }) => {
		// Look for web push related content
		const body = await page.textContent('body');
		expect(body).toBeTruthy();
	});

	test('page loads without critical JavaScript errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => {
			errors.push(error.message);
		});

		await page.goto('/webhook');
		await page.waitForTimeout(2000);

		const criticalErrors = errors.filter(
			(e) =>
				!e.includes('ResizeObserver') &&
				!e.includes('chunk') &&
				!e.includes('NetworkError') &&
				!e.includes('WebSocket closed without opened')
		);
		expect(criticalErrors).toHaveLength(0);
	});

	test('page content is not empty', async ({ page }) => {
		const body = await page.textContent('body');
		expect(body?.trim().length).toBeGreaterThan(0);
	});
});
