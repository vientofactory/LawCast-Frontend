import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { measureContrast } from './helpers/contrast';

test.beforeEach(async ({ page }) => {
	// Isolated accessibility checks must not depend on CDN font availability.
	await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
	await page.route('https://www.googletagmanager.com/**', (route) =>
		route.fulfill({ contentType: 'application/javascript', body: '' })
	);
});

for (const theme of ['light', 'dark'] as const) {
	for (const path of [
		'/',
		'/notices',
		'/notices/2210001',
		'/notices/changes',
		'/discussions',
		'/proposals',
		'/webhook',
		'/status',
		'/announcements',
		'/crawling-transparency',
		'/license'
	]) {
		test(`passes accessibility audits on ${path} in ${theme} mode`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
			await page.goto(path);
			await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
			// Expand deferred subtrees before scanning their computed colors.
			// Native reveal and theme changes are covered separately below.
			await page.addStyleTag({
				content:
					'.lc-defer-render, .lc-defer-render-sm, .lc-defer-render-lg { content-visibility: visible !important; }'
			});
			await page.evaluate(
				() =>
					new Promise<void>((resolve) =>
						requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
					)
			);
			const results = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
				.analyze();
			expect(results.violations).toEqual([]);
		});
	}
}

test('renders content without waiting for external font CSS', async ({ page }) => {
	let releaseFontRequest!: () => void;
	const fontGate = new Promise<void>((resolve) => {
		releaseFontRequest = resolve;
	});
	const externalStylesheets: string[] = [];
	page.on('request', (request) => {
		if (request.resourceType() === 'stylesheet' && request.url().startsWith('https://')) {
			externalStylesheets.push(request.url());
		}
	});
	await page.route('https://cdnjs.cloudflare.com/**', async (route) => {
		await fontGate;
		await route.abort();
	});
	try {
		await page.goto('/', { waitUntil: 'domcontentloaded' });
		await expect(page.locator('#home-page-title')).toBeVisible();
		await expect(page.getByTestId('home-search-input')).toBeVisible();
		expect(externalStylesheets).toEqual([]);
		await expect
			.poll(() =>
				page.evaluate(() => performance.getEntriesByName('first-contentful-paint').length)
			)
			.toBe(1);
	} finally {
		releaseFontRequest();
	}
});

test('paints server-rendered content while hydration and analytics scripts are pending', async ({
	page
}) => {
	let releaseScripts!: () => void;
	const scriptsGate = new Promise<void>((resolve) => {
		releaseScripts = resolve;
	});
	const pendingScripts: string[] = [];
	await page.route(/\/_app\/immutable\/.*\.js|www\.googletagmanager\.com\//, async (route) => {
		pendingScripts.push(route.request().url());
		await scriptsGate;
		await route.abort();
	});
	await page.addInitScript(() => {
		Object.assign(window, { __pendingScriptLcp: 0 });
		new PerformanceObserver((list) => {
			Object.assign(window, { __pendingScriptLcp: list.getEntries().at(-1)?.startTime ?? 0 });
		}).observe({ type: 'largest-contentful-paint', buffered: true });
	});
	try {
		await page.goto('/license', { waitUntil: 'commit' });
		await expect(page.locator('pre.lc-code-block')).toBeVisible();
		await expect.poll(() => pendingScripts.some((url) => url.includes('/_app/'))).toBe(true);
		await expect
			.poll(() => pendingScripts.some((url) => url.includes('googletagmanager')))
			.toBe(true);
		await expect
			.poll(() =>
				page.evaluate(() => (window as Window & { __pendingScriptLcp: number }).__pendingScriptLcp)
			)
			.toBeGreaterThan(0);
		const navigation = await page.evaluate(() => {
			const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
			return { load: timing.loadEventEnd };
		});
		expect(navigation).toEqual({ load: 0 });
	} finally {
		releaseScripts();
	}
});

