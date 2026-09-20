import { expect, test } from '@playwright/test';

const mockEnabled = ['1', 'true', 'yes', 'on'].includes(
	(process.env.DIFFCHAIN_UI_MOCK ?? '').trim().toLowerCase()
);

const CF_HTML =
	'<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>Challenge</body></html>';

function buildSveltekitErrorDataJson(status: number) {
	return {
		status,
		contentType: 'application/json',
		headers: { 'cf-mitigated': 'challenge' },
		body: JSON.stringify({
			nodes: [
				null,
				{
					type: 'data',
					data: null,
					uses: { params: {}, route: { id: '/notices' }, url: true },
					errors: [{ message: 'Cloudflare challenge', code: 'CF_CHALLENGE', stack: '' }],
					status
				}
			]
		})
	};
}

function buildPlain403Json() {
	return {
		status: 403,
		contentType: 'application/json',
		headers: {},
		body: JSON.stringify({ message: 'Forbidden' })
	};
}

const noticesDataUrl = /\/notices\/__data\.json/;

async function getSessionStorage(page: import('@playwright/test').Page) {
	return page.evaluate(() => ({
		guard: sessionStorage.getItem('lawcast:cf-under-attack-reload-at'),
		detect: sessionStorage.getItem('lawcast:cf-under-attack-last-detected-at')
	}));
}

async function setSessionStorage(
	page: import('@playwright/test').Page,
	opts: { guardTs?: number; detectTs?: number }
) {
	await page.evaluate(
		({ guardTs, detectTs }) => {
			if (guardTs !== undefined)
				sessionStorage.setItem('lawcast:cf-under-attack-reload-at', String(guardTs));
			if (detectTs !== undefined)
				sessionStorage.setItem('lawcast:cf-under-attack-last-detected-at', String(detectTs));
		},
		{ guardTs: opts.guardTs, detectTs: opts.detectTs }
	);
}

test.describe('Cloudflare Under Attack challenge handling', () => {
	test.skip(!mockEnabled, 'Cloudflare challenge tests require DIFFCHAIN_UI_MOCK=1.');

	test.describe('patched fetch detection (client-side)', () => {
		test('intercepts navigation __data.json with cf-mitigated header', async ({ page }) => {
			let intercepted = false;

			await page.goto('/');
			await expect(page.getByTestId('site-header')).toBeVisible();

			await page.route(noticesDataUrl, async (route) => {
				intercepted = true;
				await route.fulfill(buildSveltekitErrorDataJson(403));
			});

			await page.getByTestId('nav-link-notices').click();
			await page.waitForTimeout(3000);

			expect(intercepted).toBe(true);

			const marks = await getSessionStorage(page);
			expect(marks.detect).not.toBeNull();
			expect(Number(marks.detect)).toBeGreaterThan(0);
		});

		test('detects implicit challenge (non-JSON 403) and sets sessionStorage', async ({ page }) => {
			await page.goto('/');
			await expect(page.getByTestId('site-header')).toBeVisible();

			await page.route(noticesDataUrl, async (route) => {
				await route.fulfill({
					status: 403,
					contentType: 'text/html; charset=UTF-8',
					headers: {},
					body: CF_HTML
				});
			});

			await page.getByTestId('nav-link-notices').click();
			await page.waitForTimeout(3000);

			const marks = await getSessionStorage(page);
			expect(marks.detect).not.toBeNull();
			expect(Number(marks.detect)).toBeGreaterThan(0);
		});

		test('non-challenge 403 without cf-mitigated header and with JSON does NOT trigger detection', async ({
			page
		}) => {
			await page.goto('/');
			await expect(page.getByTestId('site-header')).toBeVisible();

			await page.route(noticesDataUrl, async (route) => {
				await route.fulfill(buildPlain403Json());
			});

			await page.getByTestId('nav-link-notices').click();
			await page.waitForTimeout(3000);

			const marks = await getSessionStorage(page);
			expect(marks.guard).toBeNull();
			expect(marks.detect).toBeNull();
		});
	});

	test.describe('recovery UI (SSR error page)', () => {
		test('renders when sessionStorage mark exists and status is challenge', async ({ page }) => {
			await page.goto('/');
			await expect(page.getByTestId('site-header')).toBeVisible();

			const now = Date.now();
			await setSessionStorage(page, { guardTs: now - 60_000, detectTs: now });

			const response = await page.goto('/cf-challenge-test');
			expect(response?.status()).toBe(403);

			await expect(page.getByText('보안 확인 챌린지를 처리하는 중입니다')).toBeVisible({
				timeout: 10_000
			});
			await expect(page.getByRole('button', { name: '지금 새로고침' })).toBeVisible();
			await expect(page.getByText('잠시 후 페이지가 자동으로 새로고침됩니다.')).toBeVisible();
		});

		test('manual refresh button triggers page reload', async ({ page }) => {
			await page.goto('/');
			await expect(page.getByTestId('site-header')).toBeVisible();

			const now = Date.now();
			await setSessionStorage(page, { guardTs: now - 60_000, detectTs: now });

			await page.goto('/cf-challenge-test');

			await expect(page.getByText('보안 확인 챌린지를 처리하는 중입니다')).toBeVisible({
				timeout: 10_000
			});

			await page.getByRole('button', { name: '지금 새로고침' }).click();

			await expect(page).toHaveURL(/\/cf-challenge-test/);
			await expect(page.getByTestId('site-header')).toBeVisible({ timeout: 10_000 });
		});

		test('does NOT show without sessionStorage mark', async ({ page }) => {
			await page.goto('/cf-challenge-test');

			await expect(page.getByText('보안 확인 챌린지를 처리하는 중입니다')).toBeHidden();

			await expect(page.getByText('HTTP 403')).toBeVisible();
		});
	});
});
