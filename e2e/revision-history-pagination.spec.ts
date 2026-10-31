import { test, expect } from '@playwright/test';
import { mergeRevisionHistory, validateOlderRevisionPage } from '../src/lib/utils/revision-history';
import type { NoticeChangeTimelineResponse } from '../src/lib/types/api';

test.describe('Progressive revision history (mock fixtures)', () => {
	test.skip(process.env.DIFFCHAIN_UI_MOCK !== '1', 'Requires the 125-record mock notice.');

	test('discovers the manual fixture in the list and shows skeletons without response interception', async ({
		page
	}) => {
		await page.goto('/notices?search=국가재정&searchMode=keyword');
		const link = page.getByTestId('notice-detail-link-2210010');
		await expect(link).toContainText('변경 기록 125개·점진 로딩 테스트');
		await link.click();
		await expect(page.locator('main h1')).toContainText('변경 기록 125개·점진 로딩 테스트');
		const history = page.getByTestId('revision-history');
		await expect(async () => {
			if ((await history.getAttribute('open')) === null)
				await page.getByTestId('revision-history-toggle').click();
			await expect(page.getByTestId('compare-from-select')).toBeVisible({ timeout: 1000 });
		}).toPass();
		await history.evaluate(async (element) => {
			await Promise.all(
				element
					.getAnimations({ subtree: true })
					.map((animation) => animation.finished.catch(() => {}))
			);
		});
		await page.getByTestId('revision-history-load-older').scrollIntoViewIfNeeded();
		await expect(page.getByTestId('revision-history-skeleton')).toBeAttached();
		await expect(page.getByTestId('revision-records').locator(':scope > li')).toHaveCount(20);
		await expect(page.getByTestId('revision-records').locator(':scope > li')).toHaveCount(40);
		await expect(page.getByTestId('revision-history-skeleton')).toHaveCount(0);
	});

	test('appends skeleton-backed pages beyond 100 records and compares across page boundaries', async ({
		page
	}, testInfo) => {
		test.setTimeout(60000);
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let requests = 0;
		await page.route('**/api/notices/2210010/changes?**', async (route) => {
			requests++;
			await gate;
			await route.continue();
		});
		await page.goto('/notices/2210010?timeline=open&cmpFrom=110&cmpTo=120');
		const records = page.getByTestId('revision-records').locator(':scope > li');
		await expect(records).toHaveCount(20);
		await page.getByTestId('revision-history-load-older').scrollIntoViewIfNeeded();
		await expect(page.getByTestId('revision-history-skeleton')).toBeVisible();
		await expect(page.getByTestId('revision-history-loading-status')).toHaveText(
			'이전 변경 기록을 불러오는 중입니다.'
		);
		await page
			.getByTestId('revision-history-skeleton')
			.screenshot({ path: testInfo.outputPath('history-skeleton.png') });
		await expect(records).toHaveCount(20);
		await expect(page.getByTestId('revision-history-load-older')).toBeDisabled();
		await expect(page.getByTestId('compare-from-select')).toHaveValue('110');
		await page.getByTestId('revision-history-load-older-top').scrollIntoViewIfNeeded();
		expect(requests).toBe(1);
		release();
		await expect(records).toHaveCount(40);
		await expect(page.getByTestId('revision-history-skeleton')).toHaveCount(0);
		await page.getByTestId('compare-from-select').selectOption('90');
		await expect(page.getByTestId('revision-before-proposalReason')).toHaveText(
			'기록 90의 제안이유\n줄바꿈을 보존합니다.'
		);
		await expect(page.getByTestId('revision-after-proposalReason')).toHaveText(
			'기록 120의 제안이유\n줄바꿈을 보존합니다.'
		);
		await page.getByTestId('revision-view-90').click();
		await expect(page.getByTestId('historical-revision-banner')).toBeVisible();
		await expect(records).toHaveCount(40);
		for (const count of [60, 80, 100, 120, 125]) {
			await page.getByTestId('revision-history-load-older-top').click();
			await expect(records).toHaveCount(count);
		}
		await expect(page.getByTestId('revision-history-complete')).toContainText(
			'125개를 모두 불러왔습니다.'
		);
		await expect(page.getByTestId('revision-history-load-older')).toHaveCount(0);
		const heights = await records.evaluateAll((items) =>
			items.map((item) => Number(item.getAttribute('data-testid')!.replace('revision-record-', '')))
		);
		expect(heights).toEqual(Array.from({ length: 125 }, (_, i) => 125 - i));
		await page.getByTestId('compare-from-select').selectOption('1');
		await page.getByTestId('compare-to-select').selectOption('125');
		await expect(page.getByTestId('revision-before-proposalReason')).toHaveText(
			'기록 1의 제안이유\n줄바꿈을 보존합니다.'
		);
		await expect(page.getByTestId('revision-after-proposalReason')).toHaveText(
			'기록 125의 제안이유\n줄바꿈을 보존합니다.'
		);
	});

	test('retains existing records and comparison state after an error and retries only on demand', async ({
		page
	}) => {
		let requests = 0;
		await page.route('**/api/notices/2210010/changes?**', async (route) => {
			requests++;
			if (requests === 1)
				await route.fulfill({
					status: 503,
					contentType: 'application/json',
					body: JSON.stringify({ success: false, message: '일시적인 오류' })
				});
			else await route.continue();
		});
		await page.goto('/notices/2210010?timeline=open&cmpFrom=110&cmpTo=120');
		await page.getByTestId('revision-history-load-older-top').click();
		await expect(page.getByTestId('revision-history-more-error')).toBeAttached();
		await expect(page.getByTestId('revision-records').locator(':scope > li')).toHaveCount(20);
		await expect(page.getByTestId('compare-from-select')).toHaveValue('110');
		await page.getByTestId('revision-history-load-older').scrollIntoViewIfNeeded();
		await expect(page.getByTestId('revision-history-more-error')).toBeVisible();
		expect(requests).toBe(1);
		await page.getByTestId('revision-history-load-older').click();
		await expect(page.getByTestId('revision-records').locator(':scope > li')).toHaveCount(40);
		await expect(page.getByTestId('revision-history-more-error')).toHaveCount(0);
		expect(requests).toBe(2);
	});

	test('does not attach a delayed page to a different notice after navigation', async ({
		page
	}) => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route('**/api/notices/2210010/changes?**', async (route) => {
			await gate;
			await route.continue().catch(() => {});
		});
		await page.goto('/notices/2210010?timeline=open');
		await page.getByTestId('revision-history-load-older-top').click();
		await expect(page.getByTestId('revision-history-skeleton')).toBeAttached();
		await page.goto('/notices/2210001?timeline=open');
		release();
		await expect(page.getByTestId('revision-records').locator(':scope > li')).toHaveCount(3);
		await expect(page.getByTestId('revision-history-complete')).toContainText(
			'3개를 모두 불러왔습니다.'
		);
		await expect(page.getByTestId('revision-history-skeleton')).toHaveCount(0);
	});

	test('shows mobile dark skeletons without pulsing when reduced motion is requested', async ({
		page
	}, testInfo) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route('**/api/notices/2210010/changes?**', async (route) => {
			await gate;
			await route.continue().catch(() => {});
		});
		try {
			await page.goto('/notices/2210010?timeline=open');
			await page.getByTestId('revision-history').evaluate(async (element) => {
				await Promise.all(
					element
						.getAnimations({ subtree: true })
						.map((animation) => animation.finished.catch(() => {}))
				);
			});
			await page.getByTestId('revision-history-load-older-top').click();
			const skeleton = page.getByTestId('revision-history-skeleton');
			await expect(skeleton).toBeAttached();
			expect(
				await skeleton
					.locator(':scope > div')
					.first()
					.evaluate((element) => getComputedStyle(element).animationName)
			).toBe('none');
			await skeleton.scrollIntoViewIfNeeded();
			await expect(skeleton).toBeVisible();
			await skeleton.screenshot({ path: testInfo.outputPath('history-skeleton-mobile.png') });
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
		} finally {
			release();
		}
		await expect(page.getByTestId('revision-records').locator(':scope > li')).toHaveCount(40);
	});

	test('resolves a comparison link to an unloaded record once its page is loaded', async ({
		page
	}) => {
		await page.goto('/notices/2210010?cmpFrom=90&cmpTo=125');
		await expect(page.getByTestId('comparison-error')).toContainText('아직 불러오지 않았습니다');
		await page.getByTestId('revision-history-load-older-top').click();
		await expect(page.getByTestId('comparison-error')).toHaveCount(0);
		await expect(page.getByTestId('revision-comparison')).toBeVisible();
		await expect(page.getByTestId('compare-from-select')).toHaveValue('90');
	});
});

test('rejects nonadvancing and cross-notice pages rather than silently looping', () => {
	const item = {
		id: 1,
		noticeNum: 2210010,
		eventHeight: 106
	} as NoticeChangeTimelineResponse['items'][number];
	const page = {
		noticeNum: 2210010,
		items: [item],
		count: 1,
		hasMore: true,
		nextBeforeHeight: 106
	};
	expect(() => validateOlderRevisionPage(page, 2210010, 106)).toThrow();
	expect(() => validateOlderRevisionPage({ ...page, noticeNum: 2210001 }, 2210010, 126)).toThrow();
	expect(() => validateOlderRevisionPage({ ...page, items: [], count: 0 }, 2210010, 126)).toThrow();
	expect(mergeRevisionHistory([item], [{ ...item }])).toHaveLength(1);
});
