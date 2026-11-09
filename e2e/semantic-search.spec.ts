import { expect, test, type Page } from '@playwright/test';
import { expectHeadMetadata } from './helpers/head-metadata';

/**
 * Semantic search UI tests (flag-gated).
 *
 * The dedicated config (playwright.semantic-search.config.ts) boots a dev server with
 * PUBLIC_SEMANTIC_SEARCH_ENABLED=1 and DIFFCHAIN_UI_MOCK=1. Without the flag the entry
 * point and route are hidden and redirected, so skip on a plain `npm run test:e2e` server
 * (same pattern as E2E_CF_CHALLENGE / E2E_RATE_LIMIT_SIM).
 *
 * The search itself is SSR: `+page.server.ts` calls the API, so the browser never requests
 * `/api/notices/semantic-search` and `page.route` cannot stub it. Fixtures come from
 * `src/lib/server/semantic-search-mock.ts`, which selects a response from marker words in
 * the query — `레이트리밋` -> 429, `오류` -> 500, `않는` -> empty results,
 * `약한` -> empty clear tier + weak hit (reveal button), `약한 여러` -> a weak band
 * longer than one page (paged reveal), `키워드` -> keyword fallback,
 * anything else -> one sample result.
 * The engine-status endpoint is still fetched by the browser and keeps its `page.route`
 * stubs below.
 */
const semanticEnabled = ['1', 'true', 'yes', 'on'].includes(
	(process.env.E2E_SEMANTIC_SEARCH ?? '').trim().toLowerCase()
);

test('enforces the semantic API top-k ceiling at the frontend boundary', async ({ request }) => {
	test.skip(!semanticEnabled, 'Requires the semantic search fixture');
	const path = '/api/notices/semantic-search?query=test';
	const atLimit = await request.get(`${path}&k=20`);
	expect(atLimit.status()).toBe(200);
	const aboveLimit = await request.get(`${path}&k=21`);
	expect(aboveLimit.status()).toBe(400);
	expect(await aboveLimit.json()).toMatchObject({ success: false });
});

const HEALTH_API = '**/api/notices/semantic-search/health';

const STAMP = '2026-10-02T12:00:00+00:00';
const TRIGGERED_AT = '2026-10-02T13:00:00+00:00';

function healthEnvelope(
	overrides: Partial<{
		status: 'loading' | 'ready' | 'failed';
		indexedChunks: number;
		lastUpdateAt: string | null;
		lastUpdateTriggeredAt: string | null;
	}> = {}
) {
	return {
		success: true,
		data: {
			status: 'ready' as const,
			indexedChunks: 93031,
			lastUpdateAt: STAMP,
			lastUpdateTriggeredAt: TRIGGERED_AT,
			...overrides
		}
	};
}

/**
 * Fill and submit the semantic search form, robust against hydration timing.
 *
 * There are two submission paths: once hydrated the form navigates to ?search= and the
 * server load runs the search; before hydration a plain GET submit round-trips through the
 * same parameter and SSRs the results. Either way the query ends up in the URL, so retry
 * until it lands — the fill can also beat the input's own listeners and leave the form
 * state empty for the click.
 */
async function search(page: Page, query: string) {
	await page.goto('/notices/semantic-search');
	for (let attempt = 1; attempt <= 5; attempt += 1) {
		await page.getByTestId('semantic-search-input').fill(query);
		await page.getByTestId('semantic-search-submit').click();
		try {
			await expect
				.poll(() => new URL(page.url()).searchParams.get('search'), { timeout: 3000 })
				.toBe(query);
			return;
		} catch {
			// Not there yet (hydration race); re-fill and submit once more.
		}
	}
	throw new Error('semantic search never reached ?search= (hydration race)');
}

/**
 * Arm BEFORE goto: the /health request is fired from onMount, i.e. after the
 * lazily-loaded route chunk has hydrated, so awaiting it guarantees the
 * trigger button's click handler is attached (a click landing earlier is a
 * silent no-op, same race as search()).
 */
function watchEngineHealth(page: Page) {
	return page.waitForRequest(HEALTH_API, { timeout: 20000 }).catch(() => null);
}

/**
 * Capture the example-chip labels the server rendered, read from the document
 * response of the load under test. A second request would draw a different
 * random subset, so the HTML has to come from this very navigation.
 */
function captureSsrChips(page: Page) {
	let html = '';
	page.on('response', (response) => {
		if (response.request().resourceType() !== 'document') return;
		if (!new URL(response.url()).pathname.replace(/\/+$/, '').endsWith('/notices/semantic-search'))
			return;
		void response
			.text()
			.then((text) => {
				html = text;
			})
			.catch(() => {});
	});
	return async () => {
		await expect.poll(() => html.length).toBeGreaterThan(0);
		return [...html.matchAll(/data-testid="semantic-search-example"[^>]*>([^<]*)</g)].map((m) =>
			m[1].trim()
		);
	};
}

async function openEngineStatus(page: Page, hydrated: Promise<unknown>) {
	await hydrated;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		await page.getByTestId('semantic-search-engine-status-trigger').click();
		try {
			// waitFor resolves void on success, so success/failure must be
			// distinguished by rejection rather than by the resolved value.
			await page
				.getByTestId('semantic-search-engine-status-panel')
				.waitFor({ state: 'visible', timeout: 2000 });
			return;
		} catch {
			// Click landed before the handler attached; retry the toggle.
		}
	}
	throw new Error('engine status panel never opened');
}

