import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark']) {
	for (const touch of [false, true]) {
		test(`keeps the ${theme} switch clear when idle with touch=${touch}`, async ({
			browser,
			baseURL
		}, testInfo) => {
			const context = await browser.newContext({
				viewport: { width: touch ? 390 : 1440, height: 900 },
				hasTouch: touch
			});
			await context.addInitScript((theme) => localStorage.setItem('lawcast-theme', theme), theme);
			const page = await context.newPage();
			await page.goto(baseURL!);
			if (touch) {
				await expect(async () => {
					await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
					await expect(page.getByRole('switch')).toBeVisible({ timeout: 1000 });
				}).toPass();
			}
			const control = page.getByRole('switch');
			await expect(control).toHaveAttribute('aria-checked', String(theme === 'dark'));
			await page.mouse.move(0, 899);
			await expect(control).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
			await expect(control).toHaveCSS('box-shadow', 'none');
			if (!touch) {
				await control.hover();
				await expect(control).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
				await page.mouse.move(0, 899);
				await expect(control).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
				// Establish keyboard modality without depending on the OS tab-navigation preference.
				await page.keyboard.press('Tab');
				await control.focus();
				await expect(control).toBeFocused();
				await expect(control).toHaveCSS('outline-style', 'solid');
				await expect(control).toHaveCSS('outline-width', '2px');
				await page.keyboard.press('Space');
			} else await control.tap();
			await expect(control).toHaveAttribute('aria-checked', String(theme !== 'dark'));
			await page.mouse.move(0, 899);
			await expect(control).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
			// Capture settled theme colors rather than the transition between palettes.
			await page.waitForTimeout(400);
			await page.screenshot({
				path: `${process.env.THEME_SCREENSHOTS || 'test-results'}/${testInfo.project.name}-${theme}-${touch ? 'touch' : 'keyboard'}.png`
			});
			await context.close();
		});
	}
}
