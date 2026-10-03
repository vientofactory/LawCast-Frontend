import { expect, test, type Page } from '@playwright/test';

/**
 * Semantic search UI tests (flag-gated).
 *
 * The dedicated config (playwright.semantic-search.config.ts) boots a dev server with
 * PUBLIC_SEMANTIC_SEARCH_ENABLED=1. Without the flag the entry point and route are hidden
 * and redirected, so skip on a plain `npm run test:e2e` server (same pattern as
 * E2E_CF_CHALLENGE / E2E_RATE_LIMIT_SIM).
 */
const semanticEnabled = ['1', 'true', 'yes', 'on'].includes(
	(process.env.E2E_SEMANTIC_SEARCH ?? '').trim().toLowerCase()
);

const SEMANTIC_API = '**/api/notices/semantic-search*';
const HEALTH_API = '**/api/notices/semantic-search/health';

const sampleResult = {
	noticeNum: 2220607,
	subject: '상가건물 임대차보호법 일부개정법률안',
	committee: '법무부',
	section: '주요내용',
	score: 0.586,
	excerpt: '점유를 회복할 필요가 있는 경우에 임대인이 계약을 해지할 수 있도록 함.'
};

const STAMP = '2026-10-02T12:00:00+00:00';
const TRIGGERED_AT = '2026-10-02T13:00:00+00:00';

/**
 * The engine-status request shares the semantic-search URL prefix, so raw
 * `includes('/api/notices/semantic-search')` matchers would also accept
 * `/semantic-search/health` and mistake it for a fired search.
 */
function isSearchApiRequest(url: string) {
	return url.includes('/api/notices/semantic-search') && !url.includes('/health');
}

function healthEnvelope(
	overrides: Partial<{
		indexedChunks: number;
		lastUpdateAt: string | null;
		lastUpdateTriggeredAt: string | null;
	}> = {}
) {
	return {
		success: true,
		data: {
			indexedChunks: 93031,
			lastUpdateAt: STAMP,
			lastUpdateTriggeredAt: TRIGGERED_AT,
			...overrides
		}
	};
}

function semanticEnvelope(
	results: unknown[],
	mode = 'semantic',
	fallbackReason: string | null = null,
	lastUpdateAt: string | null = STAMP
) {
	return {
		success: true,
		data: { query: '임대차 계약에서 세입자 보호', mode, fallbackReason, lastUpdateAt, results }
	};
}

/**
 * Fill and submit the semantic search form, robust against hydration timing.
 *
 * The form is client-side (SvelteKit lazy-loads the route chunk after `load`),	 * so a click that lands before hydration falls back to a plain GET submit and
 * reloads the page untouched. Retry until the API request actually fires.
 */
