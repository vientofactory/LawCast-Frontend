import type { Locator, Page } from '@playwright/test';

/**
 * Opens the live notices list and returns the first notice's number and link.
 * The archive differs per dev server (mock fixtures vs. real backend), so the
 * id is discovered rather than pinned. Null when the archive is empty.
 */
export async function discoverFirstNotice(
	page: Page
): Promise<{ num: string; link: Locator } | null> {
	await page.goto('/notices');
	const list = page.getByTestId('notices-results-list');
	if (!(await list.isVisible().catch(() => false))) return null;

	const link = list.locator('a[data-testid^="notice-detail-link-"]').first();
	const testId = (await link.getAttribute('data-testid')) ?? '';
	return testId ? { num: testId.replace('notice-detail-link-', ''), link } : null;
}
