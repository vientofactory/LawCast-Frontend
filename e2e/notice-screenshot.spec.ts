import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

test.skip(
	!['1', 'true', 'yes', 'on'].includes((process.env.DIFFCHAIN_UI_MOCK ?? '1').toLowerCase()),
	'Screenshot tests require the mock notice fixture'
);

const screenshotPath = /\/api\/notices\/2210003\/screenshot(?:\?.*)?$/;
const imageBody = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=',
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
		await expect(page.getByTestId('screenshot-original')).toBeDisabled();
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
		const retryRequest = page.waitForRequest((request) =>
			request.url().includes('/screenshot?retry=1')
		);
		await page.getByTestId('notice-detail-screenshot-retry').click();
		await retryRequest;
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
	await page.getByTestId('notice-screenshot-modal').getByTestId('modal-close').click();
	await expect(page.getByTestId('notice-detail-screenshot-preview')).toBeHidden();
	await openPreview(page);
	await expect(page.getByTestId('notice-detail-screenshot-image')).toBeVisible();
	await expect(page.getByTestId('notice-detail-screenshot-loading')).toBeHidden();
});

test('opens the archive screenshot in a separate shared dialog', async ({ page }) => {
	await page.route(screenshotPath, (route) =>
		route.fulfill({ contentType: 'image/png', body: imageBody })
	);
	await page.goto('/notices/2210003?archive=true');
	await openPreview(page);
	const dialog = page.getByRole('dialog', { name: '국회 페이지 미리보기', exact: true });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByTestId('notice-detail-screenshot-image')).toBeVisible();
	await expect(
		page.getByTestId('notice-detail-archive-meta').getByTestId('notice-detail-screenshot-preview')
	).toHaveCount(0);
});

test.beforeEach(async ({ page, browserName }) => {
	if (browserName === 'webkit')
		await page.addInitScript(() => {
			Reflect.deleteProperty(window, 'PushManager');
		});
});

