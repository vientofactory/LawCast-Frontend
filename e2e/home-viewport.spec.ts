import { test, expect } from '@playwright/test';

for (const viewport of [
	{ width: 1440, height: 1080 },
	{ width: 2048, height: 1091 },
	{ width: 1920, height: 1440 },
	{ width: 2560, height: 1600 },
	{ width: 390, height: 844 },
	{ width: 1440, height: 600 }
]) {
	test(`home overview fills the viewport without clipping at ${viewport.width}x${viewport.height}`, async ({
		page
	}, testInfo) => {
		await page.setViewportSize(viewport);
		await page.goto('/');
		await page.evaluate(() => document.fonts.ready);
		const hero = page.getByTestId('home-hero');
		await page.waitForFunction(
			() =>
				!!document
					.querySelector('.lc-page-shell')
					?.getAttribute('style')
					?.includes('--lc-home-overview-offset')
		);
		await expect
			.poll(async () => (await hero.boundingBox())!.y + (await hero.boundingBox())!.height)
			.toBeGreaterThanOrEqual(viewport.height - 1);
		const heroBox = (await hero.boundingBox())!;
		const cueBox = (await page.getByTestId('home-scroll-cue').boundingBox())!;
		expect(cueBox.y + cueBox.height).toBeLessThanOrEqual(heroBox.y + heroBox.height + 1);
		expect(
			(await page.getByTestId('recent-notices-region').boundingBox())!.y
		).toBeGreaterThanOrEqual(viewport.height);
		if (viewport.height >= 1080) {
			// The hero's min-height is derived from the ResizeObserver-computed
			// offset, so the layout settles to exact fit over a few frames. Poll
			// the exact-fit condition (retrying until it holds) instead of reading
			// a single frame, then measure the sub-assertions on the settled value.
			await expect
				.poll(async () =>
					Math.abs(
						(await hero.boundingBox())!.y + (await hero.boundingBox())!.height - viewport.height
					)
				)
				.toBeLessThanOrEqual(1);
			const settledHero = (await hero.boundingBox())!;
			const settledCue = (await page.getByTestId('home-scroll-cue').boundingBox())!;
			expect(Math.abs(settledHero.y + settledHero.height - viewport.height)).toBeLessThanOrEqual(1);
			expect(settledCue.y).toBeGreaterThan(viewport.height - 100);
			const introduction = (await page.locator('.lc-home-introduction').boundingBox())!;
			const status = (await page.getByTestId('home-status-region').boundingBox())!;
			const gap = await page
				.locator('.lc-home-hero-content')
				.evaluate((node) => parseFloat(getComputedStyle(node).rowGap));
			const bodyCenter = (introduction.y + status.y + status.height) / 2;
			const availableCenter = (settledHero.y + settledCue.y - gap) / 2;
			expect(Math.abs(bodyCenter - availableCenter)).toBeLessThanOrEqual(1);
		}
		if (viewport.width === 1920)
			await page.screenshot({ path: testInfo.outputPath('desktop.png') });
		await page.getByTestId('home-scroll-cue').click();
		await expect(page).toHaveURL(/#recent-notices$/);
		await expect(page.getByTestId('recent-notices-region')).toBeInViewport();
	});
}
