import { expect, test, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const pages = [
	'/notices',
	'/notices/changes',
	'/discussions',
	'/status',
	'/proposals',
	'/crawling-transparency',
	'/notices/semantic-search?search=보호'
];
async function setMode(request: APIRequestContext, mode: string) {
	const response = await request.get(`http://127.0.0.1:4331/control?mode=${mode}`);
	expect(response.ok()).toBe(true);
	expect((await response.json()).mode).toBe(mode);
}
test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => Reflect.deleteProperty(window, 'PushManager'));
});
for (const path of pages)
	test(`distinguishes server failure from rate limiting on ${path}`, async ({
		page,
		request
	}, info) => {
		await setMode(request, 'server');
		await page.goto(path);
		const failure = page.getByTestId('load-failure');
		await expect(failure).toBeVisible();
		await expect(failure).toHaveAttribute('data-failure-kind', 'server');
		await expect(page.getByTestId('server-offline-screen')).toHaveCount(0);
		await expect(page.getByRole('banner')).toBeVisible();
		await expect(page.getByRole('contentinfo')).toBeVisible();
		await expect(page.locator('.lc-rate-limit-overlay')).toHaveCount(0);
		await expect(failure.getByRole('button', { name: '다시 시도', exact: true })).toBeEnabled();
		await expect(page.getByText('요청이 너무 많습니다', { exact: true })).toHaveCount(0);
		if (path === '/notices') {
			expect(
				(await new AxeBuilder({ page }).include('[data-testid="load-failure"]').analyze())
					.violations
			).toEqual([]);
			if (process.env.UI_SCREENSHOT_DIR) {
				const dir = join(process.env.UI_SCREENSHOT_DIR, info.project.name);
				await mkdir(dir, { recursive: true });
				await page.screenshot({ path: join(dir, 'server-light.png') });
			}
		}
	});
for (const [mode, kind] of [
	['network', 'network'],
	['timeout', 'timeout'],
	['unauthorized', 'unauthorized'],
	['forbidden', 'forbidden'],
	['missing', 'not-found'],
	['invalid', 'invalid-request'],
	['html', 'invalid-response'],
	['bad-json', 'invalid-response'],
	['false-envelope', 'invalid-response']
] as const) {
	test(`classifies ${mode} without a rate-limit cooldown`, async ({ page, request }) => {
		await setMode(request, mode);
		await page.goto('/notices');
		await expect(page.getByTestId('load-failure')).toHaveAttribute('data-failure-kind', kind);
		await expect(page.locator('.lc-rate-limit-overlay')).toHaveCount(0);
	});
}
for (const mode of ['rate', 'rate-html', 'rate-json'])
	test(`retains genuine HTTP 429 handling for ${mode}`, async ({ page, request }) => {
		await setMode(request, mode);
		await page.goto('/notices');
		await expect(page.locator('.lc-rate-limit-overlay')).toBeVisible();
		await expect(page.getByTestId('load-failure')).toHaveCount(0);
	});
test('clears cooldown when retry changes from 429 to 503 and then recovers', async ({
	page,
	request
}) => {
	await setMode(request, 'rate');
	await page.goto('/notices');
	const rate = page.locator('.lc-rate-limit-overlay');
	const retry = rate.getByRole('button', { name: '다시 시도', exact: true });
	await expect(retry).toBeDisabled();
	await expect(retry).toBeEnabled({ timeout: 6000 });
	await setMode(request, 'server');
	await retry.click();
	const failure = page.getByTestId('load-failure');
	await expect(failure).toHaveAttribute('data-failure-kind', 'server');
	await expect(rate).toHaveCount(0);
	await expect(failure.getByRole('button', { name: '다시 시도', exact: true })).toBeEnabled();
	await setMode(request, 'ok');
	await failure.getByRole('button', { name: '다시 시도', exact: true }).click();
	await expect(failure).toHaveCount(0);
	await expect(page.getByRole('heading', { name: '입법예고', exact: true })).toBeVisible();
});
test('keeps failure feedback readable in dark mode', async ({ page, request }, info) => {
	await setMode(request, 'server');
	await page.addInitScript(() => localStorage.setItem('lawcast-theme', 'dark'));
	await page.goto('/notices');
	const failure = page.getByTestId('load-failure');
	await expect(failure).toBeVisible();
	expect(
		(await new AxeBuilder({ page }).include('[data-testid="load-failure"]').analyze()).violations
	).toEqual([]);
	if (process.env.UI_SCREENSHOT_DIR) {
		const dir = join(process.env.UI_SCREENSHOT_DIR, info.project.name);
		await mkdir(dir, { recursive: true });
		await page.screenshot({ path: join(dir, 'server-dark.png') });
	}
});

