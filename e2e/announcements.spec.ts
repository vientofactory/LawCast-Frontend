import { test, expect } from '@playwright/test';

/**
 * Contract:
 * - Hero: exactly one notice-title chip (the top-pinned notice) -> click opens the body page
 * - Board list (/announcements): all published notices in display order, each row a detail link
 * - Notice date: row creation time (Notion created_time) rendered as KST YYYY-MM-DD on list + detail
 * - Detail: same design language as the rest of the site (breadcrumb nav + lc-panel card)
 * - SSR payload: global loaders carry ONE notice each (layout = urgent, home = pinned);
 *   the full list is embedded only on the announcements routes.
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
		// Notice date = Notion created_time, shown as KST date with the raw
		// ISO instant preserved on <time datetime>.
		const date = page.getByTestId('admin-notice-date');
		// The detail chip carries the `게시일` label in front of the KST date.
		await expect(date).toHaveText('게시일: 2026-09-01');
		await expect(date).toHaveAttribute('datetime', '2026-09-01T03:00:00.000Z');
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
		// Heading (## -> h2; the notice title owns h1), bold text, unordered
		// list, table and blockquote from the Notion block tree must survive
		// the round trip. The body also contains a toggle block, so scope the
		// bold assertion to the intro paragraph (strict mode: 2 <strong>s).
		await expect(body.locator('h2')).toContainText('개인정보 처리 방침 개정 안내');
		await expect(body.locator('p strong').first()).toContainText('개인정보 처리 방침');
		await expect(body.locator('ul li')).toHaveCount(2);
		await expect(body.locator('table')).toBeVisible();
		await expect(body.locator('table td', { hasText: '2026-10-15' })).toHaveCount(1);
		await expect(body.locator('blockquote')).toContainText('디스코드');

		// No raw markdown syntax may leak into the rendered output.
		await expect(body).not.toContainText('##');
		await expect(body).not.toContainText('| --- |');
	});

	test('renders a Notion toggle as a clickable disclosure', async ({ page }) => {
		test.skip(!MOCK_ENABLED, 'requires the mock fixture');
		await page.goto('/announcements/mock-announcement-2');

		const body = page.getByTestId('admin-notice-body');
		// notion-to-md emits <details>/<summary>; the tags themselves must never
		// show up as literal text.
		await expect(body).not.toContainText('<details>');
		await expect(body).not.toContainText('<summary>');

		const toggle = body.getByTestId('notice-toggle');
		await expect(toggle).toHaveCount(1);
		const summary = toggle.locator('summary');
		await expect(summary).toContainText('개정 상세 보기');

		// Collapsed by default: the toggle body is hidden, then revealed on click.
		const toggleBody = toggle.locator('div p');
		await expect(toggleBody).toBeHidden();
		await summary.click();
		await expect(toggleBody).toBeVisible();
		await expect(toggle.locator('div strong')).toContainText('상세 설명');

		// Clicking again collapses it.
		await summary.click();
		await expect(toggleBody).toBeHidden();
	});

	test('urgent banner sits directly below the header on every page', async ({ page }) => {
		await page.goto('/');
		const banner = page.getByTestId('urgent-notice-banner');

		if (!MOCK_ENABLED) {
			// Real mode: cap 0..1 — a live `긴급` notice may or may not exist.
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

	test('embeds the full list only on announcements routes and keeps urgent notices client-side', async ({
		page
	}) => {
		test.skip(!MOCK_ENABLED, 'requires the mock fixture');

		// Layout SSR no longer waits for or embeds the urgent notice.
		const statusHtml = await (await page.request.get('/status')).text();
		expect(statusHtml).not.toContain('data-testid="urgent-notice-banner"');
		expect(statusHtml).not.toContain(ORDER_ONE_TITLE);
		expect(statusHtml).not.toContain('adminNotices');
		// Notice 2 is not urgent, so a non-announcement page must not ship it.
		expect(statusHtml).not.toContain(ORDER_TWO_TITLE);

		// Home adds the single pinned notice (fixture 1 = top + urgent) but still
		// no second notice.
		const homeHtml = await (await page.request.get('/')).text();
		expect(homeHtml).toContain('pinnedNotice');
		expect(homeHtml).toContain(ORDER_ONE_TITLE);
		expect(homeHtml).not.toContain(ORDER_TWO_TITLE);

		// The announcements board keeps loading the whole list.
		const listHtml = await (await page.request.get('/announcements')).text();
		expect(listHtml).toContain(ORDER_ONE_TITLE);
		expect(listHtml).toContain(ORDER_TWO_TITLE);
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

		// Every row shows its creation date (KST), derived from created_time.
		await expect(page.getByTestId('admin-notices-list-date-mock-announcement-1')).toHaveText(
			'2026-09-01'
		);
		await expect(page.getByTestId('admin-notices-list-date-mock-announcement-2')).toHaveText(
			'2026-10-05'
		);

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

for (const width of [320, 390, 768, 1440]) {
	for (const theme of ['light', 'dark']) {
		test(`uses open announcement rows at ${width}px in ${theme}`, async ({ page }, testInfo) => {
			test.skip(!MOCK_ENABLED, 'requires the mock fixture');
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((theme) => localStorage.setItem('lawcast-theme', theme), theme);
			await page.goto('/announcements');
			const list = page.getByTestId('admin-notices-list');
			const first = page.getByTestId('admin-notices-list-link-mock-announcement-1');
			await expect(first).toBeVisible();
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			await page.evaluate(
				(theme) => document.documentElement.setAttribute('data-theme', theme),
				theme
			);
			await expect(list).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
			await expect(list).toHaveCSS('border-width', '0px');
			await expect(list).toHaveCSS('border-radius', '0px');
			await expect(first).toHaveCSS('border-bottom-width', '1px');
			await expect(first).toHaveCSS('border-inline-start-width', '0px');
			await expect(first).toHaveCSS('padding-inline-start', '0px');
			await expect(first).toHaveCSS('border-radius', '0px');
			await expect(first.locator('h2')).toHaveCSS('font-size', '18px');
			await expect(first.locator('time')).toHaveCSS('font-size', '14px');
			await expect(first.locator('.lc-flat-status')).toHaveCSS(
				'background-color',
				'rgba(0, 0, 0, 0)'
			);
			await expect(first.locator('.lc-flat-status')).toHaveCSS('border-width', '0px');
			await expect(list.locator('a').last()).toHaveCSS('border-bottom-width', '0px');
			const metadata = await first.locator('time').boundingBox();
			const heading = await first.locator('h2').boundingBox();
			expect(metadata!.y + metadata!.height).toBeLessThanOrEqual(heading!.y);
			await page.mouse.move(0, 0);
			await page.screenshot({ path: testInfo.outputPath(`announcements-${width}-${theme}.png`) });
			await page.keyboard.press('Tab');
			await first.focus();
			await expect(first).toHaveCSS('outline-style', 'solid');
			if (width === 320) {
				await first
					.locator('h2')
					.evaluate((node) => (node.textContent = '긴공지제목줄바꿈검증'.repeat(20)));
				await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			await first.click();
			await expect(page.getByTestId('admin-notice-title')).toBeVisible();
			await page.getByTestId('admin-notice-back-link').click();
			await expect(page.getByTestId('admin-notices-list')).toBeVisible();
		});
	}
}
