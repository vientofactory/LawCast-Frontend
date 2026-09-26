import { expect, test } from '@playwright/test';
import { routes, viewports } from './helpers/responsive-contracts';
import {
	expectRouteWithinBounds,
	maxTextNodeLines,
	prepareResponsivePage
} from './helpers/responsive-layout';
import { expectResponsiveNavigation } from './helpers/responsive-navigation';

test.describe('Responsive layouts', () => {
	for (const viewport of viewports) {
		test(`${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
			await prepareResponsivePage(page, viewport);

			for (const route of routes) {
				await page.goto(route.path);
				for (const selector of route.visible) {
					await expect(page.locator(selector), `${route.path}: ${selector}`).toBeVisible();
				}
				for (const { selector, maxLines } of route.text) {
					const targets = page.locator(selector);
					const count = await targets.count();
					expect(count, `${route.path}: expected representative text ${selector}`).toBeGreaterThan(
						0
					);
					for (let index = 0; index < count; index += 1) {
						expect(
							await maxTextNodeLines(targets.nth(index)),
							`${route.path}: text wraps in ${selector} (${index + 1})`
						).toBeLessThanOrEqual(maxLines);
					}
				}
				await expectRouteWithinBounds(page, route.path);
			}

			await expectResponsiveNavigation(page, viewport.width);
		});
	}
});
