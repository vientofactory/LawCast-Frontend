import { expect, test } from '@playwright/test';

/**
 * SSR rate-limit handling tests.
 *
 * These tests require the dev server to run with E2E_FORCE_429_PATHS set to
 * the endpoints each page depends on (see playwright.rate-limit.config.ts):
 *   /api/notices/changes:5,/api/notices/recent:90,/api/notices/archive:90,
 *   /api/stats:90,/api/discussions/threads:90,/api/crawling-transparency:90,
 *   /api/stats/proposals:90
 *
 * Run with: npm run test:e2e:rate-limit
 */
const simEnabled = process.env.E2E_RATE_LIMIT_SIM === '1';

test.describe('SSR rate-limit handling', () => {
	test.skip(!simEnabled, 'Set E2E_RATE_LIMIT_SIM=1 and E2E_FORCE_429_PATHS to run these tests.');

	test('changes page renders a retry banner instead of a 500 when the API rate-limits', async ({
		page
	}) => {
		const response = await page.goto('/notices/changes');

		// The page itself must NOT fail with an error page.
		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1 })).toContainText('변경 내역 모아보기');

		const banner = page.getByTestId('changes-load-error');
		await expect(banner).toBeVisible();
		await expect(banner).toHaveAttribute('data-rate-limited', 'true');
		await expect(banner).toContainText('요청이 너무 많습니다');

		// Retry button is disabled while the countdown runs.
		const retryButton = page.getByTestId('changes-retry-button');
		await expect(retryButton).toBeDisabled();
		await expect(retryButton).toContainText('초 후 재시도 가능');

		// Empty state is shown for the change list.
		await expect(page.getByTestId('changes-results-region')).toContainText(
			'보여드릴 변경 내역이 없습니다.'
		);
	});

	test('retry button re-issues the API request after the countdown expires', async ({ page }) => {
		await page.goto('/notices/changes');

		const banner = page.getByTestId('changes-load-error');
		await expect(banner).toBeVisible();

		const retryButton = page.getByTestId('changes-retry-button');
		await expect(retryButton).toBeDisabled();
		await expect(retryButton).toContainText('초 후 재시도 가능');

		// The sim gives /api/notices/changes a 2s cooldown (see
		// playwright.rate-limit.config.ts) — Playwright's fake clock does not
		// drive the page's setInterval, so wait it out in real time.
		await expect(retryButton).toBeEnabled({ timeout: 15000 });
		await expect(retryButton).toContainText('다시 시도');

		// invalidateAll re-runs the server load, which the browser observes as
		// a __data.json request (the /api fetch itself happens server-side).
		const dataRequest = page.waitForRequest(
			(request) =>
				request.method() === 'GET' && request.url().includes('/notices/changes/__data.json'),
			{ timeout: 15000 }
		);
		await retryButton.click();
		await dataRequest;

		// The sim still answers 429, so the banner must re-appear with a
		// restarted countdown instead of the page failing.
		await expect(banner).toBeVisible();
		await expect(retryButton).toBeDisabled();
	});

	test('notices list page shows a friendly rate-limit error instead of crashing', async ({
		page
	}) => {
		const response = await page.goto('/notices');
		expect(response?.status()).toBe(200);

		await expect(page.getByTestId('notices-main')).toBeVisible();
		await expect(page.getByText('요청이 너무 많습니다')).toBeVisible();
	});

	test('home page still renders with fallbacks when recent-notices API is rate-limited', async ({
		page
	}) => {
		const response = await page.goto('/');
		expect(response?.status()).toBe(200);
		await expect(page.getByTestId('home-main')).toBeVisible();
	});

	test('status page shows the rate-limit message with fallback stats', async ({ page }) => {
		const response = await page.goto('/status');
		expect(response?.status()).toBe(200);
		await expect(page.getByText('요청이 너무 많습니다')).toBeVisible();
	});

	test('discussions page shows the rate-limit message with an empty list', async ({ page }) => {
		const response = await page.goto('/discussions');
		expect(response?.status()).toBe(200);
		await expect(page.getByText('요청이 너무 많습니다')).toBeVisible();
	});

	test('crawling transparency page shows the rate-limit message', async ({ page }) => {
		const response = await page.goto('/crawling-transparency');
		expect(response?.status()).toBe(200);
		await expect(page.getByText('요청이 너무 많습니다')).toBeVisible();
	});

	test('proposals page shows the rate-limit message', async ({ page }) => {
		const response = await page.goto('/proposals');
		expect(response?.status()).toBe(200);
		await expect(page.getByText('요청이 너무 많습니다')).toBeVisible();
	});
});
