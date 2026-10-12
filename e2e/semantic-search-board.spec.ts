import { expect, test, type Page } from '@playwright/test';
import { SEMANTIC_EXAMPLE_QUERIES } from '../src/lib/utils/semantic-search';

/**
 * `/notices` board search-mode UI (flag-gated).
 *
 * Runs under the semantic config (`npm run test:e2e:semantic-search`), which boots a dev
 * server with PUBLIC_SEMANTIC_SEARCH_ENABLED=1 and DIFFCHAIN_UI_MOCK=1. Without the flag
 * the board renders byte-identical markup in keyword-only mode, so skip on the plain
 * `npm run test:e2e` server (same pattern as semantic-search.spec.ts).
 *
 * Fixtures come from `src/lib/server/diffchain-ui-mock.ts` (`getMockArchiveNoticesResponse`),
 * which selects a response from marker words in the query:
 * `보호` (an archived subject) -> semantic results with relevance chips,
 * `키워드`/`폴백` -> keyword fallback, `약한` -> empty clear tier + a 12-hit weak band.
 * The scope note's on-demand keyword count is the one browser-issued archive read: it goes
 * through `/api/notices/archive` (the `[...path]` proxy), which is why mock mode needs its
 * own branch there — `handleFetch` only intercepts server-side calls.
 */
const semanticEnabled = ['1', 'true', 'yes', 'on'].includes(
	(process.env.E2E_SEMANTIC_SEARCH ?? '').trim().toLowerCase()
);

const SEARCH_WITH_RESULTS = '보호';
const SEARCH_WEAK_ONLY = '약한 결과 조회';

function gotoBoard(page: Page, params: string) {
	return page.goto(`/notices?${params}`);
}

/**
 * Click a board control and wait for its effect, retrying the whole pair.
 *
 * The board is one Svelte island, and `onclick` handlers only exist after hydration: a
 * click that lands on a cold `goto` is a silent no-op, so a single `click()` +
 * assertion intermittently fails. `toPass` re-runs both until the effect shows up or the
 * budget runs out (same reason `search()` and `openEngineStatus()` retry in
 * semantic-search.spec.ts).
 */
async function clickUntil(page: Page, testId: string, effect: () => Promise<void>) {
	await expect(async () => {
		await page.getByTestId(testId).click();
		await effect();
	}).toPass({ timeout: 20_000 });
}

