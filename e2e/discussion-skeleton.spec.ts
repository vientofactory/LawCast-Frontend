import { test, expect } from '@playwright/test';

for (const width of [320, 1440]) {
	for (const theme of ['light', 'dark']) {
		for (const reducedMotion of ['reduce', 'no-preference'] as const) {
			test(`matches the current skeleton at ${width} in ${theme} with ${reducedMotion}`, async ({
				browser,
				baseURL
			}) => {
				const context = await browser.newContext({
					javaScriptEnabled: false,
					viewport: { width, height: 1000 },
					reducedMotion
				});
				const page = await context.newPage();
				await page.goto(`${baseURL}/notices/2210001/discussions/221000101`);
				await page.evaluate(
					(theme) => document.documentElement.setAttribute('data-theme', theme),
					theme
				);
				const skeleton = page.getByTestId('discussion-thread-skeleton');
				await expect(skeleton).toBeVisible();
				await expect(skeleton).toHaveAttribute('aria-hidden', 'true');
				await expect(page.getByRole('region', { name: '토론 불러오는 중' })).toHaveAttribute(
					'aria-busy',
					'true'
				);
				await expect(skeleton.locator('button,input,textarea,a')).toHaveCount(0);
				const layout = await skeleton.evaluate((node) => ({
					border: getComputedStyle(node.parentElement!).borderWidth,
					padding: getComputedStyle(node.parentElement!).padding,
					animation: getComputedStyle(node.querySelector('.lc-skeleton')!).animationName,
					overflow: document.documentElement.scrollWidth > innerWidth
				}));
				expect(layout.border).toBe('0px');
				expect(layout.padding).toBe('0px');
				expect(layout.animation === 'none').toBe(reducedMotion === 'reduce');
				expect(layout.overflow).toBe(false);
				await expect(page.getByTestId('discussion-skeleton-composer')).toHaveCount(1);
				if (width === 320) {
					await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
					expect(
						await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
					).toBe(true);
				}
				await context.close();
			});
		}
	}
}

test('replaces the skeleton with interactive discussion content after hydration', async ({
	page
}) => {
	await page.goto('/notices/2210001/discussions/221000101');
	await expect(page.getByTestId('discussion-thread-summary')).toBeVisible();
	await expect(page.getByTestId('discussion-thread-skeleton')).toHaveCount(0);
	await expect(page.getByTestId('discussion-reply-form')).toHaveCount(1);
	await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
});
