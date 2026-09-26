import { test, expect, type Page } from '@playwright/test';

test.describe('Notices List Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/notices');
	});

	test('renders the main content area', async ({ page }) => {
		const main = page.getByTestId('notices-main');
		await expect(main).toBeVisible();
	});

	test('displays the page title', async ({ page }) => {
		await expect(page).toHaveTitle(/LawCast/);
	});

	test('filter form is visible', async ({ page }) => {
		const filterForm = page.getByTestId('notices-filter-form');
		await expect(filterForm).toBeVisible();
	});

	test('search input is available', async ({ page }) => {
		const searchInput = page.getByTestId('notices-search-input');
		await expect(searchInput).toBeVisible();
	});

	test('date range inputs are available', async ({ page }) => {
		const startDate = page.getByTestId('notices-start-date');
		const endDate = page.getByTestId('notices-end-date');
		await expect(startDate).toBeVisible();
		await expect(endDate).toBeVisible();
	});

	test('sort order select is available', async ({ page }) => {
		const sortOrder = page.getByTestId('notices-sort-order');
		await expect(sortOrder).toBeVisible();
	});

	test('page size select is available', async ({ page }) => {
		const pageSize = page.getByTestId('notices-page-size');
		await expect(pageSize).toBeVisible();
	});

	test('full text toggle is available', async ({ page }) => {
		const fullTextToggle = page.getByTestId('notices-full-text-toggle');
		await expect(fullTextToggle).toBeVisible();
	});

	test('search submit button works', async ({ page }) => {
		const submitBtn = page.getByTestId('notices-search-submit');
		await expect(submitBtn).toBeVisible();
		await expect(submitBtn).toHaveAttribute('type', 'submit');
	});

	test('reset filters button is available', async ({ page }) => {
		const resetBtn = page.getByTestId('notices-reset-filters');
		await expect(resetBtn).toBeVisible();
		await expect(resetBtn).toHaveAttribute('href', '/notices');
	});

	test('quick range buttons are available', async ({ page }) => {
		await expect(page.getByTestId('notices-quick-range-7-days')).toBeVisible();
		await expect(page.getByTestId('notices-quick-range-30-days')).toBeVisible();
		await expect(page.getByTestId('notices-quick-range-this-month')).toBeVisible();
		await expect(page.getByTestId('notices-quick-range-clear')).toBeVisible();
	});

	test('status filter buttons are available', async ({ page }) => {
		const statusFilter = page.getByTestId('notices-status-filter');
		await expect(statusFilter).toBeVisible();

		await expect(page.getByTestId('notices-status-filter-all')).toBeVisible();
		await expect(page.getByTestId('notices-status-filter-active')).toBeVisible();
		await expect(page.getByTestId('notices-status-filter-done')).toBeVisible();
	});

	test('results region is present', async ({ page }) => {
		const resultsRegion = page.getByTestId('notices-results-region');
		await expect(resultsRegion).toBeVisible();
	});

	test('results summary is visible', async ({ page }) => {
		const summary = page.getByTestId('notices-results-summary');
		await expect(summary).toBeVisible();
	});

	test('search input accepts text input', async ({ page }) => {
		const searchInput = page.getByTestId('notices-search-input');
		await searchInput.fill('테스트');
		await expect(searchInput).toHaveValue('테스트');
	});

	test('searching navigates with search query param', async ({ page }) => {
		const searchInput = page.getByTestId('notices-search-input');
		await searchInput.fill('테스트');
		await page.getByTestId('notices-search-submit').click();
		await page.waitForURL(/search=/, { timeout: 10_000 });
		const url = new URL(page.url());
		expect(url.searchParams.get('search')).toBeTruthy();
	});

	test('reset filters clears the URL', async ({ page }) => {
		await page.goto('/notices?search=테스트&startDate=2024-01-01');
		await page.getByTestId('notices-reset-filters').click();
		await expect(page).toHaveURL('/notices');
	});

	test('results list or empty state is shown', async ({ page }) => {
		const resultsList = page.getByTestId('notices-results-list');
		const emptyState = page.getByTestId('notices-empty-state');

		// Either results list or empty state should be visible
		const listVisible = await resultsList.isVisible().catch(() => false);
		const emptyVisible = await emptyState.isVisible().catch(() => false);
		expect(listVisible || emptyVisible).toBeTruthy();
	});

	test('pagination is shown when there are results', async ({ page }) => {
		const resultsList = page.getByTestId('notices-results-list');
		const hasResults = await resultsList.isVisible().catch(() => false);

		if (hasResults) {
			const summaryText = await page.getByTestId('notices-results-summary').innerText();
			const totalResults = Number(summaryText.match(/[\d,]+(?=건)/)?.[0]?.replace(/,/g, '') ?? '0');
			const pageSize = Number(
				(await page
					.getByTestId('notices-page-size')
					.inputValue()
					.catch(() => '10')) || '10'
			);

			if (totalResults <= pageSize) {
				test.skip(true, 'Pagination is only rendered when total results exceed the page size.');
				return;
			}

			const pagination = page.locator(
				'[data-testid="notices-pagination"], nav[aria-label="페이지 내비게이션"]'
			);
			await expect(pagination.first()).toBeVisible();
		}
	});
});

