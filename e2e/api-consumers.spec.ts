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
			const expectedWindows = [
				[1, ['1', '2', '3', '4', '…', '1109']],
				[555, ['1', '…', '554', '555', '556', '…', '1109']],
				[1108, ['1', '…', '1106', '1107', '1108', '1109']],
				[1109, ['1', '…', '1106', '1107', '1108', '1109']]
			] as const;
			for (const [currentPage, expectedWindow] of expectedWindows) {
				await page.goto(`/notices?page=${currentPage}`);
				const nav = page.getByTestId('notices-pagination');
				await nav.scrollIntoViewIfNeeded();
				await expect(nav.locator('[aria-current="page"]:visible')).toHaveText(String(currentPage));
				await expect(
					nav.locator(':is(.lc-pagination-number, .lc-pagination-ellipsis):visible')
				).toHaveText([...expectedWindow], { timeout: 2000 });
				await expect(nav.getByRole('link', { name: '첫 페이지로 이동', exact: true })).toHaveCount(
					currentPage > 1 ? 1 : 0
				);
				await expect(
					nav.getByRole('link', { name: '마지막 페이지로 이동', exact: true })
				).toHaveCount(currentPage < 1109 ? 1 : 0);
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

for (const path of ['/', '/notices/2210001']) {
	test(`keeps realtime reads out of SSR on ${path}`, async ({ request }) => {
		await request.get(`${fixture}/control?discussionCount=7&urgent=1`);
		const response = await request.get(path);
		expect(response.status()).toBe(200);
		const html = await response.text();
		expect(html).not.toContain('Live thread 7');
		expect(html).not.toContain('Live urgent notice');
		const paths: string[] = await (await request.get(`${fixture}/requests`)).json();
		expect(paths.filter((item) => item.includes('/discussions'))).toEqual([]);
		expect(paths.filter((item) => item.includes('urgent=true'))).toEqual([]);
	});
}

test('loads discussion counts and urgent notices after hydration', async ({ page, request }) => {
	await request.get(`${fixture}/control?discussionCount=7&urgent=1&delayDiscussions=500`);
	await page.goto('/notices/2210001');
	await expect(page.getByTestId('urgent-notice-banner')).toContainText('Live urgent notice');
	await expect(page.getByTestId('notice-detail-discussions-anchor')).toContainText('7');
	await expect(page.getByTestId('discussion-thread-list')).toContainText('Live thread 7');
	expect(
		(await (await request.get('/api/notices/2210001/discussions')).headers())['cache-control']
	).toContain('no-store');
});

test('loads recent home discussions without embedding their counts in SSR', async ({
	page,
	request
}) => {
	await request.get(`${fixture}/control?discussionCount=3&delayDiscussions=700`);
	await page.goto('/');
	await expect(page.getByTestId('home-discussions-loading')).toBeVisible();
	await expect(page.getByTestId('home-recent-discussions')).toContainText('Live thread 3');
});

test('refreshes urgent notice removal and new discussion counts after focus', async ({
	page,
	request
}) => {
	await request.get(`${fixture}/control?urgent=1&discussionCount=2`);
	await page.goto('/notices/2210001');
	await expect(page.getByTestId('urgent-notice-banner')).toBeVisible();
	await expect(page.getByTestId('notice-detail-discussions-anchor')).toContainText('2');
	await request.get(`${fixture}/control?discussionCount=5`);
	await page.clock.install();
	await page.clock.fastForward(61000);
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await expect(page.getByTestId('urgent-notice-banner')).toHaveCount(0);
	await expect(page.getByTestId('notice-detail-discussions-anchor')).toContainText('5');
});

test('does not replace a newer notice with a delayed previous discussion read', async ({
	page,
	request
}) => {
	await request.get(`${fixture}/control?discussionCount=8&delayDiscussions=1500`);
	await page.goto('/notices/2210001');
	await expect
		.poll(async () =>
			(await (await request.get(`${fixture}/requests`)).json()).some((path: string) =>
				path.includes('/2210001/discussions')
			)
		)
		.toBe(true);
	await request.get(`${fixture}/control?discussionCount=4`);
	await page.evaluate(async () => {
		const link = document.createElement('a');
		link.href = '/notices/2210002';
		link.textContent = 'next notice';
		document.body.append(link);
		link.click();
	});
	await expect(page).toHaveURL(/2210002/);
	await expect(page.getByTestId('notice-detail-discussions-anchor')).toContainText('4');
	await page.waitForTimeout(1600);
	await expect(page.getByTestId('notice-detail-discussions-anchor')).not.toContainText('8');
});

test('reports discussion failures instead of a false empty list and recovers', async ({
	page,
	request
}) => {
	await request.get(`${fixture}/control?failDiscussions=503`);
	await page.goto('/notices/2210001');
	const list = page.getByTestId('notice-discussions');
	await expect(list.getByTestId('load-failure')).toBeVisible();
	await expect(list.getByTestId('discussion-empty-state')).toHaveCount(0);
	await expect(page.getByTestId('notice-detail-discussions-anchor')).toHaveText('토론');
	await request.get(`${fixture}/control?discussionCount=6`);
	await list.getByRole('button', { name: '다시 시도', exact: true }).click();
	await expect(page.getByTestId('notice-detail-discussions-anchor')).toContainText('6');
});

test('retains genuine discussion cooldowns and recovers through a non-rate failure', async ({
	page,
	request
}) => {
	await request.get(`${fixture}/control?failDiscussions=429`);
	await page.goto('/notices/2210001');
	const list = page.getByTestId('notice-discussions');
	await expect(list.locator('.lc-rate-limit-overlay')).toBeVisible();
	await request.get(`${fixture}/control?failDiscussions=503`);
	const retry = list
		.getByTestId('rate-limit-failure')
		.getByRole('button', { name: '다시 시도', exact: true });
	await expect(retry).toBeEnabled({ timeout: 5000 });
	await retry.click();
	await expect(list.getByTestId('load-failure')).toHaveAttribute('data-failure-kind', 'server');
	await expect(list.locator('.lc-rate-limit-overlay')).toHaveCount(0);
});

for (const [path, mode, status] of [
	['/', 'failHome=1', 503],
	['/notices/2210001', 'failChanges=1', 503],
	['/notices/2210001', 'failDetail=429', 429],
	['/notices/2210001', 'failDetail=404', 404]
] as const) {
	test(`does not cache rendered recovery responses for ${mode}`, async ({ request }) => {
		await request.get(`${fixture}/control?${mode}`);
		const response = await request.get(path);
		expect(response.status()).toBe(status);
		expect(response.headers()['cache-control']).toContain('no-store');
		expect(response.headers()['cloudflare-cdn-cache-control']).toBe('no-store');
	});
}

test('keeps SvelteKit data recovery protocol successful but explicitly unstorable', async ({
	request
}) => {
	await request.get(`${fixture}/control?failChanges=1`);
	const response = await request.get('/notices/2210001/__data.json?x-sveltekit-invalidated=11');
	expect(response.status()).toBe(200);
	expect(response.headers()['cache-control']).toContain('no-store');
	expect(await response.text()).toContain('changesLoadError');
});

test('marks realtime and personal proxy responses as private no-store', async ({ request }) => {
	for (const path of [
		'/api/announcements/top?urgent=true',
		'/api/discussions/threads',
		'/api/push/subscriptions/notice-status?endpoint=fixture'
	]) {
		const response = await request.get(path);
		expect(response.headers()['cache-control']).toBe('private, no-store');
	}
});

test('pauses background polling and coalesces focus with visibility refresh', async ({
	page,
	request
}) => {
	await request.get(`${fixture}/control?discussionCount=2`);
	await page.goto('/notices/2210001');
	await expect(page.getByTestId('notice-detail-discussions-anchor')).toContainText('2');
	await request.get(`${fixture}/control?discussionCount=9`);
	await page.clock.install();
	await page.evaluate(() =>
		Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
	);
	await page.clock.fastForward(31000);
	let paths: string[] = await (await request.get(`${fixture}/requests`)).json();
	expect(paths.filter((item) => item.includes('/discussions'))).toEqual([]);
	await page.evaluate(() => {
		Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
		document.dispatchEvent(new Event('visibilitychange'));
		window.dispatchEvent(new Event('focus'));
	});
	await expect(page.getByTestId('notice-detail-discussions-anchor')).toContainText('9');
	paths = await (await request.get(`${fixture}/requests`)).json();
	expect(paths.filter((item) => item.endsWith('/discussions'))).toHaveLength(1);
});

test('keeps a failed urgent recheck from breaking public content', async ({ page, request }) => {
	await request.get(`${fixture}/control?failUrgent=1&discussionCount=2`);
	const response = await page.goto('/notices/2210001');
	expect(response?.status()).toBe(200);
	await expect(page.getByTestId('notice-detail-discussions-anchor')).toContainText('2');
	await expect(page.getByTestId('urgent-notice-banner')).toHaveCount(0);
	await request.get(`${fixture}/control?urgent=1`);
	await page.clock.install();
	await page.clock.fastForward(61000);
	await expect(page.getByTestId('urgent-notice-banner')).toBeVisible();
});

test('keeps existing discussion links and focus during background revalidation', async ({
	page,
	request
}) => {
	await request.get(`${fixture}/control?discussionCount=2`);
	await page.goto('/notices/2210001');
	const link = page.getByTestId('discussion-thread-link-99');
	await expect(link).toContainText('Live thread 2');
	await link.focus();
	let release!: () => void;
	let started!: () => void;
	const blocked = new Promise<void>((resolve) => (release = resolve));
	const observed = new Promise<void>((resolve) => (started = resolve));
	await page.route('**/api/notices/2210001/discussions', async (route) => {
		started();
		await blocked;
		await route.continue();
	});
	await request.get(`${fixture}/control?discussionCount=3`);
	await page.clock.install();
	await page.clock.fastForward(31000);
	await observed;
	await expect(link).toBeVisible();
	await expect(link).toContainText('Live thread 2');
	await expect(link).toBeFocused();
	release();
	await expect(link).toContainText('Live thread 3');
	await expect(link).toBeFocused();
});
