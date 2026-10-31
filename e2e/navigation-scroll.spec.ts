import { test, expect, type Page } from '@playwright/test';

async function waitForHydration(page: Page) {
	// Confirm a client handler is active before testing SPA history navigation.
	const themeSwitch = page.getByRole('switch', { name: /테마로 전환/ }).first();
	const initialChecked = await themeSwitch.getAttribute('aria-checked');
	await expect(async () => {
		if ((await themeSwitch.getAttribute('aria-checked')) === initialChecked) {
			await themeSwitch.click();
		}
		await expect(themeSwitch).not.toHaveAttribute('aria-checked', initialChecked!, {
			timeout: 1000
		});
	}).toPass();
}

async function expectScrollOrigin(page: Page) {
	await expect.poll(() => page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
	expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
		'auto'
	);
}

test('resets scroll when following a link from the footer', async ({ page }) => {
	await page.goto('/notices');
	await waitForHydration(page);
	const link = page.locator('footer a[href="/announcements"]');
	await link.scrollIntoViewIfNeeded();
	expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
	await link.click();
	await expect(page).toHaveURL('/announcements');
	await expectScrollOrigin(page);
});

test('resets pagination and history navigation to the origin', async ({ page }) => {
	await page.goto('/notices?limit=10');
	await waitForHydration(page);
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
	await waitForHydration(page);
	await page.getByRole('link', { name: '최근 입법예고 섹션으로 이동' }).click();
	await expect(page).toHaveURL(/#recent-notices$/);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('keeps the timeline in view when selecting and clearing comparison revisions', async ({
	page
}) => {
	test.skip(process.env.DIFFCHAIN_UI_MOCK !== '1', 'Requires pinned mock revision records.');
	await page.goto('/notices/2210001');
	const timeline = page.locator('details').filter({ hasText: '변경 기록' }).first();
	await expect(async () => {
		if ((await timeline.getAttribute('open')) === null) {
			await timeline.locator('summary').click();
		}
		await expect(page.getByRole('button', { name: '기준으로 선택' }).first()).toBeVisible({
			timeout: 1000
		});
	}).toPass();

	await page.getByRole('button', { name: '기준으로 선택' }).first().click();
	await expect(page).toHaveURL(/cmpFrom=/);
	await expect(page.getByRole('button', { name: '비교 대상으로 선택' }).first()).toBeVisible();
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

	await page.getByRole('button', { name: '비교 대상으로 선택' }).first().click();
	await expect(page).toHaveURL(/cmpTo=/);
	await expect(page.getByTestId('revision-comparison')).toBeVisible();
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

	await page.getByRole('button', { name: '전체 필드 보기' }).click();
	await expect(page).toHaveURL(/cmpShowAll=1/);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

	await page.getByRole('button', { name: '비교 해제' }).first().click();
	await expect(page).not.toHaveURL(/cmpFrom=|cmpTo=/);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});
