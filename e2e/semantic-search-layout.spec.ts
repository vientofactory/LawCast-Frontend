import { expect, test, type Locator, type Page } from '@playwright/test';

const enabled = ['1', 'true', 'yes', 'on'].includes(process.env.E2E_SEMANTIC_SEARCH ?? '');

async function visit(page: Page, path: string) {
	await page.goto(path);
	await expect(page.getByTestId('search-timing-toggle')).toHaveAttribute('aria-expanded', 'false');
}

async function expectOpenRow(row: Locator) {
	await expect(row).toBeVisible();
	await expect(row).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(row).toHaveCSS('border-radius', '0px');
	await expect(row).toHaveCSS('border-inline-start-width', '0px');
	await expect(row).toHaveCSS('padding-inline-start', '0px');
	await expect(row).toHaveCSS('box-shadow', 'none');
	await expect(row.locator('h3')).toHaveCSS('font-size', '18px');
	for (const meta of await row.locator('.lc-flat-status').all()) {
		await expect(meta).toHaveCSS('font-size', '14px');
		await expect(meta).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		await expect(meta).toHaveCSS('border-width', '0px');
	}
}

async function reveal(page: Page, buttonId: string, rows: Locator) {
	await expect(async () => {
		if ((await rows.count()) === 0) await page.getByTestId(buttonId).click();
		await expect(rows).toHaveCount(10, { timeout: 1000 });
	}).toPass({ timeout: 10000 });
}

for (const width of [320, 390, 768, 1440]) {
	for (const theme of ['light', 'dark']) {
		test(`uses flat semantic and weak-result lists at ${width}px in ${theme}`, async ({
			page
		}, testInfo) => {
			test.skip(!enabled, 'Requires the semantic search fixture');
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((value) => {
				localStorage.setItem('lawcast-theme', value);
				localStorage.setItem('lawcast-cookie-consent', 'accepted');
				localStorage.setItem(
					'lawcast-dev-search-timing-layout-v1',
					JSON.stringify({ open: false, width: 432 })
				);
			}, theme);
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await visit(page, '/notices/semantic-search?search=보호');
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			await expectOpenRow(page.locator('.lc-semantic-result').first());
			await page.screenshot({ path: testInfo.outputPath(`legacy-${width}-${theme}.png`) });

			for (const board of [false, true]) {
				const prefix = board ? 'notices-semantic' : 'semantic-search';
				const path = board
					? '/notices?searchMode=semantic&search='
					: '/notices/semantic-search?search=';
				await visit(page, path + encodeURIComponent('약한 여러 결과 조회'));
				const rows = page.locator('.lc-semantic-result');
				await expect(rows).toHaveCount(0);
				await reveal(page, `${prefix}-show-weak`, rows);
				await expectOpenRow(rows.first());
				const banner = page.getByTestId(`${prefix}-weak-banner`);
				await expect(banner).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
				await expect(banner).toHaveCSS('border-width', '0px');
				await expect(banner).toContainText('관련도가 낮은 결과');
				await expect(rows.first()).toHaveCSS('border-bottom-width', '1px');
				await page.getByTestId(`${prefix}-weak-more`).click();
				await expect(rows).toHaveCount(12);
				await expect(rows.last()).toHaveCSS('border-bottom-width', '0px');
				await banner.scrollIntoViewIfNeeded();
				await page.screenshot({
					path: testInfo.outputPath(`${board ? 'board' : 'legacy'}-weak-${width}-${theme}.png`)
				});
				await page.getByTestId(`${prefix}-hide-weak`).click();
				await expect(rows).toHaveCount(0);
			}

			for (const board of [false, true]) {
				const path = board
					? '/notices?searchMode=auto&limit=10&page=2&search='
					: '/notices/semantic-search?search=';
				await visit(page, path + encodeURIComponent('혼합 결과'));
				const tail = page.getByTestId(
					board ? 'notices-semantic-weak-tail' : 'semantic-search-weak-tail'
				);
				await expect(tail).toBeVisible();
				await expect(tail.locator('article')).toHaveCount(0);
				await tail.locator('summary').click();
				await expect(tail.locator('article')).toHaveCount(10);
				await expectOpenRow(tail.locator('article').first());
				await tail.getByRole('button', { name: /더 보기/ }).click();
				await expect(tail.locator('article')).toHaveCount(12);
				await expect(tail.locator('article').nth(10).getByRole('link').first()).toBeFocused();
				await expect(tail.locator('article').last()).toHaveCSS('border-bottom-width', '0px');
				await tail.locator('summary').click();
				await expect(tail.locator('article')).toHaveCount(0);
				await tail.locator('summary').click();
				await expect(tail.locator('article')).toHaveCount(10);
			}
			if (width === 320) {
				await page
					.locator('.lc-semantic-result h3')
					.first()
					.evaluate((node) => (node.textContent = '긴법률안제목줄바꿈검증'.repeat(20)));
				await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
		});
	}
}
