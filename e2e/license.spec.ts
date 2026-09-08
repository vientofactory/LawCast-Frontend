import { test, expect } from '@playwright/test';

test.describe('License Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/license');
	});

	test('renders the page successfully', async ({ page }) => {
		await expect(page).toHaveTitle(/라이선스/);
	});

	test('displays the main heading', async ({ page }) => {
		const heading = page.locator('h1');
		await expect(heading).toContainText('라이선스 고지');
	});

	test('shows LICENSE subtitle', async ({ page }) => {
		const subtitle = page.locator('p').filter({ hasText: 'LICENSE' });
		await expect(subtitle.first()).toBeVisible();
	});

	test('displays project license section', async ({ page }) => {
		const projectLicense = page.locator('h2').filter({ hasText: 'LawCast 프로젝트 라이선스' });
		await expect(projectLicense).toBeVisible();
	});

	test('shows MIT License text', async ({ page }) => {
		const mitText = page.locator('text=MIT License');
		await expect(mitText.first()).toBeVisible();
	});

	test('displays open source licenses section', async ({ page }) => {
		const openSourceSection = page.locator('h2').filter({ hasText: '오픈소스 라이선스 고지' });
		await expect(openSourceSection).toBeVisible();
	});

	test('shows backend packages table', async ({ page }) => {
		const backendSection = page.locator('h3').filter({ hasText: '백엔드' });
		await expect(backendSection).toBeVisible();

		const table = backendSection.locator('..').locator('table');
		await expect(table).toBeVisible();
	});

	test('shows frontend packages table', async ({ page }) => {
		const frontendSection = page.locator('h3').filter({ hasText: '프론트엔드' });
		await expect(frontendSection).toBeVisible();

		const table = frontendSection.locator('..').locator('table');
		await expect(table).toBeVisible();
	});

	test('license type legend is shown', async ({ page }) => {
		const legend = page.locator('h2').filter({ hasText: '라이선스 유형 안내' });
		await expect(legend).toBeVisible();

		// Should have MIT badge
		const mitBadge = page.locator('span').filter({ hasText: 'MIT' }).first();
		await expect(mitBadge).toBeVisible();
	});

	test('page loads without critical JavaScript errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => {
			errors.push(error.message);
		});

		await page.goto('/license');
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
});
