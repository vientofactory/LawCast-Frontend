import { test, expect } from '@playwright/test';
const fixture = 'http://127.0.0.1:4327';
test.beforeEach(async ({ request }) => {
	await request.get(`${fixture}/control`);
});
test('home SSR consumes only the home statistics view', async ({ page, request }) => {
	await page.goto('/');
	await expect(
		page.getByTestId('home-status-card-archive').locator('.lc-home-signal-value')
	).toContainText('123');
	const paths: string[] = await (await request.get(`${fixture}/requests`)).json();
	expect(paths.filter((path) => path.startsWith('/api/stats'))).toEqual(['/api/stats?view=home']);
});
test('home keeps its fallback when the narrow statistics request fails', async ({
	page,
	request
}) => {
	await request.get(`${fixture}/control?failHome=1`);
	await page.goto('/');
	await expect(page.locator('#home-page-title')).toBeVisible();
	await expect(
		page.getByTestId('home-status-card-archive').locator('.lc-home-signal-value')
	).toHaveText('기록 수집 중');
});
test('status refresh reruns its own loader without refetching the layout announcement', async ({
	page,
	request
}) => {
	await page.goto('/status');
	await expect(page.locator('main h1')).toContainText('시스템 상태');
	const before: string[] = await (await request.get(`${fixture}/requests`)).json();
	const dataRequest = page.waitForResponse((response) =>
		response.url().includes('/status/__data.json')
	);
	await page.getByRole('button', { name: '새로고침', exact: true }).click();
	await dataRequest;
	const after: string[] = await (await request.get(`${fixture}/requests`)).json();
	expect(after.filter((path) => path === '/api/stats').length).toBe(
		before.filter((path) => path === '/api/stats').length + 1
	);
	expect(after.filter((path) => path.startsWith('/api/announcements/top')).length).toBe(
		before.filter((path) => path.startsWith('/api/announcements/top')).length
	);
});

test('distinguishes unavailable history from empty history and retries without resetting scroll', async ({
	page,
	request
}) => {
	await request.get(`${fixture}/control?failChanges=1`);
	await page.goto('/notices/2210001?timeline=open');
	await expect(page.getByTestId('revision-history-error')).toBeVisible();
	await expect(page.getByTestId('revision-history')).not.toContainText(
		'아직 보존된 변경 기록이 없습니다.'
	);
	await request.get(`${fixture}/control`);
	await page.getByTestId('revision-history-retry').click();
	await expect(page.getByTestId('revision-history-error')).toHaveCount(0);
	await expect(page.getByTestId('revision-history')).toContainText(
		'아직 보존된 변경 기록이 없습니다.'
	);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('explains when only one record is available', async ({ page, request }) => {
	await request.get(`${fixture}/control?historyCount=1`);
	await page.goto('/notices/2210001?timeline=open');
	await expect(page.getByTestId('revision-history')).toContainText('아직 기록이 하나뿐입니다.');
	await expect(page.getByTestId('revision-selection')).toHaveCount(0);
	await expect(page.getByTestId('revision-view-1')).toBeVisible();
});

test('recognizes a complete legacy window and explains identical comparison content', async ({
	page,
	request
}) => {
	await request.get(`${fixture}/control?historyCount=2&historyWindow=1`);
	await page.goto('/notices/2210001?cmpFrom=4&cmpTo=5');
	await expect(page.getByTestId('revision-history-complete')).toContainText(
		'2개를 모두 불러왔습니다.'
	);
	await expect(page.getByTestId('comparison-no-changes')).toBeVisible();
	await expect(page.getByTestId('revision-diff-summary')).toContainText('바뀐 항목 0개');
});

test('does not mistake missing field values for identical content', async ({ page, request }) => {
	await request.get(`${fixture}/control?historyCount=2&noFields=1`);
	await page.goto('/notices/2210001?cmpFrom=1&cmpTo=2');
	await expect(page.getByTestId('comparison-unavailable-fields')).toBeVisible();
	await expect(page.getByTestId('comparison-no-changes')).toHaveCount(0);
});

test('loads an older history page through the browser proxy with its exclusive cursor', async ({
	page,
	request
}) => {
	await request.get(`${fixture}/control?historyCount=45`);
	await page.goto('/notices/2210001?timeline=open');
	await expect(page.getByTestId('revision-records').locator(':scope > li')).toHaveCount(20);
	await page.getByTestId('revision-history-load-older-top').click();
	await expect(page.getByTestId('revision-records').locator(':scope > li')).toHaveCount(40);
	const paths: string[] = await (await request.get(`${fixture}/requests`)).json();
	expect(paths.filter((path) => path.includes('/2210001/changes'))).toEqual([
		'/api/notices/2210001/changes',
		'/api/notices/2210001/changes?limit=20&beforeHeight=26'
	]);
	await page.getByTestId('revision-history-load-older-top').click();
	await expect(page.getByTestId('revision-history-complete')).toContainText(
		'45개를 모두 불러왔습니다.'
	);
	await expect(page.getByTestId('compare-from-select').locator('option[value="1"]')).toHaveCount(1);
});

for (const width of [320, 360, 390, 430]) {
	for (const theme of ['light', 'dark']) {
		test(`mobile pagination has roomy targets at ${width}px in ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			for (const currentPage of [1, 555, 1108, 1109]) {
				await page.goto(`/notices?page=${currentPage}`);
				const nav = page.getByTestId('notices-pagination');
				await nav.scrollIntoViewIfNeeded();
				await expect(nav.locator('[aria-current="page"]:visible')).toHaveText(String(currentPage));
				expect((await nav.boundingBox())!.width).toBeGreaterThanOrEqual(width - 48);
				for (const control of await nav.locator('a:visible').all()) {
					const bounds = (await control.boundingBox())!;
					expect(bounds.width).toBeGreaterThanOrEqual(48);
					expect(bounds.height).toBeGreaterThanOrEqual(48);
					const label = control.locator('.lc-pagination-number');
					if (await label.count()) {
						expect(bounds.width - (await label.boundingBox())!.width).toBeGreaterThanOrEqual(24);
					}
				}
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true
				);
				if (currentPage === 1 || currentPage === 1108) {
					await nav.screenshot({ path: test.info().outputPath(`pagination-${currentPage}.png`) });
				}
				const target = currentPage === 1109 ? 1108 : currentPage + 1;
				const direction = nav.getByRole('link', {
					name: currentPage === 1109 ? '이전 페이지로 이동' : '다음 페이지로 이동',
					exact: true
				});
				if (test.info().project.name === 'mobile') await direction.tap();
				else await direction.click();
				await expect(nav.locator('[aria-current="page"]:visible')).toHaveText(String(target));
			}
		});
	}
}

test('mobile pagination retains all jumps with enlarged text', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 900 });
	await page.goto('/notices?page=1108');
	await page.addStyleTag({ content: 'html { font-size: 200%; }' });
	const nav = page.getByTestId('notices-pagination');
	await nav.scrollIntoViewIfNeeded();
	await expect(nav.getByRole('link', { name: '1페이지로 이동', exact: true })).toBeVisible();
	await expect(nav.getByRole('link', { name: '1109페이지로 이동', exact: true })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	for (const control of await nav.locator('a:visible').all()) {
		const bounds = (await control.boundingBox())!;
		expect(bounds.x).toBeGreaterThanOrEqual(0);
		expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
	}
});
