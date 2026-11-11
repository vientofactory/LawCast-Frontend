import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
	buildInlineDiffSegments,
	buildRevisionTextDiff,
	splitRevisionContext
} from '../src/lib/utils/revision-text-diff';
import { REVISION_DIFF_MOCK } from '../src/lib/server/revision-diff-mock';

function reconstruct(diff: ReturnType<typeof buildRevisionTextDiff>, side: 'before' | 'after') {
	return diff.blocks
		.map((block) =>
			block.kind === 'context' ? block.text : side === 'before' ? block.beforeText : block.afterText
		)
		.join('');
}

test('isolates distant edits in long legislative text without highlighting unchanged paragraphs', () => {
	const { before, after } = REVISION_DIFF_MOCK;
	const diff = buildRevisionTextDiff(before, after);
	expect(diff.changeCount).toBe(2);
	expect(diff.coarse).toBe(false);
	expect(reconstruct(diff, 'before')).toBe(before);
	expect(reconstruct(diff, 'after')).toBe(after);
	const changes = diff.blocks.filter((block) => block.kind === 'change');
	expect(changes.every((block) => !block.beforeText.includes('현행 제도'))).toBe(true);
	expect(changes.map((block) => block.afterText).join('')).toContain('소상공인');
});

test('preserves repeated unpunctuated context between distant edits beyond the old matrix limit', () => {
	const middle = '변경 없이 유지되는 동일한 구간 '.repeat(600);
	const before = `기존 대상 ${middle}6개월`;
	const after = `새로운 대상 ${middle}1년`;
	const diff = buildRevisionTextDiff(before, after);
	expect(diff.changeCount).toBe(2);
	expect(diff.coarse).toBe(false);
	expect(reconstruct(diff, 'before')).toBe(before);
	expect(reconstruct(diff, 'after')).toBe(after);
	expect(diff.blocks.some((block) => block.kind === 'context' && block.text.includes(middle))).toBe(
		true
	);
	const inline = buildInlineDiffSegments(before, after);
	expect(
		inline.beforeSegments
			.filter((segment) => segment.kind === 'removed')
			.map((s) => s.text)
			.join('')
	).not.toContain('유지되는');
});

for (const [name, before, after] of [
	['addition', '', '새 문장.\n둘째 문장.'],
	['removal', '삭제 전\r\n원문\t끝', ''],
	['identical content', '첫째 줄\r\n\n둘째 줄  \t', '첫째 줄\r\n\n둘째 줄  \t'],
	['empty content', '', ''],
	['whitespace only', '\t\n  ', '\t\r\n '],
	['supplementary characters', '\u{20000} 문장.\n보존', '\u{20001} 문장.\n보존'],
	['literal markup', '<script>alert(1)</script>\n기존', '<img src=x onerror=alert(2)>\n신규'],
	['reordered paragraphs', '첫 문단.\n둘째 문단.\n셋째 문단.', '셋째 문단.\n첫 문단.\n둘째 문단.']
] as const) {
	test(`reconstructs exact sources for ${name} in both comparison directions`, () => {
		for (const [left, right] of [
			[before, after],
			[after, before]
		]) {
			const diff = buildRevisionTextDiff(left, right);
			expect(reconstruct(diff, 'before')).toBe(left);
			expect(reconstruct(diff, 'after')).toBe(right);
			if (left === right) expect(diff.changeCount).toBe(0);
		}
	});
}

test('bounds wholesale replacement work and discloses a lossless coarse result', () => {
	const before = '가'.repeat(20_000);
	const after = '나'.repeat(20_000);
	const diff = buildRevisionTextDiff(before, after);
	expect(diff.coarse).toBe(true);
	expect(reconstruct(diff, 'before')).toBe(before);
	expect(reconstruct(diff, 'after')).toBe(after);
});

test('keeps code-point context slices lossless at every boundary', () => {
	const text = '\u{20000}\r\n문장 '.repeat(100);
	for (const previous of [true, false]) {
		for (const next of [true, false]) {
			const parts = splitRevisionContext(text, previous, next);
			expect(parts.start + parts.hidden + parts.end).toBe(text);
			expect(Array.from(parts.start).length).toBe(previous ? 40 : 0);
			expect(Array.from(parts.end).length).toBe(next ? 40 : 0);
		}
	}
});

test('preserves exact text through deterministic randomized edits', () => {
	let seed = 34567;
	const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) % 12;
	const alphabet = ['가', '나', ' ', '\n', '\r', '.', '!', '\t', '\u{20000}', '0', '<', '>'];
	for (let run = 0; run < 400; run++) {
		const before = Array.from({ length: 50 }, () => alphabet[random()]).join('');
		const after = Array.from({ length: 50 }, () => alphabet[random()]).join('');
		const diff = buildRevisionTextDiff(before, after);
		expect(reconstruct(diff, 'before')).toBe(before);
		expect(reconstruct(diff, 'after')).toBe(after);
	}
});

