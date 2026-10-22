import { expect, test } from '@playwright/test';

/**
 * Runs against the mock payload served with DIFFCHAIN_UI_MOCK_NSM_DEGRADED=1
 * (see playwright.nsm-degraded.config.ts).
 *
 * The state under test is a collector that keeps running on schedule while the
 * list it scans returns zero rows for several cycles. It used to be
 * indistinguishable from an idle crawler, which is how a blocked source stayed
 * invisible; /status now has to render it as a failure and name how long the
 * source has been serving nothing.
 */
const nsmDegradedEnabled = ['1', 'true', 'yes', 'on'].includes(
	(process.env.E2E_NSM_DEGRADED ?? '').trim().toLowerCase()
);

test.describe('System Status Page — stalled NSM list scan', () => {
	// These assertions only hold on the degraded mock payload, which only the
	// dedicated config serves. Without this guard the plain `npm run test:e2e`
	// run picks the spec up against the healthy mock and fails on purpose-driven
	// mismatches.
	test.skip(!nsmDegradedEnabled, 'stalled NSM fixtures require E2E_NSM_DEGRADED=1.');

	test.beforeEach(async ({ page }) => {
		await page.goto('/status');
	});

	test('badges the crawler as stopped instead of idle', async ({ page }) => {
		const card = page.getByTestId('crawler-nsm');
		await expect(card).toBeVisible();
		await expect(card).toContainText('수집 중단');
	});

	test('names the zero-row streak and the last healthy collection', async ({ page }) => {
		const notice = page.getByTestId('nsm-list-scan-degraded');
		await expect(notice).toBeVisible();
		await expect(notice).toContainText('4회 연속 0건');
		await expect(notice).toContainText('마지막 정상 수집');
		await expect(notice).toContainText('29시간 전');
	});

	test('escalates the overall status away from "정상"', async ({ page }) => {
		const badge = page.locator('span', { hasText: /전체 상태/ }).first();
		await expect(badge).toContainText('주의 필요');
	});

	test('does not show the healthy list-scan line while degraded', async ({ page }) => {
		await expect(page.getByTestId('nsm-list-scan-healthy')).toHaveCount(0);
	});

	test('page loads without critical JavaScript errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => {
			errors.push(error.message);
		});

		await page.reload();
		await page.waitForTimeout(1000);

		const criticalErrors = errors.filter(
			(message) => !message.includes('ResizeObserver') && !message.includes('favicon')
		);
		expect(criticalErrors).toEqual([]);
	});
});
