import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [320, 390, 768, 1440]) {
	for (const theme of ['light', 'dark']) {
		test(`keeps comparison actions available at ${width}px in ${theme}`, async ({
			page
		}, testInfo) => {
			await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.addInitScript((value) => {
				localStorage.setItem('lawcast-theme', value);
				Reflect.deleteProperty(window, 'PushManager');
			}, theme);
			await page.goto('/notices/2210001?cmpFrom=1&cmpTo=2&search=law');
			const history = page.getByTestId('revision-history');
			const result = page.getByTestId('revision-comparison');
			await expect(result).toBeVisible();
			await expect(history.locator('[data-testid="revision-comparison"]')).toHaveCount(1);
			await page.evaluate(() => document.fonts.ready);
			const assertActions = async () => {
				await expect
					.poll(() =>
						page.getByTestId('compare-clear').evaluate((node) => {
							const r = node.getBoundingClientRect();
							const h = document.querySelector('.lc-header-shell')!.getBoundingClientRect();
							return (
								r.top >= h.bottom - 1 && r.bottom <= innerHeight && r.width >= 44 && r.height >= 44
							);
						})
					)
					.toBe(true);
			};
			await assertActions();
			if (width < 1024) {
				await expect(page.getByTestId('revision-records')).toBeHidden();
				await page.getByTestId('history-show-records').click();
				await expect(page.getByTestId('revision-records')).toBeVisible();
				await expect(result).toBeHidden();
				await page.getByTestId('revision-record-2').scrollIntoViewIfNeeded();
				const before = await page.evaluate(() => scrollY);
				await assertActions();
				await page.getByTestId('history-show-comparison').click();
				await expect(result).toBeVisible();
				await page.getByTestId('history-show-records').click();
				expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(3);
				await page.getByTestId('history-show-comparison').click();
				await page.getByTestId('revision-diff-isDone').scrollIntoViewIfNeeded();
			} else {
				const list = await page.getByTestId('revision-records').boundingBox();
				const diff = await result.boundingBox();
				expect(list!.x + list!.width).toBeLessThan(diff!.x);
				const reader = page.getByRole('region', { name: '비교 결과 읽기' });
				await reader.focus();
				await page.keyboard.press('PageDown');
				await expect.poll(() => reader.evaluate((n) => n.scrollTop)).toBeGreaterThan(0);
				await page.getByTestId('revision-record-1').scrollIntoViewIfNeeded();
			}
			await assertActions();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			await page.screenshot({ path: testInfo.outputPath(`workspace-${width}-${theme}.png`) });
			const audit = await new AxeBuilder({ page })
				.include('[data-testid="revision-history"]')
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
				.analyze();
			expect(audit.violations).toEqual([]);
			await page.getByTestId('compare-swap').click();
			await expect(page.getByTestId('compare-from-select')).toHaveValue('2');
			await expect(page.getByTestId('compare-to-select')).toHaveValue('1');
			await assertActions();
			if (width >= 1024) await expect(page.getByTestId('compare-latest')).toBeVisible();
			if (width >= 1024) {
				await expect
					.poll(() =>
						page.getByRole('region', { name: '비교 결과 읽기' }).evaluate((n) => n.scrollTop)
					)
					.toBe(0);
			}
			await page.getByTestId('compare-clear').click();
			await expect(result).toHaveCount(0);
			await expect(page.getByTestId('revision-records')).toBeVisible();
			await expect(page).not.toHaveURL(/cmpFrom|cmpTo/);
			await expect(page).toHaveURL(/search=law/);
		});
	}
}

test('starts a mobile comparison from a record and returns to the same action on exit', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/notices/2210001?timeline=true');
	const action = page.getByTestId('revision-previous-2');
	await action.focus();
	const before = await page.evaluate(() => scrollY);
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('revision-comparison')).toBeVisible();
	await expect(page.getByTestId('revision-records')).toBeHidden();
	await page.getByTestId('compare-clear').click();
	await expect(action).toBeFocused();
	expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(3);
});

test('retains selection and visible actions across responsive layout changes', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/notices/2210001?cmpFrom=1&cmpTo=2');
	await expect(page.getByTestId('revision-comparison')).toBeVisible();
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.getByTestId('revision-records')).toBeHidden();
	await page.getByTestId('history-show-records').click();
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(page.getByTestId('revision-comparison')).toBeVisible();
	await expect(page.getByTestId('revision-records')).toBeVisible();
	await expect(page.getByTestId('compare-from-select')).toHaveValue('1');
});

test('keeps an exit and reading space available with enlarged text on a short mobile screen', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 568 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/notices/2210001?cmpFrom=1&cmpTo=2');
	await expect(page.getByTestId('revision-comparison')).toBeVisible();
	await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
	await page.evaluate(() => document.fonts.ready);
	await expect(async () => {
		// Re-measure native reveal geometry after upstream deferred sections resize.
		await page.getByTestId('revision-diff-isDone').scrollIntoViewIfNeeded();
		expect(
			await page.getByTestId('compare-clear').evaluate((n) => {
				const r = n.getBoundingClientRect();
				const h = document.querySelector('.lc-header-shell')!.getBoundingClientRect();
				return r.top >= h.bottom - 1 && r.bottom <= innerHeight - 100;
			})
		).toBe(true);
	}).toPass();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.getByTestId('compare-from-select').focus();
	await expect
		.poll(() =>
			page
				.getByTestId('compare-from-select')
				.evaluate(
					(n) =>
						n.getBoundingClientRect().top >=
						document.querySelector('.lc-header-shell')!.getBoundingClientRect().bottom - 1
				)
		)
		.toBe(true);
	await page.getByTestId('compare-clear').focus();
	await expect
		.poll(() =>
			page
				.getByTestId('compare-clear')
				.evaluate((n) => n.getBoundingClientRect().bottom <= innerHeight)
		)
		.toBe(true);
	await page.getByTestId('compare-clear').click();
	await expect(page.getByTestId('revision-comparison')).toHaveCount(0);
});