test.describe('Semantic Search UI', () => {
	test.skip(
		!semanticEnabled,
		'semantic search tests require E2E_SEMANTIC_SEARCH=1 (dedicated config).'
	);

	test('entry point is visible on the notices page when the flag is on', async ({ page }) => {
		await page.goto('/notices');
		await expect(page.getByTestId('semantic-search-entry')).toBeVisible();
	});

	test('preserves and reopens timing history across searches, routes and reload', async ({
		page
	}) => {
		await page.addInitScript(() => localStorage.setItem('lawcast-cookie-consent', 'accepted'));
		await page.setViewportSize({ width: 1360, height: 800 });
		await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
		await search(page, '세입자 보호');

		const timing = page.getByTestId('search-timing');
		const traceId = page.getByTestId('search-timing-id');
		const history = page.getByTestId('search-timing-history');
		await expect(timing).toBeVisible();
		const main = (await page.getByTestId('semantic-search-main').boundingBox())!;
		const dock = (await page.getByTestId('search-timing-dock').boundingBox())!;
		expect(main.x + main.width).toBeLessThanOrEqual(dock.x);
		await expect(page.getByTestId('search-timing-duration')).toHaveText(/^\d+\.\d{2} ms$/);
		await expect(page.getByTestId('search-timing-status')).toContainText('HTTP 200');
		await expect(page.getByTestId('search-timing-backend')).toHaveText('측정값 없음');
		await expect(traceId).toHaveText(/^[a-f0-9-]{36}$/);
		const firstTrace = await traceId.innerText();

		await page.getByTestId('semantic-search-input').fill('오류');
		await page.getByTestId('semantic-search-submit').click();
		await expect(page.getByTestId('search-timing-status')).toHaveText('실패 (HTTP 500)');
		await expect(traceId).not.toHaveText(firstTrace);
		await expect(traceId).toHaveText(/^[a-f0-9-]{36}$/);
		const latest = await traceId.innerText();
		await history.selectOption(firstTrace);
		await expect(traceId).toHaveText(firstTrace);

		await page.goto('/notices/semantic-search');
		await expect(traceId).toHaveText(latest);
		await history.selectOption(firstTrace);
		await expect(traceId).toHaveText(firstTrace);
		await page.getByTestId('search-timing-toggle').click();
		await expect(timing).toHaveCount(0);
		await page.getByTestId('search-timing-toggle').click();
		await expect(traceId).toHaveText(firstTrace);
		await page.goto('/notices');
		await expect(history.locator('option')).toHaveCount(3);
		await page.getByTestId('search-timing-clear').click();
		await expect(page.getByTestId('search-timing-dock')).toHaveCount(0);
		await page.reload();
		await expect(page.getByTestId('search-timing-dock')).toHaveCount(0);
	});

	test('shows correlated timings for sidecar attempts, backend and SvelteKit', async ({ page }) => {
		await page.goto('/notices/semantic-search?search=검색+타이밍+검증');
		await expect(page.getByTestId('search-timing-backend')).toHaveText('25.50 ms');
		await expect(page.getByTestId('search-timing-duration')).toHaveText(/^\d+\.\d{2} ms$/);
		const calls = page.getByTestId('search-timing-call');
		await expect(calls).toHaveCount(3);
		await expect(calls.nth(0)).toContainText('/health');
		await expect(calls.nth(1)).toContainText('실패 (HTTP 422)');
		await expect(calls.nth(1)).toContainText('사이드카 단계별 측정값 없음');
		await expect(calls.nth(2)).toContainText('/search · k=10');
		await expect(calls.nth(2)).toContainText('14.00 ms');
		await expect(calls.nth(2)).toContainText('8.00 ms');
		await expect(calls.nth(2)).toContainText('2.00 ms');
		await expect(calls.nth(2)).toContainText('10.00 ms');
		await expect(page.getByTestId('search-timing-longest')).toBeVisible();
		const start = async (id: string) =>
			Number(await page.getByTestId(`search-span-${id}`).getAttribute('data-start-ms'));
		const backendStart = await start('backend');
		const callStart = await start('call-2');
		const denseStart = await start('call-2-dense');
		const annotateStart = await start('call-2-annotate');
		expect((await start('call-2-dense-embedding')) - denseStart).toBeCloseTo(0.5);
		expect((await start('call-2-dense-faiss')) - denseStart).toBeCloseTo(5);
		expect((await start('call-2-dense-classification')) - denseStart).toBeCloseTo(6.5);
		await expect(page.getByTestId('search-span-call-2-dense-embedding')).toContainText('4.00 ms');
		await expect(page.getByTestId('search-span-call-2-dense-faiss')).toContainText('1.50 ms');
		await expect(page.getByTestId('search-span-call-2-dense-classification')).toContainText(
			'1.00 ms'
		);
		expect(callStart - backendStart).toBeCloseTo(7);
		expect(denseStart - callStart).toBeCloseTo(2);
		expect(annotateStart - denseStart).toBeCloseTo(8);
		expect(await start('call-1')).toBeLessThan(callStart);
		expect(await start('body')).toBeGreaterThan(annotateStart);
	});

	test('resizes the timing dock and restores width and collapse after reload', async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem('lawcast-cookie-consent', 'accepted'));
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
		await page.goto('/notices/semantic-search?search=세입자+보호');

		const dock = page.getByTestId('search-timing-dock');
		const handle = page.getByRole('separator', { name: 'Search Timing 패널 너비' });
		const toggle = page.getByTestId('search-timing-toggle');
		await expect(handle).toHaveAttribute('aria-valuenow', '432');
		await expect(page.getByTestId('app-route-container')).toHaveAttribute('style', /432px/);
		const before = (await dock.boundingBox())!;
		const edge = (await handle.boundingBox())!;
		const x = edge.x + edge.width / 2;
		const y = edge.y + edge.height / 2;
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x - 180, y, { steps: 8 });
		await page.mouse.up();
		await expect(handle).toHaveAttribute('aria-valuenow', '612');
		expect(
			await page.evaluate(
				() => JSON.parse(localStorage.getItem('lawcast-dev-search-timing-layout-v1')!).width
			)
		).toBe(612);
		const widened = (await dock.boundingBox())!;
		expect(widened.width).toBe(612);
		expect(widened.x + widened.width).toBe(before.x + before.width);
		const main = (await page.getByTestId('semantic-search-main').boundingBox())!;
		expect(main.x + main.width).toBeLessThanOrEqual(widened.x);

		await handle.press('ArrowLeft');
		await expect(handle).toHaveAttribute('aria-valuenow', '628');
		await handle.press('Home');
		await expect(handle).toHaveAttribute('aria-valuenow', '320');
		await handle.press('End');
		await expect(handle).toHaveAttribute('aria-valuenow', '800');
		await handle.press('ArrowRight');
		await expect(handle).toHaveAttribute('aria-valuenow', '784');

		await handle.press('Enter');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(toggle).toBeFocused();
		await page.reload();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(handle).toHaveCount(0);
		await toggle.click();
		await expect(handle).toHaveAttribute('aria-valuenow', '784');

		await page.setViewportSize({ width: 390, height: 844 });
		await expect(handle).toBeHidden();
		expect((await dock.boundingBox())!.width).toBeLessThan(390);
		await page.setViewportSize({ width: 1440, height: 900 });
		await expect(handle).toHaveAttribute('aria-valuenow', '784');
		await page.reload();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(handle).toHaveAttribute('aria-valuenow', '784');
	});

	test('compares a pinned previous request with the latest on a shared axis', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.addInitScript(() => {
			localStorage.setItem('lawcast-cookie-consent', 'accepted');
			const common = {
				path: '/notices/semantic-search',
				status: 200,
				outcome: 'success',
				fetchStartedMs: 0
			};
			const call = (startMs: number, denseMs: number, annotateMs: number) => ({
				path: '/search',
				startMs,
				roundTripMs: 15,
				status: 200,
				outcome: 'ok',
				chunkK: 10,
				timings: {
					denseMs,
					annotateMs,
					totalMs: denseMs + annotateMs,
					denseStages: {
						embedding: { startMs: 0, durationMs: denseMs - 4 },
						embeddingStages: {
							tokenization: { startMs: 0.25, durationMs: 0.5 },
							model: { startMs: 0.75, durationMs: denseMs - 5 },
							cpuConversion: { startMs: denseMs - 4.25, durationMs: 0.25 }
						},
						faiss: { startMs: denseMs - 4, durationMs: 2 },
						classification: { startMs: denseMs - 2, durationMs: 2 }
					}
				}
			});
			sessionStorage.setItem(
				'lawcast-dev-search-timing-v1',
				JSON.stringify({
					records: [
						{
							...common,
							query: '새 기록',
							traceId: 'latest',
							recordedAt: 2,
							sveltekitMs: 40,
							headersReceivedMs: 35,
							backend: { backendMs: 20, omittedCalls: 0, sidecarCalls: [call(1, 10, 2)] }
						},
						{
							...common,
							query: '이전 기록',
							traceId: 'baseline',
							recordedAt: 1,
							sveltekitMs: 50,
							headersReceivedMs: 45,
							backend: {
								backendMs: 30,
								omittedCalls: 0,
								sidecarCalls: [
									{ path: '/health', startMs: 1, roundTripMs: 3, status: 200, outcome: 'ok' },
									call(6, 8, 4)
								]
							}
						}
					]
				})
			);
		});
		await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
		await page.goto('/notices/semantic-search');
		await page.getByTestId('search-timing-history').selectOption('baseline');
		await page.getByTestId('search-timing-compare-toggle').click();
		const compare = page.getByTestId('search-timing-comparison');
		await expect(compare).toBeVisible();
		await expect(compare.getByTestId('search-timing-compare-toggle')).toBeFocused();
		const axis = page.getByTestId('search-comparison-axis');
		await expect(axis.locator(':scope > div').getByText('50.00 ms', { exact: true })).toHaveCount(
			2
		);
		await expect(axis).toHaveAttribute('data-axis-ms', '50');
		const row = (label: string) =>
			compare.getByTestId('search-comparison-row').filter({ hasText: label });
		const total = row('SvelteKit 전체');
		await expect(total.getByTestId('search-comparison-delta')).toHaveText('−10.00 ms 빨라짐');
		await expect(
			total.getByTestId('search-comparison-previous').getByTestId('search-comparison-bar')
		).toHaveAttribute('style', /width:\s*100%/);
		await expect(
			total.getByTestId('search-comparison-latest').getByTestId('search-comparison-bar')
		).toHaveAttribute('style', /width:\s*80%/);
		await expect(row('Dense').getByTestId('search-comparison-delta')).toHaveText('+2.00 ms 느려짐');
		await expect(row('질의 임베딩').getByTestId('search-comparison-delta')).toHaveText(
			'+2.00 ms 느려짐'
		);
		await expect(row('토큰화').getByTestId('search-comparison-delta')).toHaveText('차이 없음');
		await expect(row('모델 실행').getByTestId('search-comparison-delta')).toHaveText(
			'+2.00 ms 느려짐'
		);
		await expect(row('CPU 벡터 변환').getByTestId('search-comparison-delta')).toHaveText(
			'차이 없음'
		);
		await expect(row('FAISS 조회·정렬').getByTestId('search-comparison-delta')).toHaveText(
			'차이 없음'
		);
		await expect(row('관련도 분류').getByTestId('search-comparison-delta')).toHaveText('차이 없음');
		await expect(row('Annotate').getByTestId('search-comparison-delta')).toHaveText(
			'−2.00 ms 빨라짐'
		);
		await expect(row('Sidecar 전체').getByTestId('search-comparison-delta')).toHaveText(
			'차이 없음'
		);
		await expect(row('/health').getByTestId('search-comparison-delta')).toHaveText(
			'비교할 값 없음'
		);
		await expect(row('/health').getByTestId('search-comparison-latest')).toContainText('기록 없음');

		await page.getByTestId('search-timing-toggle').click();
		await page.getByTestId('semantic-search-input').fill('세입자 보호');
		await page.getByTestId('semantic-search-input').press('Enter');
		await expect(page.getByTestId('search-timing-toggle')).toContainText('3건');
		await page.getByTestId('search-timing-toggle').click();
		await expect(compare.getByText('세입자 보호', { exact: true })).toBeVisible();
		await expect(compare.getByText('이전 기록', { exact: true })).toBeVisible();
		await expect(row('질의 임베딩').getByTestId('search-comparison-delta')).toHaveText(
			'비교할 값 없음'
		);
		await page.getByTestId('search-timing-compare-toggle').click();
		await expect(page.getByTestId('search-timing-id')).toHaveText('baseline');
		const waterfall = page.getByTestId('search-timing-waterfall');
		await expect(
			waterfall.getByTestId('search-span-call-1-dense-embedding-tokenization')
		).toHaveAttribute('data-start-ms', '15.25');
		await expect(waterfall.getByTestId('search-span-call-1-dense-embedding-model')).toHaveAttribute(
			'data-start-ms',
			'15.75'
		);
		await expect(
			waterfall.getByTestId('search-span-call-1-dense-embedding-cpuConversion')
		).toHaveAttribute('data-start-ms', '18.75');
	});

	test('uses the web push debug panel styling at a narrow viewport', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 720 });
		await page.emulateMedia({ colorScheme: 'light' });
		await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
		await page.route('**/api/push/public-key', (route) =>
			route.fulfill({ json: { success: true, data: { enabled: true, publicKey: 'test-key' } } })
		);

		const panelStyle = (panel: ReturnType<Page['locator']>) =>
			panel.evaluate((node) => {
				const box = getComputedStyle(node);
				const title = getComputedStyle(node.querySelector('header p')!);
				const badge = getComputedStyle(node.querySelector('abbr')!);
				const list = getComputedStyle(node.querySelector('dl')!);
				const label = getComputedStyle(node.querySelector('dt')!);
				return {
					background: box.backgroundColor,
					foreground: box.color,
					border: box.border,
					radius: box.borderRadius,
					padding: box.padding,
					fontSize: box.fontSize,
					title: [title.color, title.fontWeight, title.marginBottom],
					badge: [badge.color, badge.backgroundColor],
					list: [list.display, list.rowGap],
					label: [label.display, label.fontWeight]
				};
			});

		await page.goto('/webhook');
		const push = page.getByRole('complementary', { name: 'Web Push Notification Debug' });
		await expect(push).toBeVisible();
		await expect(push.getByText('DEV', { exact: true })).toBeVisible();
		const expected = await panelStyle(push);

		await page.goto('/notices/semantic-search?search=세입자+보호');
		const timing = page.getByTestId('search-timing');
		await expect(timing).toBeVisible();
		expect(await panelStyle(timing)).toEqual(expected);
		await expect(timing).toHaveCSS('border-top-style', 'solid');
		await expect(timing).toHaveCSS('border-inline-start-width', '2px');
		await expect(timing.getByText('DEV', { exact: true })).toBeVisible();
		await expect(timing.locator('header svg')).toBeVisible();
		await expect(timing.locator(':scope > div > dl > div')).toHaveCount(4);
		await expect(timing.getByTestId('search-timing-history')).toBeVisible();
		await expect(timing.locator('header').locator('..')).toHaveCSS('position', 'sticky');
		await expect(page.getByTestId('search-timing-id')).toHaveCSS('word-break', 'break-all');
		expect(await timing.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);

		await page.emulateMedia({ colorScheme: 'dark' });
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		const dark = await panelStyle(timing);
		expect(dark.background).not.toBe(expected.background);
		expect(dark.foreground).not.toBe(expected.foreground);
		expect(dark.badge).not.toEqual(expected.badge);
	});

	test('the notices board exposes the same engine status widget', async ({ page }) => {
		// The consent banner shares the bottom-right corner on a first visit, so
		// pre-accept it and let the corner widget receive the clicks below.
		await page.addInitScript(() => localStorage.setItem('lawcast-cookie-consent', 'accepted'));
		await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
		const hydrated = watchEngineHealth(page);
		await page.goto('/notices');
		await hydrated;

		await expect(page.getByTestId('notices-engine-status')).toBeVisible();
		await expect(page.getByTestId('notices-engine-status-panel')).toHaveCount(0);

		await page.getByTestId('notices-engine-status-trigger').click();
		await expect(page.getByTestId('notices-engine-status-panel')).toBeVisible();
		await expect(page.getByTestId('notices-engine-status-chunks')).toHaveText('93,031');
		await expect(page.getByTestId('notices-engine-status-last-update')).toContainText('2026');

		// Same popover behaviour as the search page: outside clicks close it.
		await page.getByTestId('notices-results-summary').click();
		await expect(page.getByTestId('notices-engine-status-panel')).toHaveCount(0);
	});

	test('renders semantic results with percentage score and section', async ({ page }) => {
		await search(page, '임대차 계약에서 세입자 보호');

		const result = page.getByTestId('semantic-result-2220607');
		await expect(result).toBeVisible();
		// Cosine similarity 0.586 renders as a whole-number percentage, not a decimal.
		await expect(result).toContainText('유사도 59%');
		await expect(result).toContainText('의안번호 2220607');
		await expect(result).toContainText('주요내용');
		await expect(page.getByTestId('semantic-result-link-2220607')).toContainText(
			'법률안 상세 보기'
		);
		await expect(page.getByTestId('semantic-search-fallback-banner')).toHaveCount(0);
		// The index time is owned by the engine status widget now, so the
		// results list no longer renders a duplicate `마지막 업데이트` line.
	});

	test('controls the query through the URL search parameter', async ({ page }) => {
		// Deep link: the input is prefilled and the search runs automatically.
		await page.goto(
			`/notices/semantic-search?search=${encodeURIComponent('임대차 계약에서 세입자 보호')}`
		);
		await expect(page.getByTestId('semantic-search-input')).toHaveValue(
			'임대차 계약에서 세입자 보호'
		);
		await expect(page.getByTestId('semantic-result-2220607')).toBeVisible();

		// Submitting a new query rewrites ?search= in place (replaceState).
		await page.getByTestId('semantic-search-input').fill('상가건물 임대차');
		await page.getByTestId('semantic-search-submit').click();
		await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe('상가건물 임대차');
	});

	test('the per-request chip draw is never served from a shared cache', async ({ page }) => {
		// Same policy as the board (see its spec): the example chips are drawn per
		// request, so the HTML must not be replayable from a shared cache.
		const response = await page.goto('/notices/semantic-search');
		expect(response?.status()).toBe(200);
		const header = response?.headers()['cache-control'] ?? '';
		expect(header).toContain('private');
		expect(header).toContain('no-cache');
		expect(header).not.toContain('public');
	});

	test('runs a search from the example chips and mirrors it into the URL', async ({ page }) => {
		// The random subset is drawn in +page.server.ts, so the SSR HTML must
		// already carry the final chips — capture this navigation's document
		// response to prove nothing is swapped in after the first paint.
		const ssrLabels = captureSsrChips(page);
		// The health request fires from onMount, i.e. after hydration, which is
		// what guarantees the click handler below is attached.
		const hydrated = watchEngineHealth(page);
		await page.goto('/notices/semantic-search');
		await hydrated;
		await expect(page.getByTestId('semantic-search-example')).toHaveCount(3);
		const labels = (await page.getByTestId('semantic-search-example').allInnerTexts()).map(
			(label) => label.trim()
		);
		expect(labels).toEqual(await ssrLabels());

		await page.getByTestId('semantic-search-example').first().click();
		await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe(labels[0]);

		await expect(page.getByTestId('semantic-result-2220607')).toBeVisible();
	});

	test('carries the current keyword search into the semantic entry link', async ({ page }) => {
		await page.goto(`/notices?search=${encodeURIComponent('임대차')}`);
		const entry = page.getByTestId('semantic-search-entry');
		await expect(entry).toBeVisible();
		await expect(entry).toHaveAttribute(
			'href',
			`/notices/semantic-search?search=${encodeURIComponent('임대차')}`
		);
	});

	test('keeps URL, input, and results in agreement across back/forward', async ({ page }) => {
		const query = '임대차 계약에서 세입자 보호';
		await page.goto('/notices'); // history entry before the search page
		await search(page, query);
		await expect(page.getByTestId('semantic-result-2220607')).toBeVisible();
		await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe(query);

		// Native back (what a user's Back button triggers) must move off the
		// current entry. Hydration timing decides how the search page was
		// entered (SPA pushState vs. plain GET form submit), so the landing
		// page differs — every landing must still be self-consistent.
		const beforeBack = page.url();
		await page.evaluate(() => history.back());
		await expect.poll(() => page.url(), { timeout: 10000 }).not.toBe(beforeBack);

		if (new URL(page.url()).pathname.replace(/\/+$/, '').endsWith('/notices/semantic-search')) {
			// Landed on a search-page entry without ?search=: it must show the
			// initial state, never stale results for a query it no longer has.
			await expect(page.getByTestId('semantic-search-initial-state')).toBeVisible();
			await expect(page.getByTestId('semantic-search-results-list')).toHaveCount(0);
			await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBeNull();
		} else {
			await expect
				.poll(() => new URL(page.url()).pathname.replace(/\/+$/, ''), { timeout: 10000 })
				.toBe('/notices');
		}

		// Forward must land on the searched entry with URL, input, and results agreeing.
		await page.evaluate(() => history.forward());
		await expect
			.poll(() => new URL(page.url()).searchParams.get('search'), { timeout: 10000 })
			.toBe(query);
		await expect(page.getByTestId('semantic-search-input')).toHaveValue(query);
		await expect(page.getByTestId('semantic-result-2220607')).toBeVisible({ timeout: 10000 });
	});

	test('directly loading an edited ?search= URL keeps input, results, and URL in agreement', async ({
		page
	}) => {
		await page.goto(
			`/notices/semantic-search?search=${encodeURIComponent('임대차 계약에서 세입자 보호')}`
		);
		await expect(page.getByTestId('semantic-search-input')).toHaveValue(
			'임대차 계약에서 세입자 보호'
		);
		await expect(page.getByTestId('semantic-result-2220607')).toBeVisible();

		// Address-bar edit to a different query: a fresh load must run the new
		// query server-side (not show stale results for the old one).
		const edited = '상가건물 임대차';
		await page.goto(`/notices/semantic-search?search=${encodeURIComponent(edited)}`);
		await expect(page.getByTestId('semantic-search-input')).toHaveValue(edited);
		await expect(page.getByTestId('semantic-result-2220607')).toBeVisible({ timeout: 10000 });
		await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe(edited);

		// Address-bar edit removing the parameter resets to the initial state.
		await page.goto('/notices/semantic-search');
		await expect(page.getByTestId('semantic-search-input')).toHaveValue('');
		await expect(page.getByTestId('semantic-search-initial-state')).toBeVisible();
		await expect(page.getByTestId('semantic-search-results-list')).toHaveCount(0);
		await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBeNull();
	});

	test('head metadata names the query only on a result view', async ({ page }) => {
		// Landing view: the tags exist once and stay query-free.
		await page.goto('/notices/semantic-search');
		await expectHeadMetadata(page, { canonical: /\/notices\/semantic-search$/ });
		await expect(page).not.toHaveTitle(/검색 결과/);

		// Result view: the same tags now echo the executed query.
		const query = '임대차 계약에서 세입자 보호';
		await search(page, query);
		await expect(page.getByTestId('semantic-result-2220607')).toBeVisible();
		await expectHeadMetadata(page, { query, canonical: /\/notices\/semantic-search$/ });
	});

	test('shows the empty state when nothing matches', async ({ page }) => {
		await search(page, '존재하지 않는 질의어');

		await expect(page.getByTestId('semantic-search-empty-state')).toBeVisible();
		// No weak band in this response: the plain empty state, no reveal button.
		await expect(page.getByTestId('semantic-search-show-weak')).toHaveCount(0);
	});

	test('hides weak results behind a reveal button when nothing is clear', async ({ page }) => {
		// Deep link: the SSR page already carries the weak-only response. The health
		// request gates the reveal click on hydration, same as the chips test — a
		// click landing earlier is a silent no-op.
		const hydrated = watchEngineHealth(page);
		await page.goto(`/notices/semantic-search?search=${encodeURIComponent('약한 관련 결과 조회')}`);
		await hydrated;

		// Empty clear tier: the empty state offers the weak band explicitly.
		await expect(page.getByTestId('semantic-search-empty-state')).toBeVisible();
		const reveal = page.getByTestId('semantic-search-show-weak');
		await expect(reveal).toBeVisible();
		await expect(reveal).toContainText('관련도가 낮은 결과 보기');
		await expect(page.getByTestId('semantic-search-results-list')).toHaveCount(0);

		// Only a click surfaces the weak hits, flagged as low-relevance.
		await reveal.click();
		await expect(page.getByTestId('semantic-search-weak-banner')).toBeVisible();
		const weakResult = page.getByTestId('semantic-result-2220901');
		await expect(weakResult).toBeVisible();
		await expect(weakResult).toContainText('유사도 31%');
		await expect(page.getByTestId('semantic-search-empty-state')).toHaveCount(0);

		// Hiding returns to the empty state with the reveal button.
		await page.getByTestId('semantic-search-hide-weak').click();
		await expect(page.getByTestId('semantic-search-empty-state')).toBeVisible();
		await expect(page.getByTestId('semantic-search-show-weak')).toBeVisible();
		await expect(page.getByTestId('semantic-search-results-list')).toHaveCount(0);
	});

	test('pages a weak band that is longer than one screen', async ({ page }) => {
		// The live engine returns its whole below-threshold pool (up to k hits, all
		// inside one narrow score band), so the reveal has to batch it instead of
		// dumping it. The `약한 여러` fixture is that 12-hit pool.
		const hydrated = watchEngineHealth(page);
		await page.goto(`/notices/semantic-search?search=${encodeURIComponent('약한 여러 결과 조회')}`);
		await hydrated;

		await expect(page.getByTestId('semantic-search-weak-offer')).toContainText('12건');
		await page.getByTestId('semantic-search-show-weak').click();

		const cards = page.locator('article[data-testid^="semantic-result-"]');
		await expect(cards).toHaveCount(10);
		// The headline count describes the whole band, not the batch on screen.
		await expect(page.getByTestId('semantic-search-results-summary')).toContainText('12건');
		await expect(page.getByTestId('semantic-search-weak-progress')).toContainText('12건 중 10건');

		const more = page.getByTestId('semantic-search-weak-more');
		await expect(more).toContainText('(10/12)');
		await more.click();
		await expect(cards).toHaveCount(12);
		await expect(page.getByTestId('semantic-search-weak-more')).toHaveCount(0);

		// Re-revealing after hide restarts at one batch.
		await page.getByTestId('semantic-search-hide-weak').click();
		await page.getByTestId('semantic-search-show-weak').click();
		await expect(cards).toHaveCount(10);
	});

	test('shows the keyword fallback banner for fallback responses', async ({ page }) => {
		await search(page, '상가건물 임대차 키워드 검색');

		await expect(page.getByTestId('semantic-search-fallback-banner')).toBeVisible();
		await expect(page.getByTestId('semantic-search-fallback-banner')).toContainText(
			'키워드 검색 결과를 반환합니다'
		);
		await expect(page.getByTestId('semantic-result-2220607')).toBeVisible();
	});

	test('shows an error state when the API fails', async ({ page }) => {
		await search(page, '의미 검색 오류 발생');

		await expect(page.getByTestId('load-failure')).toHaveAttribute('data-failure-kind', 'server');
		await expect(page.locator('.lc-rate-limit-overlay')).toHaveCount(0);
	});
	test('validates blank queries client-side', async ({ page }) => {
		await page.goto('/notices/semantic-search');
		await expect(async () => {
			await page.getByTestId('semantic-search-input').fill('   ');
			await page.getByTestId('semantic-search-submit').click();
			await expect(page.getByTestId('semantic-search-error')).toBeVisible({ timeout: 1500 });
		}).toPass();
		await expect(page.getByTestId('semantic-search-error')).toContainText(
			'검색어를 입력해 주세요.'
		);
	});

	test('keeps the engine status collapsed until the corner widget is opened', async ({ page }) => {
		await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
		const hydrated = watchEngineHealth(page);
		await page.goto('/notices/semantic-search');

		// A ready engine must not cover the search UI with the unavailable overlay.
		await expect(page.getByTestId('semantic-search-unavailable-overlay')).toHaveCount(0);

		// The widget sits in the corner without pushing any status content into
		// the page flow; details appear only after the user opens it.
		const status = page.getByTestId('semantic-search-engine-status');
		await expect(status).toBeVisible();
		await expect(page.getByTestId('semantic-search-engine-status-panel')).toHaveCount(0);
		await openEngineStatus(page, hydrated);

		await expect(page.getByTestId('semantic-search-engine-status-panel')).toBeVisible();
		await expect(page.getByTestId('semantic-search-engine-status-chunks')).toHaveText('93,031');
		const lastUpdate = page.getByTestId('semantic-search-engine-status-last-update');
		await expect(lastUpdate).toContainText('2026');
		await expect(lastUpdate).not.toContainText('기록 없음');
		const lastUpdateRun = page.getByTestId('semantic-search-engine-status-last-update-run');
		await expect(lastUpdateRun).toContainText('2026');
		await expect(lastUpdateRun).not.toContainText('기록 없음');
		await expect(page.getByTestId('semantic-search-engine-status-error')).toHaveCount(0);

		// Closing hides the panel again.
		await page.getByTestId('semantic-search-engine-status-close').click();
		await expect(page.getByTestId('semantic-search-engine-status-panel')).toHaveCount(0);
	});

	test('closes the engine status panel when clicking outside it', async ({ page }) => {
		await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
		const hydrated = watchEngineHealth(page);
		await page.goto('/notices/semantic-search');
		await openEngineStatus(page, hydrated);
		await expect(page.getByTestId('semantic-search-engine-status-panel')).toBeVisible();

		// A click outside the widget dismisses the popover...
		await page.getByTestId('semantic-search-input').click();
		await expect(page.getByTestId('semantic-search-engine-status-panel')).toHaveCount(0);
		await expect(page.getByTestId('semantic-search-engine-status-trigger')).toHaveAttribute(
			'aria-expanded',
			'false'
		);

		// ...while clicks inside the widget keep it open.
		await openEngineStatus(page, Promise.resolve());
		await page.getByTestId('semantic-search-engine-status-values').click();
		await expect(page.getByTestId('semantic-search-engine-status-panel')).toBeVisible();
	});

	test('shows a loading state until the engine status resolves', async ({ page }) => {
		await page.route(HEALTH_API, async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 2500));
			await route.fulfill({ json: healthEnvelope() });
		});
		const hydrated = watchEngineHealth(page);
		await page.goto('/notices/semantic-search');
		await openEngineStatus(page, hydrated);

		await expect(page.getByTestId('semantic-search-engine-status-loading')).toBeVisible();
		await expect(page.getByTestId('semantic-search-engine-status-values')).toBeVisible({
			timeout: 10000
		});
		await expect(page.getByTestId('semantic-search-engine-status-loading')).toHaveCount(0);
	});

	test('shows "기록 없음" when the engine has no recorded update times', async ({ page }) => {
		await page.route(HEALTH_API, (route) =>
			route.fulfill({
				json: healthEnvelope({ indexedChunks: 0, lastUpdateAt: null, lastUpdateTriggeredAt: null })
			})
		);
		const hydrated = watchEngineHealth(page);
		await page.goto('/notices/semantic-search');
		await openEngineStatus(page, hydrated);

		await expect(page.getByTestId('semantic-search-engine-status-chunks')).toHaveText('0');
		await expect(page.getByTestId('semantic-search-engine-status-last-update')).toContainText(
			'기록 없음'
		);
		await expect(page.getByTestId('semantic-search-engine-status-last-update-run')).toContainText(
			'기록 없음'
		);
	});

	test('shows an error state when the engine status cannot be fetched', async ({ page }) => {
		await page.route(HEALTH_API, (route) =>
			route.fulfill({
				status: 503,
				json: { statusCode: 503, message: '의미 검색 엔진 상태를 확인할 수 없습니다.' }
			})
		);
		const hydrated = watchEngineHealth(page);
		await page.goto('/notices/semantic-search');
		await openEngineStatus(page, hydrated);

		const statusError = page.getByTestId('semantic-search-engine-status-error');
		await expect(statusError).toBeVisible();
		await expect(statusError).toContainText('의미 검색 엔진 상태를 확인할 수 없습니다.');
		await expect(page.getByTestId('semantic-search-engine-status-values')).toHaveCount(0);
	});

	// The search UI availability gate: a not-ready engine or an unfetchable
	// status covers the form + results with an overlay telling the user that
	// search is currently unavailable.
	for (const status of ['loading', 'failed'] as const) {
		test(`covers the search UI while the engine status is ${status}`, async ({ page }) => {
			// Later registrations win, so each loop iteration re-stubs before its goto.
			await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope({ status }) }));
			await page.goto('/notices/semantic-search');

			const overlay = page.getByTestId('semantic-search-unavailable-overlay');
			await expect(overlay).toBeVisible();
			await expect(overlay).toContainText('의미 검색을 사용할 수 없습니다');

			// The overlay really sits on top of the form: every point the user
			// aims at inside the form resolves to the overlay element.
			const coversForm = await page.evaluate(() => {
				const form = document.querySelector('[data-testid="semantic-search-form"]');
				if (!form) return false;
				const rect = form.getBoundingClientRect();
				const hit = document.elementFromPoint(
					rect.left + rect.width / 2,
					rect.top + rect.height / 2
				);
				return hit?.closest('[data-testid="semantic-search-unavailable-overlay"]') !== null;
			});
			expect(coversForm).toBe(true);

			// The covered form is inert: its input cannot take focus, so no
			// keyboard-only path can submit a search behind the overlay.
			const input = page.getByTestId('semantic-search-input');
			await input.focus();
			await expect(input).not.toBeFocused();
		});
	}

	test('covers the search UI when the engine status cannot be fetched', async ({ page }) => {
		await page.route(HEALTH_API, (route) =>
			route.fulfill({
				status: 503,
				json: { statusCode: 503, message: '의미 검색 엔진 상태를 확인할 수 없습니다.' }
			})
		);
		await page.goto('/notices/semantic-search');

		const overlay = page.getByTestId('semantic-search-unavailable-overlay');
		await expect(overlay).toBeVisible();
		await expect(overlay).toContainText('지금은 의미 검색을 사용할 수 없습니다');
		// The reason line carries the backend's status-fetch failure message.
		await expect(overlay).toContainText('의미 검색 엔진 상태를 확인할 수 없습니다');
	});
	test('engine status dot shows green only when the engine is ready', async ({ page }) => {
		const dot = page.getByTestId('semantic-search-engine-status-dot');
		const overlay = page.getByTestId('semantic-search-unavailable-overlay');
		// Both theme spellings of each dot color (app.css), so the assertion
		// checks the rendered pixel rather than only the class name.
		const SUCCESS_COLORS = ['rgb(22, 163, 74)', 'rgb(134, 239, 172)'];
		const WARNING_COLORS = ['rgb(245, 158, 11)', 'rgb(251, 191, 36)'];
		const DANGER_COLORS = ['rgb(185, 28, 28)', 'rgb(252, 165, 165)'];
		const dotColor = () => dot.evaluate((el) => getComputedStyle(el).backgroundColor);
		// The overlay only appears after the health fetch has settled, so it is
		// the settle signal that stops the dot assertions from racing the
		// pre-fetch initial state (which is amber for every status).
		const assertSettledDot = async (expectedClass: RegExp, allowedColors: string[]) => {
			await expect(overlay).toBeVisible();
			await expect(dot).toHaveClass(expectedClass);
			// The whole point of the fix: no other state may wear the green light.
			expect(SUCCESS_COLORS).not.toContain(await dotColor());
			expect(allowedColors).toContain(await dotColor());
		};

		// Ready: the only state allowed to show green. (No overlay appears here,
		// so reaching lc-dot-success from the amber initial state is itself the
		// proof that the fetch settled.)
		await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
		await page.goto('/notices/semantic-search');
		await expect(dot).toHaveClass(/lc-dot-success/);
		expect(SUCCESS_COLORS).toContain(await dotColor());
		await expect(overlay).toHaveCount(0);

		// Engine still loading: amber pulse, never green.
		await page.route(HEALTH_API, (route) =>
			route.fulfill({ json: healthEnvelope({ status: 'loading' }) })
		);
		await page.goto('/notices/semantic-search');
		await assertSettledDot(/lc-dot-warning/, WARNING_COLORS);

		// Engine failed: red, never green.
		await page.route(HEALTH_API, (route) =>
			route.fulfill({ json: healthEnvelope({ status: 'failed' }) })
		);
		await page.goto('/notices/semantic-search');
		await assertSettledDot(/lc-text-danger/, DANGER_COLORS);

		// Status unfetchable: red, never green.
		await page.route(HEALTH_API, (route) =>
			route.fulfill({
				status: 503,
				json: { statusCode: 503, message: '의미 검색 엔진 상태를 확인할 수 없습니다.' }
			})
		);
		await page.goto('/notices/semantic-search');
		await assertSettledDot(/lc-text-danger/, DANGER_COLORS);
	});

	test('rate-limit overlay counts down and re-enables the retry button', async ({ page }) => {
		await search(page, '레이트리밋 테스트 질의');

		await expect(page.getByText('요청이 너무 많습니다')).toBeVisible({ timeout: 10000 });
		// The countdown must tick down to zero instead of freezing at "N초 후...".
		await expect(page.getByText('잠시 후 다시 시도해주세요')).toBeVisible({ timeout: 15000 });
		const retryButton = page.getByRole('button', { name: /다시 시도/ });
		await expect(retryButton).toBeEnabled();

		// The enabled button re-runs the server load, which hits the same 429
		// and restarts the countdown overlay.
		await retryButton.click();
		await expect(page.getByText('초 후 다시 시도할 수 있습니다')).toBeVisible({ timeout: 10000 });
	});
});
