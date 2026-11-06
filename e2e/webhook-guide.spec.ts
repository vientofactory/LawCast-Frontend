import { test, expect } from '@playwright/test';

for (const width of [320, 390, 768, 1440]) {
	for (const theme of ['light', 'dark']) {
		test(`keeps the guide readable at ${width} in ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((theme) => localStorage.setItem('lawcast-theme', theme), theme);
			await page.goto('/webhook');
			const guide = page.getByTestId('webhook-guide');
			const toggle = page.getByTestId('webhook-guide-toggle');
			await toggle.focus();
			await page.keyboard.press('Enter');
			await expect(guide).toHaveAttribute('open', '');
			await expect(guide.locator('ol > li')).toHaveCount(6);
			await expect(guide.locator('.lc-banner-info, .lc-banner-warning')).toHaveCount(0);
			await expect(guide.locator('code')).toHaveText([
				'https://discord.com/api/webhooks/',
				'https://discordapp.com/api/webhooks/'
			]);
			await expect(page.getByTestId('webhook-guide-content')).toHaveCSS(
				'background-color',
				'rgba(0, 0, 0, 0)'
			);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await toggle.click();
			await expect(guide).not.toHaveAttribute('open');
			await toggle.click();
			await expect(guide).toHaveAttribute('open', '');
			if (width === 320) {
				await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true
				);
			}
		});
	}
}