test.describe('Compact revision comparison (mock fixtures)', () => {
	test.skip(process.env.DIFFCHAIN_UI_MOCK !== '1', 'Requires pinned mock revision records.');
	for (const [width, theme] of [
		[1280, 'light'],
		[820, 'dark'],
		[390, 'light'],
		[360, 'dark']
	] as const) {
		test(`folds long context and automatically adapts layout at ${width}px in ${theme} mode`, async ({
			page
		}, testInfo) => {
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await page.goto(`/notices/${REVISION_DIFF_MOCK.noticeNum}?cmpFrom=1&cmpTo=2`);
			const field = page.getByTestId('text-diff-proposalReason');
			await expect(field.getByTestId('diff-hunk')).toHaveCount(2);
			expect(await field.getByTestId('revision-before-proposalReason').first().textContent()).toBe(
				'지원 대상을 중소기업으로 정함.'
			);
			expect((await field.boundingBox())!.height).toBeLessThan(780);
			await expect(page.getByTestId('diff-layout-controls')).toHaveCount(0);
			await expect(page.getByRole('button', { name: '변경 모아보기', exact: true })).toHaveCount(0);
			await expect(page.getByRole('button', { name: '나란히 대조', exact: true })).toHaveCount(0);
			await expect(field.getByTestId('diff-fold')).toHaveCount(3);
			await expect(field.getByTestId('diff-hidden-context').first()).not.toBeVisible();
			await expect(page.getByTestId('diff-show-context')).not.toBeChecked();
			await page.getByTestId('diff-show-context').check();
			await expect(page.getByTestId('diff-show-context')).toBeChecked();
			await page.getByTestId('diff-show-context').uncheck();
			await field.getByTestId('diff-fold').first().locator('summary').click();
			await expect(field.getByTestId('diff-hidden-context').first()).toBeVisible();
			await field.getByTestId('diff-fold').first().locator('summary').click();
			await field.getByRole('button', { name: '다음 변경' }).click();
			await expect(field.getByTestId('diff-hunk').nth(1)).toBeFocused();
			await expect(field.getByRole('status')).toHaveText('변경 2 / 2');
			await field.getByRole('button', { name: '이전 변경' }).click();
			await expect(field.getByTestId('diff-hunk').first()).toBeFocused();
			const pair = field.getByTestId('diff-pair').first();
			const columns = await pair.evaluate(
				(element) => getComputedStyle(element).gridTemplateColumns.split(' ').length
			);
			expect(columns).toBe(width >= 1024 ? 2 : 1);
			if (width === 1280) {
				for (const resizedWidth of [390, 1023, 1024, 1280]) {
					await page.setViewportSize({ width: resizedWidth, height: 900 });
					await expect
						.poll(() =>
							pair.evaluate(
								(element) => getComputedStyle(element).gridTemplateColumns.split(' ').length
							)
						)
						.toBe(resizedWidth >= 1024 ? 2 : 1);
					await expect(page.getByTestId('diff-layout-controls')).toHaveCount(0);
				}
			}
			const spacing = await pair.evaluate((element) => {
				const [before, after] = Array.from(element.children);
				const beforePanel = before.getBoundingClientRect();
				const afterPanel = after.getBoundingClientRect();
				const beforeContent = before.querySelector('[data-testid^="revision-before-"]')!;
				const afterContent = after.querySelector('[data-testid^="revision-after-"]')!;
				const range = document.createRange();
				range.selectNodeContents(beforeContent);
				return {
					beforeInset: beforeContent.getBoundingClientRect().left - beforePanel.left,
					afterInset: afterContent.getBoundingClientRect().left - afterPanel.left,
					spaceBeforeDivider: beforePanel.right - range.getBoundingClientRect().right,
					panelGap: afterPanel.top - beforePanel.bottom
				};
			});
			expect(spacing.beforeInset).toBeGreaterThanOrEqual(12);
			if (width >= 1024) {
				expect(spacing.afterInset - spacing.beforeInset).toBe(1);
				expect(spacing.spaceBeforeDivider).toBeLessThan(24);
			} else {
				expect(spacing.afterInset).toBe(spacing.beforeInset);
				expect(spacing.panelGap).toBe(0);
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			await field.screenshot({ path: testInfo.outputPath('compact-comparison.png') });
			const accessibility = await new AxeBuilder({ page })
				.include('[data-testid="revision-comparison"]')
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
				.analyze();
			expect(accessibility.violations).toEqual([]);
			await page.getByTestId('compare-swap').click();
			await expect(field.getByTestId('revision-before-proposalReason').first()).toContainText(
				'소상공인'
			);
			await expect(field.getByRole('status')).toHaveText('변경 1 / 2');
			await page.getByTestId('compare-show-all').click();
			await expect(page.getByTestId('revision-diff-subject')).not.toHaveAttribute('open', '');
			expect(errors).toEqual([]);
		});
	}
});