test('bounds unanswered upstream requests and shows a timeout instead of rate limiting', async ({
	page,
	request
}) => {
	test.setTimeout(60000);
	await setMode(request, 'slow');
	await page.goto('/notices', { timeout: 45000 });
	await expect(page.getByTestId('load-failure')).toHaveAttribute('data-failure-kind', 'timeout');
	await expect(page.locator('.lc-rate-limit-overlay')).toHaveCount(0);
});

for (const path of ['/notices/2210001', '/notices/2210001/discussions/221000101'])
	test(`keeps partial discussion failures distinct on ${path}`, async ({ page, request }) => {
		await setMode(request, 'partial');
		await page.goto(path);
		const region = path.endsWith('221000101')
			? page.locator('main')
			: page.getByTestId('notice-discussions');
		await expect(region.getByTestId('load-failure')).toHaveAttribute('data-failure-kind', 'server');
		await expect(region.locator('.lc-rate-limit-overlay')).toHaveCount(0);
		await expect(region.getByRole('button', { name: '다시 시도', exact: true })).toBeEnabled();
	});

test('preserves upstream server failure status on the detail error page', async ({
	page,
	request
}) => {
	await setMode(request, 'server');
	const response = await page.goto('/notices/2210001');
	expect(response?.status()).toBe(503);
	await expect(page.getByTestId('server-offline-screen')).toHaveCount(0);
	await expect(page.getByRole('banner')).toBeVisible();
	await expect(page.getByRole('contentinfo')).toBeVisible();
	await expect(page.locator('section[data-failure-kind="server"]')).toBeVisible();
	await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeEnabled();
	await expect(page.locator('.lc-rate-limit-overlay')).toHaveCount(0);
});

for (const path of ['/', '/notices', '/notices/2210001', '/notices/2210001/discussions/221000101'])
	test(`shows dedicated server offline guidance on ${path}`, async ({ page, request }) => {
		await setMode(request, 'network');
		await page.goto(path);
		const screen = page.getByTestId('server-offline-screen');
		await expect(screen).toBeVisible();
		await expect(page.getByRole('banner')).toHaveCount(0);
		await expect(page.getByRole('contentinfo')).toHaveCount(0);
		await expect(screen.getByRole('heading')).toHaveText('데이터 서버에 연결할 수 없습니다');
		await expect(screen.getByRole('link', { name: /공식 디스코드/ })).toHaveAttribute(
			'href',
			'https://discord.gg/er675xfv7K'
		);
		await expect(screen.getByRole('link', { name: /서비스 상태/ })).toHaveAttribute(
			'href',
			'https://stats.uptimerobot.com/t2yRqkjHzp'
		);
		await expect(screen.getByRole('link', { name: /서비스 상태/ })).toHaveAttribute(
			'target',
			'_blank'
		);
		await expect(screen.getByRole('button', { name: '다시 시도', exact: true })).toBeEnabled();
		await expect(page.getByTestId('pwa-offline-page')).toHaveCount(0);
		await expect(page.locator('.lc-rate-limit-overlay')).toHaveCount(0);
	});

test('keeps generic server errors and rate limits distinct from server offline guidance', async ({
	page,
	request
}) => {
	await setMode(request, 'internal');
	await page.goto('/notices');
	await expect(page.getByTestId('load-failure')).toHaveAttribute('data-failure-kind', 'server');
	await expect(page.getByTestId('server-offline-screen')).toHaveCount(0);
	await setMode(request, 'rate');
	await page.reload();
	await expect(page.locator('.lc-rate-limit-overlay')).toBeVisible();
	await expect(page.getByTestId('server-offline-screen')).toHaveCount(0);
});

test('recovers from server offline and keeps the PWA document independent', async ({
	page,
	request
}) => {
	await setMode(request, 'network');
	await page.goto('/notices?search=보호');
	const screen = page.getByTestId('server-offline-screen');
	await expect(screen).toBeVisible();
	await setMode(request, 'ok');
	await screen.getByRole('button', { name: '다시 시도', exact: true }).click();
	await expect(screen).toHaveCount(0);
	await expect(page).toHaveURL(/search=/);
	await page.goto('/offline.html');
	await expect(page.getByTestId('pwa-offline-page')).toBeVisible();
	await expect(page.getByTestId('server-offline-screen')).toHaveCount(0);
});

