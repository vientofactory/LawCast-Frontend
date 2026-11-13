import { expect, test } from '@playwright/test';

for (const width of [320, 390, 768, 1440]) {
	for (const theme of ['light', 'dark']) {
		test(`uses open comment rows at ${width}px in ${theme}`, async ({ page }, testInfo) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((theme) => localStorage.setItem('lawcast-theme', theme), theme);
			await page.goto('/notices/2210001/discussions/221000101');
			const first = page.getByTestId('discussion-comment-1');
			await expect(first).toBeVisible();
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			await expect(first).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
			await expect(first).toHaveCSS('border-radius', '0px');
			await expect(first).toHaveCSS('border-top-width', '0px');
			await expect(first).toHaveCSS('border-bottom-width', '1px');
			await expect(first.locator('header')).toHaveCSS('border-bottom-width', '0px');
			await expect(first.locator('time')).toHaveCSS('font-size', '14px');
			const body = first.locator('.whitespace-pre-wrap');
			await expect(body).toHaveCSS('font-size', '16px');
			const actions = page.getByTestId('discussion-comment-actions-1');
			expect((await actions.boundingBox())!.y).toBeGreaterThanOrEqual(
				(await body.boundingBox())!.y + (await body.boundingBox())!.height
			);
			for (const action of ['quote', 'edit', 'delete', 'number']) {
				const control = page.getByTestId(`discussion-comment-${action}-1`);
				expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
			}
			await expect(page.getByTestId('discussion-comment-17')).toContainText('시스템');
			const systemHeader = page.getByTestId('discussion-comment-17').locator('header');
			await expect(systemHeader.locator('.lc-text-secondary')).toHaveCount(0);
			await expect(systemHeader.locator('span.font-mono')).toHaveCount(0);
			await expect(systemHeader.locator('#comment-author-17')).toHaveText('LawCast');
			await expect(first.locator('header span.font-mono')).toContainText('127.0.1.***');
			await expect(page.getByTestId('discussion-comment-actions-17')).toHaveCount(0);
			await expect(page.getByTestId('discussion-comment-11')).toContainText('(수정됨)');
			const reference = page
				.getByTestId('discussion-comment-9')
				.getByRole('button', { name: /7번 의견/ });
			await expect(reference).toHaveCSS('border-left-width', '2px');
			await reference.click();
			await expect(page.getByTestId('discussion-comment-7')).toBeInViewport();
			await first.scrollIntoViewIfNeeded();
			await page.keyboard.press('Tab');
			await page.getByTestId('discussion-comment-quote-1').focus();
			await expect(page.getByTestId('discussion-comment-quote-1')).toHaveCSS(
				'outline-style',
				'solid'
			);
			if (width === 320) {
				await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			await first.scrollIntoViewIfNeeded();
			await page.screenshot({ path: testInfo.outputPath(`comments-${width}-${theme}.png`) });
		});
	}
}

test('keeps deleted comments readable without user actions', async ({ page }) => {
	await page.goto('/notices/2210001/discussions/221000101');
	await expect(async () => {
		await page.getByTestId('discussion-reply-form').scrollIntoViewIfNeeded();
		await expect(page.getByTestId('discussion-comment-54')).toBeAttached({ timeout: 1000 });
	}).toPass();
	const deleted = page.getByTestId('discussion-comment-23');
	await deleted.scrollIntoViewIfNeeded();
	await expect(deleted).toHaveCSS('opacity', '1');
	await expect(deleted).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(page.getByTestId('discussion-comment-actions-23')).toHaveCount(0);
});