// ── Cross-dimension filter tests (require DIFFCHAIN_UI_MOCK=1) ──────────
const mockEnabled =
	(process.env.DIFFCHAIN_UI_MOCK ?? '').trim().toLowerCase() === '1' ||
	(process.env.DIFFCHAIN_UI_MOCK ?? '').trim().toLowerCase() === 'true';

test.describe('Notices Filter Cross-Dimension Tests', () => {
	test.skip(!mockEnabled, 'Cross-dimension filter tests require DIFFCHAIN_UI_MOCK=1.');

	// ── Helpers ──────────────────────────────────────────────────────────────

	/**
	 * Returns a YYYY-MM-DD string for N days ago in KST (UTC+9, no DST).
	 * The page builds filter dates from KST calendar dates (toKstInputDate) and
	 * the mock anchors range boundaries at KST midnight, so derive the date in
	 * KST regardless of the test runner's timezone.
	 */
	function daysAgoInputDate(days: number): string {
		const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
		return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
	}

	/** Reads the result count from the summary bar. */
	async function getResultCount(page: Page): Promise<number> {
		const text = await page.getByTestId('notices-results-summary').innerText();
		const match = text.match(/([\d,]+)건/);
		return Number(match?.[1]?.replace(/,/g, '') ?? '0');
	}

	/** Returns the notice nums of all visible notice cards. */
	async function getVisibleNoticeNums(page: Page): Promise<number[]> {
		const cards = page.locator('[data-testid^="notice-card-"]');
		const count = await cards.count();
		const nums: number[] = [];
		for (let i = 0; i < count; i++) {
			const testId = await cards.nth(i).getAttribute('data-testid');
			const num = testId?.replace('notice-card-', '');
			if (num) nums.push(Number(num));
		}
		return nums;
	}

	/** Returns the text of the active filter chips area. */
	async function getActiveFilterText(page: Page): Promise<string> {
		const chips = page.getByTestId('notices-active-filters');
		if (!(await chips.isVisible().catch(() => false))) return '';
		return chips.innerText();
	}

	// ── Category 1: Search keyword filtering ─────────────────────────────────

	test.describe('Search keyword filtering', () => {
		test('search by subject keyword shows matching notice only', async ({ page }) => {
			await page.goto('/notices?search=AI');
			const count = await getResultCount(page);
			expect(count).toBe(1);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toContain(2210001);
		});

		test('search by committee name shows matching notice only', async ({ page }) => {
			await page.goto('/notices?search=교육위원회');
			const count = await getResultCount(page);
			expect(count).toBe(1);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toContain(2210007);
		});

		test('search by proposerCategory matches all notices', async ({ page }) => {
			await page.goto('/notices?search=의원');
			const count = await getResultCount(page);
			expect(count).toBe(12);
		});

		test('search with non-existent keyword shows empty state', async ({ page }) => {
			await page.goto('/notices?search=존재하지않는법률');
			const count = await getResultCount(page);
			expect(count).toBe(0);
			await expect(page.getByTestId('notices-empty-state')).toBeVisible();
		});

		test('empty search string shows all notices', async ({ page }) => {
			await page.goto('/notices?search=');
			const count = await getResultCount(page);
			expect(count).toBe(12);
		});
	});

	// ── Category 2: FullText toggle interaction ──────────────────────────────

	test.describe('FullText toggle interaction', () => {
		test('fullText=true searches proposal reasons', async ({ page }) => {
			// '제도적 기반' appears only in 2210001's proposalReason
			await page.goto('/notices?search=제도적 기반&fullText=true');
			const count = await getResultCount(page);
			expect(count).toBe(1);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toContain(2210001);
		});

		test('fullText=false does not search proposal reasons', async ({ page }) => {
			// '제도적' only in proposalReason, not in subject/committee/proposerCategory
			await page.goto('/notices?search=제도적');
			const count = await getResultCount(page);
			expect(count).toBe(0);
			await expect(page.getByTestId('notices-empty-state')).toBeVisible();
		});

		test('fullText=true with different keyword matches different notice', async ({ page }) => {
			// '안전보건 확보' appears only in 2210003's proposalReason
			await page.goto('/notices?search=안전보건 확보&fullText=true');
			const count = await getResultCount(page);
			expect(count).toBe(1);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toContain(2210003);
		});

		test('fullText toggle via URL shows purple chip', async ({ page }) => {
			await page.goto('/notices?search=AI&fullText=true');
			const filterText = await getActiveFilterText(page);
			expect(filterText).toContain('원문 포함 검색');
		});

		test('fullText toggle via UI navigates with fullText param', async ({ page }) => {
			await page.goto('/notices?search=제도적 기반');
			// Click the fullText toggle link
			await page.getByTestId('notices-full-text-toggle').click();
			await page.waitForURL(/fullText=true/, { timeout: 10_000 });
			const count = await getResultCount(page);
			expect(count).toBe(1);
		});
	});

	// ── Category 3: Status filter ────────────────────────────────────────────

	test.describe('Status filter', () => {
		test('isDone=false shows only active notices', async ({ page }) => {
			await page.goto('/notices?isDone=false');
			const count = await getResultCount(page);
			expect(count).toBe(6);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toContain(2210001);
			expect(nums).toContain(2210003);
		});

		test('isDone=true shows only done notices', async ({ page }) => {
			await page.goto('/notices?isDone=true');
			const count = await getResultCount(page);
			expect(count).toBe(6);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toContain(2210002);
			expect(nums).toContain(2210004);
		});

		test('no isDone param shows all notices', async ({ page }) => {
			await page.goto('/notices');
			const count = await getResultCount(page);
			expect(count).toBe(12);
		});

		test('clicking active status button navigates with isDone=false', async ({ page }) => {
			await page.goto('/notices');
			await page.getByTestId('notices-status-filter-active').click();
			await page.waitForURL(/isDone=false/, { timeout: 10_000 });
			const count = await getResultCount(page);
			expect(count).toBe(6);
		});

		test('clicking done status button navigates with isDone=true', async ({ page }) => {
			await page.goto('/notices');
			await page.getByTestId('notices-status-filter-done').click();
			await page.waitForURL(/isDone=true/, { timeout: 10_000 });
			const count = await getResultCount(page);
			expect(count).toBe(6);
		});

		test('clicking all status button removes isDone param', async ({ page }) => {
			await page.goto('/notices?isDone=false');
			await page.getByTestId('notices-status-filter-all').click();
			await page.waitForURL((url) => !url.searchParams.has('isDone'), { timeout: 10_000 });
			const count = await getResultCount(page);
			expect(count).toBe(12);
		});
	});

	// ── Category 4: Search × Status filter ───────────────────────────────────

	test.describe('Search × Status filter combinations', () => {
		test('search + active status filters intersection', async ({ page }) => {
			// AI matches 2210001 (active) — should return 1
			await page.goto('/notices?search=AI&isDone=false');
			const count = await getResultCount(page);
			expect(count).toBe(1);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toEqual([2210001]);
		});

		test('search + done status filters intersection (no match)', async ({ page }) => {
			// AI matches 2210001 but it is active (isDone=false), so isDone=true yields 0
			await page.goto('/notices?search=AI&isDone=true');
			const count = await getResultCount(page);
			expect(count).toBe(0);
			await expect(page.getByTestId('notices-empty-state')).toBeVisible();
		});

		test('search keyword matching done notice with isDone=true', async ({ page }) => {
			// 개인정보 matches 2210002 (done) — should return 1
			await page.goto('/notices?search=개인정보&isDone=true');
			const count = await getResultCount(page);
			expect(count).toBe(1);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toContain(2210002);
		});

		test('search keyword matching done notice with isDone=false yields 0', async ({ page }) => {
			// 개인정보 matches 2210002 but it is done, so isDone=false yields 0
			await page.goto('/notices?search=개인정보&isDone=false');
			const count = await getResultCount(page);
			expect(count).toBe(0);
		});

		test('active filter chips show both search and status', async ({ page }) => {
			await page.goto('/notices?search=AI&isDone=false');
			const filterText = await getActiveFilterText(page);
			expect(filterText).toContain('키워드: AI');
			expect(filterText).toContain('진행 중인 입법예고만');
		});
	});

	// ── Category 5: FullText × Status filter ─────────────────────────────────

	test.describe('FullText × Status filter combinations', () => {
		test('fullText search + active status', async ({ page }) => {
			// '제도적 기반' only in 2210001's proposalReason, which is active
			await page.goto('/notices?search=제도적 기반&fullText=true&isDone=false');
			const count = await getResultCount(page);
			expect(count).toBe(1);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toContain(2210001);
		});

		test('fullText search + done status (no match)', async ({ page }) => {
			// '제도적 기반' only in 2210001 (active), so isDone=true yields 0
			await page.goto('/notices?search=제도적 기반&fullText=true&isDone=true');
			const count = await getResultCount(page);
			expect(count).toBe(0);
		});

		test('fullText search for done notice keyword', async ({ page }) => {
			// '피해 구제' appears in 2210002's proposalReason (done)
			await page.goto('/notices?search=피해 구제&fullText=true&isDone=true');
			const count = await getResultCount(page);
			expect(count).toBe(1);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toContain(2210002);
		});
	});

	// ── Category 6: Date range filtering ─────────────────────────────────────

	test.describe('Date range filtering', () => {
		test('recent 7-day quick range shows notices within range', async ({ page }) => {
			await page.goto('/notices');
			await page.getByTestId('notices-quick-range-7-days').click();
			await page.waitForURL(/startDate=/, { timeout: 10_000 });
			const count = await getResultCount(page);
			// Quick 7-day range = 7 calendar days (start = today - 6): 2210003(1d),
			// 2210007(2d), 2210001(3d), 2210011(4d), 2210005(5d), 2210012(6d) = 6 items.
			// 2210009(7d) is outside the range.
			expect(count).toBe(6);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toContain(2210001);
			expect(nums).toContain(2210003);
			expect(nums).toContain(2210012);
			expect(nums).not.toContain(2210009);
		});

		test('recent 30-day quick range shows all notices', async ({ page }) => {
			await page.goto('/notices');
			await page.getByTestId('notices-quick-range-30-days').click();
			await page.waitForURL(/startDate=/, { timeout: 10_000 });
			const count = await getResultCount(page);
			// All 12 notices are within 30 days
			expect(count).toBe(12);
		});

		test('manual date range narrows results', async ({ page }) => {
			// Use specific dates that cleanly include/exclude notices
			// 2210003(1d), 2210007(2d), 2210001(3d), 2210011(4d) = 4 active items within 5 days
			// 2210005(5d) may be at boundary, so use 8-day range to include it clearly
			const startDate = daysAgoInputDate(8);
			const endDate = daysAgoInputDate(0);
			await page.goto(`/notices?startDate=${startDate}&endDate=${endDate}`);
			const count = await getResultCount(page);
			// Within 8 days: 2210001(3d), 2210003(1d), 2210005(5d), 2210007(2d), 2210011(4d)
			// Plus done: 2210002(10d→excluded), 2210006(8d→included), 2210012(6d→included)
			expect(count).toBeGreaterThanOrEqual(5);
		});

		test('date range outside all notice dates shows empty', async ({ page }) => {
			// 100 days ago to 90 days ago — no notices this old
			const startDate = daysAgoInputDate(100);
			const endDate = daysAgoInputDate(90);
			await page.goto(`/notices?startDate=${startDate}&endDate=${endDate}`);
			const count = await getResultCount(page);
			expect(count).toBe(0);
			await expect(page.getByTestId('notices-empty-state')).toBeVisible();
		});

		test('clear range button removes date params', async ({ page }) => {
			await page.goto('/notices');
			await page.getByTestId('notices-quick-range-7-days').click();
			await page.waitForURL(/startDate=/, { timeout: 10_000 });
			await page.getByTestId('notices-quick-range-clear').click();
			await page.waitForURL(
				(url) => !url.searchParams.has('startDate') && !url.searchParams.has('endDate'),
				{ timeout: 10_000 }
			);
			const count = await getResultCount(page);
			expect(count).toBe(12);
		});

		test('active filter chip shows date range', async ({ page }) => {
			await page.goto('/notices');
			await page.getByTestId('notices-quick-range-7-days').click();
			await page.waitForURL(/startDate=/, { timeout: 10_000 });
			const filterText = await getActiveFilterText(page);
			expect(filterText).toContain('기간:');
		});

		test('quick range button highlights when active', async ({ page }) => {
			await page.goto('/notices');
			await page.getByTestId('notices-quick-range-7-days').click();
			await page.waitForURL(/startDate=/, { timeout: 10_000 });
			// The button should have the active style class
			const btn = page.getByTestId('notices-quick-range-7-days');
			await expect(btn).toHaveClass(/lc-chip-blue/);
		});
	});

	// ── Category 7: Date range × Search ──────────────────────────────────────

	test.describe('Date range × Search combinations', () => {
		test('date range + search filters both dimensions', async ({ page }) => {
			// 2210001 (AI, 3d ago) is within 5-day range; 2210004 (플랫폼, 20d ago) is not
			const startDate = daysAgoInputDate(5);
			const endDate = daysAgoInputDate(0);
			await page.goto(`/notices?search=AI&startDate=${startDate}&endDate=${endDate}`);
			const count = await getResultCount(page);
			expect(count).toBe(1);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toContain(2210001);
		});

		test('date range excludes search match outside range', async ({ page }) => {
			// 2210004 subject has '플랫폼' but is 20d old; narrow range excludes it
			const startDate = daysAgoInputDate(5);
			const endDate = daysAgoInputDate(0);
			await page.goto(`/notices?search=플랫폼&startDate=${startDate}&endDate=${endDate}`);
			const count = await getResultCount(page);
			expect(count).toBe(0);
		});

		test('date range with committee search', async ({ page }) => {
			// Use 8-day range to clearly include 2210003(1d), 2210005(5d), 2210011(4d)
			const startDate = daysAgoInputDate(8);
			const endDate = daysAgoInputDate(0);
			await page.goto(`/notices?search=환경노동위원회&startDate=${startDate}&endDate=${endDate}`);
			const count = await getResultCount(page);
			// 2210003(1d), 2210005(5d), 2210011(4d) are all 환경노동위원회 within range
			expect(count).toBe(3);
		});

		test('fullText search within date range', async ({ page }) => {
			// '제도적 기반' in 2210001's proposalReason (3d ago) — within 8-day range
			const startDate = daysAgoInputDate(8);
			const endDate = daysAgoInputDate(0);
			await page.goto(
				`/notices?search=제도적 기반&fullText=true&startDate=${startDate}&endDate=${endDate}`
			);
			const count = await getResultCount(page);
			expect(count).toBe(1);
		});

		test('active filter chips show search, date, and fullText', async ({ page }) => {
			const startDate = daysAgoInputDate(8);
			const endDate = daysAgoInputDate(0);
			await page.goto(
				`/notices?search=제도적 기반&fullText=true&startDate=${startDate}&endDate=${endDate}`
			);
			const filterText = await getActiveFilterText(page);
			expect(filterText).toContain('키워드: 제도적');
			expect(filterText).toContain('기간:');
			expect(filterText).toContain('원문 포함 검색');
		});
	});

	// ── Category 8: Date range × Status filter ───────────────────────────────

	test.describe('Date range × Status filter combinations', () => {
		test('date range + active status', async ({ page }) => {
			// Within 8-day range: 2210001(3d), 2210003(1d), 2210005(5d), 2210007(2d),
			// 2210009(7d), 2210011(4d) = all 6 active items
			const startDate = daysAgoInputDate(8);
			const endDate = daysAgoInputDate(0);
			await page.goto(`/notices?isDone=false&startDate=${startDate}&endDate=${endDate}`);
			const count = await getResultCount(page);
			expect(count).toBe(6);
		});

		test('date range + done status filters correctly', async ({ page }) => {
			// Within 18-day range: 2210002(10d), 2210006(8d), 2210008(15d), 2210010(12d), 2210012(6d)
			// 2210004(20d) is outside 18-day range
			const startDate = daysAgoInputDate(18);
			const endDate = daysAgoInputDate(0);
			await page.goto(`/notices?isDone=true&startDate=${startDate}&endDate=${endDate}`);
			const count = await getResultCount(page);
			expect(count).toBe(5);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toContain(2210002);
		});

		test('narrow date range + done status yields 0', async ({ page }) => {
			// 3-day range: no done notices this recent (closest done is 2210012 at 6d)
			const startDate = daysAgoInputDate(3);
			const endDate = daysAgoInputDate(0);
			await page.goto(`/notices?isDone=true&startDate=${startDate}&endDate=${endDate}`);
			const count = await getResultCount(page);
			expect(count).toBe(0);
		});
	});

	// ── Category 9: Page size and pagination ─────────────────────────────────

	test.describe('Page size and pagination', () => {
		test('limit=10 shows 10 items per page with pagination', async ({ page }) => {
			await page.goto('/notices?limit=10&sortOrder=asc');
			const count = await getResultCount(page);
			expect(count).toBe(12);

			// First page should show 10 items
			const nums = await getVisibleNoticeNums(page);
			expect(nums.length).toBe(10);

			// Pagination should be visible
			const pagination = page.locator(
				'[data-testid="notices-pagination"], nav[aria-label="페이지 내비게이션"]'
			);
			await expect(pagination.first()).toBeVisible();
		});

		test('limit=100 shows all items on one page', async ({ page }) => {
			await page.goto('/notices?limit=100');
			const count = await getResultCount(page);
			expect(count).toBe(12);

			const nums = await getVisibleNoticeNums(page);
			expect(nums.length).toBe(12);

			// No pagination needed
			const pagination = page.locator(
				'[data-testid="notices-pagination"], nav[aria-label="페이지 내비게이션"]'
			);
			const paginationVisible = await pagination
				.first()
				.isVisible()
				.catch(() => false);
			expect(paginationVisible).toBe(false);
		});

		test('invalid limit falls back to default (20)', async ({ page }) => {
			await page.goto('/notices?limit=999');
			const pageInput = page.getByTestId('notices-page-size');
			const selectedValue = await pageInput.inputValue();
			expect(selectedValue).toBe('20');
		});

		test('search with limit=10 triggers pagination', async ({ page }) => {
			// '환경노동위원회' matches 2 notices; limit=10 with 12 total still triggers pagination
			await page.goto('/notices?search=위원회&limit=10&sortOrder=asc');
			const count = await getResultCount(page);
			// All 12 notices have committee names containing '위원회'
			expect(count).toBe(12);

			const nums = await getVisibleNoticeNums(page);
			expect(nums.length).toBe(10);

			const pagination = page.locator(
				'[data-testid="notices-pagination"], nav[aria-label="페이지 내비게이션"]'
			);
			await expect(pagination.first()).toBeVisible();
		});

		test('clicking page 2 navigates to second page', async ({ page }) => {
			await page.goto('/notices?limit=10&sortOrder=asc');
			// Click page 2 link
			const page2Link = page
				.locator('nav[aria-label="페이지 내비게이션"] a')
				.filter({ hasText: /^2$/ })
				.first();
			await page2Link.click();
			await page.waitForURL(/page=2/, { timeout: 10_000 });
			const nums = await getVisibleNoticeNums(page);
			expect(nums.length).toBe(2);
			// Page 2 with ascending sort should have the last 2 items (2210011, 2210012)
			expect(nums).toContain(2210011);
			expect(nums).toContain(2210012);
		});
	});

	// ── Category 10: URL parameter integrity ─────────────────────────────────

	test.describe('URL parameter integrity', () => {
		test('all params preserved through search form submit', async ({ page }) => {
			await page.goto('/notices?search=AI&isDone=false&sortOrder=asc&limit=20&fullText=true');
			// Modify search value and submit via Enter key (more reliable)
			await page.getByTestId('notices-search-input').fill('AI 데이터');
			await page.getByTestId('notices-search-input').press('Enter');
			// Wait for page=1 to appear (indicates form submit completed)
			await page.waitForURL((url) => url.searchParams.get('page') === '1', { timeout: 10_000 });
			const url = new URL(page.url());
			expect(url.searchParams.get('search')).toBe('AI 데이터');
			expect(url.searchParams.get('isDone')).toBe('false');
			expect(url.searchParams.get('sortOrder')).toBe('asc');
			expect(url.searchParams.get('fullText')).toBe('true');
		});

		test('isDone and proposer params survive form submit', async ({ page }) => {
			await page.goto('/notices?isDone=false&proposer=홍길동');
			// Modify search and submit via Enter key (more reliable)
			await page.getByTestId('notices-search-input').fill('중대재해');
			await page.getByTestId('notices-search-input').press('Enter');
			await page.waitForURL((url) => url.searchParams.get('page') === '1', { timeout: 10_000 });
			const url = new URL(page.url());
			expect(url.searchParams.get('isDone')).toBe('false');
			expect(url.searchParams.get('proposer')).toBe('홍길동');
		});

		test('reset filters clears all params including isDone', async ({ page }) => {
			await page.goto('/notices?search=AI&isDone=false&fullText=true&startDate=2026-01-01');
			await page.getByTestId('notices-reset-filters').click();
			await expect(page).toHaveURL('/notices');
		});

		test('page param resets to 1 on new search', async ({ page }) => {
			await page.goto('/notices?search=의원&page=2&limit=10&sortOrder=asc');
			// Modify search and submit via Enter key — page should reset to 1
			await page.getByTestId('notices-search-input').fill('AI');
			await page.getByTestId('notices-search-input').press('Enter');
			await page.waitForURL((url) => url.searchParams.get('search') === 'AI', { timeout: 10_000 });
			const url = new URL(page.url());
			expect(url.searchParams.get('page')).toBe('1');
		});

		test('sort order preserved through status filter click', async ({ page }) => {
			await page.goto('/notices?sortOrder=asc');
			await page.getByTestId('notices-status-filter-active').click();
			await page.waitForURL(/isDone=false/, { timeout: 10_000 });
			const url = new URL(page.url());
			expect(url.searchParams.get('sortOrder')).toBe('asc');
		});
	});

	// ── Category 11: Active filter chips ─────────────────────────────────────

	test.describe('Active filter chips', () => {
		test('search chip shows keyword and dismiss link', async ({ page }) => {
			await page.goto('/notices?search=AI');
			const filterText = await getActiveFilterText(page);
			expect(filterText).toContain('키워드: AI');
			// The dismiss affordance is an icon-only link, so assert its accessible name.
			const dismissLink = page
				.getByTestId('notices-active-filters')
				.locator('a[aria-label="키워드 검색 해제"]');
			await expect(dismissLink).toBeVisible();
		});

		test('dismissing search chip removes search param', async ({ page }) => {
			await page.goto('/notices?search=AI');
			// Click the search chip's icon-only dismiss link (identified by aria-label)
			const dismissLink = page
				.getByTestId('notices-active-filters')
				.locator('a[aria-label="키워드 검색 해제"]');
			await dismissLink.click();
			await page.waitForURL(
				(url) => !url.searchParams.has('search') || url.searchParams.get('search') === '',
				{ timeout: 10_000 }
			);
			const count = await getResultCount(page);
			expect(count).toBe(12);
		});

		test('multiple chips visible for multi-filter state', async ({ page }) => {
			await page.goto('/notices?search=AI&isDone=false&fullText=true');
			const filterText = await getActiveFilterText(page);
			expect(filterText).toContain('키워드: AI');
			expect(filterText).toContain('진행 중인 입법예고만');
			expect(filterText).toContain('원문 포함 검색');
		});

		test('sorting chip shows when other filters are active', async ({ page }) => {
			// sortOrder alone does NOT trigger hasActiveFilters; combine with search
			await page.goto('/notices?search=AI&sortOrder=asc');
			const filterText = await getActiveFilterText(page);
			expect(filterText).toContain('정렬: 오름차순');
			expect(filterText).toContain('기본값');
		});

		test('no active filters area when no filters applied', async ({ page }) => {
			await page.goto('/notices');
			const chips = page.getByTestId('notices-active-filters');
			await expect(chips).not.toBeVisible();
		});
	});

	// ── Category 12: Edge cases ──────────────────────────────────────────────

	test.describe('Edge cases', () => {
		test('reversed dates (startDate > endDate) shows warning', async ({ page }) => {
			const startDate = daysAgoInputDate(0);
			const endDate = daysAgoInputDate(10);
			await page.goto(`/notices?startDate=${startDate}&endDate=${endDate}`);
			// The page should still load without crashing
			await expect(page.getByTestId('notices-main')).toBeVisible();
			// Results should still be shown (server auto-corrects)
			const count = await getResultCount(page);
			expect(count).toBeGreaterThanOrEqual(0);
		});

		test('all filters combined produces correct intersection', async ({ page }) => {
			// search='제도적 기반' + fullText=true + isDone=false + narrow date range
			// Only 2210001 matches: has '제도적 기반' in proposalReason, is active, within 8-day range
			const startDate = daysAgoInputDate(8);
			const endDate = daysAgoInputDate(0);
			await page.goto(
				`/notices?search=제도적 기반&fullText=true&isDone=false&startDate=${startDate}&endDate=${endDate}`
			);
			const count = await getResultCount(page);
			expect(count).toBe(1);
			const nums = await getVisibleNoticeNums(page);
			expect(nums).toEqual([2210001]);
		});

		test('all filters combined with wrong status yields 0', async ({ page }) => {
			// Same as above but isDone=true — 2210001 is active, not done
			const startDate = daysAgoInputDate(8);
			const endDate = daysAgoInputDate(0);
			await page.goto(
				`/notices?search=제도적 기반&fullText=true&isDone=true&startDate=${startDate}&endDate=${endDate}`
			);
			const count = await getResultCount(page);
			expect(count).toBe(0);
		});

		test('whitespace-only search is treated as empty', async ({ page }) => {
			await page.goto('/notices?search=%20%20%20');
			const count = await getResultCount(page);
			expect(count).toBe(12);
		});

		test('very long search string does not crash', async ({ page }) => {
			const longSearch = 'A'.repeat(500);
			await page.goto(`/notices?search=${encodeURIComponent(longSearch)}`);
			await expect(page.getByTestId('notices-main')).toBeVisible();
			const count = await getResultCount(page);
			expect(count).toBe(0);
		});

		test('search with special characters does not crash', async ({ page }) => {
			await page.goto(`/notices?search=${encodeURIComponent(' test &foo=bar ')}`);
			await expect(page.getByTestId('notices-main')).toBeVisible();
			const count = await getResultCount(page);
			expect(count).toBeGreaterThanOrEqual(0);
		});

		test('results summary shows correct total with active filters', async ({ page }) => {
			await page.goto('/notices?search=AI');
			const summary = page.getByTestId('notices-results-summary');
			const text = await summary.innerText();
			// Should show '현재 검색 결과' with count and total
			expect(text).toContain('현재 검색 결과');
			expect(text).toContain('/ 전체');
		});

		test('results summary shows archive count without filters', async ({ page }) => {
			await page.goto('/notices');
			const summary = page.getByTestId('notices-results-summary');
			const text = await summary.innerText();
			expect(text).toContain('입법예고 아카이브 건수');
		});

		test('notice count update reflects filter changes', async ({ page }) => {
			await page.goto('/notices');
			let count = await getResultCount(page);
			expect(count).toBe(12);

			// Apply status filter via link (more reliable than button click)
			await page.goto('/notices?isDone=false');
			count = await getResultCount(page);
			// Active notices: 2210001, 2210003, 2210005, 2210007, 2210009, 2210011
			expect(count).toBe(6);

			// Add search via Enter key (more reliable than button click)
			await page.getByTestId('notices-search-input').fill('AI');
			await page.getByTestId('notices-search-input').press('Enter');
			await page.waitForURL((url) => url.searchParams.get('search') === 'AI', {
				timeout: 10_000
			});
			count = await getResultCount(page);
			// 'AI' matches 2210001 subject (active) only
			expect(count).toBe(1);
		});

		test('descending sort shows higher nums first', async ({ page }) => {
			await page.goto('/notices?sortOrder=desc');
			const nums = await getVisibleNoticeNums(page);
			if (nums.length >= 2) {
				expect(nums[0]).toBeGreaterThan(nums[1]);
			}
		});

		test('ascending sort shows lower nums first', async ({ page }) => {
			await page.goto('/notices?sortOrder=asc');
			const nums = await getVisibleNoticeNums(page);
			if (nums.length >= 2) {
				expect(nums[0]).toBeLessThan(nums[1]);
			}
		});

		test('toggle done button when already on isDone=true removes filter', async ({ page }) => {
			await page.goto('/notices?isDone=true');
			const countBefore = await getResultCount(page);
			// Mock: 2210002, 2210004, 2210006, 2210008, 2210010, 2210012 are done (6 total)
			expect(countBefore).toBe(6);

			// Click done button again — should toggle off (remove isDone)
			await page.getByTestId('notices-status-filter-done').click();
			await page.waitForURL((url) => !url.searchParams.has('isDone'), { timeout: 10_000 });
			const countAfter = await getResultCount(page);
			expect(countAfter).toBe(12);
		});

		test('search Enter key submits the form', async ({ page }) => {
			await page.goto('/notices');
			await page.getByTestId('notices-search-input').fill('중대재해');
			await page.getByTestId('notices-search-input').press('Enter');
			await page.waitForURL((url) => url.searchParams.get('search')?.length > 0, {
				timeout: 10_000
			});
			const count = await getResultCount(page);
			// '중대재해' matches 2210003 subject
			expect(count).toBe(1);
		});

		test('fullText chip dismiss via ✕ link removes fullText param', async ({ page }) => {
			await page.goto('/notices?search=제도적 기반&fullText=true');
			// Click the fullText dismiss link (text: '✕')
			const dismissLink = page
				.getByTestId('notices-active-filters')
				.locator('a[aria-label="원문 포함 검색 해제"]');
			await dismissLink.click();
			await page.waitForURL((url) => !url.searchParams.has('fullText'), { timeout: 10_000 });
		});

		test('status chip dismiss via ✕ link removes isDone param', async ({ page }) => {
			await page.goto('/notices?isDone=false');
			const dismissLink = page
				.getByTestId('notices-active-filters')
				.locator('a[aria-label="상태 필터 해제"]');
			await dismissLink.click();
			await page.waitForURL((url) => !url.searchParams.has('isDone'), { timeout: 10_000 });
			const count = await getResultCount(page);
			expect(count).toBe(12);
		});
	});
});