for (const theme of ['light', 'dark'])
	test(`keeps server offline actions accessible in ${theme}`, async ({ page, request }, info) => {
		await page.addInitScript((theme) => localStorage.setItem('lawcast-theme', theme), theme);
		await setMode(request, 'network');
		await page.goto('/notices');
		const screen = page.getByTestId('server-offline-screen');
		await expect(screen).toBeVisible();
		expect(
			(await new AxeBuilder({ page }).include('[data-testid="server-offline-screen"]').analyze())
				.violations
		).toEqual([]);
		for (const action of await screen.locator('button, a').all()) {
			const box = await action.boundingBox();
			expect(box!.height).toBeGreaterThanOrEqual(44);
			await action.focus();
			await expect(action).toBeFocused();
		}
		if (process.env.UI_SCREENSHOT_DIR) {
			const dir = join(process.env.UI_SCREENSHOT_DIR, info.project.name);
			await mkdir(dir, { recursive: true });
			await page.screenshot({ path: join(dir, `offline-${theme}.png`) });
		}
		await page.setViewportSize({ width: 320, height: 740 });
		await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	});

test('uses the shared page hierarchy for server offline recovery', async ({ page, request }) => {
	await setMode(request, 'network');
	await page.goto('/notices');
	const screen = page.getByTestId('server-offline-screen');
	await expect(screen.locator('img[src="/brand/v2/icon-192.png"]')).toHaveCount(0);
	await expect(screen.locator('.lc-page-heading')).toBeVisible();
	await expect(page.getByTestId('server-offline-page')).toHaveClass(/lc-main--form/);
	await expect(screen.getByTestId('server-offline-retry')).toHaveClass(/lc-button-primary/);
	await expect(screen.getByTestId('server-offline-status')).toHaveClass(/lc-button-neutral/);
	await expect(screen.getByTestId('server-offline-discord')).toHaveClass(/lc-link/);
	await expect(page.getByRole('banner')).toHaveCount(0);
	await expect(page.getByRole('contentinfo')).toHaveCount(0);
	await setMode(request, 'ok');
	await screen.getByTestId('server-offline-retry').click();
	await expect(screen).toHaveCount(0);
	await expect(page.getByRole('banner')).toBeVisible();
	await expect(page.getByRole('contentinfo')).toBeVisible();
});

test('retains navigation and footer on non-offline error pages', async ({ page, request }) => {
	await setMode(request, 'missing');
	await page.goto('/notices/2210001');
	await expect(page.getByRole('banner')).toBeVisible();
	await expect(page.getByRole('contentinfo')).toBeVisible();
	await expect(page.getByTestId('server-offline-screen')).toHaveCount(0);
});

for (const mode of ['gateway', 'server', 'timeout'] as const)
	test(`keeps HTTP ${mode} responses in ordinary error UI`, async ({ page, request }) => {
		await setMode(request, mode);
		await page.goto('/notices');
		await expect(page.getByTestId('server-offline-screen')).toHaveCount(0);
		await expect(page.getByTestId('load-failure')).toHaveAttribute(
			'data-failure-kind',
			mode === 'timeout' ? 'timeout' : 'server'
		);
		await expect(page.getByRole('banner')).toBeVisible();
		await expect(page.getByRole('contentinfo')).toBeVisible();
		await expect(
			page.getByTestId('load-failure').getByRole('button', { name: '다시 시도', exact: true })
		).toBeEnabled();
	});

for (const path of ['/notices/2210001', '/notices/2210001/discussions/221000101'])
	test(`preserves connection failure through browser proxy retry on ${path}`, async ({
		page,
		request
	}) => {
		await setMode(request, 'partial-network');
		await page.goto(path);
		const failure = page.getByTestId('load-failure');
		await expect(failure).toHaveAttribute('data-failure-kind', 'network');
		await expect(page.getByTestId('server-offline-screen')).toBeVisible();
		const responsePromise = page.waitForResponse(
			(response) =>
				response.url().includes('/api/') &&
				response.headers()['x-lawcast-proxy-connection-failure'] === 'network'
		);
		await failure.getByRole('button', { name: '다시 시도', exact: true }).click();
		expect((await responsePromise).status()).toBe(502);
		await expect(failure).toHaveAttribute('data-failure-kind', 'network');
		await expect(failure).toHaveAttribute('aria-busy', 'false');
		await expect(page.locator('.lc-rate-limit-overlay')).toHaveCount(0);
	});
