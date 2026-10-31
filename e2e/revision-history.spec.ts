import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { measureContrast } from './helpers/contrast';
import {
	buildRevisionSnapshots,
	compareRevisionSnapshots,
	buildInlineDiffSegments
} from '../src/lib/utils/revision-comparison';
import type { NoticeChangeEventItem } from '../src/lib/types/api';

function event(
	height: number,
	details: Array<[string, string | null, string | null]>
): NoticeChangeEventItem {
	return {
		id: height,
		noticeNum: 1,
		detectedAt: '2026-10-31T12:00:00Z',
		eventType: 'updated',
		source: null,
		eventHeight: height,
		prevEventHash: null,
		eventHash: `hash-${height}`,
		changedFieldCount: details.length,
		hashAlgo: 'sha256',
		canonVersion: 1,
		diffSummary: null,
		details: details.map(([fieldPath, beforeValue, afterValue], id) => ({
			id,
			fieldPath,
			beforeValue,
			afterValue,
			changeType: 'modified',
			beforeHash: null,
			afterHash: null
		}))
	};
}

test('reconstructs earlier values even when the first record omits the field', () => {
	const snapshots = buildRevisionSnapshots([
		event(3, [['proposalReason', '수정본', null]]),
		event(1, [['subject', null, '법률안']]),
		event(2, [['proposalReason', '기존 원문\n둘째 줄', '수정본']])
	]);
	expect(snapshots[1].proposalReason).toBe('기존 원문\n둘째 줄');
	expect(
		compareRevisionSnapshots(snapshots[1], snapshots[2]).find(
			(item) => item.fieldPath === 'proposalReason'
		)?.changeType
	).toBe('modified');
	expect(
		compareRevisionSnapshots(snapshots[2], snapshots[3]).find(
			(item) => item.fieldPath === 'proposalReason'
		)?.changeType
	).toBe('removed');
	expect(compareRevisionSnapshots(snapshots[1], snapshots[2])).toHaveLength(2);
});

test('keeps unchanged text between separate edits and preserves both complete values', () => {
	const before = '기존 문장\n변경 없이 유지되는 구간\n이전 결론';
	const after = '새로운 문장\n변경 없이 유지되는 구간\n새 결론';
	const diff = buildInlineDiffSegments(before, after);
	expect(diff.beforeSegments.map((segment) => segment.text).join('')).toBe(before);
	expect(diff.afterSegments.map((segment) => segment.text).join('')).toBe(after);
	expect(
		diff.beforeSegments
			.filter((segment) => segment.kind === 'context')
			.map((segment) => segment.text)
			.join('')
	).toContain('변경 없이 유지되는 구간');
});

test('keeps supplementary characters intact across highlight boundaries', () => {
	const diff = buildInlineDiffSegments('\u{20000}문장', '\u{20001}문장');
	expect(diff.beforeSegments[0]).toEqual({ text: '\u{20000}', kind: 'removed' });
	expect(diff.afterSegments[0]).toEqual({ text: '\u{20001}', kind: 'added' });
});

test('preserves long text when the bounded diff falls back', () => {
	const before = Array.from({ length: 500 }, (_, i) => `이전${i}`).join('\n');
	const after = Array.from({ length: 500 }, (_, i) => `이후${i}`).join('\n');
	const diff = buildInlineDiffSegments(before, after);
	expect(diff.beforeSegments.map((segment) => segment.text).join('')).toBe(before);
	expect(diff.afterSegments.map((segment) => segment.text).join('')).toBe(after);
});

