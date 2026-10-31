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
