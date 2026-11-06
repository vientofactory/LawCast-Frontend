import { test, expect, type Page } from '@playwright/test';

async function offer(page: Page, fails = false) {
	await page.evaluate((fails) => {
		const event = new Event('beforeinstallprompt', { cancelable: true });
		Object.assign(event, {
			prompt: async () => {
				document.documentElement.dataset.installCalls = String(
					Number(document.documentElement.dataset.installCalls || 0) + 1
				);
				if (fails) throw new Error('Test installation failure');
			},
			userChoice: Promise.resolve({ outcome: 'accepted' })
		});
		window.dispatchEvent(event);
	}, fails);
}

async function freeze(page: Page, id: string) {
	return page.getByTestId(id).evaluate(async (node) => {
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const animations = node
			.getAnimations()
			.filter((animation) =>
				(animation.effect as KeyframeEffect).getKeyframes().some((frame) => 'opacity' in frame)
			);
		for (const animation of animations) {
			animation.pause();
			animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
		}
		return animations.length;
	});
}

async function finish(page: Page, id: string) {
	await page.getByTestId(id).evaluate((node) => node.getAnimations().forEach((a) => a.finish()));
}

for (const width of [390, 1440]) {
	for (const theme of ['light', 'dark']) {
		for (const reducedMotion of ['no-preference', 'reduce'] as const) {
			test(`animates prompt lifetime at ${width} in ${theme} with ${reducedMotion}`, async ({
				page
			}) => {
				await page.setViewportSize({ width, height: 900 });
				await page.emulateMedia({ reducedMotion });
				await page.route('https://www.googletagmanager.com/**', (route) =>
					route.fulfill({ body: '', contentType: 'application/javascript' })
				);
				await page.goto('/');
				const cookie = page.getByTestId('cookie-consent-banner');
				await expect(cookie).toBeVisible();
				await page.evaluate(
					(theme) => document.documentElement.setAttribute('data-theme', theme),
					theme
				);
				await offer(page);
				const install = page.getByTestId('pwa-install-prompt');
				await expect(install).toBeVisible();
				if (reducedMotion === 'no-preference') {
					expect(await freeze(page, 'pwa-install-prompt')).toBeGreaterThan(0);
					await finish(page, 'pwa-install-prompt');
				}
				await page.waitForTimeout(300);
				await expect(page.locator('html')).toHaveJSProperty('scrollWidth', width);
				const before = await cookie.boundingBox();
				const above = await install.boundingBox();
				expect(above!.y + above!.height).toBeLessThanOrEqual(before!.y);
				await page.screenshot({
					path: `${process.env.PROMPT_SCREENSHOTS || 'test-results'}/${test.info().project.name}-${width}-${theme}-${reducedMotion}-open.png`
				});
				const choice = page.getByTestId(
					width === 390 ? 'cookie-consent-decline' : 'cookie-consent-accept'
				);
				await choice.focus();
				await choice.evaluate((node) => node.click());
				if (reducedMotion === 'no-preference') {
					expect(await freeze(page, 'cookie-consent-banner')).toBeGreaterThan(0);
					await expect(cookie).toHaveAttribute('inert', '');
					await expect(cookie).toHaveAttribute('inert', '');
					expect(
						await page.evaluate(() =>
							parseFloat(
								document.documentElement.style.getPropertyValue('--lc-consent-banner-height')
							)
						)
					).toBeGreaterThan(0);
					await page.screenshot({
						path: `${process.env.PROMPT_SCREENSHOTS || 'test-results'}/${test.info().project.name}-${width}-${theme}-closing.png`
					});
					await finish(page, 'cookie-consent-banner');
				}
				await expect(cookie).toHaveCount(0);
				await expect(page.getByTestId('cookie-settings-button')).toBeVisible();
				await expect(page.getByTestId('cookie-settings-button')).toBeFocused();
				await page.getByTestId('pwa-install-dismiss').evaluate((node) => node.click());
				if (reducedMotion === 'no-preference') {
					expect(await freeze(page, 'pwa-install-prompt')).toBeGreaterThan(0);
					await expect(install).toHaveAttribute('inert', '');
					await expect(page.getByTestId('pwa-install-button')).toHaveCount(1);
					await page.screenshot({
						path: `${process.env.PROMPT_SCREENSHOTS || 'test-results'}/${test.info().project.name}-${width}-${theme}-install-closing.png`
					});
					await finish(page, 'pwa-install-prompt');
				}
				await expect(install).toHaveCount(0);
				expect(
					await page.evaluate(() => localStorage.getItem('lawcast-pwa-dismissed-at'))
				).toBeTruthy();
				await page.getByTestId('cookie-settings-button').click();
				await expect(cookie).toBeVisible();
			});
		}
	}
}

test('calls the native prompt once and recovers from a native error', async ({ page }) => {
	await page.route('https://www.googletagmanager.com/**', (route) => route.fulfill({ body: '' }));
	await page.goto('/');
	await expect(page.getByTestId('cookie-consent-banner')).toBeVisible();
	await offer(page, true);
	await page.getByTestId('pwa-install-button').click();
	await expect(page.locator('html')).toHaveAttribute('data-install-calls', '1');
	await expect(page.getByTestId('pwa-install-prompt').getByRole('status')).toContainText(
		'설치 창을 열지 못했습니다'
	);
	await page.getByTestId('pwa-install-dismiss').click();
	await expect(page.getByTestId('pwa-install-prompt')).toHaveCount(0);
});
