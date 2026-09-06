import { test, expect } from '@playwright/test';

test.describe('Notice Detail Page', () => {
	test('renders with valid notice number', async ({ page }) => {
		// Navigate from notices list to find a valid notice number
		await page.goto('/notices');
		const resultsList = page.getByTestId('notices-results-list');
		const hasResults = await resultsList.isVisible().catch(() => false);

		if (!hasResults) {
			test.skip(true, 'No notices available to test detail page');
			return;
		}

		// Click first notice detail link
		const firstDetailLink = resultsList.locator('a[data-testid^="notice-detail-link-"]').first();
		const noticeNum = await firstDetailLink.getAttribute('data-testid');
		const num = noticeNum?.replace('notice-detail-link-', '');

		await firstDetailLink.click();
		await expect(page).toHaveURL(new RegExp(`/notices/${num}`));

		// Main content should be visible
		const main = page.getByTestId('notice-detail-main');
		await expect(main).toBeVisible();
	});

	test('shows back link to notices list', async ({ page }) => {
		await page.goto('/notices');
		const resultsList = page.getByTestId('notices-results-list');
		const hasResults = await resultsList.isVisible().catch(() => false);

		if (!hasResults) {
			test.skip(true, 'No notices available');
			return;
		}

		const firstDetailLink = resultsList.locator('a[data-testid^="notice-detail-link-"]').first();
		await firstDetailLink.click();

		const backLink = page.getByTestId('notice-detail-back-link');
		await expect(backLink).toBeVisible();
		await expect(backLink).toHaveAttribute('href', /\/notices/);
	});

	test('displays summary section when loaded', async ({ page }) => {
		await page.goto('/notices');
		const resultsList = page.getByTestId('notices-results-list');
		const hasResults = await resultsList.isVisible().catch(() => false);

		if (!hasResults) {
			test.skip(true, 'No notices available');
			return;
		}

		const firstDetailLink = resultsList.locator('a[data-testid^="notice-detail-link-"]').first();
		await firstDetailLink.click();

		const summary = page.getByTestId('notice-detail-summary');
		await expect(summary).toBeVisible();
	});

	test('displays proposal reason section', async ({ page }) => {
		await page.goto('/notices');
		const resultsList = page.getByTestId('notices-results-list');
		const hasResults = await resultsList.isVisible().catch(() => false);

		if (!hasResults) {
			test.skip(true, 'No notices available');
			return;
		}

		const firstDetailLink = resultsList.locator('a[data-testid^="notice-detail-link-"]').first();
		await firstDetailLink.click();

		const content = page.getByTestId('notice-detail-content');
		await expect(content).toBeVisible();
	});

	test('share button is functional', async ({ page }) => {
		await page.goto('/notices');
		const resultsList = page.getByTestId('notices-results-list');
		const hasResults = await resultsList.isVisible().catch(() => false);

		if (!hasResults) {
			test.skip(true, 'No notices available');
			return;
		}

		const firstDetailLink = resultsList.locator('a[data-testid^="notice-detail-link-"]').first();
		await firstDetailLink.click();

		const shareBtn = page.getByTestId('notice-detail-share');
		await expect(shareBtn).toBeVisible();
	});

	test('open source link is available', async ({ page }) => {
		await page.goto('/notices');
		const resultsList = page.getByTestId('notices-results-list');
		const hasResults = await resultsList.isVisible().catch(() => false);

		if (!hasResults) {
			test.skip(true, 'No notices available');
			return;
		}

		const firstDetailLink = resultsList.locator('a[data-testid^="notice-detail-link-"]').first();
		await firstDetailLink.click();

		const openSourceBtn = page.getByTestId('notice-detail-open-source');
		await expect(openSourceBtn).toBeVisible();
	});

	test('archive meta section exists', async ({ page }) => {
		await page.goto('/notices');
		const resultsList = page.getByTestId('notices-results-list');
		const hasResults = await resultsList.isVisible().catch(() => false);

		if (!hasResults) {
			test.skip(true, 'No notices available');
			return;
		}

		const firstDetailLink = resultsList.locator('a[data-testid^="notice-detail-link-"]').first();
		await firstDetailLink.click();

		const archiveMeta = page.getByTestId('notice-detail-archive-meta');
		await expect(archiveMeta).toBeVisible();
	});

	test('invalid notice number shows error page', async ({ page }) => {
		const response = await page.goto('/notices/not-a-number');
		// The route rejects non-numeric notice identifiers before loading notice data.
		const isErrorPage = await page
			.locator('text=유효하지 않은 법률안 번호입니다.')
			.isVisible()
			.catch(() => false);
		const isServerError = response && response.status() >= 400;
		expect(isErrorPage || isServerError).toBeTruthy();
	});

	test('notice detail page has correct page title format', async ({ page }) => {
		await page.goto('/notices');
		const resultsList = page.getByTestId('notices-results-list');
		const hasResults = await resultsList.isVisible().catch(() => false);

		if (!hasResults) {
			test.skip(true, 'No notices available');
			return;
		}

		const firstDetailLink = resultsList.locator('a[data-testid^="notice-detail-link-"]').first();
		await firstDetailLink.click();

		await expect(page).toHaveTitle(/LawCast/);
	});

	test('JSON-LD structured data is present on detail page', async ({ page }) => {
		await page.goto('/notices');
		const resultsList = page.getByTestId('notices-results-list');
		const hasResults = await resultsList.isVisible().catch(() => false);

		if (!hasResults) {
			test.skip(true, 'No notices available');
			return;
		}

		const firstDetailLink = resultsList.locator('a[data-testid^="notice-detail-link-"]').first();
		await firstDetailLink.click();

		const jsonLd = page.locator('script[type="application/ld+json"]');
		await expect(jsonLd).toBeAttached();
	});
});
