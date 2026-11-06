import { test, expect } from '@playwright/test';

for (const width of [320, 390, 768, 1440]) {
	for (const theme of ['light', 'dark']) {
		test(`separates bill context from discussion at ${width} in ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.goto('/notices/2210001/discussions/221000101');
			const context = page.getByTestId('discussion-bill-context');
			const summary = page.getByTestId('discussion-thread-summary');
			await expect(summary).toBeVisible();
			await page.evaluate(
				(theme) => document.documentElement.setAttribute('data-theme', theme),
				theme
			);
			await expect(context).toContainText('토론 대상 법률안');
			await expect(summary).toContainText('토론 주제');
			const geometry = await page.evaluate(() => {
				const context = document.querySelector('[data-testid="discussion-bill-context"]')!;
				const summary = document.querySelector('[data-testid="discussion-thread-summary"]')!;
				const actions = document.querySelector('[data-testid="discussion-thread-actions"]')!;
				return {
					background: getComputedStyle(context).backgroundColor,
					titleSize: parseFloat(getComputedStyle(summary.querySelector('h2')!).fontSize),
					contextSize: parseFloat(getComputedStyle(context.querySelector('h1')!).fontSize),
					gap: actions.getBoundingClientRect().top - context.getBoundingClientRect().bottom,
					actionBorder: getComputedStyle(actions).borderBottomWidth,
					overflow: document.documentElement.scrollWidth > innerWidth
				};
			});
			expect(geometry.background).not.toBe('rgba(0, 0, 0, 0)');
			expect(geometry.titleSize).toBeGreaterThan(geometry.contextSize);
			expect(geometry.gap).toBeGreaterThanOrEqual(24);
			expect(geometry.actionBorder).toBe('0px');
			expect(geometry.overflow).toBe(false);
			await expect(page.getByRole('region', { name: '토론 본문' })).toBeVisible();
			await expect(page.getByTestId('discussion-comment-list')).toBeVisible();
			if (width === 320) {
				await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true
				);
			}
		});
	}
}
