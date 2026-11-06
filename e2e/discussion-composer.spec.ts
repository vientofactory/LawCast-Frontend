import { test, expect } from '@playwright/test';

for (const width of [320, 390, 768, 1440]) {
	for (const theme of ['light', 'dark']) {
		test(`distinguishes the composer at ${width} in ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.goto('/notices/2210001/discussions/221000101');
			const composer = page.getByTestId('discussion-reply-form');
			await expect(composer).toBeAttached();
			await page.evaluate(
				(theme) => document.documentElement.setAttribute('data-theme', theme),
				theme
			);
			await composer.scrollIntoViewIfNeeded();
			await expect(page.getByRole('region', { name: '새 의견 작성' })).toBeVisible();
			const style = await composer.evaluate((node) => ({
				background: getComputedStyle(node).backgroundColor,
				heading: parseFloat(getComputedStyle(node.querySelector('h3')!).fontSize),
				border: getComputedStyle(node).borderTopWidth
			}));
			expect(style.background).not.toBe('rgba(0, 0, 0, 0)');
			expect(style.heading).toBe(20);
			expect(style.border).toBe('1px');
			await page.getByTestId('discussion-reply-nickname').focus();
			await page.keyboard.press('Tab');
			await expect(page.getByTestId('discussion-reply-password')).toBeFocused();
			await page.keyboard.press('Tab');
			await expect(page.getByTestId('discussion-reply-content')).toBeFocused();
			if (width === 320)
				await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
		});
	}
}
