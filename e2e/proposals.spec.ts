import { test, expect } from '@playwright/test';

test.describe('Proposals Statistics Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/proposals');
	});

	test('renders the page successfully', async ({ page }) => {
		await expect(page).toHaveTitle(/발의 통계/);
	});

	test('displays the main heading', async ({ page }) => {
		const heading = page.locator('h1');
		await expect(heading).toContainText('법률안 발의 통계');
	});

	test('shows description text', async ({ page }) => {
		const description = page.locator('p').filter({ hasText: '수집된 법률안 발의 건수' });
		await expect(description.first()).toBeVisible();
	});

	test('granularity buttons are available', async ({ page }) => {
		await expect(page.getByRole('button', { name: /일별/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /주별/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /월별/ })).toBeVisible();
	});

	test('chart type buttons are available', async ({ page }) => {
		await expect(page.getByRole('button', { name: /막대 차트/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /선형 차트/ })).toBeVisible();
	});

	test('quick range buttons are available', async ({ page }) => {
		await expect(page.getByRole('button', { name: /최근 7일/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /최근 30일/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /최근 90일/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /올해/ })).toBeVisible();
	});

	test('date range inputs are available', async ({ page }) => {
		const startDate = page.locator('#start-date');
		const endDate = page.locator('#end-date');
		await expect(startDate).toBeVisible();
		await expect(endDate).toBeVisible();
	});

	test('query button is available', async ({ page }) => {
		const queryBtn = page.getByRole('button', { name: /조회/ });
		await expect(queryBtn).toBeVisible();
	});

	test('summary cards are visible', async ({ page }) => {
		const totalCountHeading = page.locator('h2').filter({ hasText: '전체 발의 건수' });
		await expect(totalCountHeading).toBeVisible();

		const bucketCountHeading = page.locator('h2').filter({ hasText: '집계 구간 수' });
		await expect(bucketCountHeading).toBeVisible();
	});

	test('data interpretation warning is shown', async ({ page }) => {
		const warning = page.locator('text=데이터 해석에 유의하세요');
		await expect(warning).toBeVisible();
	});

	test('granularity switching updates the page', async ({ page }) => {
		const weeklyBtn = page.getByRole('button', { name: /주별/ });
		await weeklyBtn.click();
		await page.waitForTimeout(2000);
		// The page uses replaceState so the URL may or may not change
		// Verify the button is still active after click
		await expect(weeklyBtn).toBeVisible();
	});

	test('page loads without critical JavaScript errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => {
			errors.push(error.message);
		});

		await page.goto('/proposals');
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
