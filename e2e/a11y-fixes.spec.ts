import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { buildMarkdownHeadingLevels } from '../src/lib/utils/markdown-headings';

test.beforeEach(async ({ page, browserName }, info) => {
	// Layout coverage isolates WebKit's unavailable headless native push implementation.
	if (browserName === 'webkit' && !info.title.startsWith('keeps push initialization')) {
		await page.addInitScript(() => {
			Reflect.deleteProperty(window, 'PushManager');
		});
	}
});

test('normalizes nested Markdown headings without mutating tokens', () => {
	for (const first of [1, 2, 3, 6]) {
		const headings = [
			{ type: 'heading', depth: first },
			{ type: 'heading', depth: 6 },
			{ type: 'heading', depth: first }
		];
		const tokens = [headings[0], { type: 'blockquote', tokens: [headings[1]] }, headings[2]];
		const before = JSON.stringify(tokens);
		const levels = buildMarkdownHeadingLevels(tokens);
		expect(headings.map((h) => levels.get(h))).toEqual([2, first === 6 ? 2 : 3, 2]);
		expect(JSON.stringify(tokens)).toBe(before);
	}
});

test('reveals home section links when keyboard focus enters the navigation', async ({ page }) => {
	await page.goto('/');
	const navigation = page.getByTestId('home-section-navigation');
	await navigation.locator('a').first().focus();
	await expect(navigation).toHaveCSS('clip-path', 'none');
	expect((await navigation.boundingBox())!.width).toBeGreaterThan(100);
	// WebKit's default native Tab policy omits links; focus visibility is the invariant.
	await navigation.locator('a').nth(1).focus();
	await expect(navigation.locator('a').nth(1)).toBeFocused();
	await expect(navigation).toHaveCSS('clip-path', 'none');
});

test('keeps landscape navigation scrollable and restores its keyboard invoker', async ({
	page
}) => {
	await page.setViewportSize({ width: 667, height: 375 });
	await page.goto('/');
	const trigger = page.getByRole('button', { name: '메뉴 열기', exact: true });
	await expect(async () => {
		await trigger.focus();
		await trigger.press('Enter');
		await expect(page.getByTestId('mobile-navigation')).toBeVisible({ timeout: 1000 });
	}).toPass();
	const menu = page.getByTestId('mobile-navigation');
	await expect(menu).toHaveCSS('overflow-y', 'auto');
	expect((await menu.boundingBox())!.height).toBeLessThanOrEqual(375.5);
	const last = page.getByTestId('mobile-nav-link-webhook');
	await last.focus();
	await last.scrollIntoViewIfNeeded();
	const bounds = (await last.boundingBox())!;
	expect(bounds.y + bounds.height).toBeLessThanOrEqual(376);
	for (let i = 0; i < 12; i++) {
		await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab');
		expect(await menu.evaluate((node) => node.contains(document.activeElement))).toBe(true);
	}
	await page.keyboard.press('Escape');
	await expect(menu).toHaveCount(0);
	await expect(trigger).toBeFocused();
	await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

for (const width of [390, 1440]) {
	test(`reflows seven public surfaces at 200 percent root font at ${width}px`, async ({
		page,
		browserName
	}) => {
		if (browserName === 'webkit')
			await page.addInitScript(() => {
				Reflect.deleteProperty(window, 'PushManager');
			});
		await page.setViewportSize({ width, height: 900 });
		for (const route of [
			'/',
			'/notices',
			'/notices/2210004',
			'/discussions',
			'/webhook',
			'/announcements/mock-announcement-2',
			'/status'
		]) {
			await page.goto(route);
			await page.addStyleTag({ content: ':root {font-size:200%!important}' });
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), {
					message: route
				})
				.toBe(true);
		}
	});
}

test('exposes native guide expansion and repairs public landmark references', async ({ page }) => {
	await page.goto('/webhook');
	const guide = page.getByTestId('webhook-guide');
	await expect(guide).not.toHaveAttribute('open', '');
	await page.getByTestId('webhook-guide-toggle').focus();
	await page.keyboard.press('Enter');
	await expect(guide).toHaveAttribute('open', '');
	await expect(
		page
			.getByTestId('webhook-guide-content')
			.getByRole('heading', { name: '알림을 받을 채널 선택' })
	).toBeVisible();
	await page.goto('/a11y-fix-not-found');
	await expect(page.locator('main#main-content')).toHaveCount(1);
	await page.goto('/notices/2210001/discussions/221000101');
	await expect(page.locator('main')).toHaveAttribute('aria-labelledby', 'discussion-thread-title');
	await expect(page.locator('#discussion-thread-title')).toHaveCount(1);
});

