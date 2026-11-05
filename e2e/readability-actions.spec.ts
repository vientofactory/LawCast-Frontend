import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [320, 390, 820, 1440]) {
	for (const theme of ['light', 'dark']) {
		test(`readable copy and ranked actions at ${width}px in ${theme}`, async ({
			page,
			browserName
		}) => {
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			await page.goto('/');
			const tagline = page.getByTestId('brand-tagline');
			await expect(tagline).toBeVisible();
			expect(
				await tagline.evaluate(async (node) => {
					await Promise.all(
						node.getAnimations().map((animation) => animation.finished.catch(() => {}))
					);
					return getComputedStyle(node).opacity;
				})
			).toBe('1');
			for (const route of ['/', '/notices', '/status', '/crawling-transparency', '/discussions']) {
				await page.goto(route);
				await page.addStyleTag({
					content:
						'.lc-defer-render,.lc-defer-render-sm,.lc-defer-render-lg{content-visibility:visible!important}'
				});
				const small = await page.locator('main').evaluate((main) =>
					[...main.querySelectorAll('p,span,time,button,a')]
						.filter((node) => {
							const box = node.getBoundingClientRect();
							return (
								box.width > 1 &&
								box.height > 1 &&
								node.textContent?.trim() &&
								!node.closest('svg') &&
								parseFloat(getComputedStyle(node).fontSize) < 14
							);
						})
						.map((node) => node.textContent?.trim().slice(0, 60))
				);
				expect(small).toEqual([]);
				expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
					false
				);
			}
			await page.goto('/notices');
			await expect(page.locator('[data-testid^="notice-open-summary-"]')).toHaveCount(0);
			const primary = page.locator('[data-testid^="notice-detail-link-"]').first();
			await expect(primary).toBeVisible();
			await expect(primary).toHaveAttribute('href', /\/notices\//);
			const actions = page.locator('.lc-result-action-secondary');
			for (const action of await actions.all()) {
				await expect(action).toHaveText(/PDF|HWP|국회 원문/);
				await expect(action).toHaveCSS('min-height', '44px');
				// Allow subpixel rectangle serialization in Firefox.
				expect((await action.boundingBox())?.height).toBeGreaterThanOrEqual(43.99);
				expect(await action.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
					'rgba(0, 0, 0, 0)'
				);
			}
			await primary.focus();
			await expect(primary).toBeFocused();
			// Safari's native all-controls navigation uses Option-Tab.
			await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
			await expect(actions.first()).toBeFocused();
			// Audit the completed historical reveal, not a partially transparent animation frame.
			await page.getByTestId('brand-heading').evaluate(async (node) => {
				await Promise.all(
					node
						.getAnimations({ subtree: true })
						.map((animation) => animation.finished.catch(() => {}))
				);
			});
			const audit = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
				.analyze();
			expect(audit.violations).toEqual([]);
		});
	}
}
