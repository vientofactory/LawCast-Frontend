import { expect, type Page } from '@playwright/test';
import { maxTextNodeLines } from './responsive-layout';

export async function expectResponsiveNavigation(page: Page, width: number): Promise<void> {
	const mobileMenuButton = page.locator('button[aria-controls="mobile-menu-panel"]');
	if (width < 768) {
		await expect(mobileMenuButton).toBeVisible();
		await expect(page.getByTestId('primary-navigation')).toBeHidden();
		const mobileNavigation = page.getByTestId('mobile-navigation');
		// A click before hydration silently does nothing (the panel state lives in
		// client JS), and the preceding page.goto may still be hydrating on a cold
		// dev server — retry the toggle until the panel actually opens.
		await expect(async () => {
			if (await mobileNavigation.isVisible().catch(() => false)) {
				return;
			}
			await mobileMenuButton.click({ timeout: 2000 });
			await expect(mobileNavigation).toBeVisible({ timeout: 1500 });
		}).toPass({ timeout: 20000 });
		await expect(mobileNavigation).toBeInViewport();
		for (const label of await mobileNavigation.locator('a > span:last-child').all()) {
			expect(await maxTextNodeLines(label), 'mobile navigation label wraps').toBeLessThanOrEqual(1);
		}
		return;
	}

	await expect(mobileMenuButton).toBeHidden();
	const desktopNavigation = page.getByTestId('primary-navigation');
	await expect(desktopNavigation).toBeVisible();
	if (width >= 1024) {
		for (const label of await desktopNavigation.locator('a > span:last-child').all()) {
			expect(await maxTextNodeLines(label), 'desktop navigation label wraps').toBeLessThanOrEqual(
				1
			);
		}
	}
}
