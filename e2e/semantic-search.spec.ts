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

const sampleResult = {
	noticeNum: 2220607,
	subject: '상가건물 임대차보호법 일부개정법률안',
	committee: '법무부',
	section: '주요내용',
	score: 0.586,
	excerpt: '점유를 회복할 필요가 있는 경우에 임대인이 계약을 해지할 수 있도록 함.'
};

function semanticEnvelope(
	results: unknown[],
	mode = 'semantic',
	fallbackReason: string | null = null
) {
	return {
		success: true,
		data: { query: '임대차 계약에서 세입자 보호', mode, fallbackReason, results }
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
			.waitForRequest((req) => req.url().includes('/api/notices/semantic-search'), {
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

test.describe('Semantic Search UI', () => {
	test.skip(
		!semanticEnabled,
		'semantic search tests require E2E_SEMANTIC_SEARCH=1 (dedicated config).'
	);

	test('entry point is visible on the notices page when the flag is on', async ({ page }) => {
		await page.goto('/notices');
		await expect(page.getByTestId('semantic-search-entry')).toBeVisible();
	});

	test('renders semantic results with score and section', async ({ page }) => {
		await page.route(SEMANTIC_API, (route) =>
			route.fulfill({ json: semanticEnvelope([sampleResult]) })
		);
		await search(page, '임대차 계약에서 세입자 보호');

		const result = page.getByTestId('semantic-result-2220607');
		await expect(result).toBeVisible();
		await expect(result).toContainText('유사도 0.586');
		await expect(result).toContainText('주요내용');
		await expect(page.getByTestId('semantic-search-fallback-banner')).toHaveCount(0);
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
});
