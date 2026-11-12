import { expect, test } from '@playwright/test';

const selectors = [
	'[data-testid="site-brand"]',
	'.lc-header-theme .lc-theme-switch',
	'.lc-header-menu-toggle',
	'.lc-nav-link',
	'.lc-home-signal-card',
	'[data-testid="home-status-link-archive"]',
	'[data-testid="home-status-link-changes"]'
].join(',');

for (const theme of ['light', 'dark'] as const) {
	for (const motion of ['no-preference', 'reduce'] as const) {
		test(`keeps initial styles bounded through hard reload in ${theme} with ${motion}`, async ({
			page,
			context,
			isMobile
		}, info) => {
			await page.emulateMedia({ reducedMotion: motion });
			await page.addInitScript(
				({ theme, selectors }) => {
					localStorage.setItem('lawcast-theme', theme);
					const samples: { at: number; violations: string[] }[] = [];
					Object.assign(window, { __initialStyleSamples: samples });
					const start = performance.now();
					const sample = () => {
						const violations: string[] = [];
						for (const node of document.querySelectorAll<HTMLElement>(selectors)) {
							const style = getComputedStyle(node);
							const properties = style.transitionProperty.split(',').map((value) => value.trim());
							if (
								properties.some(
									(property) =>
										property === 'all' ||
										/^(border|outline|padding|margin|width|height)/.test(property)
								)
							)
								violations.push(
									`${node.dataset.testid ?? node.className}: ${properties.join(',')}`
								);
							if (!node.matches(':focus-visible') && style.outlineStyle !== 'none')
								violations.push(`${node.dataset.testid ?? node.className}: unexpected outline`);
							for (const animation of node.getAnimations()) {
								if (
									animation instanceof CSSTransition &&
									/^(border|outline|padding|margin|width|height)/.test(animation.transitionProperty)
								)
									violations.push(`unexpected transition: ${animation.transitionProperty}`);
							}
						}
						if (document.querySelector('[data-testid="site-brand"]'))
							samples.push({ at: performance.now(), violations });
						if (performance.now() - start < 4000) requestAnimationFrame(sample);
					};
					requestAnimationFrame(sample);
				},
				{ theme, selectors }
			);
			const session = await context.newCDPSession(page);
			await session.send('Network.enable');
			await session.send('Network.setCacheDisabled', { cacheDisabled: true });
			await page.goto('/');

			for (let reload = 0; reload < 2; reload++) {
				const loaded = page.waitForEvent('load');
				// CDP explicitly bypasses the cache, unlike a normal page.reload().
				await session.send('Page.reload', { ignoreCache: true });
				await loaded;
				await expect(page.getByTestId('home-status-link-archive')).toBeVisible();
				await page.waitForTimeout(300);
				const samples = await page.evaluate(
					() =>
						Reflect.get(window, '__initialStyleSamples') as { at: number; violations: string[] }[]
				);
				expect(samples.length).toBeGreaterThan(1);
				expect(samples.flatMap((sample) => sample.violations)).toEqual([]);
				await info.attach(`initial-styles-${reload}`, {
					body: JSON.stringify(samples),
					contentType: 'application/json'
				});
				await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			}

			const brand = page.getByTestId('site-brand');
			await page.locator('a[href="#main-content"]').focus();
			await page.keyboard.press('Tab');
			await expect(brand).toBeFocused();
			await expect(brand).toHaveCSS('outline-style', 'solid');
			await expect(brand).toHaveCSS('outline-width', '2px');
			await page.keyboard.press('Tab');

			if (isMobile) {
				await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeFocused();
				await page.keyboard.press('Enter');
				await expect(page.getByTestId('mobile-nav-link-home')).toBeVisible();
			}
			const toggle = page.locator(
				isMobile ? '.lc-mobile-menu-panel .lc-theme-switch' : '.lc-header-theme .lc-theme-switch'
			);
			await toggle.focus();
			await page.keyboard.press('Tab');
			await page.keyboard.press('Shift+Tab');
			await expect(toggle).toBeFocused();
			await expect(toggle).toHaveCSS('outline-style', 'solid');
			await page.keyboard.press('Space');
			await expect(page.locator('html')).toHaveAttribute(
				'data-theme',
				theme === 'dark' ? 'light' : 'dark'
			);
			await page.keyboard.press('Space');
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

			const navPrefix = isMobile ? 'mobile-nav-link-' : 'nav-link-';
			await page.getByTestId(navPrefix + 'notices').focus();
			await page.keyboard.press('Shift+Tab');
			await expect(page.getByTestId(navPrefix + 'home')).toBeFocused();
			await expect(page.getByTestId(navPrefix + 'home')).toHaveCSS('outline-style', 'solid');
			await expect(page.getByTestId(navPrefix + 'home')).toHaveCSS(
				'transition-property',
				'background-color, color'
			);
			if (isMobile) {
				await page.keyboard.press('Escape');
				// Keep the focus trap until the real mobile-menu outro completes.
				await expect(page.locator('.lc-mobile-menu-panel')).toHaveCount(0);
				await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeFocused();
			}
			const archive = page.getByTestId('home-status-link-archive');
			await archive.focus();
			await page.keyboard.press('Tab');
			await page.keyboard.press('Shift+Tab');
			await expect(archive).toBeFocused();
			await expect(archive).toHaveCSS('outline-style', 'solid');
			await page.screenshot({ path: info.outputPath('keyboard-focus.png') });
		});
	}
}