test.describe('Notices board search modes (semantic enabled)', () => {
	test.skip(
		!semanticEnabled,
		'board search-mode tests require E2E_SEMANTIC_SEARCH=1 (dedicated config).'
	);

	test('cold start explains each mode and offers distinct example queries', async ({ page }) => {
		await gotoBoard(page, '');

		const mode = page.getByTestId('notices-search-mode');
		await expect(mode).toBeVisible();
		// The selected mode is explained in place: the labels alone cannot tell a
		// first-time reader which one is exhaustive.
		await expect(page.getByTestId('notices-search-mode-hint')).toContainText('뜻이 비슷한');
		// Each option carries the same sentence as its tooltip.
		for (const option of ['auto', 'keyword', 'semantic']) {
			await expect(page.getByTestId(`notices-search-mode-${option}`)).toHaveAttribute(
				'title',
				/./u
			);
		}

		const chips = page.getByTestId('notices-example-queries');
		await expect(chips).toBeVisible();
		await expect(page.locator('[data-testid^="notices-example-query-"]')).toHaveCount(3);

		// The draw is random per request (restored 2026-10-13), so the stable
		// properties are: three distinct chips, all drawn from the pool. Do NOT
		// assert anything across reloads here — two independent draws of 3 from an
		// 18-entry pool collide with probability 1/C(18,3) = 0.12%, and asserting
		// "the set changed" would flake at that rate. SSR/hydration agreement for
		// the same navigation is covered by `captureSsrChips` in
		// semantic-search.spec.ts (the chips come from the load payload, so they
		// cannot be swapped after first paint).
		const labels = (
			await page.locator('[data-testid^="notices-example-query-"]').allInnerTexts()
		).map((label) => label.trim());
		expect(new Set(labels).size).toBe(3);
		for (const label of labels) {
			expect(SEMANTIC_EXAMPLE_QUERIES).toContain(label);
		}
	});

	test('the per-request chip draw is never served from a shared cache', async ({ page }) => {
		// The chips are drawn per request. If a shared cache (or a browser's heuristic
		// freshness) pinned one draw, every visitor would see the same three chips —
		// exactly the frozen symptom a deterministic draw used to cause. The route
		// therefore declares itself uncacheable by shared caches.
		const response = await gotoBoard(page, '');
		expect(response?.status()).toBe(200);
		const header = response?.headers()['cache-control'] ?? '';
		expect(header).toContain('private');
		expect(header).toContain('no-cache');
		expect(header).not.toContain('public');
	});

	test('an example chip runs a semantic search and hides the examples', async ({ page }) => {
		await gotoBoard(page, '');
		const label = (await page.getByTestId('notices-example-query-1').innerText()).trim();

		await page.getByTestId('notices-example-query-1').click();

		await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe(label);
		expect(new URL(page.url()).searchParams.get('searchMode')).toBe('auto');
		await expect(page.getByTestId('notices-search-input')).toHaveValue(label);
		await expect(page.getByTestId('notices-example-queries')).toHaveCount(0);
	});

	test('semantic results flag their scope and count the keyword matches on demand', async ({
		page
	}) => {
		await gotoBoard(page, `search=${encodeURIComponent(SEARCH_WITH_RESULTS)}&searchMode=semantic`);

		const scope = page.getByTestId('notices-semantic-scope-note');
		await expect(scope).toBeVisible();
		await expect(scope).toContainText('관련도순 상위 결과');
		await expect(page.getByTestId('notices-semantic-scope-keyword')).toHaveAttribute(
			'href',
			/notices\?.*searchMode=keyword/
		);
		// Relevance chips explain themselves rather than reading as a verdict.
		await expect(page.locator('[title*="얼마나 비슷한지"]').first()).toBeVisible();

		// One request, only when asked: the count is not part of the search itself.
		const countRequest = page.waitForRequest(
			(request) =>
				request.url().includes('/api/notices/archive') &&
				request.url().includes('limit=1') &&
				request.url().includes(encodeURIComponent(SEARCH_WITH_RESULTS)),
			{ timeout: 20_000 }
		);
		await clickUntil(page, 'notices-semantic-scope-count', async () => {
			await expect(page.getByTestId('notices-semantic-scope-count-result')).toBeVisible({
				timeout: 1000
			});
		});
		await countRequest;

		const result = page.getByTestId('notices-semantic-scope-count-result');
		await expect(result).toContainText('키워드 검색은 같은 조건에서');
		await expect(result).toContainText('건');
	});

	test('the on-demand count never goes stale across a new query', async ({ page }) => {
		await gotoBoard(page, `search=${encodeURIComponent(SEARCH_WITH_RESULTS)}&searchMode=semantic`);
		await clickUntil(page, 'notices-semantic-scope-count', async () => {
			await expect(page.getByTestId('notices-semantic-scope-count-result')).toBeVisible({
				timeout: 1000
			});
		});

		await page.getByTestId('notices-search-input').fill('근로기준법');
		await page.getByTestId('notices-search-submit').click();

		// The stored number belonged to the previous filters; the offer must come back
		// instead of quoting it for the new query.
		await expect(page.getByTestId('notices-semantic-scope-count')).toBeVisible();
		await expect(page.getByTestId('notices-semantic-scope-count-result')).toHaveCount(0);
	});

	test('keyword mode shows no scope note', async ({ page }) => {
		await gotoBoard(page, `search=${encodeURIComponent(SEARCH_WITH_RESULTS)}&searchMode=keyword`);
		await expect(page.getByTestId('notices-semantic-scope-note')).toHaveCount(0);
		// Keyword mode is the exhaustive path: no relevance chips either.
		await expect(page.locator('[title*="얼마나 비슷한지"]')).toHaveCount(0);
	});

	test('a long weak band is offered, then paged instead of dumped', async ({ page }) => {
		// The mock returns 12 weak hits — the live engine returns its whole
		// below-threshold pool (up to 100), all in one score band.
		await gotoBoard(page, `search=${encodeURIComponent(SEARCH_WEAK_ONLY)}&searchMode=semantic`);

		const offer = page.getByTestId('notices-semantic-weak-offer');
		await expect(offer).toContainText('12건');
		await expect(offer).toContainText('10건부터');
		// The weak band is not the only escape: keyword mode is exhaustive (it is
		// the path that now searches `제안이유` too), so it is offered right here
		// instead of only in the plain empty state.
		await expect(page.getByTestId('notices-empty-try-keyword')).toHaveAttribute(
			'href',
			/notices\?.*searchMode=keyword/
		);

		const cards = page.locator('[data-testid^="notices-weak-result-"]');
		await clickUntil(page, 'notices-semantic-show-weak', async () => {
			await expect(cards).toHaveCount(10, { timeout: 1000 });
		});
		await expect(page.getByTestId('notices-semantic-weak-progress')).toContainText('12건 중 10건');
		const more = page.getByTestId('notices-semantic-weak-more');
		await expect(more).toContainText('(10/12)');

		await clickUntil(page, 'notices-semantic-weak-more', async () => {
			await expect(cards).toHaveCount(12, { timeout: 1000 });
		});
		await expect(page.getByTestId('notices-semantic-weak-more')).toHaveCount(0);
		await expect(page.getByTestId('notices-semantic-weak-progress')).toHaveCount(0);

		// Hiding and re-revealing restarts at one page.
		await clickUntil(page, 'notices-semantic-hide-weak', async () => {
			await expect(cards).toHaveCount(0, { timeout: 1000 });
		});
		await clickUntil(page, 'notices-semantic-show-weak', async () => {
			await expect(cards).toHaveCount(10, { timeout: 1000 });
		});
	});
});