for (const width of [320, 390, 820, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		test(`screenshot modal focus, scrolling and palette at ${width}px in ${theme}`, async ({
			page
		}, testInfo) => {
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			await page.route(screenshotPath, (route) =>
				route.fulfill({
					contentType: 'image/svg+xml',
					body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="4800"><rect width="1200" height="4800" fill="white"/><text x="40" y="80" fill="black" font-size="32">Archived assembly page</text></svg>'
				})
			);
			await page.goto('/notices/2210003?archive=true');
			await expect(page.getByTestId('notice-detail-screenshot-image')).toHaveCount(0);
			const trigger = page.getByTestId('notice-detail-screenshot-toggle');
			await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
			await page.keyboard.press('Tab');
			await trigger.focus();
			await trigger.press('Enter');
			const dialog = page.getByTestId('notice-screenshot-modal');
			await expect(dialog).toBeVisible();
			await expect(dialog).toHaveCSS(
				'background-color',
				theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(48, 49, 50)'
			);
			await expect(dialog.getByTestId('modal-close')).toBeFocused();
			await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
			expect(await page.locator('main').evaluate((node) => !!node.closest('[inert]'))).toBe(true);
			await page.keyboard.press('Shift+Tab');
			await expect(dialog.getByTestId('notice-detail-screenshot-download')).toBeFocused();
			await page.keyboard.press('Tab');
			await expect(dialog.getByTestId('modal-close')).toBeFocused();
			await expect(dialog.getByTestId('notice-detail-screenshot-image')).toBeVisible();
			await expect(dialog.getByTestId('notice-detail-screenshot-download')).toHaveAttribute(
				'download',
				/notice-2210003-screenshot\./
			);
			await dialog.evaluate(async (node) => {
				await Promise.all(
					node
						.getAnimations({ subtree: true })
						.map((animation) => animation.finished.catch(() => {}))
				);
			});
			const geometry = await dialog.evaluate((node) => {
				const bounds = node.getBoundingClientRect();
				return {
					left: bounds.left,
					right: bounds.right,
					viewport: innerWidth,
					height: bounds.height,
					viewportHeight: innerHeight,
					scrollable: node.scrollHeight > node.clientHeight
				};
			});
			expect(geometry.left).toBeGreaterThanOrEqual(0);
			expect(geometry.right).toBeLessThanOrEqual(geometry.viewport + 1);
			expect(geometry.height).toBeLessThanOrEqual(geometry.viewportHeight);
			expect(geometry.scrollable).toBe(false);
			const dock = page.getByTestId('screenshot-tools');
			const dockGeometry = await dock.evaluate((node) => ({
				top: node.getBoundingClientRect().top,
				bottom: node.getBoundingClientRect().bottom,
				imageBottom: document
					.querySelector('[data-testid="screenshot-viewport"]')!
					.getBoundingClientRect().bottom,
				overflows: node.scrollWidth > node.clientWidth
			}));
			expect(dockGeometry.top).toBeGreaterThanOrEqual(dockGeometry.imageBottom);
			expect(dockGeometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
			expect(dockGeometry.overflows).toBe(false);
			for (const control of await dock.locator('button, a').all()) {
				const bounds = await control.boundingBox();
				expect(bounds!.height).toBeGreaterThanOrEqual(48);
				expect(bounds!.width).toBeGreaterThanOrEqual(48);
			}

			const viewport = page.getByTestId('screenshot-viewport');
			expect(await viewport.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
			await viewport.evaluate((node) => {
				node.scrollTop = node.scrollHeight;
			});
			await expect(dialog.getByTestId('modal-close')).toBeInViewport();
			await expect(page.getByTestId('screenshot-zoom-in')).toBeInViewport();
			await page.getByTestId('screenshot-original').click();
			await expect(page.getByTestId('screenshot-zoom-value')).toHaveText('100%');
			await expect(page.getByTestId('notice-detail-screenshot-image')).toHaveCSS('width', '1200px');
			await viewport.evaluate((node) => {
				node.scrollLeft = 40;
				node.scrollTop = 200;
			});
			const panBefore = await viewport.evaluate((node) => ({
				x: node.scrollLeft,
				y: node.scrollTop
			}));
			const bounds = (await viewport.boundingBox())!;
			await page.mouse.move(bounds.x + 100, bounds.y + 100);
			await page.mouse.down();
			await page.mouse.move(bounds.x + 60, bounds.y + 40, { steps: 3 });
			await page.mouse.up();
			const panAfter = await viewport.evaluate((node) => ({
				x: node.scrollLeft,
				y: node.scrollTop
			}));
			expect(panAfter.x).toBeGreaterThan(panBefore.x);
			expect(panAfter.y).toBeGreaterThan(panBefore.y);

			expect(await viewport.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
			await page.getByTestId('screenshot-zoom-in').click();
			await expect(page.getByTestId('screenshot-zoom-value')).toHaveText('125%');
			await page.getByTestId('screenshot-zoom-out').click();
			await expect(page.getByTestId('screenshot-zoom-value')).toHaveText('100%');
			await viewport.focus();
			await page.keyboard.press('+');
			await expect(page.getByTestId('screenshot-zoom-value')).toHaveText('125%');
			await page.keyboard.press('0');
			await expect(page.getByTestId('screenshot-fit')).toHaveAttribute('aria-pressed', 'true');
			expect(await viewport.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(
				true
			);
			await viewport.evaluate((node) => {
				node.scrollTop = 0;
			});
			await dialog.evaluate(async (node) => {
				await Promise.all(
					node
						.getAnimations({ subtree: true })
						.map((animation) => animation.finished.catch(() => {}))
				);
			});
			const accessibility = await new AxeBuilder({ page })
				.include('[data-testid="notice-screenshot-modal"]')
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
				.analyze();
			expect(accessibility.violations).toEqual([]);
			if (process.env.UI_SCREENSHOT_DIR) {
				const directory = join(process.env.UI_SCREENSHOT_DIR, testInfo.project.name);
				await mkdir(directory, { recursive: true });
				await page.screenshot({
					path: join(directory, `screenshot-modal-${width}-${theme}.png`),
					scale: 'css'
				});
			}
			await page.keyboard.press('Escape');
			await expect(dialog).toHaveCount(0);
			await expect(trigger).toBeFocused();
			await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
			expect(await page.locator('main').evaluate((node) => !!node.closest('[inert]'))).toBe(false);
			await openPreview(page);
			await expect(dialog).toBeVisible();
			await expect(page.getByTestId('screenshot-fit')).toHaveAttribute('aria-pressed', 'true');
			await dialog
				.locator('..')
				.locator(':scope > .absolute.inset-0')
				.click({ position: { x: 2, y: 2 } });
			await expect(dialog).toHaveCount(0);
		});
	}
}

test('closes a screenshot deep link and restores the preview trigger', async ({ page }) => {
	await page.route(screenshotPath, (route) =>
		route.fulfill({ contentType: 'image/png', body: imageBody })
	);
	await page.goto('/notices/2210003?screenshot=true');
	const dialog = page.getByTestId('notice-screenshot-modal');
	await expect(dialog).toBeVisible();
	await dialog.getByTestId('modal-close').click();
	await expect(dialog).toHaveCount(0);
	await expect(page.getByTestId('notice-detail-screenshot-toggle')).toBeFocused();
	await expect(page).not.toHaveURL(/screenshot=/);
});

test('supports original-size and fit-to-width screenshot viewing', async ({ page }) => {
	await page.route(screenshotPath, (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="4800"><rect width="1200" height="4800" fill="white"/></svg>'
		})
	);
	await page.goto('/notices/2210003?archive=true');
	await openPreview(page);
	await expect(page.getByTestId('screenshot-original')).toBeVisible();
	await page.getByTestId('screenshot-original').click();
	await expect(page.getByTestId('notice-detail-screenshot-image')).toHaveCSS('width', '1200px');
	await expect(page.getByTestId('screenshot-zoom-value')).toHaveText('100%');
	const viewport = page.getByTestId('screenshot-viewport');
	await viewport.focus();
	for (let index = 0; index < 10; index++) await page.keyboard.press('Shift+Equal');
	await expect(page.getByTestId('screenshot-zoom-value')).toHaveText('400%');
	await expect(page.getByTestId('screenshot-zoom-in')).toBeDisabled();
	for (let index = 0; index < 25; index++) await page.keyboard.press('-');
	await expect(page.getByTestId('screenshot-zoom-value')).toHaveText('10%');
	await expect(page.getByTestId('screenshot-zoom-out')).toBeDisabled();
	await page.keyboard.press('0');
	await expect(page.getByTestId('screenshot-fit')).toHaveAttribute('aria-pressed', 'true');
});

for (const theme of ['light', 'dark'] as const) {
	test(`touch screenshot viewport zoom in ${theme}`, async ({ page }, testInfo) => {
		await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
		await page.route(screenshotPath, (route) =>
			route.fulfill({
				contentType: 'image/svg+xml',
				body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="6000"><rect width="1200" height="6000" fill="white"/></svg>'
			})
		);
		await page.goto('/notices/2210003?archive=true');
		await page.getByTestId('notice-detail-screenshot-toggle').tap();
		const viewport = page.getByTestId('screenshot-viewport');
		await expect(page.getByTestId('screenshot-original')).toBeEnabled();
		await page.getByTestId('screenshot-original').tap();
		await expect(page.getByTestId('screenshot-zoom-value')).toHaveText('100%');
		// Chromium serializes the equivalent pan and pinch combination as manipulation.
		await expect(viewport).toHaveCSS('touch-action', /^(pan-x pan-y pinch-zoom|manipulation)$/);
		await viewport.evaluate((node) => {
			node.scrollLeft = 200;
			node.scrollTop = node.scrollHeight;
		});
		expect(await viewport.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
		await expect(page.getByTestId('screenshot-zoom-in')).toBeInViewport();
		await expect(page.getByTestId('modal-close')).toBeInViewport();
		await page.getByTestId('screenshot-zoom-in').tap();
		await expect(page.getByTestId('screenshot-zoom-value')).toHaveText('125%');
		await page.getByTestId('screenshot-zoom-out').tap();
		await expect(page.getByTestId('screenshot-zoom-value')).toHaveText('100%');
		await page.getByTestId('screenshot-fit').tap();
		await expect(page.getByTestId('screenshot-fit')).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByTestId('screenshot-original')).toHaveAttribute('aria-pressed', 'false');
		await expect(page.getByTestId('screenshot-original')).toHaveCSS(
			'background-color',
			theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(45, 46, 47)'
		);
		expect(await viewport.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
		await page.setViewportSize({ width: 844, height: 390 });
		await expect
			.poll(() =>
				viewport.evaluate((node) =>
					Math.abs(
						(node.querySelector('img') as HTMLImageElement).getBoundingClientRect().width -
							(node.clientWidth - 24)
					)
				)
			)
			.toBeLessThan(1);
		await expect
			.poll(() => viewport.evaluate((node) => node.scrollWidth <= node.clientWidth + 1))
			.toBe(true);
		await expect(page.getByTestId('modal-close')).toBeInViewport();
		if (process.env.UI_SCREENSHOT_DIR) {
			const directory = join(process.env.UI_SCREENSHOT_DIR, testInfo.project.name);
			await mkdir(directory, { recursive: true });
			await page.screenshot({ path: join(directory, `zoom-landscape-${theme}.png`), scale: 'css' });
		}
		await page.getByTestId('modal-close').tap();
		await expect(page.getByTestId('notice-screenshot-modal')).toHaveCount(0);
	});
}

test('places viewer tools below the image viewport', async ({ page }) => {
	await page.route(screenshotPath, (route) =>
		route.fulfill({ contentType: 'image/png', body: imageBody })
	);
	await page.goto('/notices/2210003?archive=true');
	await openPreview(page);
	const tools = page.getByRole('group', { name: '스크린샷 보기 조절', exact: true });
	await expect(tools).toBeVisible();
	const geometry = await tools.evaluate((node) => ({
		top: node.getBoundingClientRect().top,
		imageBottom: document
			.querySelector('[data-testid="screenshot-viewport"]')!
			.getBoundingClientRect().bottom
	}));
	expect(geometry.top).toBeGreaterThanOrEqual(geometry.imageBottom);
});