async function search(page: Page, query: string) {
	await page.goto('/notices/semantic-search');
	for (let attempt = 1; attempt <= 5; attempt += 1) {
		await page.getByTestId('semantic-search-input').fill(query);
		const apiRequested = page
			.waitForRequest((req) => isSearchApiRequest(req.url()), {
				timeout: 3000
			})
			.catch(() => null);
		await page.getByTestId('semantic-search-submit').click();
		if (await apiRequested) {
			return;
		}
	}
	throw new Error('semantic search request never fired (hydration race)');
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

	test('renders semantic results with percentage score and section', async ({ page }) => {
		await page.route(SEMANTIC_API, (route) =>
			route.fulfill({ json: semanticEnvelope([sampleResult]) })
		);
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
		// results list no longer renders a duplicate 마지막 업데이트 line.
	});

	test('controls the query through the URL search parameter', async ({ page }) => {
		await page.route(SEMANTIC_API, (route) =>
			route.fulfill({ json: semanticEnvelope([sampleResult]) })
		);

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

	test('runs a search from the example chips and mirrors it into the URL', async ({ page }) => {
		await page.route(SEMANTIC_API, (route) =>
			route.fulfill({ json: semanticEnvelope([sampleResult]) })
		);
		await page.goto('/notices/semantic-search');

		// Retry: a click landing before hydration does nothing (type="button").
		await expect(async () => {
			await page.getByTestId('semantic-search-example').first().click();
			await expect
				.poll(() => new URL(page.url()).searchParams.get('search'), { timeout: 1500 })
				.toBe('해외직구할 때 관세 얼마나 내야 해?');
		}).toPass();

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
		await page.route(SEMANTIC_API, (route) =>
			route.fulfill({ json: semanticEnvelope([sampleResult]) })
		);
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
		await page.route(SEMANTIC_API, (route) =>
			route.fulfill({ json: semanticEnvelope([sampleResult]) })
		);
		await page.goto(
			`/notices/semantic-search?search=${encodeURIComponent('임대차 계약에서 세입자 보호')}`
		);
		await expect(page.getByTestId('semantic-search-input')).toHaveValue(
			'임대차 계약에서 세입자 보호'
		);
		await expect(page.getByTestId('semantic-result-2220607')).toBeVisible();

		// Address-bar edit to a different query: a fresh load must auto-run the
		// new query (not show stale results for the old one).
		const edited = '상가건물 임대차';
		const autoRan = page.waitForRequest(
			(req) =>
				req.url().includes('/api/notices/semantic-search') &&
				new URL(req.url()).searchParams.get('query') === edited,
			{ timeout: 10000 }
		);
		await page.goto(`/notices/semantic-search?search=${encodeURIComponent(edited)}`);
		await autoRan;
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

	test('shows the empty state when nothing matches', async ({ page }) => {
		await page.route(SEMANTIC_API, (route) => route.fulfill({ json: semanticEnvelope([]) }));
		await search(page, '존재하지 않는 질의어');

		await expect(page.getByTestId('semantic-search-empty-state')).toBeVisible();
	});

	test('shows the keyword fallback banner for fallback responses', async ({ page }) => {
		await page.route(SEMANTIC_API, (route) =>
			route.fulfill({
				json: semanticEnvelope(
					[{ ...sampleResult, score: null, section: null, excerpt: null }],
					'keyword_fallback',
					'의미 검색 엔진을 사용할 수 없어 키워드 검색 결과를 반환합니다.'
				)
			})
		);
		await search(page, '상가건물 임대차');

		await expect(page.getByTestId('semantic-search-fallback-banner')).toBeVisible();
		await expect(page.getByTestId('semantic-search-fallback-banner')).toContainText(
			'키워드 검색 결과를 반환합니다'
		);
		await expect(page.getByTestId('semantic-result-2220607')).toBeVisible();
	});

	test('shows an error state when the API fails', async ({ page }) => {
		await page.route(SEMANTIC_API, (route) =>
			route.fulfill({
				status: 500,
				json: { success: false, message: '검색 서비스를 일시적으로 사용할 수 없습니다.' }
			})
		);
		await search(page, '임대차 계약에서 세입자 보호');

		await expect(page.getByTestId('semantic-search-error')).toBeVisible();
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

		// The widget sits in the corner without pushing any status content into
		// the page flow; details appear only after the user opens it.
		const status = page.getByTestId('semantic-search-engine-status');
		await expect(status).toBeVisible();
		await expect(page.getByTestId('semantic-search-engine-status-panel')).toHaveCount(0);
		await openEngineStatus(page, hydrated);

		await expect(page.getByTestId('semantic-search-engine-status-panel')).toBeVisible();
		await expect(page.getByTestId('semantic-search-engine-chunks')).toHaveText('93,031');
		const lastUpdate = page.getByTestId('semantic-search-engine-last-update');
		await expect(lastUpdate).toContainText('2026');
		await expect(lastUpdate).not.toContainText('기록 없음');
		const lastUpdateRun = page.getByTestId('semantic-search-engine-last-update-run');
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

	test('shows 기록 없음 when the engine has no recorded update times', async ({ page }) => {
		await page.route(HEALTH_API, (route) =>
			route.fulfill({
				json: healthEnvelope({ indexedChunks: 0, lastUpdateAt: null, lastUpdateTriggeredAt: null })
			})
		);
		const hydrated = watchEngineHealth(page);
		await page.goto('/notices/semantic-search');
		await openEngineStatus(page, hydrated);

		await expect(page.getByTestId('semantic-search-engine-chunks')).toHaveText('0');
		await expect(page.getByTestId('semantic-search-engine-last-update')).toContainText('기록 없음');
		await expect(page.getByTestId('semantic-search-engine-last-update-run')).toContainText(
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

	test('rate-limit overlay counts down and re-enables the retry button', async ({ page }) => {
		await page.route(SEMANTIC_API, (route) =>
			route.fulfill({
				status: 429,
				contentType: 'application/json',
				headers: { 'retry-after': '5' },
				body: JSON.stringify({ statusCode: 429, message: 'Too many requests.', retryAfter: 5 })
			})
		);
		await search(page, '임대차 계약에서 세입자 보호');

		await expect(page.getByText('요청이 너무 많습니다')).toBeVisible({ timeout: 10000 });
		// The countdown must tick down to zero instead of freezing at "N초 후...".
		await expect(page.getByText('잠시 후 다시 시도해주세요')).toBeVisible({ timeout: 15000 });
		const retryButton = page.getByRole('button', { name: /다시 시도/ });
		await expect(retryButton).toBeEnabled();

		// The enabled button must re-issue the search and restart the overlay.
		const retryRequest = page.waitForRequest((request) => isSearchApiRequest(request.url()), {
			timeout: 10000
		});
		await retryButton.click();
		await retryRequest;
		await expect(page.getByText('초 후 다시 시도할 수 있습니다')).toBeVisible({ timeout: 10000 });
	});
});
