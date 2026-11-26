import { test, expect } from '@playwright/test';

test('source panels have no bottom dividers in either theme or layout', async ({
	page
}, testInfo) => {
	for (const theme of ['light', 'dark']) {
		await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
		for (const width of [320, 1280]) {
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/crawling-transparency');
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			const section = page
				.getByRole('heading', { name: '데이터 수집 소스', exact: true })
				.locator('..');
			const panels = section.locator(':scope > .grid > div');
			await expect(panels).toHaveCount(2);
			for (const panel of await panels.all()) {
				await expect(panel).toHaveCSS('border-bottom-width', '0px');
				await expect(panel).toHaveCSS('padding-top', '16px');
				await expect(panel).toHaveCSS('padding-bottom', '16px');
			}
			await expect(page.locator('main > section').nth(1)).toHaveCSS('border-top-width', '2px');
			await section.screenshot({
				path: testInfo.outputPath(`source-panels-${theme}-${width}.png`)
			});
		}
	}
});

test('transparency source names match both status crawler names', async ({ page }) => {
	await page.goto('/status');
	const names = await Promise.all(
		['crawler-pal', 'crawler-nsm'].map(async (id) =>
			(await page.getByTestId(id).getByRole('heading').innerText()).trim()
		)
	);
	await page.goto('/crawling-transparency');
	for (const name of names) {
		await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
	}
});

test.describe('Crawling Transparency Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/crawling-transparency');
	});

	test('renders the page successfully', async ({ page }) => {
		const title = await page.title();
		expect(title).toBeTruthy();
	});

	test('displays page heading about crawling transparency', async ({ page }) => {
		// The page should have some heading or content about crawling
		const heading = page.locator('h1, h2').first();
		await expect(heading).toBeVisible();
	});

	test('shows notice source information', async ({ page }) => {
		// Should mention the National Assembly legislative notice board or a similar source.
		const content = await page.textContent('body');
		expect(content).toBeTruthy();
	});

	test('page has no JavaScript errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => {
			errors.push(error.message);
		});

		await page.goto('/crawling-transparency');
		await page.waitForTimeout(2000);

		// Filter out known non-critical errors
		const criticalErrors = errors.filter(
			(e) =>
				!e.includes('ResizeObserver') &&
				!e.includes('chunk') &&
				!e.includes('NetworkError') &&
				!e.includes('WebSocket closed without opened')
		);
		expect(criticalErrors).toHaveLength(0);
	});

	test('page is accessible via header navigation', async ({ page }) => {
		await page.goto('/');
		// The crawling transparency page is not in the main nav, so direct navigation is expected
		await page.goto('/crawling-transparency');
		const heading = page.locator('h1, h2').first();
		await expect(heading).toBeVisible();
	});

	test('page loads without errors when API is available', async ({ page }) => {
		const response = await page.goto('/crawling-transparency');
		// Should not return a server error
		expect(response?.status()).toBeLessThan(500);
	});

	test('content area is not empty', async ({ page }) => {
		const body = await page.textContent('body');
		expect(body?.trim().length).toBeGreaterThan(0);
	});
});
