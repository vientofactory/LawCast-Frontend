import { test, expect, type Page } from '@playwright/test';
import { readModalTransitionSample, startModalTransitionSample } from './helpers/modal-transition';

const MOCK_PUSH_ENDPOINT = 'https://e2e.push.example.com/mock-endpoint';

/**
 * The "모든 웹 푸시 구독 해지" control only renders when the form detected a real
 * browser subscription, so stub PushManager before any page script runs. The app
 * reads it through `navigator.serviceWorker.register('/sw.js').pushManager`,
 * which resolves via ServiceWorkerRegistration.prototype.
 */
async function installPushSubscriptionStub(page: Page): Promise<void> {
	await page.addInitScript((endpoint) => {
		const fakeSubscription = {
			endpoint,
			expirationTime: null,
			toJSON() {
				return {
					endpoint,
					expirationTime: null,
					keys: { p256dh: 'mock-p256dh', auth: 'mock-auth' }
				};
			},
			unsubscribe: async () => true
		};
		const fakePushManager = {
			getSubscription: async () => fakeSubscription,
			subscribe: async () => fakeSubscription
		};

		try {
			Object.defineProperty(ServiceWorkerRegistration.prototype, 'pushManager', {
				configurable: true,
				get: () => fakePushManager
			});
		} catch (error) {
			console.error('Failed to stub PushManager:', error);
		}
	}, MOCK_PUSH_ENDPOINT);
}

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

test.describe('Full unsubscribe confirm modal', () => {
	test('opens with an intro transition, closes without a request and unsubscribes on confirm', async ({
		page
	}) => {
		let deleteCalls = 0;
		let deletedEndpoint: string | null = null;

		await installPushSubscriptionStub(page);
		await page.route('**/api/push/public-key', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					data: { enabled: true, publicKey: 'BFakeE2EVapidPublicKey' }
				})
			})
		);
		await page.route('**/api/push/subscriptions', async (route) => {
			if (route.request().method() !== 'DELETE') {
				await route.fallback();
				return;
			}

			deleteCalls += 1;
			deletedEndpoint = (route.request().postDataJSON() as { endpoint?: string }).endpoint ?? null;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true, data: { success: true } })
			});
		});
		await page.route('**/api/push/subscriptions/notice-status*', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true, data: { enabled: true } })
			})
		);

		await page.goto('/webhook');

		// The advanced section only renders once the (stubbed) subscription is detected.
		const advancedToggle = page.getByRole('button', {
			name: '고급 설정: 브라우저 구독 전체 해지'
		});
		await expect(advancedToggle).toBeVisible();
		await advancedToggle.click();

		const openConfirm = async () => {
			await page.getByRole('button', { name: '모든 웹 푸시 구독 해지' }).click();
		};

		await startModalTransitionSample(page);
		await openConfirm();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('모든 웹 푸시 구독을 해지할까요?');
		await expect(dialog).toHaveAttribute('aria-modal', 'true');
		const labelledBy = await dialog.getAttribute('aria-labelledby');
		expect(labelledBy).toBeTruthy();
		await expect(dialog.locator(`#${labelledBy}`)).toContainText('모든 웹 푸시 구독을 해지할까요?');
		await expect(dialog).toContainText(
			'입법예고 알림과 모든 토론 인용 알림이 이 브라우저에서 함께 해지됩니다.'
		);

		// The first open lazy-loads the modal chunk: the intro transition must still play.
		await page.waitForTimeout(300);
		const firstOpenSample = await readModalTransitionSample(page);
		expect(firstOpenSample.seen).toBe(true);
		expect(firstOpenSample.minBackdropOpacity).toBeLessThan(0.9);
		expect(firstOpenSample.minDialogScale).toBeLessThan(0.99);

		// Escape closes without touching the API.
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		expect(deleteCalls).toBe(0);

		// Cancelling also closes without touching the API.
		await openConfirm();
		await dialog.getByRole('button', { name: '취소' }).click();
		await expect(dialog).toHaveCount(0);
		expect(deleteCalls).toBe(0);

		// Confirm unsubscribes the browser and unregisters the endpoint exactly once.
		await openConfirm();
		await dialog.getByRole('button', { name: '전체 해지' }).click();
		await expect(dialog).toHaveCount(0);
		await expect(page.getByText('모든 웹 푸시 구독이 해지되었습니다.')).toBeVisible();
		expect(deleteCalls).toBe(1);
		expect(deletedEndpoint).toBe(MOCK_PUSH_ENDPOINT);

		// isSubscribed is false afterwards, so the advanced section disappears.
		await expect(advancedToggle).toHaveCount(0);
	});
});
