import { expect, type Page } from '@playwright/test';

/** Open the real filter control before exercising controls intentionally disclosed by it. */
export async function openNoticeFilters(page: Page) {
	const dialog = page.getByTestId('notices-filter-dialog');
	await expect(async () => {
		// A routed filter may still be fading out after its URL has already changed.
		if ((await dialog.getAttribute('data-modal-phase')) === 'closing') {
			await expect(dialog).toBeHidden({ timeout: 1500 });
		}
		if (!(await dialog.isVisible())) {
			await page.getByTestId('notices-filter-toggle').click({ timeout: 1500 });
		}
		await expect(dialog).toBeVisible({ timeout: 1000 });
		await expect(dialog).not.toHaveAttribute('data-modal-phase', /.+/, { timeout: 1500 });
		await expect(dialog).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 15_000 });
}

export async function openStatisticsSettings(page: Page) {
	const settings = page.getByTestId('statistics-settings');
	if (!(await settings.getAttribute('open'))) {
		if (await settings.evaluate((element) => (element as HTMLDetailsElement).open)) return;
		await settings.locator('summary').click();
	}
}
