import { expect, type Page } from '@playwright/test';
import { maxTextNodeLines } from './responsive-layout';

export async function expectResponsiveNavigation(page: Page, width: number): Promise<void> {
	const mobileMenuButton = page.locator('button[aria-controls="mobile-menu-panel"]');
	if (width < 768) {
		await expect(mobileMenuButton).toBeVisible();
		await expect(page.getByTestId('primary-navigation')).toBeHidden();
		await mobileMenuButton.click();
		const mobileNavigation = page.getByTestId('mobile-navigation');
		await expect(mobileNavigation).toBeVisible();
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
