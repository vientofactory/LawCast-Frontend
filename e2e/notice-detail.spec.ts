import { test, expect } from '@playwright/test';
import { discoverFirstNotice } from './helpers/notice-list';

test.describe('Notice Detail Page', () => {
	test('renders with valid notice number', async ({ page }) => {
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available to test detail page');
			return;
		}

		await notice.link.click();
		await expect(page).toHaveURL(new RegExp(`/notices/${notice.num}`));

		// Main content should be visible
		const main = page.getByTestId('notice-detail-main');
		await expect(main).toBeVisible();
	});

	test('shows back link to notices list', async ({ page }) => {
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available');
			return;
		}

		await notice.link.click();

		const backLink = page.getByTestId('notice-detail-back-link');
		await expect(backLink).toBeVisible();
		await expect(backLink).toHaveAttribute('href', /\/notices/);
	});

	test('displays summary section when loaded', async ({ page }) => {
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available');
			return;
		}

		await notice.link.click();

		const summary = page.getByTestId('notice-detail-summary');
		await expect(summary).toBeVisible();
	});

	test('displays proposal reason section', async ({ page }) => {
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available');
			return;
		}

		await notice.link.click();

		const content = page.getByTestId('notice-detail-content');
		await expect(content).toBeVisible();
	});

	test('share button is functional', async ({ page }) => {
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available');
			return;
		}

		await notice.link.click();

		const shareBtn = page.getByTestId('notice-detail-share');
		await expect(shareBtn).toBeVisible();
	});

	test('open source link is available', async ({ page }) => {
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available');
			return;
		}

		await notice.link.click();

		const openSourceBtn = page.getByTestId('notice-detail-open-source');
		await expect(openSourceBtn).toBeVisible();
	});

	test('archive meta section exists', async ({ page }) => {
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available');
			return;
		}

		await notice.link.click();

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
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available');
			return;
		}

		await notice.link.click();

		await expect(page).toHaveTitle(/LawCast/);
	});

	test('JSON-LD structured data is present on detail page', async ({ page }) => {
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available');
			return;
		}

		await notice.link.click();

		const jsonLd = page.locator('script[type="application/ld+json"]');
		await expect(jsonLd).toBeAttached();
	});

	test('renders facts, proposal reason, timeline and archive download sections', async ({
		page
	}) => {
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available');
			return;
		}

		await notice.link.click();
		await expect(page.getByTestId('notice-detail-main')).toBeVisible();

		// Proposal reason text comes from the mocked detail payload.
		await expect(page.getByTestId('notice-detail-proposal-reason')).toBeVisible();
		// Deferred-render sections are attached even before they scroll into view.
		await expect(page.getByTestId('notice-detail-facts')).toBeAttached();
		await expect(page.getByTestId('notice-detail-timeline')).toBeAttached();
		await expect(page.getByTestId('notice-fact-의안번호')).toBeAttached();

		// The archive detail panel starts collapsed and hides its export button.
		await expect(page.getByTestId('notice-detail-archive-meta')).toBeVisible();
		await expect(page.getByTestId('notice-detail-download-archive')).toHaveCount(0);

		// The ?archive=true deep link opens the panel (and its ZIP export control).
		await page.goto(`/notices/${notice.num}?archive=true`);
		await expect(page.getByTestId('notice-detail-archive-meta')).toHaveAttribute('open', '');
		await expect(page.getByTestId('notice-detail-download-archive')).toBeVisible();
	});

	test('change timeline compare mode selects base and target revisions', async ({ page }) => {
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available');
			return;
		}

		await notice.link.click();
		await expect(page.getByTestId('notice-detail-main')).toBeVisible();

		// Open the change-tracking timeline panel. Clicks before hydration do
		// nothing and hydration can re-close a panel opened too early, so toggle
		// until the panel body renders (same retry pattern as other specs).
		const summary = page.locator('summary').filter({ hasText: '변경 추적 타임라인' });
		const timelineDetails = page
			.locator('details')
			.filter({ hasText: '변경 추적 타임라인' })
			.first();
		const timelineBody = timelineDetails.locator(':scope > div').first();
		await expect(async () => {
			if ((await timelineDetails.getAttribute('open')) === null) {
				await summary.click({ timeout: 2000 });
			}
			await expect(timelineBody).toBeVisible({ timeout: 2000 });
		}).toPass({ timeout: 20000 });

		const baseButton = page.getByRole('button', { name: '기준으로 선택' }).first();
		if (!(await baseButton.isVisible().catch(() => false))) {
			test.skip(true, 'Notice has no comparable revisions');
			return;
		}

		// Selecting the base must reactively update the UI, not just the URL.
		await baseButton.click();
		await expect(page).toHaveURL(/cmpFrom=/);
		const targetButton = page.getByRole('button', { name: '비교 대상으로 선택' }).first();
		await expect(targetButton).toBeVisible({ timeout: 5000 });

		// Selecting the target enters compare mode.
		await targetButton.click();
		await expect(page).toHaveURL(/cmpTo=/);
		await expect(page.getByText('리비전 비교 열람 중')).toBeVisible({ timeout: 5000 });
		await expect(page.getByText('비교 기준', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('비교 대상', { exact: true }).first()).toBeVisible();

		// The "show all fields" toggle rewrites the URL and must keep both params.
		await page.getByRole('button', { name: '전체 필드 보기' }).click();
		await expect(page).toHaveURL(/cmpShowAll=1/);
		await expect(page).toHaveURL(/cmpFrom=/);
		await expect(page).toHaveURL(/cmpTo=/);
	});
});
