import { test, expect } from '@playwright/test';

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
