import { expect, test } from '@playwright/test';

const noticeNum = 2210001;
const threadId = noticeNum * 100 + 1;
const mockEnabled = ['1', 'true', 'yes', 'on'].includes(
	(process.env.DIFFCHAIN_UI_MOCK ?? '').trim().toLowerCase()
);

function buildRateLimitResponse(retryAfter: number): {
	status: number;
	contentType: string;
	headers: Record<string, string>;
	body: string;
} {
	return {
		status: 429,
		contentType: 'application/json',
		headers: { 'retry-after': String(retryAfter) },
		body: JSON.stringify({
			statusCode: 429,
			message: 'Too many requests. Please retry shortly.',
			retryAfter
		})
	};
}

test.describe('Client-side rate-limit handling', () => {
	test.skip(!mockEnabled, 'Client-side 429 tests require DIFFCHAIN_UI_MOCK=1.');

	test('new-thread modal shows a rate-limit message with countdown on 429', async ({ page }) => {
		await page.route(`**/api/notices/${noticeNum}/discussions`, async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill(buildRateLimitResponse(5));
				return;
			}
			await route.fallback();
		});

		await page.goto(`/notices/${noticeNum}`);
		await expect(page.getByTestId('discussion-new-thread-button')).toBeVisible();

		// Clicking before SvelteKit hydration completes silently does nothing,
		// so retry the click until the modal actually opens.
		await expect(async () => {
			await page.getByTestId('discussion-new-thread-button').click({ timeout: 2_000 });
			await expect(page.locator('#thread-title-input')).toBeVisible({ timeout: 1_000 });
		}).toPass({ timeout: 20_000 });

		await page.locator('#thread-title-input').fill('레이트리밋 테스트 토론');
		await page.locator('#thread-password-input').fill('1234');
		await page.locator('textarea').first().fill('레이트리밋 상태에서 작성한 첫 의견입니다.');

		await page.getByRole('button', { name: '토론 개설하기' }).click();

		// The modal surfaces the Korean rate-limit message with the server-provided
		// retry-after countdown (not the backend's English message).
		await expect(page.getByText('요청이 너무 많습니다. 5초 후 다시 시도해주세요.')).toBeVisible();
	});

	test('thread detail reload shows the rate-limit countdown and disables refresh', async ({
		page
	}) => {
		// Intercept only client-side thread fetches; the initial SSR data renders
		// from the mock before any browser request happens.
		await page.route(`**/api/discussions/threads/${threadId}?*`, async (route) => {
			await route.fulfill(buildRateLimitResponse(4));
		});

		await page.goto(`/notices/${noticeNum}/discussions/${threadId}`);
		await expect(page.getByTestId('discussion-thread-detail')).toBeVisible();

		// Retry the click until the client-side reload request actually fires
		// (hydration race: clicks before hydration have no effect).
		await expect(async () => {
			const reloadRequest = page.waitForRequest(
				(request) =>
					request.method() === 'GET' &&
					request.url().includes(`/api/discussions/threads/${threadId}`),
				{ timeout: 2_000 }
			);
			await page.getByRole('button', { name: '새로고침' }).click({ timeout: 2_000 });
			await reloadRequest;
		}).toPass({ timeout: 20_000 });

		// The error banner shows the Korean message with the countdown.
		await expect(page.getByText('요청이 너무 많습니다. 4초 후 다시 시도해주세요.')).toBeVisible();

		// The refresh button stays disabled while the cooldown is active.
		await expect(page.getByRole('button', { name: '새로고침' })).toBeDisabled();
	});
});
