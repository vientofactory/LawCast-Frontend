import { expect, test, type Page } from '@playwright/test';

/**
 * Wand sparkle loading-animation tests (flag-gated, same as semantic-search.spec.ts).
 *
 * The search API call itself is SSR (`+page.server.ts` runs it inside handleFetch), so the
 * route layer cannot intercept `/api/notices/semantic-search` directly. The observable
 * browser-side seam is SvelteKit's data request: a client-side `goto('?search=...')`
 * refetches the route data through the network stack, and `navigating` — which drives the
 * loading UI — stays active until that response lands. Delaying the data request therefore
 * holds the loading window open long enough to assert the loader mid-request, with no delay
 * knob in the server mock.
 *
 * Markers in semantic-search-mock.ts still choose the fixture: a plain query returns one
 * sample result.
 */
const semanticEnabled = ['1', 'true', 'yes', 'on'].includes(
	(process.env.E2E_SEMANTIC_SEARCH ?? '').trim().toLowerCase()
);

const HEALTH_API = '**/api/notices/semantic-search/health';

const STAMP = '2026-10-02T12:00:00+00:00';
const TRIGGERED_AT = '2026-10-02T13:00:00+00:00';

/** Long enough for the mid-request assertions below to all land inside one window. */
const REQUEST_DELAY_MS = 2500;

function healthEnvelope() {
	return {
		success: true,
		data: {
			status: 'ready' as const,
			indexedChunks: 93031,
			lastUpdateAt: STAMP,
			lastUpdateTriggeredAt: TRIGGERED_AT
		}
	};
}

/**
 * Arm BEFORE goto: the /health request is fired from onMount, i.e. after the
 * lazily-loaded route chunk has hydrated, so awaiting it guarantees the form's
 * submit handler is attached (a click landing earlier is a native GET submit
 * that SSRs the results and skips the loading window entirely).
 */
function watchEngineHealth(page: Page) {
	return page.waitForRequest(HEALTH_API, { timeout: 20000 }).catch(() => null);
}

/**
 * Delay every browser-side request for this route — i.e. the data request behind
 * a client-side `goto('?search=...')` — then let it fall through to the dev
 * server (whose mock answers normally). The document response and the /api/*
 * calls (engine health) are never delayed.
 */
function delayRouteDataRequests(page: Page, ms: number) {
	return page.route(/\/notices\/semantic-search/, async (route) => {
		const request = route.request();
		const pathname = new URL(request.url()).pathname;
		if (request.resourceType() === 'document' || pathname.startsWith('/api/')) {
			await route.fallback();
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, ms));
		await route.fallback();
	});
}

/** Fill and submit once hydration is guaranteed; assert the fill actually landed. */
async function fillAndSubmit(page: Page, query: string) {
	await page.getByTestId('semantic-search-input').fill(query);
	await expect(page.getByTestId('semantic-search-input')).toHaveValue(query);
	await page.getByTestId('semantic-search-submit').click();
}

