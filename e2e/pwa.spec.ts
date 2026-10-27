import { expect, test, type Page } from '@playwright/test';

async function openApp(page: Page) {
	await page.goto('/');
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise<void>((resolve) =>
				navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
					once: true
				})
			);
		}
	});
}

// Headless Chromium does not display OS installation dialogs. Exercise the
// browser event contract separately from the real worker and manifest checks.
async function offerInstall(page: Page, outcome = 'accepted', fail = false) {
	await page.evaluate(
		({ outcome, fail }) => {
			const event = new Event('beforeinstallprompt', { cancelable: true });
			Object.assign(event, {
				prompt: async () => {
					document.documentElement.dataset.pwaPromptCalls = String(
						Number(document.documentElement.dataset.pwaPromptCalls || 0) + 1
					);
					if (!navigator.userActivation.isActive) throw new Error('Missing user gesture');
					if (fail) throw new Error('Prompt unavailable');
				},
				userChoice: Promise.resolve({ outcome })
			});
			window.dispatchEvent(event);
		},
		{ outcome, fail }
	);
}

test.describe('PWA', () => {
	test('serves a discoverable installable manifest and existing brand icons', async ({
		page,
		request
	}) => {
		await openApp(page);
		expect(
			await page
				.locator('link[rel="manifest"]')
				.evaluate((link: HTMLLinkElement) => new URL(link.href).pathname)
		).toBe('/manifest.webmanifest');
		const response = await request.get('/manifest.webmanifest');
		expect(response.ok()).toBeTruthy();
		expect(response.headers()['content-type']).toContain('manifest+json');
		const manifest = await response.json();
		expect(manifest).toMatchObject({
			id: '/',
			start_url: '/',
			scope: '/',
			display: 'standalone',
			lang: 'ko'
		});
		expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual([
			'192x192',
			'512x512'
		]);
		for (const icon of manifest.icons) {
			expect(icon.src).toMatch(/^\/brand\//);
			const size = Number(icon.sizes.split('x')[0]);
			const dimensions = await page.evaluate(async (src) => {
				const image = new Image();
				image.src = src;
				await image.decode();
				return [image.naturalWidth, image.naturalHeight];
			}, icon.src);
			expect(dimensions).toEqual([size, size]);
		}
		const cdp = await page.context().newCDPSession(page);
		const parsed = await cdp.send('Page.getAppManifest');
		expect(parsed.errors).toEqual([]);
		expect(JSON.parse(parsed.data!)).toMatchObject({ name: manifest.name });
		const eligibility = await cdp.send('Page.getInstallabilityErrors');
		expect(eligibility.installabilityErrors).toEqual([]);
	});

	test('serves the offline document after platform HTML normalization', async ({ request }) => {
		const response = await request.get('/offline.html');
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('text/html');
		expect(await response.text()).toContain('data-testid="pwa-offline-page"');
		if (process.env.PWA_CLOUDFLARE === '1')
			expect(new URL(response.url()).pathname).toBe('/offline');
	});

	test('registers one root-scoped push worker on ordinary pages', async ({ page }) => {
		await openApp(page);
		const registrations = await page.evaluate(async () =>
			(await navigator.serviceWorker.getRegistrations()).map((registration) => ({
				scope: new URL(registration.scope).pathname,
				script: new URL(registration.active!.scriptURL).pathname,
				push: 'pushManager' in registration
			}))
		);
		expect(registrations).toEqual([{ scope: '/', script: '/sw.js', push: true }]);
		await page.goto('/webhook');
		expect(
			await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)
		).toBe(1);
	});

	test('shows an offline fallback on deep navigation and recovers online', async ({
		page,
		context
	}) => {
		await openApp(page);
		await context.setOffline(true);
		await page.goto('/notices/2210001');
		await expect(page.getByTestId('pwa-offline-page')).toBeVisible();
		expect(await page.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(
			192
		);
		await context.setOffline(false);
		await page.getByTestId('pwa-offline-retry').click();
		await expect(page.getByTestId('app-route-container')).toBeVisible();
	});

	test('caches only offline assets and leaves API failures as network failures', async ({
		page,
		context
	}) => {
		await openApp(page);
		await page.evaluate(() => fetch('/api/version'));
		const cached = await page.evaluate(async () => {
			const names = await caches.keys();
			return (
				await Promise.all(
					names.map(async (name) =>
						(await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname)
					)
				)
			)
				.flat()
				.sort();
		});
		expect(cached).toEqual(['/brand/icon-192.png', '/brand/icon-512.png', '/offline.html']);
		await context.setOffline(true);
		expect(
			await page.evaluate(() =>
				fetch('/api/version').then(
					() => false,
					() => true
				)
			)
		).toBeTruthy();
	});

	test('waits for browser eligibility and invokes the native prompt only on click', async ({
		page
	}) => {
		await openApp(page);
		await expect(page.getByTestId('pwa-install-prompt')).toBeHidden();
		await offerInstall(page);
		await expect(page.getByTestId('pwa-install-prompt')).toBeVisible();
		expect(await page.locator('html').getAttribute('data-pwa-prompt-calls')).toBeNull();
		await page.getByTestId('pwa-install-button').click();
		await expect(page.locator('html')).toHaveAttribute('data-pwa-prompt-calls', '1');
		await expect(page.getByTestId('pwa-install-prompt')).toBeHidden();
	});

	test('snoozes a declined offer across reloads and offers again after seven days', async ({
		page
	}) => {
		await openApp(page);
		await offerInstall(page);
		await page.getByTestId('pwa-install-dismiss').click();
		await page.reload();
		await offerInstall(page);
		await expect(page.getByTestId('pwa-install-prompt')).toBeHidden();
		await page.evaluate(() =>
			localStorage.setItem('lawcast-pwa-dismissed-at', String(Date.now() - 8 * 86400000))
		);
		await offerInstall(page);
		await expect(page.getByTestId('pwa-install-prompt')).toBeVisible();
	});

	test('snoozes a native dismissal without reusing the consumed event', async ({ page }) => {
		await openApp(page);
		await offerInstall(page, 'dismissed');
		await page.getByTestId('pwa-install-button').click();
		await expect(page.getByTestId('pwa-install-prompt')).toBeHidden();
		await expect
			.poll(() => page.evaluate(() => localStorage.getItem('lawcast-pwa-dismissed-at')))
			.not.toBeNull();
		await offerInstall(page);
		await expect(page.getByTestId('pwa-install-prompt')).toBeHidden();
	});

	test('hides the offer after installation', async ({ page }) => {
		await openApp(page);
		await offerInstall(page);
		await expect(page.getByTestId('pwa-install-prompt')).toBeVisible();
		await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
		await expect(page.getByTestId('pwa-install-prompt')).toBeHidden();
		await offerInstall(page);
		await expect(page.getByTestId('pwa-install-prompt')).toBeHidden();
	});

	test('does not offer installation in standalone mode', async ({ page }) => {
		await page.addInitScript(() => {
			const original = window.matchMedia.bind(window);
			window.matchMedia = (query) => {
				const result = original(query);
				if (query === '(display-mode: standalone)')
					Object.defineProperty(result, 'matches', { value: true });
				return result;
			};
		});
		await openApp(page);
		await offerInstall(page);
		await expect(page.getByTestId('pwa-install-prompt')).toBeHidden();
	});

	test('fits installation controls within a mobile viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openApp(page);
		await offerInstall(page);
		const offer = page.getByTestId('pwa-install-prompt');
		await expect(offer).toBeVisible();
		const bounds = await offer.boundingBox();
		expect(bounds!.x).toBeGreaterThanOrEqual(0);
		expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
		expect(
			await offer.evaluate((element) => element.scrollWidth <= element.clientWidth)
		).toBeTruthy();
		await expect(page.getByTestId('pwa-install-button')).toBeInViewport();
		await page.screenshot({ path: 'test-results/pwa-install-mobile.png' });
	});

	test('handles prompt errors and unavailable storage without breaking browsing', async ({
		page
	}) => {
		await openApp(page);
		await page.evaluate(() => {
			Storage.prototype.getItem = () => {
				throw new Error('Storage blocked');
			};
			Storage.prototype.setItem = () => {
				throw new Error('Storage blocked');
			};
		});
		await offerInstall(page, 'accepted', true);
		await page.getByTestId('pwa-install-button').click();
		await expect(page.getByTestId('pwa-install-prompt').getByRole('status')).toContainText(
			'설치 창을 열지 못했습니다.'
		);
		await page.getByTestId('pwa-install-dismiss').click();
		await expect(page.getByTestId('pwa-install-prompt')).toBeHidden();
	});
});
