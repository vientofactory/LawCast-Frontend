import { test, expect } from '@playwright/test';

/**
 * Contract:
 * - Hero: exactly one notice-title chip (the top-pinned notice) -> click opens the body page
 * - Board list (/announcements): all published notices in display order, each row a detail link
 * - Detail: same design language as the rest of the site (breadcrumb nav + lc-panel card)
 * The two mock fixture notices prove "2 fixtures -> 1 chip / 2 list rows" on both caps.
 * Chip cap owner: src/routes/+page.svelte. Shared list/detail loader: lib/server/announcements.ts.
 */

const MOCK_VALUES = new Set(['1', 'true', 'yes', 'on']);
const MOCK_ENABLED = MOCK_VALUES.has((process.env.DIFFCHAIN_UI_MOCK ?? '').trim().toLowerCase());

const ORDER_ONE_TITLE = 'LawCast 베타 서비스 이용 안내';
const ORDER_TWO_TITLE = '개인정보 처리 방침 안내';

test.describe('Admin notices: hero chip, board list, detail', () => {
	test('renders exactly one notice-title chip inside the hero', async ({ page }) => {
		await page.goto('/');
		const chips = page.getByTestId('home-hero').getByTestId('pinned-notice-chip');

		if (MOCK_ENABLED) {
			await expect(chips).toHaveCount(1);
			// Title text only (no status/body), and the bullhorn icon adds no text.
			await expect(chips).toHaveText(ORDER_ONE_TITLE);
		} else {
			// With or without a live notice the chip cap is 0..1 — 2+ violates the cap.
			expect(await chips.count()).toBeLessThanOrEqual(1);
		}
	});

	test('navigates from the chip to the notice body page', async ({ page }) => {
		test.skip(!MOCK_ENABLED, 'requires the mock fixture');
		await page.goto('/');

		await page.getByTestId('pinned-notice-chip').click();
		await page.waitForURL(/\/announcements\/mock-announcement-1$/);

		await expect(page.getByTestId('admin-notice-title')).toHaveText(ORDER_ONE_TITLE);
		const body = page.getByTestId('admin-notice-content');
		await expect(body).toContainText('변경 사항은 이 공지에서 안내드립니다.');

		// Body newlines are preserved.
		expect(await body.textContent()).toContain('\n');
	});

	test('renders the markdown body with its formatting preserved', async ({ page }) => {
		test.skip(!MOCK_ENABLED, 'requires the mock fixture');
		await page.goto('/announcements/mock-announcement-2');

		const body = page.getByTestId('admin-notice-body');
		await expect(body).toBeVisible();
		// Heading (## -> h3; the notice title owns h1), bold text, unordered
		// list, table and blockquote from the Notion block tree must survive
		// the round trip.
		await expect(body.locator('h3')).toContainText('개인정보 처리 방침 개정 안내');
		await expect(body.locator('strong')).toContainText('개인정보 처리 방침');
		await expect(body.locator('ul li')).toHaveCount(2);
		await expect(body.locator('table')).toBeVisible();
		await expect(body.locator('table td', { hasText: '2026-10-15' })).toHaveCount(1);
		await expect(body.locator('blockquote')).toContainText('디스코드');

		// No raw markdown syntax may leak into the rendered output.
		await expect(body).not.toContainText('##');
		await expect(body).not.toContainText('| --- |');
	});

	test('urgent banner sits directly below the header on every page', async ({ page }) => {
		await page.goto('/');
		const banner = page.getByTestId('urgent-notice-banner');

		if (!MOCK_ENABLED) {
			// Real mode: cap 0..1 — a live 긴급 notice may or may not exist.
			expect(await banner.count()).toBeLessThanOrEqual(1);
			return;
		}

		await expect(banner).toHaveCount(1);
		await expect(banner).toContainText(ORDER_ONE_TITLE);

		// The banner renders immediately after the sticky top navigation.
		const headerBox = await page.getByTestId('site-header').boundingBox();
		const bannerBox = await banner.boundingBox();
		expect(headerBox).not.toBeNull();
		expect(bannerBox).not.toBeNull();
		if (!headerBox || !bannerBox) return;
		expect(bannerBox.y).toBeGreaterThanOrEqual(headerBox.y);
		expect(bannerBox.y - (headerBox.y + headerBox.height)).toBeLessThanOrEqual(24);

		// Site-wide: it persists on other pages, not just the home hero.
		await page.goto('/announcements');
		await expect(page.getByTestId('urgent-notice-banner')).toHaveCount(1);

		// Clicking the banner opens the notice body page.
		await page.getByTestId('urgent-notice-link').click();
		await page.waitForURL(/\/announcements\/mock-announcement-1$/);
		await expect(page.getByTestId('admin-notice-title')).toHaveText(ORDER_ONE_TITLE);
	});

	test('board list shows published notices in order and links to the detail', async ({ page }) => {
		test.skip(!MOCK_ENABLED, 'requires the mock fixture');
		await page.goto('/announcements');

		const list = page.getByTestId('admin-notices-list');
		await expect(list).toHaveCount(1);
		await expect(page.getByRole('heading', { level: 1, name: '공지사항' })).toBeVisible();

		// Display order: first -> second.
		const links = list.locator('a');
		await expect(links).toHaveCount(2);
		await expect(links.nth(0)).toContainText(ORDER_ONE_TITLE);
		await expect(links.nth(1)).toContainText(ORDER_TWO_TITLE);

		// Row click -> detail, which shares the site's breadcrumb design.
		await links.nth(0).click();
		await page.waitForURL(/\/announcements\/mock-announcement-1$/);
		await expect(page.getByTestId('admin-notice-title')).toHaveText(ORDER_ONE_TITLE);
		await expect(page.locator('nav[aria-label="이동 경로"]')).toHaveCount(1);
		await expect(page.getByTestId('admin-notice-back-link')).toHaveAttribute(
			'href',
			'/announcements'
		);
	});
});
