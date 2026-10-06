import { test, expect } from '@playwright/test';
import { discoverFirstNotice } from './helpers/notice-list';
import { buildOpinionSubmissionUrl } from '../src/lib/utils/opinion-submission-url.util';

// Mock fixtures for notice 2210003 (see diffchain-ui-mock.ts).
const MOCK_VIEW_URL =
	'https://pal.assembly.go.kr/napal/lgsltpa/lgsltpaOngoing/view.do?lgsltPaId=PRC_MOCK2210003';
const MOCK_OPINION_URL =
	'https://pal.assembly.go.kr/napal/lgsltpa/lgsltpaOpn/list.do?lgsltPaId=PRC_MOCK2210003';

const mockEnabled = ['1', 'true', 'yes', 'on'].includes(
	(process.env.DIFFCHAIN_UI_MOCK ?? '').trim().toLowerCase()
);

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

	test('detail page references a rendered OG image', async ({ page, request }) => {
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available');
			return;
		}

		await notice.link.click();

		const ogImage = page.locator('meta[property="og:image"]');
		await expect(ogImage).toHaveCount(1);
		const imageUrl = (await ogImage.getAttribute('content')) ?? '';
		expect(imageUrl).toMatch(/\/notices\/\d+\/og\.png$/);

		// The referenced endpoint must answer with a real PNG for this bill.
		const response = await request.get(imageUrl);
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toBe('image/png');
		const bytes = await response.body();
		expect(bytes.subarray(0, 8)).toEqual(
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
		);
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

	test('detail page exposes the opinion submission entry with period guidance', async ({
		page
	}) => {
		const notice = await discoverFirstNotice(page);
		if (!notice) {
			test.skip(true, 'No notices available');
			return;
		}

		await notice.link.click();

		// The opinion-submission entry renders regardless of the notice's state.
		await expect(page.getByTestId('notice-opinion-cta')).toBeVisible();
		await expect(page.getByTestId('notice-opinion-submit')).toBeVisible();
		await expect(page.getByTestId('notice-opinion-guidance')).toContainText('의견 제출 가능 기간');

		// The opinion CTA owns the single primary emphasis while the row's
		// source opener stays a neutral utility for the raw notice link.
		await expect(page.getByTestId('notice-opinion-submit')).toHaveClass(/lc-button-primary/);
		const openSourceBtn = page.getByTestId('notice-detail-open-source');
		await expect(openSourceBtn).toHaveClass(/lc-button-neutral/);
		await expect(openSourceBtn).not.toHaveClass(/lc-button-primary/);
	});
});

