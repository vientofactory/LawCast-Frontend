import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { BRAND_ARC, BRAND_LETTER, BRAND_DOT } from '../src/lib/brand-symbol.js';

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
	test('assembles the symbol before revealing the wordmark without shifting layout', async ({
		page
	}, testInfo) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await openApp(page);
		const brand = page.getByTestId('site-brand').getByTestId('brand-logo');
		await expect(brand).toHaveAttribute('data-intro', 'true');
		const bounds = await brand.boundingBox();
		const heading = page.getByTestId('brand-heading');
		const headingBounds = await heading.boundingBox();
		const opacity = (part: string) =>
			brand.getByTestId(part).evaluate((node) => Number(getComputedStyle(node).opacity));
		for (const time of [0, 650, 1100, 1700, 1900, 2200]) {
			await heading.evaluate((node, time) => {
				for (const animation of node.getAnimations({ subtree: true })) {
					animation.pause();
					animation.currentTime = time;
				}
			}, time);
			if (time === 0) {
				expect(
					await brand.locator('.lc-brand-echo').evaluate((node) => getComputedStyle(node).opacity)
				).toBe('0');
				for (const part of ['brand-arc', 'brand-letter', 'brand-dot', 'brand-wordmark'])
					expect(await opacity(part)).toBe(0);
			} else if (time === 650) {
				expect(await opacity('brand-arc')).toBeGreaterThan(0.9);
				expect(await opacity('brand-letter')).toBeGreaterThan(0.8);
				expect(await opacity('brand-dot')).toBe(0);
				expect(await opacity('brand-wordmark')).toBe(0);
			} else if (time === 1100) {
				expect(await opacity('brand-dot')).toBeGreaterThan(0.9);
				expect(await opacity('brand-wordmark')).toBeGreaterThan(0);
			} else {
				for (const part of ['brand-arc', 'brand-letter', 'brand-dot', 'brand-wordmark'])
					expect(await opacity(part)).toBe(1);
			}
			const taglineOpacity = await page
				.getByTestId('brand-tagline')
				.evaluate((node) => Number(getComputedStyle(node).opacity));
			if (time <= 1700) expect(taglineOpacity).toBe(0);
			else if (time === 1900) {
				expect(taglineOpacity).toBeGreaterThan(0);
				expect(taglineOpacity).toBeLessThan(1);
			} else expect(taglineOpacity).toBe(1);
			await page
				.getByTestId('site-brand')
				.screenshot({ path: testInfo.outputPath(`assembly-${time}.png`), animations: 'allow' });
		}
		expect(await brand.boundingBox()).toEqual(bounds);
		expect(await heading.boundingBox()).toEqual(headingBounds);
		expect(
			await page
				.getByTestId('footer-brand')
				.evaluate((node) => node.getAnimations({ subtree: true }).length)
		).toBe(0);
	});

	test('does not replay the intro on client navigation', async ({ page }) => {
		await openApp(page);
		await page.evaluate(() => {
			document.documentElement.dataset.brandDocument = 'same';
		});
		await page.getByTestId('nav-link-webhook').click();
		await expect(page).toHaveURL(/\/webhook$/);
		await expect(page.getByTestId('site-brand').getByTestId('brand-logo')).toHaveAttribute(
			'data-intro',
			'false'
		);
		expect(await page.evaluate(() => document.documentElement.dataset.brandDocument)).toBe('same');
		expect(
			await page
				.getByTestId('brand-heading')
				.evaluate((node) => node.getAnimations({ subtree: true }).length)
		).toBe(0);
		expect(
			await page.getByTestId('brand-tagline').evaluate((node) => getComputedStyle(node).opacity)
		).toBe('1');
	});

	test('shows the complete logo immediately when reduced motion is requested', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await openApp(page);
		const brand = page.getByTestId('site-brand').getByTestId('brand-logo');
		expect(
			await page
				.getByTestId('brand-heading')
				.evaluate((node) => node.getAnimations({ subtree: true }).length)
		).toBe(0);
		expect(
			await page.getByTestId('brand-tagline').evaluate((node) => getComputedStyle(node).opacity)
		).toBe('1');
		expect(await brand.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
		for (const part of ['brand-arc', 'brand-letter', 'brand-dot', 'brand-wordmark']) {
			expect(await brand.getByTestId(part).evaluate((node) => getComputedStyle(node).opacity)).toBe(
				'1'
			);
		}
	});

	test('stops an in-progress logo intro when reduced motion is enabled', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await openApp(page);
		const brand = page.getByTestId('site-brand').getByTestId('brand-logo');
		await page.getByTestId('brand-heading').evaluate((node) => {
			for (const animation of node.getAnimations({ subtree: true })) {
				animation.pause();
				animation.currentTime = 500;
			}
		});
		expect(
			await brand.getByTestId('brand-wordmark').evaluate((node) => getComputedStyle(node).opacity)
		).toBe('0');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		expect(
			await page
				.getByTestId('brand-heading')
				.evaluate((node) => node.getAnimations({ subtree: true }).length)
		).toBe(0);
		expect(
			await page.getByTestId('brand-tagline').evaluate((node) => getComputedStyle(node).opacity)
		).toBe('1');
		expect(await brand.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
		for (const part of ['brand-arc', 'brand-letter', 'brand-dot', 'brand-wordmark']) {
			expect(
				await brand.getByTestId(part).evaluate((node) => {
					const style = getComputedStyle(node);
					return { opacity: style.opacity, transform: style.transform, clip: style.clipPath };
				})
			).toEqual({ opacity: '1', transform: 'none', clip: 'none' });
		}
		expect(
			await brand.locator('.lc-brand-echo').evaluate((node) => getComputedStyle(node).opacity)
		).toBe('0');
	});

	test('renders brand assets in both themes and at mobile size', async ({ page }, testInfo) => {
		await openApp(page);
		for (const theme of ['light', 'dark']) {
			await page.evaluate((theme) => {
				document.documentElement.dataset.theme = theme;
			}, theme);
			for (const region of ['site-brand', 'footer-brand']) {
				const logo = page.getByTestId(region).locator(`.lc-brand-${theme}`);
				await expect(logo).toHaveAttribute('src', `/brand/v2/wordmark-${theme}.svg`);
				await expect(logo).toBeVisible();
				expect(
					await logo.evaluate(async (img: HTMLImageElement) => {
						await img.decode();
						return [img.naturalWidth, img.naturalHeight];
					})
				).toEqual([179, 64]);
			}
			await page
				.getByTestId('site-brand')
				.screenshot({ path: testInfo.outputPath(`brand-${theme}.png`) });
		}
		await page.setViewportSize({ width: 375, height: 812 });
		await expect(page.getByTestId('site-brand')).toBeVisible();
		await page.screenshot({ path: testInfo.outputPath('brand-mobile.png') });
		for (const [src, size] of [
			['/brand/v2/favicon.png', 32],
			['/brand/v2/apple-touch-icon.png', 180],
			['/brand/v2/badge-96.png', 96]
		] as const) {
			const result = await page.evaluate(async (src) => {
				const image = new Image();
				image.src = src;
				await image.decode();
				const canvas = document.createElement('canvas');
				canvas.width = image.width;
				canvas.height = image.height;
				const ctx = canvas.getContext('2d')!;
				ctx.drawImage(image, 0, 0);
				const data = ctx.getImageData(0, 0, image.width, image.height).data;
				let white = true;
				let opaque = false;
				for (let i = 0; i < data.length; i += 4) {
					if (data[i + 3]) white &&= data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255;
					opaque ||= data[i + 3] === 255;
				}
				return { size: [image.width, image.height], corner: data[3], white, opaque };
			}, src);
			expect(result.size).toEqual([size, size]);
			if (src.includes('badge'))
				expect(result).toMatchObject({ corner: 0, white: true, opaque: true });
		}
	});

	test('replaces legacy icon caches and preserves unrelated caches', async ({ page }) => {
		await page.goto('/offline.html');
		await page.evaluate(async () => {
			await (
				await caches.open('lawcast-pwa-v2')
			).put('/brand/icon-192.png', new Response('old icon'));
			await caches.open('unrelated-cache');
		});
		await openApp(page);
		const names = await page.evaluate(() => caches.keys());
		expect(names).toContain('lawcast-pwa-v5');
		expect(names).toContain('unrelated-cache');
		expect(names).not.toContain('lawcast-pwa-v2');
	});

	test('uses reachable brand assets in push notification options', async ({ request }) => {
		const handlers: Record<string, (event: unknown) => void> = {};
		const notifications: { title: string; options: Record<string, unknown> }[] = [];
		runInNewContext(readFileSync(new URL('../static/sw.js', import.meta.url), 'utf8'), {
			self: {
				addEventListener: (name: string, handler: (event: unknown) => void) => {
					handlers[name] = handler;
				},
				registration: {
					showNotification: async (title: string, options: Record<string, unknown>) => {
						notifications.push({ title, options });
					}
				}
			}
		});
		let pending: Promise<unknown> = Promise.resolve();
		handlers.push({
			data: { text: () => JSON.stringify({ title: 'Test notice', url: '/notices/2210001' }) },
			waitUntil: (promise: Promise<unknown>) => {
				pending = promise;
			}
		});
		await pending;
		expect(notifications[0]).toMatchObject({
			title: 'Test notice',
			options: {
				icon: '/brand/v2/icon-192.png',
				badge: '/brand/v2/badge-96.png',
				data: { url: '/notices/2210001' }
			}
		});
		for (const path of [notifications[0].options.icon, notifications[0].options.badge]) {
			const response = await request.get(String(path));
			expect(response.ok()).toBeTruthy();
			expect(response.headers()['content-type']).toContain('image/png');
		}
	});

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
		expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
			'/brand/v2/icon-192.png',
			'/brand/v2/icon-512.png'
		]);
		for (const [selector, path] of [
			['link[rel="icon"][type="image/png"]', '/brand/v2/favicon.png'],
			['link[rel="icon"][type="image/svg+xml"]', '/brand/v2/favicon.svg'],
			['link[rel="apple-touch-icon"]', '/brand/v2/apple-touch-icon.png']
		]) {
			expect(
				await page
					.locator(selector)
					.evaluate((link: HTMLLinkElement) => new URL(link.href).pathname)
			).toBe(path);
		}
		expect(manifest).toMatchObject({
			id: '/',
			start_url: '/pwa-start',
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

	test('serves the launch document after platform HTML normalization', async ({ request }) => {
		const response = await request.get('/pwa-start.html');
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('text/html');
		expect(await response.text()).toContain('data-testid="pwa-loading-page"');
		if (process.env.PWA_CLOUDFLARE === '1')
			expect(new URL(response.url()).pathname).toBe('/pwa-start');
	});

	test('loops the header symbol assembly smoothly and respects reduced motion', async ({
		browser
	}, testInfo) => {
		// Disable only launch JavaScript so the standalone document stays available
		// for deterministic CSS timeline checks without a replacement navigation.
		const context = await browser.newContext({
			javaScriptEnabled: false,
			viewport: { width: 375, height: 812 }
		});
		try {
			const page = await context.newPage();
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.goto(new URL('/pwa-start.html', testInfo.project.use.baseURL).href);
			const symbol = page.getByTestId('pwa-loading-symbol');
			await expect(symbol.locator('.lc-brand-arc')).toHaveAttribute('d', BRAND_ARC);
			await expect(symbol.locator('.lc-brand-letter')).toHaveAttribute('d', BRAND_LETTER);
			for (const [key, value] of Object.entries(BRAND_DOT)) {
				await expect(symbol.locator('.lc-brand-dot')).toHaveAttribute(key, String(value));
			}
			await expect(page.locator('main')).toHaveText('다시 시도');
			await expect(page.locator('main img, main h1, .spinner')).toHaveCount(0);
			const bounds = await symbol.boundingBox();
			const states: Record<number, string[]> = {};
			for (const time of [0, 650, 1100, 1700, 2300, 2800, 3000, 4700]) {
				states[time] = await symbol.evaluate((node, time) => {
					for (const animation of node.getAnimations({ subtree: true })) {
						animation.pause();
						animation.currentTime = time;
					}
					return ['.lc-brand-arc', '.lc-brand-letter', '.lc-brand-dot'].map(
						(part) => getComputedStyle(node.querySelector(part)!).opacity
					);
				}, time);
				expect(await symbol.boundingBox()).toEqual(bounds);
			}
			expect(states[0]).toEqual(['0', '0', '0']);
			expect(Number(states[650][0])).toBeGreaterThan(0.9);
			expect(states[650][2]).toBe('0');
			expect(Number(states[1100][2])).toBeGreaterThan(0);
			expect(states[1700]).toEqual(['1', '1', '1']);
			expect(Number(states[2800][0])).toBeLessThan(0.1);
			expect(states[3000]).toEqual(states[0]);
			expect(states[4700]).toEqual(states[1700]);
			for (const colorScheme of ['light', 'dark'] as const) {
				await page.emulateMedia({ colorScheme });
				await page.screenshot({
					path: testInfo.outputPath(`launch-symbol-${colorScheme}.png`),
					animations: 'allow'
				});
			}
			await page.emulateMedia({ reducedMotion: 'reduce' });
			expect(await symbol.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
			for (const part of ['.lc-brand-arc', '.lc-brand-letter', '.lc-brand-dot']) {
				expect(await symbol.locator(part).evaluate((node) => getComputedStyle(node).opacity)).toBe(
					'1'
				);
			}
			await expect(page.getByTestId('pwa-loading-retry')).toBeVisible();
		} finally {
			await context.close();
		}
	});

	test('paints the cached launch screen while the home response is delayed', async ({
		page
	}, testInfo) => {
		await openApp(page);
		await page.setViewportSize({ width: 375, height: 812 });
		await page.evaluate(() => localStorage.setItem('lawcast-theme', 'dark'));
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		const cdp = await page.context().newCDPSession(page);
		// Locator assertions wait for pending navigation. Inspect the still-painted
		// launch document directly while its replacement waits for HTTP headers.
		const launchState = async () => {
			const result = await cdp.send('Runtime.evaluate', {
				expression: `JSON.stringify({
					text: document.querySelector('main')?.textContent.trim(),
					theme: document.documentElement.dataset.theme,
					background: document.body && getComputedStyle(document.body).backgroundColor,
					animation: document.querySelector('.lc-brand-arc') && getComputedStyle(document.querySelector('.lc-brand-arc')).animationName,
					retryHidden: document.querySelector('[data-testid="pwa-loading-retry"]')?.hidden
				})`,
				returnByValue: true
			});
			return result.result.value ? JSON.parse(result.result.value) : {};
		};
		const response = await page.goto('/pwa-start?pwa-test=slow#launch', { waitUntil: 'commit' });
		expect(response!.fromServiceWorker()).toBeTruthy();
		await expect.poll(launchState).toMatchObject({
			text: '다시 시도',
			theme: 'dark',
			background: 'rgb(8, 17, 31)',
			animation: 'lc-launch-arc',
			retryHidden: false
		});
		await new Promise((resolve) => setTimeout(resolve, 1700));
		const assembled = await cdp.send('Page.captureScreenshot');
		await new Promise((resolve) => setTimeout(resolve, 1500));
		const screenshot = await cdp.send('Page.captureScreenshot');
		expect(screenshot.data).not.toBe(assembled.data);
		writeFileSync(
			testInfo.outputPath('cached-launch-dark-mobile.png'),
			Buffer.from(screenshot.data, 'base64')
		);
		await expect(page).toHaveURL('/?pwa-test=slow#launch', { timeout: 25_000 });
		await expect(page.getByTestId('app-route-container')).toBeVisible();
		await expect(page.getByTestId('pwa-loading-page')).toHaveCount(0);
		await expect(page.locator('head title')).toHaveCount(1);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.getByTestId('nav-link-webhook').click();
		await expect(page).toHaveURL('/webhook');
	});

	test('launches from cache offline and recovers with the existing retry', async ({
		page,
		context
	}) => {
		await openApp(page);
		await context.setOffline(true);
		const response = await page.goto('/pwa-start', { waitUntil: 'commit' });
		expect(response!.fromServiceWorker()).toBeTruthy();
		await expect(page.getByTestId('pwa-offline-page')).toBeVisible();
		await context.setOffline(false);
		await page.getByTestId('pwa-offline-retry').click();
		await expect(page.getByTestId('app-route-container')).toBeVisible();
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

	test('caches only launch and offline assets and leaves API failures as network failures', async ({
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
		expect(cached).toEqual([
			'/brand/v2/badge-96.png',
			'/brand/v2/icon-192.png',
			'/brand/v2/icon-512.png',
			'/offline.html',
			'/pwa-start.html'
		]);
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
