import { expect, test, type Page } from '@playwright/test';

/**
 * Open Signal loading-animation tests (flag-gated, same as semantic-search.spec.ts).
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
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem('lawcast-cookie-consent', 'declined'));
	});

	test.describe('Touch keyboard dismissal', () => {
		test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

		for (const target of [
			{ path: '/notices', input: 'notices-search-input' },
			{ path: '/notices/semantic-search', input: 'semantic-search-input' }
		]) {
			test(`releases input focus before requesting results on ${target.path}`, async ({ page }) => {
				await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
				const hydrated = watchEngineHealth(page);
				await page.goto(target.path);
				await hydrated;
				const input = page.getByTestId(target.input);
				await input.fill('보호');
				await expect(input).toBeFocused();
				let release!: () => void;
				const pending = new Promise<void>((resolve) => {
					release = resolve;
				});
				await page.route(/\/notices(?:\/semantic-search)?\/__data\.json/, async (route) => {
					await pending;
					await route.fallback();
				});
				try {
					await input.press('Enter');
					await expect(page.getByTestId('open-signal-loader')).toBeVisible();
					await expect(input).not.toBeFocused();
				} finally {
					release();
				}
				await expect(page.getByTestId('open-signal-loader')).toHaveCount(0);
				await expect(input).not.toBeFocused();
				await expect(input).toHaveValue('보호');
			});
		}

		test('keeps focus available to correct an empty semantic query', async ({ page }) => {
			await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
			const hydrated = watchEngineHealth(page);
			await page.goto('/notices/semantic-search');
			await hydrated;
			const input = page.getByTestId('semantic-search-input');
			await input.focus();
			await input.press('Enter');
			await expect(page.getByTestId('semantic-search-error')).toContainText(
				'검색어를 입력해 주세요.'
			);
			await expect(input).toBeFocused();
		});
	});

	test('first search shows the Open Signal stage mid-request and clears it once results render', async ({
		page
	}, testInfo) => {
		await page.setViewportSize({ width: 320, height: 740 });
		await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
		const hydrated = watchEngineHealth(page);
		await page.goto('/notices/semantic-search');
		await hydrated;
		await delayRouteDataRequests(page, REQUEST_DELAY_MS);

		await fillAndSubmit(page, '전세 사기 피해자 구제');

		// The loader replaces the results while the search is in flight.
		await expect(page.getByTestId('open-signal-loader')).toBeVisible();
		await expect(page.getByTestId('semantic-search-loading-state')).toBeVisible();
		await expect(page.getByTestId('semantic-search-submit')).toContainText('검색 중');
		await expect(page.getByTestId('semantic-search-submit')).toBeDisabled();
		await expect(page.getByTestId('semantic-search-results-list')).toHaveCount(0);

		// Svelte scopes keyframe names, so match the stable name fragment.
		expect(
			await page.locator('.lc-signal-arc').evaluate((el) => getComputedStyle(el).animationName)
		).toContain('lc-signal-draw');
		const loader = page.getByTestId('open-signal-loader');
		await loader.evaluate((el) => {
			for (const animation of el.getAnimations({ subtree: true })) {
				animation.pause();
				animation.currentTime = 1500;
			}
		});
		for (const theme of ['light', 'dark']) {
			await page.evaluate((theme) => {
				document.documentElement.dataset.theme = theme;
			}, theme);
			expect(await loader.evaluate((el) => getComputedStyle(el).color)).toBe(
				theme === 'light' ? 'rgb(29, 78, 216)' : 'rgb(155, 185, 217)'
			);
			const bounds = (await loader.boundingBox())!;
			expect(bounds.x).toBeGreaterThanOrEqual(0);
			expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
			await page
				.getByTestId('semantic-search-loading-state')
				.screenshot({ path: testInfo.outputPath(`search-${theme}.png`) });
		}

		// Once results render, every piece of loading UI is gone again.
		await expect(page.getByTestId('semantic-search-results-list')).toBeVisible({ timeout: 10000 });
		await expect(page.getByTestId('open-signal-loader')).toHaveCount(0);
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

		// Repeat searches replace the previous results with the same loader.
		await expect(page.getByTestId('semantic-search-loading-state')).toBeVisible();
		await expect(page.getByTestId('open-signal-loader')).toBeVisible();
		await expect(page.getByTestId('semantic-search-submit')).toContainText('검색 중');
		await expect(page.getByTestId('semantic-search-submit')).toBeDisabled();
		await expect(page.getByTestId('semantic-search-results-list')).toHaveCount(0);

		// Completion swaps in the new results and clears the loader.
		await expect(page.getByTestId('semantic-search-results-summary')).toContainText(
			'퇴근 후 카톡 업무 지시',
			{ timeout: 10000 }
		);
		await expect(page.getByTestId('semantic-search-loading-state')).toHaveCount(0);
		await expect(page.getByTestId('open-signal-loader')).toHaveCount(0);
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

		await expect(page.getByTestId('open-signal-loader')).toBeVisible();
		await expect(page.getByTestId('semantic-search-loading-state')).toBeVisible();

		const loader = page.getByTestId('open-signal-loader');
		expect(await loader.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
		await expect(loader.locator('.lc-signal-arc')).toHaveCSS('stroke-dashoffset', '0px');
		await expect(loader.locator('.lc-signal-letter')).toBeVisible();
		await expect(page.getByTestId('semantic-search-submit')).toContainText('검색 중');
	});

	for (const theme of ['light', 'dark']) {
		for (const mode of ['semantic', 'auto', 'keyword']) {
			test(`board uses the destination mode for ${mode} loading in ${theme} theme`, async ({
				page
			}, testInfo) => {
				await page.setViewportSize({ width: 375, height: 812 });
				await page.emulateMedia({ reducedMotion: 'reduce' });
				await page.route(HEALTH_API, (route) => route.fulfill({ json: healthEnvelope() }));
				const hydrated = watchEngineHealth(page);
				const initialMode = mode === 'keyword' ? 'semantic' : 'keyword';
				await page.goto(`/notices?search=보호&searchMode=${initialMode}`);
				await hydrated;
				await page.evaluate((theme) => {
					document.documentElement.dataset.theme = theme;
				}, theme);
				let release!: () => void;
				const pending = new Promise<void>((resolve) => {
					release = resolve;
				});
				await page.route(/\/notices\/__data\.json/, async (route) => {
					await pending;
					await route.fallback();
				});
				try {
					await page.getByTestId(`notices-search-mode-${mode}`).click();
					const loader = page.getByTestId('open-signal-loader');
					if (mode === 'keyword') {
						await expect(page.locator('.lc-spinner-ring')).toBeVisible();
						await expect(loader).toHaveCount(0);
					} else {
						await expect(loader).toBeVisible();
						await expect(page.locator('.lc-spinner-ring')).toHaveCount(0);
						const arc = loader.locator('.lc-signal-arc');
						expect(await arc.evaluate((el) => getComputedStyle(el).stroke)).toBe(
							theme === 'light' ? 'rgb(29, 78, 216)' : 'rgb(155, 185, 217)'
						);
						const bounds = (await loader.boundingBox())!;
						expect(bounds.x).toBeGreaterThanOrEqual(16);
						expect(bounds.x + bounds.width).toBeLessThanOrEqual(359);
						expect(await loader.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(
							0
						);
						await page.screenshot({ path: testInfo.outputPath(`board-${mode}-${theme}.png`) });
					}
				} finally {
					release();
				}
				await expect(page.getByTestId('open-signal-loader')).toHaveCount(0);
				await expect(page.locator('.lc-spinner-ring')).toHaveCount(0);
				await expect(page).toHaveURL(new RegExp(`searchMode=${mode}`));
			});
		}
	}
});