test('loads the Discord widget only on request and reserves its layout space', async ({ page }) => {
	const discordRequests: string[] = [];
	await page.route('https://discord.com/**', (route) => {
		discordRequests.push(route.request().url());
		return route.fulfill({
			contentType: 'text/html',
			body: '<!doctype html><html lang="ko"><title>Discord</title><body>커뮤니티</body></html>'
		});
	});
	await page.goto('/');
	await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
	const region = page.getByTestId('discord-widget-region');
	await region.scrollIntoViewIfNeeded();
	await expect(page.getByTestId('discord-widget-load')).toBeVisible();
	await expect(page.getByTestId('discord-widget')).toHaveCount(0);
	expect(discordRequests).toEqual([]);
	const before = await region.boundingBox();
	await page.getByTestId('discord-widget-load').click();
	await expect(page.getByTestId('discord-widget')).toBeVisible();
	await expect.poll(() => discordRequests.length).toBe(1);
	expect(await region.boundingBox()).toEqual(before);
});

test('keeps offscreen text legible immediately after changing theme', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');
	await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
	await page.emulateMedia({ colorScheme: 'dark' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.locator('#recent-discussions').scrollIntoViewIfNeeded();
	const heading = await measureContrast(page, {
		selector: '#recent-discussions h2.lc-text-primary'
	});
	expect(heading.ratio).toBeGreaterThanOrEqual(3);
});

test('keeps a deferred primary action legible on reveal and theme change', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');
	await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
	await page.getByTestId('discord-widget-load').scrollIntoViewIfNeeded();
	const target = { selector: '[data-testid="discord-widget-load"]' };
	expect((await measureContrast(page, target)).ratio).toBeGreaterThanOrEqual(4.5);
	await page.emulateMedia({ colorScheme: 'dark' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	expect((await measureContrast(page, target)).ratio).toBeGreaterThanOrEqual(4.5);
});

test('keeps layout stable and responds promptly to a search input interaction', async ({
	page
}) => {
	await page.addInitScript(() => {
		const metrics = { cls: 0, interactions: [] as number[] };
		Object.assign(window, { __webVitals: metrics });
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
				if (!shift.hadRecentInput) metrics.cls += shift.value;
			}
		}).observe({ type: 'layout-shift', buffered: true });
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if ((entry as PerformanceEntry & { interactionId: number }).interactionId)
					metrics.interactions.push(entry.duration);
			}
		}).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
	});
	await page.goto('/');
	await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
	await page.getByTestId('home-search-input').pressSequentially('test');
	await expect(page.getByTestId('home-search-input')).toHaveValue('test');
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
	const metrics = await page.evaluate(
		() =>
			(window as Window & { __webVitals?: { cls: number; interactions: number[] } }).__webVitals!
	);
	expect(metrics.cls).toBeLessThanOrEqual(0.1);
	// Event Timing omits interactions below its 16 ms reporting threshold.
	expect(Math.max(0, ...metrics.interactions)).toBeLessThanOrEqual(200);
});

test('lets keyboard users scroll the statistics table', async ({ page }) => {
	await page.goto('/proposals');
	await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
	const table = page.getByTestId('proposals-table-scroll');
	await table.focus();
	await expect(table).toBeFocused();
	await table.press('ArrowDown');
	await expect.poll(() => table.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
});

test('exposes a named progress bar while navigation is pending', async ({ page }) => {
	let releaseNavigation!: () => void;
	const gate = new Promise<void>((resolve) => {
		releaseNavigation = resolve;
	});
	await page.route('**/notices/__data.json*', async (route) => {
		await gate;
		await route.continue();
	});
	await page.goto('/');
	await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
	try {
		const link = page.getByTestId('home-status-link-archive');
		await link.focus();
		await link.press('Enter');
		await expect(page.getByRole('progressbar', { name: '페이지 불러오는 중' })).toBeVisible();
		const results = await new AxeBuilder({ page })
			.withRules(['aria-roles', 'aria-progressbar-name', 'region'])
			.analyze();
		expect(results.violations).toEqual([]);
	} finally {
		releaseNavigation();
	}
	await expect(page).toHaveURL(/\/notices$/);
});

test('keeps modal actions reachable while the consent banner is visible', async ({ page }) => {
	await page.goto('/notices/2210001');
	await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
	await page.getByTestId('discussion-new-thread-button').click();
	await expect(page.getByTestId('discussion-new-thread-modal')).toBeVisible();
	await page.getByTestId('discussion-new-thread-password').fill('1234');
	await page.getByTestId('discussion-new-thread-content').fill('모달 접근성 검증 의견입니다.');
	await page.getByTestId('discussion-new-thread-submit').click();
	await expect(page.getByTestId('discussion-new-thread-error')).toHaveText(
		'토론 주제를 2자 이상 입력해주세요.'
	);
	await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
});
