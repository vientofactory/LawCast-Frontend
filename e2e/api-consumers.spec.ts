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
