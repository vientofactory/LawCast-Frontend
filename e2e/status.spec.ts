import { test, expect } from '@playwright/test';

test.describe('System Status Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/status');
	});

	test('renders the page successfully', async ({ page }) => {
		await expect(page).toHaveTitle(/시스템 상태/);
	});

	test('displays the main heading', async ({ page }) => {
		const heading = page.locator('h1');
		await expect(heading).toContainText('LawCast 시스템 상태');
	});

	test('shows SYSTEM STATUS subtitle', async ({ page }) => {
		const subtitle = page.locator('p').filter({ hasText: 'SYSTEM STATUS' });
		await expect(subtitle.first()).toBeVisible();
	});

	test('displays last fetched timestamp', async ({ page }) => {
		const lastFetched = page.locator('p').filter({ hasText: '마지막 조회' });
		await expect(lastFetched.first()).toBeVisible();
	});

	test('overall status badge is visible', async ({ page }) => {
		const statusBadge = page.locator('text=전체 상태');
		await expect(statusBadge.first()).toBeVisible();
	});

	test('refresh button is available', async ({ page }) => {
		const refreshBtn = page.getByRole('button', { name: /새로고침/ });
		await expect(refreshBtn).toBeVisible();
	});

	test('webhook status section is visible', async ({ page }) => {
		const webhookSection = page.locator('h2').filter({ hasText: '웹훅 상태' });
		await expect(webhookSection).toBeVisible();
	});

	test('cache status section is visible', async ({ page }) => {
		const cacheSection = page.locator('h2').filter({ hasText: '캐시 상태' });
		await expect(cacheSection).toBeVisible();
	});

	test('web push status section is visible', async ({ page }) => {
		const webPushSection = page.locator('h2').filter({ hasText: '웹 푸시 상태' });
		await expect(webPushSection).toBeVisible();
	});

	test('AI summary section is visible', async ({ page }) => {
		const aiSection = page.locator('h2').filter({ hasText: 'AI 요약' });
		await expect(aiSection).toBeVisible();
	});

	test('page loads without critical JavaScript errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => {
			errors.push(error.message);
		});

		await page.goto('/status');
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
