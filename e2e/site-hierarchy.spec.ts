import { test, expect } from '@playwright/test';

for (const width of [390, 1440]) {
	for (const theme of ['light', 'dark']) {
		test(`keeps page and section titles distinct at ${width} in ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			for (const route of [
				'/status',
				'/crawling-transparency',
				'/proposals',
				'/license',
				'/announcements',
				'/discussions',
				'/notices/semantic-search'
			]) {
				await page.goto(route);
				await expect(page.locator('main h1')).toBeVisible();
				expect(
					await page
						.locator('main h1')
						.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))
				).toBeGreaterThanOrEqual(28);
				for (const title of await page.locator('main .lc-section-heading').all()) {
					if (await title.isVisible())
						expect(
							await title.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))
						).toBe(20);
				}
				expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
					false
				);
			}
		});
	}
}