test.describe('Semantic Search loading animation', () => {
	test.skip(
		!semanticEnabled,
		'semantic search tests require E2E_SEMANTIC_SEARCH=1 (dedicated config).'
	);

	test('first search shows the wand sparkle stage mid-request and clears it once results render', async ({
		page
	}) => {
		await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
		const hydrated = watchEngineHealth(page);
		await page.goto('/notices/semantic-search');
		await hydrated;
		await delayRouteDataRequests(page, REQUEST_DELAY_MS);

		await fillAndSubmit(page, '전세 사기 피해자 구제');

		// Mid-request: the stage scene and the button state are up (the rail-sweep
		// track and sweep variant were removed by the loader simplification)...
		await expect(page.getByTestId('wand-sparkle-stage')).toBeVisible();
		await expect(page.getByTestId('semantic-search-loading-state')).toBeVisible();
		await expect(page.getByTestId('semantic-search-submit')).toContainText('검색 중');
		await expect(page.getByTestId('semantic-search-submit')).toBeDisabled();
		await expect(page.getByTestId('semantic-search-results-list')).toHaveCount(0);

		// ...and the wand really animates rather than sitting there as a still
		// frame. Svelte hash-prefixes scoped keyframe names in dev builds, so match
		// the animation by name fragment instead of the literal string.
		expect(
			await page.locator('.wand-sweep-group').evaluate((el) => getComputedStyle(el).animationName)
		).toContain('wand-sweep');

		// Once results render, every piece of loading UI is gone again.
		await expect(page.getByTestId('semantic-search-results-list')).toBeVisible({ timeout: 10000 });
		await expect(page.getByTestId('wand-sparkle-stage')).toHaveCount(0);
		await expect(page.getByTestId('semantic-search-loading-state')).toHaveCount(0);
		await expect(page.getByTestId('semantic-search-submit')).toHaveText('검색');
	});

	test('repeat search shows the loading stage mid-request and swaps in the new results', async ({
		page
	}) => {
		await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
		const hydrated = watchEngineHealth(page);
		await page.goto('/notices/semantic-search');
		await hydrated;

		// The first search completes normally so the repeat search has a query on screen.
		await fillAndSubmit(page, '전세 사기 피해자 구제');
		await expect(page.getByTestId('semantic-search-results-list')).toBeVisible({ timeout: 10000 });

		await delayRouteDataRequests(page, REQUEST_DELAY_MS);
		await fillAndSubmit(page, '퇴근 후 카톡 업무 지시');

		// Mid-request: the loading state shows during EVERY in-flight search (the
		// first-search-only gate was removed with the rail-sweep track), so the
		// stage scene replaces the previous results while the repeat runs.
		await expect(page.getByTestId('semantic-search-loading-state')).toBeVisible();
		await expect(page.getByTestId('wand-sparkle-stage')).toBeVisible();
		await expect(page.getByTestId('semantic-search-submit')).toContainText('검색 중');
		await expect(page.getByTestId('semantic-search-submit')).toBeDisabled();
		await expect(page.getByTestId('semantic-search-results-list')).toHaveCount(0);

		// Completion swaps in the new results and clears the loader.
		await expect(page.getByTestId('semantic-search-results-summary')).toContainText(
			'퇴근 후 카톡 업무 지시',
			{ timeout: 10000 }
		);
		await expect(page.getByTestId('semantic-search-loading-state')).toHaveCount(0);
		await expect(page.getByTestId('wand-sparkle-stage')).toHaveCount(0);
		await expect(page.getByTestId('semantic-search-submit')).toHaveText('검색');
	});

	test('prefers-reduced-motion stops the animations but keeps the loader rendered', async ({
		page
	}) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
		const hydrated = watchEngineHealth(page);
		await page.goto('/notices/semantic-search');
		await hydrated;
		await delayRouteDataRequests(page, REQUEST_DELAY_MS);

		await fillAndSubmit(page, '전세 사기 피해자 구제');

		await expect(page.getByTestId('wand-sparkle-stage')).toBeVisible();
		await expect(page.getByTestId('semantic-search-loading-state')).toBeVisible();

		// Every animated part computes to an instantly-finished animation under the
		// global reduced-motion override in app.css (0.01ms duration, one iteration)
		// — Svelte hash-prefixes scoped keyframe names in dev builds, so the name
		// itself is checked only for being present, not for a literal value.
		for (const selector of ['.wand-sweep-group', '.wand-star', '.spark', '.dust']) {
			const motion = await page
				.locator(selector)
				.first()
				.evaluate((el) => {
					const style = getComputedStyle(el);
					const seconds = (value: string) =>
						value.endsWith('ms') ? parseFloat(value) / 1000 : parseFloat(value);
					return {
						duration: seconds(style.animationDuration),
						iterations: style.animationIterationCount,
						name: style.animationName
					};
				});
			expect(motion.name).not.toBe('none'); // the animation still exists; it just never moves
			expect(motion.duration).toBeLessThanOrEqual(0.01);
			expect(motion.iterations).toBe('1');
		}

		// ...while the scene itself stays rendered for the in-flight search.
		await expect(page.getByTestId('wand-sparkle-stage')).toBeVisible();
		await expect(page.locator('.wand-handle')).toBeVisible();
		await expect(page.getByTestId('semantic-search-submit')).toContainText('검색 중');
	});
});
