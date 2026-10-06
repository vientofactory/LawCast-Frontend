import { test, expect, type Page } from '@playwright/test';
import { measureContrast } from './helpers/contrast';

/**
 * Re-measures the P15 contrast failures on real screens (WCAG AA, 4.5:1 for
 * body text). Regression guard for the color-token corrections:
 * - light lc-text-dim (was 2.37:1 on the page background)
 * - light lc-text-muted (was 4.39:1, incl. done-card titles)
 * - dark lc-button-primary label (was 2.99:1)
 */

const STORAGE_KEY = 'lawcast-theme';
const AA_BODY_MIN = 4.5;

async function gotoWithTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
	await page.goto('/notices');
	await page.waitForLoadState('domcontentloaded');
	await page.evaluate(
		({ key, value }) => {
			localStorage.setItem(key, value);
		},
		{ key: STORAGE_KEY, value: theme }
	);
	await page.reload();
	await page.waitForLoadState('domcontentloaded');
}

test.describe('Color contrast (WCAG AA)', () => {
	test('light theme dim and muted tokens clear 4.5:1 on the page background', async ({ page }) => {
		await gotoWithTheme(page, 'light');

		const dim = await measureContrast(page, { fgVar: '--lc-text-dim', bgVar: '--lc-page-bg' });
		expect(dim.ratio, `lc-text-dim: ${dim.fg} vs ${dim.bg}`).toBeGreaterThanOrEqual(AA_BODY_MIN);

		const muted = await measureContrast(page, { fgVar: '--lc-text-muted', bgVar: '--lc-page-bg' });
		expect(muted.ratio, `lc-text-muted: ${muted.fg} vs ${muted.bg}`).toBeGreaterThanOrEqual(
			AA_BODY_MIN
		);
	});

	test('light theme dim text on live controls clears 4.5:1', async ({ page }) => {
		await gotoWithTheme(page, 'light');

		// The search input placeholder renders with the lc-text-dim token.
		const placeholder = await measureContrast(page, {
			selector: '[data-testid="notices-search-input"]',
			pseudoElement: '::placeholder'
		});
		expect(
			placeholder.ratio,
			`placeholder: ${placeholder.fg} vs ${placeholder.bg}`
		).toBeGreaterThanOrEqual(AA_BODY_MIN);
	});

	test('light theme done-card title clears 4.5:1', async ({ page }) => {
		await gotoWithTheme(page, 'light');

		const doneTitle = page.locator('article.lc-notice-card-done h3').first();
		if ((await doneTitle.count()) === 0) {
			test.skip(true, 'No done notices available on this backend');
			return;
		}

		const measurement = await measureContrast(page, {
			selector: 'article.lc-notice-card-done h3'
		});
		expect(
			measurement.ratio,
			`done-card title: ${measurement.fg} vs ${measurement.bg}`
		).toBeGreaterThanOrEqual(AA_BODY_MIN);
	});

	test('dark theme primary button label clears 4.5:1', async ({ page }) => {
		await gotoWithTheme(page, 'dark');

		const button = await measureContrast(page, { selector: 'button.lc-button-primary' });
		expect(button.ratio, `primary button: ${button.fg} vs ${button.bg}`).toBeGreaterThanOrEqual(
			AA_BODY_MIN
		);
	});
});
