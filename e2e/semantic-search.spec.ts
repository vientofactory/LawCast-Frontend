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
 * `약한` -> empty clear tier + weak hit (reveal button), `키워드` -> keyword fallback,
 * anything else -> one sample result.
 * The engine-status endpoint is still fetched by the browser and keeps its `page.route`
 * stubs below.
 */
const semanticEnabled = ['1', 'true', 'yes', 'on'].includes(
	(process.env.E2E_SEMANTIC_SEARCH ?? '').trim().toLowerCase()
);

const HEALTH_API = '**/api/notices/semantic-search/health';

const STAMP = '2026-10-02T12:00:00+00:00';
const TRIGGERED_AT = '2026-10-02T13:00:00+00:00';

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
		// results list no longer renders a duplicate 마지막 업데이트 line.
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