test.describe('Opinion submission CTA and deadline chip (mock fixtures)', () => {
	test.skip(!mockEnabled, 'Pinned to mock notice numbers; requires DIFFCHAIN_UI_MOCK=1.');

	test('active notice shows the opinion CTA, period guidance and D-day chip', async ({ page }) => {
		// Mock 2210003 is ongoing with a notice period ending in three KST days.
		await page.goto('/notices/2210003');
		await expect(page.getByTestId('notice-detail-main')).toBeVisible();

		const submit = page.getByTestId('notice-opinion-submit');
		await expect(submit).toBeEnabled();
		await expect(submit).toContainText('의견 제출하기');
		// Copy no longer echoes the row's "국회 페이지 열기" label.
		await expect(submit).not.toContainText('국회 페이지');

		const guidance = page.getByTestId('notice-opinion-guidance');
		await expect(guidance).toContainText('의견 제출 가능 기간');
		await expect(guidance).toContainText('누구나 국회 홈페이지에서 의견을 제출할 수 있습니다');

		// Deadline chip and the notice-period fact agree on the parsed end date.
		await expect(page.getByTestId('notice-detail-deadline-chip')).toHaveText('마감 D-3');
		await expect(page.getByTestId('notice-fact-입법예고기간')).toContainText('마감 (D-3)');
	});

	test('clicking the opinion CTA opens the National Assembly page', async ({ page }) => {
		await page.goto('/notices/2210003');
		await expect(page.getByTestId('notice-opinion-submit')).toBeVisible();

		// Capture window.open instead of navigating to the external page.
		await page.evaluate(() => {
			const target = window as unknown as { __openedUrls?: string[]; open: unknown };
			target.__openedUrls = [];
			target.open = (url: string) => {
				target.__openedUrls?.push(url);
				return null;
			};
		});
		// Clicking before hydration completes silently does nothing, so retry the
		// click until the handler actually runs (same pattern as discussions.spec).
		await expect(async () => {
			await page.getByTestId('notice-opinion-submit').click();
			const opened = await page.evaluate(
				() => (window as unknown as { __openedUrls?: string[] }).__openedUrls ?? []
			);
			// The CTA is rewritten to the opinion-submission page, keeping the id.
			expect(opened).toContain(MOCK_OPINION_URL);
			// It must not open the raw view page anymore.
			expect(opened).not.toContain(MOCK_VIEW_URL);
		}).toPass({ timeout: 15_000 });
	});

	test('the row source opener still opens the raw assembly view page', async ({ page }) => {
		await page.goto('/notices/2210003');
		await expect(page.getByTestId('notice-detail-open-source')).toBeVisible();

		await page.evaluate(() => {
			const target = window as unknown as { __openedUrls?: string[]; open: unknown };
			target.__openedUrls = [];
			target.open = (url: string) => {
				target.__openedUrls?.push(url);
				return null;
			};
		});
		// Only the opinion CTA is rewritten; the source opener keeps notice.link.
		await expect(async () => {
			await page.getByTestId('notice-detail-open-source').click();
			const opened = await page.evaluate(
				() => (window as unknown as { __openedUrls?: string[] }).__openedUrls ?? []
			);
			expect(opened).toContain(MOCK_VIEW_URL);
			expect(opened).not.toContain(MOCK_OPINION_URL);
		}).toPass({ timeout: 15_000 });
	});

	test.describe('buildOpinionSubmissionUrl utility', () => {
		// Pure-function coverage for paths no mock fixture exercises (foreign
		// domains, malformed input). Frontend has no unit runner, so these
		// assertions live in Playwright, which transpiles the TS source directly.

		test('rewrites pal.assembly.go.kr links to the opinion-submission page', () => {
			expect(buildOpinionSubmissionUrl(MOCK_VIEW_URL)).toBe(MOCK_OPINION_URL);
			expect(
				buildOpinionSubmissionUrl(
					'https://pal.assembly.go.kr/napal/lgsltpa/lgsltpaOngoing/view.do?lgsltPaId=PRC_XYZ'
				)
			).toBe('https://pal.assembly.go.kr/napal/lgsltpa/lgsltpaOpn/list.do?lgsltPaId=PRC_XYZ');
		});

		test('keeps non-assembly domains unchanged', () => {
			expect(buildOpinionSubmissionUrl('https://example.com/lawcast/mock/2210003')).toBe(
				'https://example.com/lawcast/mock/2210003'
			);
			// Suffix lookalikes must never match the exact-host guard.
			expect(
				buildOpinionSubmissionUrl(
					'https://pal.assembly.go.kr.evil.example/napal/x?lgsltPaId=PRC_XYZ'
				)
			).toBe('https://pal.assembly.go.kr.evil.example/napal/x?lgsltPaId=PRC_XYZ');
		});

		test('keeps assembly links without an lgsltPaId unchanged', () => {
			const noId = 'https://pal.assembly.go.kr/napal/lgsltpa/lgsltpaOngoing/view.do';
			expect(buildOpinionSubmissionUrl(noId)).toBe(noId);
			const emptyId = 'https://pal.assembly.go.kr/napal/x.do?lgsltPaId=';
			expect(buildOpinionSubmissionUrl(emptyId)).toBe(emptyId);
		});

		test('handles empty and unparseable input', () => {
			expect(buildOpinionSubmissionUrl(null)).toBe('');
			expect(buildOpinionSubmissionUrl(undefined)).toBe('');
			expect(buildOpinionSubmissionUrl('')).toBe('');
			expect(buildOpinionSubmissionUrl('not a url')).toBe('not a url');
		});
	});

	test('ended notice disables the CTA and shows the ended deadline chip', async ({ page }) => {
		// Mock 2210002 is done with a notice period that ended on 2026-06-28.
		await page.goto('/notices/2210002');
		await expect(page.getByTestId('notice-detail-main')).toBeVisible();

		const submit = page.getByTestId('notice-opinion-submit');
		await expect(submit).toBeDisabled();
		await expect(submit).toContainText('의견 제출 기간이 종료되었습니다');
		await expect(page.getByTestId('notice-opinion-guidance')).toContainText(
			'종료되어 더 이상 의견을 제출할 수 없습니다'
		);
		await expect(page.getByTestId('notice-detail-deadline-chip')).toHaveText('종료(2026-06-28)');
	});
});
