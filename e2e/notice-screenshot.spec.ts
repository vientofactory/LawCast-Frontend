import { test, expect, type Page } from '@playwright/test';

test.skip(
	!['1', 'true', 'yes', 'on'].includes((process.env.DIFFCHAIN_UI_MOCK ?? '1').toLowerCase()),
	'Screenshot tests require the mock notice fixture'
);

const screenshotPath = '**/api/notices/2210003/screenshot';
const imageBody = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=',
	'base64'
);

async function openPreview(page: Page) {
	const toggle = page.getByTestId('notice-detail-screenshot-toggle');
	await expect(async () => {
		if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
			await toggle.click();
		}
		await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
	}).toPass();
}

for (const deepLink of [false, true]) {
	test(`keeps screenshot loading visible until the image loads (${deepLink ? 'deep link' : 'click'})`, async ({
		page
	}) => {
		let releaseImage!: () => void;
		const pendingImage = new Promise<void>((resolve) => (releaseImage = resolve));
		await page.route(screenshotPath, async (route) => {
			await pendingImage;
			await route.fulfill({ contentType: 'image/png', body: imageBody });
		});
		await page.goto(`/notices/2210003?archive=true${deepLink ? '&screenshot=true' : ''}`, {
			waitUntil: 'domcontentloaded'
		});
		if (!deepLink) {
			await openPreview(page);
		}
		const loading = page.getByTestId('notice-detail-screenshot-loading');
		const image = page.getByTestId('notice-detail-screenshot-image');
		await expect(loading).toBeVisible();
		await expect(image).toBeHidden();
		await expect(page.getByTestId('notice-detail-screenshot-preview')).toHaveAttribute(
			'aria-busy',
			'true'
		);
		releaseImage();
		await expect(loading).toBeHidden();
		await expect(image).toBeVisible();
		await expect(image).toHaveJSProperty('naturalWidth', 1);
		await expect(page.getByTestId('notice-detail-screenshot-preview')).toHaveAttribute(
			'aria-busy',
			'false'
		);
	});
}

for (const failure of ['http', 'invalid image']) {
	test(`allows screenshot retry after ${failure} failure`, async ({ page }) => {
		let requests = 0;
		await page.route(screenshotPath, async (route) => {
			requests += 1;
			if (requests === 1) {
				await route.fulfill({
					status: failure === 'http' ? 503 : 200,
					contentType: 'image/png',
					body: 'invalid image'
				});
			} else {
				await route.fulfill({ contentType: 'image/png', body: imageBody });
			}
		});
		await page.goto('/notices/2210003?archive=true');
		await openPreview(page);
		await expect(page.getByTestId('notice-detail-screenshot-error')).toBeVisible();
		await expect(page.getByTestId('notice-detail-screenshot-loading')).toBeHidden();
		await page.getByTestId('notice-detail-screenshot-retry').click();
		await expect(page.getByTestId('notice-detail-screenshot-image')).toBeVisible();
		await expect(page.getByTestId('notice-detail-screenshot-error')).toBeHidden();
		expect(requests).toBe(2);
	});
}

test('shows an immediately available screenshot after closing and reopening the preview', async ({
	page
}) => {
	await page.route(screenshotPath, (route) =>
		route.fulfill({ contentType: 'image/png', body: imageBody })
	);
	await page.goto('/notices/2210003?archive=true');
	await openPreview(page);
	await expect(page.getByTestId('notice-detail-screenshot-image')).toBeVisible();
	await page.getByTestId('notice-detail-screenshot-toggle').click();
	await expect(page.getByTestId('notice-detail-screenshot-preview')).toBeHidden();
	await openPreview(page);
	await expect(page.getByTestId('notice-detail-screenshot-image')).toBeVisible();
	await expect(page.getByTestId('notice-detail-screenshot-loading')).toBeHidden();
});
