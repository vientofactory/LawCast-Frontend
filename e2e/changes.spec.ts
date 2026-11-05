import { test, expect, type Page } from '@playwright/test';

async function submitChangeFilter(
	page: Page,
	key: string,
	value: string,
	update: () => Promise<unknown>
) {
	// Retry the complete GET action if hydration replaced a field before the first submit.
	await expect(async () => {
		if (new URL(page.url()).searchParams.get(key) !== value) {
			await update();
			await page.getByRole('button', { name: '검색', exact: true }).click();
		}
		await expect(page).toHaveURL((url) => url.searchParams.get(key) === value, { timeout: 1000 });
	}).toPass({ timeout: 15_000 });
}

test.describe('Changes Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/notices/changes');
		const settings = page.getByTestId('changes-settings');
		await expect(settings).toHaveAttribute('data-disclosure-enhanced', '');
		await settings.locator('summary').click();
	});

	test('renders the page with title', async ({ page }) => {
		await expect(page).toHaveTitle(/변경 내역.*LawCast|LawCast.*변경 내역/);
	});

	test('displays the main heading', async ({ page }) => {
		const heading = page.locator('h1');
		await expect(heading).toContainText('변경 내역 모아보기');
	});

	test('shows comparable event count', async ({ page }) => {
		const countChip = page.locator('text=확인 가능한 변경 내역');
		await expect(countChip).toBeVisible();
	});

	test('filter form is available', async ({ page }) => {
		const searchInput = page.locator('#changes-search');
		await expect(searchInput).toBeVisible();

		const noticeNumInput = page.locator('#changes-notice-num');
		await expect(noticeNumInput).toBeVisible();

		const eventTypeSelect = page.locator('#changes-event-type');
		await expect(eventTypeSelect).toBeVisible();

		const sortOrderSelect = page.locator('#changes-sort-order');
		await expect(sortOrderSelect).toBeVisible();

		const limitSelect = page.locator('#changes-limit');
		await expect(limitSelect).toBeVisible();
	});

	test('event type filter has correct options', async ({ page }) => {
		const eventTypeSelect = page.locator('#changes-event-type');
		const options = eventTypeSelect.locator('option');
		await expect(options).toHaveCount(3); // Three options: all types, content change, invalidation

		await expect(options.nth(0)).toHaveText('전체 유형');
		await expect(options.nth(1)).toHaveText('내용 변경');
		await expect(options.nth(2)).toHaveText('무효화');
	});

	test('sort order filter has correct options', async ({ page }) => {
		const sortOrderSelect = page.locator('#changes-sort-order');
		const options = sortOrderSelect.locator('option');
		await expect(options).toHaveCount(2);

		await expect(options.nth(0)).toHaveText('최신순');
		await expect(options.nth(1)).toHaveText('오래된순');
	});

	test('include isDone changes checkbox is available', async ({ page }) => {
		const checkbox = page.locator('input[name="includeIsDoneChanges"]');
		await expect(checkbox).toBeVisible();
	});

	test('results region is visible', async ({ page }) => {
		const resultsRegion = page.getByTestId('changes-results-region');
		await expect(resultsRegion).toBeVisible();
	});

	test('search input accepts text', async ({ page }) => {
		const searchInput = page.locator('#changes-search');
		await searchInput.fill('테스트');
		await expect(searchInput).toHaveValue('테스트');
	});

	test('filter form submits and updates URL', async ({ page }) => {
		const searchInput = page.locator('#changes-search');
		await submitChangeFilter(page, 'search', '테스트', () => searchInput.fill('테스트'));
		await expect(searchInput).toHaveValue('테스트');
	});

	test('notice number filter works', async ({ page }) => {
		const noticeNumInput = page.locator('#changes-notice-num');
		await submitChangeFilter(page, 'noticeNum', '123', () => noticeNumInput.fill('123'));
		await expect(noticeNumInput).toHaveValue('123');
	});

	test('event type filter works', async ({ page }) => {
		const eventTypeSelect = page.locator('#changes-event-type');
		await submitChangeFilter(page, 'eventType', 'updated', () =>
			eventTypeSelect.selectOption('updated')
		);
		await expect(eventTypeSelect).toHaveValue('updated');
	});

	test('sort order filter works', async ({ page }) => {
		const sortOrderSelect = page.locator('#changes-sort-order');
		await submitChangeFilter(page, 'sortOrder', 'asc', () => sortOrderSelect.selectOption('asc'));
		await expect(sortOrderSelect).toHaveValue('asc');
	});

	test('isDone checkbox is present and can be unchecked', async ({ page }) => {
		const checkbox = page.locator('input[name="includeIsDoneChanges"]');
		await expect(checkbox).toBeVisible();
		await checkbox.uncheck({ force: true });
		await expect(checkbox).not.toBeChecked();
	});

	test('info banner about legacy genesis boundary is shown', async ({ page }) => {
		const banner = page.locator('text=도입 기준 시점');
		await expect(banner).toBeVisible();
	});

	test('navigation breadcrumb to home is available', async ({ page }) => {
		const homeLink = page.locator('a[href="/"]').first();
		await expect(homeLink).toBeVisible();
	});

	test('navigation breadcrumb to home is available from changes page', async ({ page }) => {
		const homeLink = page.locator('a[href="/"]').first();
		await expect(homeLink).toBeVisible();
	});

	test('changes page shows results or empty state', async ({ page }) => {
		const resultsRegion = page.getByTestId('changes-results-region');
		await expect(resultsRegion).toBeVisible();

		const content = await resultsRegion.textContent();
		// Should either show change items or empty message
		expect(content).toBeTruthy();
	});
});