test('repairs archive semantics, comparison names and announcement hierarchy', async ({ page }) => {
	await page.goto('/notices/2210004');
	await page.addStyleTag({
		content:
			'.lc-defer-render,.lc-defer-render-sm,.lc-defer-render-lg{content-visibility:visible!important}'
	});
	const archive = page.getByTestId('notice-detail-archive-meta');
	await archive.locator(':scope > summary').focus();
	await page.keyboard.press('Enter');
	await expect(archive).toHaveAttribute('open', '');
	const axe = await new AxeBuilder({ page })
		.include('[data-testid="notice-detail-archive-meta"]')
		.withRules(['definition-list'])
		.analyze();
	expect(axe.violations).toEqual([]);
	await page.goto('/notices/2210004?timeline=1&cmpFrom=1&cmpTo=2');
	await expect(page.getByTestId('revision-comparison')).toBeVisible();
	const labels = await page
		.getByTestId('revision-comparison')
		.locator('[aria-label]')
		.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
	expect(labels.length).toBeGreaterThan(1);
	expect(new Set(labels).size).toBe(labels.length);
	await page.goto('/announcements/mock-announcement-2');
	const body = page.getByTestId('admin-notice-body');
	expect(
		await body
			.locator('h2,h3,h4,h5,h6')
			.first()
			.evaluate((node) => node.tagName)
	).toBe('H2');
	await expect(body).not.toHaveAttribute('aria-label');
});

for (const theme of ['light', 'dark']) {
	test(`keeps push initialization errors readable in ${theme}`, async ({ page }) => {
		await page.addInitScript((value) => {
			localStorage.setItem('lawcast-theme', value);
			// This UI-state fixture never invokes the engine's native push implementation.
			if (!('PushManager' in window))
				Object.defineProperty(window, 'PushManager', { value: class {} });
			navigator.serviceWorker.register = () =>
				Promise.reject(new Error('Error retrieving push subscription.'));
		}, theme);
		await page.route('**/api/push/public-key', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ enabled: true, publicKey: 'fixture-unused-key' })
			})
		);
		await page.goto('/webhook');
		const alert = page
			.getByRole('alert')
			.filter({ hasText: 'Error retrieving push subscription.' });
		await expect(alert).toBeVisible();
		await alert.scrollIntoViewIfNeeded();
		await expect(alert).toHaveAttribute('data-notification-type', 'error');
		const result = await new AxeBuilder({ page })
			.include('[data-notification-type="error"]')
			.withRules(['color-contrast'])
			.analyze();
		expect(result.violations).toEqual([]);
	});
}

test('keeps deferred archive summaries hit-testable after pointer scrolling', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/notices/2210004');
	const archive = page.getByTestId('notice-detail-archive-meta');
	await expect(archive).toHaveAttribute('data-disclosure-enhanced', '');
	await expect(archive).toHaveCSS('content-visibility', 'visible');
	await archive.locator(':scope > summary').click();
	await expect(archive).toHaveAttribute('open', '');
	await archive.locator(':scope > summary').click();
	await expect(archive).not.toHaveAttribute('open');
});

for (const width of [390, 1440]) {
	test(`animates disclosure arrows only for user changes at ${width}px`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.setViewportSize({ width, height: 1000 });
		await page.addInitScript(() => {
			const state = window as unknown as { disclosureRotations: boolean[] };
			state.disclosureRotations = [];
			const animate = Element.prototype.animate;
			Element.prototype.animate = function (frames, options) {
				if (this.classList.contains('lc-disclosure-indicator'))
					state.disclosureRotations.push(
						!!this.closest('details')?.hasAttribute('data-disclosure-animate')
					);
				return animate.call(this, frames, options);
			};
			document.addEventListener(
				'transitionrun',
				(event) => {
					if (
						event.propertyName === 'transform' &&
						event.target instanceof HTMLElement &&
						event.target.classList.contains('lc-disclosure-indicator')
					) {
						state.disclosureRotations.push(
							!!event.target.closest('details')?.hasAttribute('data-disclosure-animate')
						);
					}
				},
				true
			);
		});
		// Delay hydration enough to expose the server-rendered initial state first.
		await page.route(/\/src\/routes\/notices\/.*\+page\.svelte/, async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 300));
			await route.continue();
		});
		await page.goto('/notices/2210004');
		const facts = page.getByTestId('notice-detail-facts');
		await expect(facts).toHaveAttribute('data-disclosure-enhanced', '');
		await expect
			.poll(() => facts.evaluate((node) => (node as HTMLDetailsElement).open))
			.toBe(width >= 1024);
		await page.waitForTimeout(250);
		const rotations = () =>
			page.evaluate(
				() => (window as unknown as { disclosureRotations: boolean[] }).disclosureRotations
			);
		expect(await rotations()).toEqual([]);
		const indicator = facts.getByTestId('disclosure-indicator');
		await expect(indicator).toHaveCSS('border-top-width', '0px');
		await expect(indicator).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		const summary = facts.locator(':scope > summary');
		await summary.focus();
		await summary.press('Enter');
		await expect.poll(async () => (await rotations()).length).toBeGreaterThan(0);
		expect((await rotations()).every(Boolean)).toBe(true);
		await expect(facts).not.toHaveAttribute('data-disclosure-state');
		await page.evaluate(() => {
			(window as unknown as { disclosureRotations: boolean[] }).disclosureRotations = [];
		});
		const nextWidth = width === 390 ? 1440 : 390;
		for (const resizedWidth of [nextWidth, width]) {
			await page.setViewportSize({ width: resizedWidth, height: 1000 });
			await expect
				.poll(() => facts.evaluate((node) => (node as HTMLDetailsElement).open))
				.toBe(resizedWidth >= 1024);
			await page.waitForTimeout(250);
			expect(await rotations()).toEqual([]);
		}
	});
}
