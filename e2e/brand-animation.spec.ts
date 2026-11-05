import { expect, test } from '@playwright/test';
import { measureContrast } from './helpers/contrast';

for (const width of [390, 1440]) {
	for (const theme of ['light', 'dark']) {
		for (const motion of ['no-preference', 'reduce'] as const) {
			test(`restores historical brand frames at ${width}px in ${theme} with ${motion}`, async ({
				page
			}, info) => {
				await page.setViewportSize({ width, height: 900 });
				await page.emulateMedia({ reducedMotion: motion });
				await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
				await page.goto('/');
				const heading = page.getByTestId('brand-heading');
				await expect(heading).toBeVisible();
				const initial = await heading.boundingBox();
				for (const time of [0, 650, 1100, 1700, 1900, 2200]) {
					await heading.evaluate((node, time) => {
						for (const animation of node.getAnimations({ subtree: true })) {
							animation.pause();
							animation.currentTime = time;
						}
					}, time);
					const opacity = await page
						.getByTestId('brand-tagline')
						.evaluate((node) => Number(getComputedStyle(node).opacity));
					if (motion === 'reduce' || time === 2200) expect(opacity).toBe(1);
					else if (time <= 1700) expect(opacity).toBe(0);
					else {
						expect(opacity).toBeGreaterThan(0);
						expect(opacity).toBeLessThan(1);
					}
					await page
						.getByTestId('site-brand')
						.screenshot({ path: info.outputPath(`frame-${time}.png`), animations: 'allow' });
				}
				const contrast = await measureContrast(page, { selector: '[data-testid="brand-tagline"]' });
				expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
				expect(await heading.boundingBox()).toEqual(initial);
				if (motion === 'reduce')
					expect(
						await heading.evaluate((node) => node.getAnimations({ subtree: true }).length)
					).toBe(0);
			});
		}
	}
}
