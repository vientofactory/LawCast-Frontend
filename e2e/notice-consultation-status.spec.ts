import { test, expect } from '@playwright/test';

test('distinguishes pre-notice bills from opinion collection on detail', async ({ page }) => {
	await page.goto('/notices/2210013');
	await expect(page.getByTestId('notice-detail-consultation-status')).toHaveText('입법예고 전');
	await expect(page.getByTestId('notice-detail-deadline-chip')).toHaveCount(0);
	await expect(page.getByTestId('notice-opinion-submit')).toBeDisabled();
	await page.goto('/notices/2210015');
	await expect(page.getByTestId('notice-detail-consultation-status')).toHaveText('의견수렴 중');
	await expect(page.getByTestId('notice-opinion-submit')).toBeEnabled();
	await page.goto('/notices/2210002');
	await expect(page.getByTestId('notice-detail-consultation-status')).toHaveText('의견수렴 종료');
	await expect(page.getByTestId('notice-opinion-submit')).toBeDisabled();
});

import { getNoticeConsultation } from '../src/lib/utils/notice-consultation';
import { toNoticeCard } from '../src/lib/server/ssr-cards';
import type { Notice } from '../src/lib/types/api';

const target = { contentId: 'PRC_TEST', isDone: false };

for (const [name, input, kind] of [
	[
		'pre-transfer despite a future deadline',
		{ contentId: null, isDone: false, noticePeriod: '2099-01-01 ~ 2099-01-15' },
		'pre_notice'
	],
	[
		'transferred despite a stale source link',
		{ ...target, link: 'https://likms.assembly.go.kr/bill/detail' },
		'open'
	],
	['explicit completion', { ...target, isDone: true }, 'ended'],
	[
		'expired period despite a stale completion marker',
		{ ...target, noticePeriod: '2020-01-01 ~ 2020-01-15' },
		'ended'
	],
	['future start date', { ...target, noticePeriod: '2099-01-01 ~ 2099-01-15' }, 'scheduled'],
	['missing metadata', {}, 'unknown'],
	[
		'deleted archive metadata independently',
		{ ...target, lifecycleStatus: 'source_deleted' },
		'open'
	],
	[
		'renumbered archive metadata independently',
		{ ...target, lifecycleStatus: 'renumbered' },
		'open'
	],
	[
		'legacy PAL source',
		{ isDone: false, link: 'https://pal.assembly.go.kr/napal/view.do?lgsltPaId=PRC_TEST' },
		'open'
	],
	[
		'lookalike source',
		{ isDone: false, link: 'https://pal.assembly.go.kr.example.com/?lgsltPaId=PRC_TEST' },
		'unknown'
	]
] as const) {
	test(`classifies ${name}`, () => {
		expect(getNoticeConsultation(input).kind).toBe(kind);
	});
}

test('preserves transfer evidence in the minimal SSR card', () => {
	for (const contentId of [null, 'PRC_TEST']) {
		const card = toNoticeCard({ contentId, isDone: false } as Notice);
		expect(card.contentId).toBe(contentId);
		expect(getNoticeConsultation(card).kind).toBe(contentId ? 'open' : 'pre_notice');
	}
});

test('shows consistent status on the home and board without relying on color', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('recent-notice-status-2210001')).toHaveText('의견수렴 중');
	await expect(page.getByTestId('recent-notice-status-2210002')).toHaveText('의견수렴 종료');
	await page.goto('/notices');
	await expect(page.getByTestId('notice-consultation-status-2210001')).toHaveText('의견수렴 중');
	await expect(page.getByTestId('notice-consultation-status-2210002')).toHaveText('의견수렴 종료');
	await expect(page.getByTestId('notice-consultation-guide')).toContainText(
		'법률안 처리 완료를 뜻하지 않습니다'
	);
});

for (const theme of ['light', 'dark']) {
	test(`keeps consultation states readable at 320px in ${theme} theme`, async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
		await page.goto('/notices/2210013');
		await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
		await expect(page.getByTestId('notice-detail-consultation-status')).toHaveText('입법예고 전');
		await expect(page.getByTestId('notice-opinion-submit')).toBeDisabled();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await page.screenshot({ path: `/tmp/lawcast-notice-status/${theme}-320.png`, fullPage: true });
	});
}
