import { test, expect, type Page } from '@playwright/test';

async function expectScrollOrigin(page: Page) {
	await expect.poll(() => page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
	expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
		'auto'
	);
}

test('resets scroll when following a link from the footer', async ({ page }) => {
	await page.goto('/notices');
	const link = page.locator('footer a[href="/announcements"]');
	await link.scrollIntoViewIfNeeded();
	expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
	await link.click();
	await expect(page).toHaveURL('/announcements');
	await expectScrollOrigin(page);
});

test('resets pagination and history navigation to the origin', async ({ page }) => {
	await page.goto('/notices?limit=10');
	const nextPage = page.getByTestId('notices-pagination').getByRole('link', {
		name: '다음 페이지로 이동',
		exact: true
	});
	await nextPage.scrollIntoViewIfNeeded();
	expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
	await nextPage.click();
	await expect(page).toHaveURL(/page=2/);
	await expectScrollOrigin(page);

	await page.locator('footer').scrollIntoViewIfNeeded();
	await page.goBack();
	await expect(page).toHaveURL('/notices?limit=10');
	await expectScrollOrigin(page);

	await page.locator('footer').scrollIntoViewIfNeeded();
	await page.goForward();
	await expect(page).toHaveURL(/page=2/);
	await expectScrollOrigin(page);
});

test('preserves in-page anchor destinations', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: '최근 입법예고 섹션으로 이동' }).click();
	await expect(page).toHaveURL(/#recent-notices$/);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});
