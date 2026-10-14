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

	test('labels the pending-bills crawler after its active collection source', async ({ page }) => {
		const card = page.getByTestId('crawler-nsm');
		await expect(card).toBeVisible();

		// The heading must follow the payload instead of a hardcoded portal name:
		// the LIKMS source should never render the `국민참여입법센터` label.
		const text = (await card.innerText()).replace(/\s+/g, ' ');
		const usesLikms = text.includes('likms.assembly.go.kr');

		await expect(card.locator('h3')).toContainText(
			usesLikms ? '의안정보시스템' : '국민참여입법센터'
		);
	});

	test('reports the list-scan health of the pending-bills crawler', async ({ page }) => {
		// The mock serves a healthy list scan, so the card must show what it read
		// rather than the degraded notice that a stalled source produces.
		const card = page.getByTestId('crawler-nsm');
		await expect(card.getByTestId('nsm-list-scan-healthy')).toBeVisible();
		await expect(card.getByTestId('nsm-list-scan-degraded')).toHaveCount(0);
	});

	test('badges crawler-owned cron jobs with their active collection source', async ({ page }) => {
		const nsmSource = (await page.getByTestId('crawler-nsm-source').innerText()).trim();
		const palSource = (await page.getByTestId('crawler-pal-source').innerText()).trim();

		// The badge must repeat the source the crawler card reports, so it keeps
		// naming the right portal once the backend collection source changes.
		await expect(page.getByTestId('cron-source-nsm')).toHaveText(nsmSource);
		await expect(page.getByTestId('cron-source-pal')).toHaveText(palSource);
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