test.describe('Revision history (mock fixtures)', () => {
	test('opens the selected change directly from the changes list', async ({ page }) => {
		await page.goto('/notices/changes');
		const link = page.getByRole('link', { name: '이 변경 비교', exact: true }).first();
		const href = await link.getAttribute('href');
		const params = new URL(href!, 'https://law.viento.me').searchParams;
		expect(Number(params.get('cmpFrom'))).toBe(Number(params.get('cmpTo')) - 1);
		await link.click();
		await expect(page.getByTestId('revision-comparison')).toBeVisible();
		await expect(page.getByTestId('compare-from-select')).toHaveValue(params.get('cmpFrom')!);
		await expect(page.getByTestId('compare-to-select')).toHaveValue(params.get('cmpTo')!);
	});

	test.skip(process.env.DIFFCHAIN_UI_MOCK !== '1', 'Requires pinned mock revision records.');
	test('opens a shared comparison and lets users change, reverse and clear either selection', async ({
		page
	}) => {
		await page.goto('/notices/2210001?cmpFrom=1&cmpTo=2&search=law&limit=10');
		await expect(page.getByTestId('revision-history')).toHaveAttribute('open', '');
		await expect(page.getByTestId('revision-before-proposalReason')).toHaveText(
			'기존 제안 이유 초안'
		);
		await expect(page.getByTestId('revision-diff-proposalReason')).toContainText('수정됨');
		await expect(page.getByTestId('revision-before-isDone')).toHaveText('입법예고 진행 중');
		await expect(page.getByTestId('revision-after-isDone')).toHaveText('입법예고 종료');
		await expect(page.getByTestId('revision-view-1')).toHaveAttribute('href', /rev=1/);
		await expect(page.getByTestId('revision-view-1')).not.toHaveAttribute('href', /cmpFrom/);
		await expect(
			page.getByTestId('compare-to-select').locator('option[value="1"]')
		).toHaveAttribute('disabled', '');
		await page.getByTestId('compare-from-select').focus();
		await page.getByTestId('compare-from-select').selectOption('3');
		await expect(page).toHaveURL(/cmpFrom=3/);
		await expect(page.getByTestId('compare-from-select')).toBeFocused();
		await expect(page.getByTestId('comparison-reverse')).toBeVisible();
		await page.getByTestId('compare-swap').click();
		await expect(page.getByTestId('compare-from-select')).toHaveValue('2');
		await expect(page.getByTestId('compare-to-select')).toHaveValue('3');
		await expect(page.getByTestId('comparison-reverse')).toHaveCount(0);
		await page.getByTestId('compare-clear').click();
		await expect(page).not.toHaveURL(/cmpFrom|cmpTo|cmpShowAll/);
		await expect(page).toHaveURL(/search=law/);
		await expect(page).toHaveURL(/limit=10/);
		await expect(page.getByTestId('revision-comparison')).toHaveCount(0);
	});

	test('offers one-click comparison and keeps technical metadata folded', async ({ page }) => {
		await page.goto('/notices/2210001?timeline=open');
		await expect(page.getByTestId('compare-latest')).toBeVisible();
		await expect(page.getByTestId('revision-metadata-3')).not.toHaveAttribute('open', '');
		await expect(page.getByTestId('revision-records').locator('li').first()).toHaveAttribute(
			'data-testid',
			'revision-record-3'
		);
		await page.getByTestId('revision-previous-2').click();
		await expect(page.getByTestId('compare-from-select')).toHaveValue('1');
		await expect(page.getByTestId('compare-to-select')).toHaveValue('2');
		await expect(page.getByTestId('revision-diff-summary')).toContainText('바뀐 항목 2개');
		await page.getByTestId('compare-latest').click();
		await expect(page.getByTestId('compare-from-select')).toHaveValue('2');
		await expect(page.getByTestId('compare-to-select')).toHaveValue('3');
		await expect(page.getByTestId('revision-comparison')).toBeVisible();
	});

	for (const query of ['cmpFrom=1&cmpTo=1', 'cmpFrom=999&cmpTo=2', 'cmpFrom=1abc&cmpTo=2']) {
		test(`explains invalid comparison selection: ${query}`, async ({ page }) => {
			await page.goto(`/notices/2210001?${query}`);
			await expect(page.getByTestId('comparison-error')).toBeVisible();
			await expect(page.getByTestId('revision-comparison')).toHaveCount(0);
			await page.getByTestId('compare-latest').click();
			await expect(page.getByTestId('comparison-error')).toHaveCount(0);
			await expect(page.getByTestId('revision-comparison')).toBeVisible();
		});
	}

	test('distinguishes past-record viewing from comparison and returns to the latest record', async ({
		page
	}) => {
		await page.goto('/notices/2210001?rev=1&timeline=open');
		await expect(page.getByTestId('historical-revision-banner')).toContainText('기록 #1');
		await expect(page.getByTestId('revision-view-1')).toHaveAttribute('aria-current', 'page');
		await expect(page.getByTestId('revision-comparison')).toHaveCount(0);
		await page.getByTestId('historical-revision-banner').getByRole('link').click();
		await expect(page).not.toHaveURL(/rev=/);
		await expect(page.getByTestId('historical-revision-banner')).toHaveCount(0);
	});

	for (const [name, width, theme] of [
		['desktop-light', 1280, 'light'],
		['mobile-dark', 390, 'dark']
	] as const) {
		test(`keeps comparison controls readable without horizontal overflow on ${name}`, async ({
			page
		}, testInfo) => {
			await page.setViewportSize({ width, height: 844 });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			await page.goto('/notices/2210001?cmpFrom=1&cmpTo=2');
			await expect(page.getByTestId('revision-comparison')).toBeVisible();
			await expect(page.getByTestId('compare-from-select')).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			await page
				.locator('#change-tracking-timeline')
				.evaluate((element) => element.scrollIntoView({ block: 'start' }));
			await page.getByTestId('revision-history').evaluate(async (element) => {
				await Promise.all(
					element
						.getAnimations({ subtree: true })
						.map((animation) => animation.finished.catch(() => {}))
				);
			});
			await page.screenshot({ path: testInfo.outputPath('comparison.png') });
			const accessibility = await new AxeBuilder({ page })
				.include('[data-testid="revision-history"]')
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
				.analyze();
			expect(accessibility.violations).toEqual([]);
			for (const selector of ['.lc-diff-added', '.lc-diff-removed']) {
				expect(
					(
						await measureContrast(page, {
							selector: `[data-testid="revision-comparison"] ${selector}`
						})
					).ratio
				).toBeGreaterThanOrEqual(4.5);
			}
			await page.getByTestId('compare-show-all').click();
			await expect(page.getByTestId('revision-diff-subject')).not.toHaveAttribute('open', '');
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
		});
	}
});
