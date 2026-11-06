import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startPaletteSampling, readPaletteSamples } from './helpers/theme-palette';
import { findSectionDividers } from './helpers/section-dividers';
import { startModalTransitionSample, readModalTransitionSample } from './helpers/modal-transition';

test.beforeEach(async ({ page, browserName, browser }, testInfo) => {
	screenshotDir = process.env.UI_SCREENSHOT_DIR
		? join(process.env.UI_SCREENSHOT_DIR, testInfo.project.name)
		: undefined;
	testInfo.annotations.push({ type: 'browser-version', description: browser.version() });
	// Match the existing accessibility fixture for headless WebKit's native push stall.
	if (browserName === 'webkit') {
		await page.addInitScript(() => {
			Reflect.deleteProperty(window, 'PushManager');
		});
	}
});

let screenshotDir = process.env.UI_SCREENSHOT_DIR;
const routes = [
	['home', '/'],
	['notices', '/notices'],
	['detail', '/notices/2210004'],
	['comparison', '/notices/2210004?timeline=1&cmpFrom=1&cmpTo=2'],
	['changes', '/notices/changes'],
	['semantic', '/notices/semantic-search'],
	['discussions', '/discussions'],
	['thread', '/notices/2210001/discussions/221000101'],
	['webhook', '/webhook'],
	['proposals', '/proposals'],
	['status', '/status'],
	['transparency', '/crawling-transparency'],
	['announcements', '/announcements'],
	['announcement', '/announcements/mock-announcement-1'],
	['license', '/license']
] as const;

for (const width of [320, 390, 820, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		test(`open layout and accessibility at ${width}px in ${theme}`, async ({ page }) => {
			test.setTimeout(180_000);
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			for (const [name, path] of routes) {
				await page.goto(path);
				await expect(page.locator('main')).toBeVisible();
				await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
				await page.evaluate(() => document.fonts.ready);
				await page
					.locator('[data-testid="brand-heading"]')
					.first()
					.evaluate(async (element) => {
						await Promise.all(
							element
								.getAnimations({ subtree: true })
								.map((animation) => animation.finished.catch(() => {}))
						);
					});
				// Expand deferred rendering for a full-DOM accessibility scan, not only the first viewport.
				await page.addStyleTag({
					content:
						'.lc-defer-render, .lc-defer-render-sm, .lc-defer-render-lg { content-visibility: visible !important; }'
				});
				const dividers = await page.evaluate(findSectionDividers);
				expect.soft(dividers.pairs, `${path}: empty duplicate section boundaries`).toEqual([]);

				const bounds = await page.evaluate(() => ({
					width: innerWidth,
					scroll: document.documentElement.scrollWidth
				}));
				expect
					.soft(bounds.scroll, `${path}: horizontal overflow`)
					.toBeLessThanOrEqual(bounds.width + 1);
				const result = await new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
					.analyze();
				expect
					.soft(
						result.violations,
						`${path}: ${JSON.stringify(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`
					)
					.toEqual([]);
				const closedDetails = page.locator('main details:not([open])');
				await closedDetails.evaluateAll((elements) =>
					elements.forEach((element) => element.setAttribute('data-divider-audit-closed', ''))
				);
				await closedDetails.evaluateAll((elements) =>
					elements.forEach((element) => element.setAttribute('open', ''))
				);
				const expandedDividers = await page.evaluate(findSectionDividers);
				expect
					.soft(expandedDividers.pairs, `${path}: expanded duplicate section boundaries`)
					.toEqual([]);
				await page.locator('[data-divider-audit-closed]').evaluateAll((elements) =>
					elements.forEach((element) => {
						element.removeAttribute('open');
						element.removeAttribute('data-divider-audit-closed');
					})
				);

				if (screenshotDir) {
					await mkdir(screenshotDir, { recursive: true });
					await writeFile(
						join(screenshotDir, `${name}-${width}-${theme}.axe.json`),
						JSON.stringify(
							{
								route: path,
								width,
								theme,
								violations: result.violations,
								sectionDividers: {
									defaultPairs: dividers.pairs,
									expandedPairs: expandedDividers.pairs
								},
								incomplete: result.incomplete.map((check) => ({
									id: check.id,
									targets: check.nodes.map((node) => node.target)
								})),
								passedRules: result.passes.map((check) => check.id)
							},
							null,
							2
						)
					);
					await page.evaluate(() => window.scrollTo(0, 0));
					await page.screenshot({ path: join(screenshotDir, `${name}-${width}-${theme}.png`) });
					if (name === 'comparison') {
						await page.getByTestId('revision-comparison').scrollIntoViewIfNeeded();
						await page.locator('[data-testid="diff-hunk"]').first().scrollIntoViewIfNeeded();
						await page.screenshot({
							path: join(screenshotDir, `comparison-body-${width}-${theme}.png`)
						});
					}
				}
			}
			expect(errors).toEqual([]);
		});
	}
}

test('mobile content priority and comparison reading width', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	const search = await page.getByTestId('home-search-input').boundingBox();
	// Readable landing copy keeps search in the first mobile viewport, not a fixed 450px slot.
	expect(search!.y + search!.height).toBeLessThanOrEqual(675);
	await page.goto('/notices');
	const firstTitle = await page
		.locator('[data-testid^="notice-detail-link-"]')
		.first()
		.boundingBox();
	// Readable labels may wrap; the first result must still fit in the initial viewport.
	expect(firstTitle!.y + firstTitle!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
	await page.goto('/notices/2210004?timeline=1&cmpFrom=1&cmpTo=2');
	await expect(page.getByTestId('revision-comparison')).toBeVisible();
	const text = await page.getByTestId('revision-before-proposalReason').first().boundingBox();
	expect(text!.width).toBeGreaterThanOrEqual(342);
	await page.goto('/notices/2210004');
	const content = page.getByTestId('notice-detail-content');
	const facts = page.getByTestId('notice-detail-facts');
	expect(
		await content.evaluate(
			(e) =>
				!!(
					e.compareDocumentPosition(
						document.querySelector('[data-testid="notice-detail-facts"]')!
					) & Node.DOCUMENT_POSITION_FOLLOWING
				)
		)
	).toBe(true);
	await expect(facts).not.toHaveAttribute('open', '');
});

test('filters support keyboard dismissal, cancellation and URL application', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/notices');
	const trigger = page.getByTestId('notices-filter-toggle');
	await expect(async () => {
		await trigger.focus();
		await trigger.press('Enter');
		await expect(page.getByRole('dialog', { name: '상세 필터' })).toBeVisible({ timeout: 1000 });
	}).toPass();
	await page.getByTestId('notices-start-date').fill('2026-01-01');
	await page.keyboard.press('Escape');
	await expect(trigger).toBeFocused();
	await expect(page.getByRole('dialog')).toBeHidden();
	await trigger.focus();
	await trigger.press('Enter');
	await expect(page.getByTestId('notices-start-date')).toHaveValue('');
	const dialog = page.getByRole('dialog', { name: '상세 필터' });
	await dialog.getByTestId('notices-start-date').fill('2026-01-01');
	await dialog.getByTestId('notices-page-size').selectOption('10');
	await page.getByTestId('notices-filters-apply').click();
	await expect(page).toHaveURL(/startDate=2026-01-01/);
	await expect(page).toHaveURL(/limit=10/);
	await expect(dialog).toBeHidden();
	await expect(page.getByTestId('notices-active-filters')).toContainText('2026-01-01');
});

test('filter dialog traps focus and audits the expanded controls', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/notices?startDate=2026-01-01&limit=10');
	const trigger = page.getByTestId('notices-filter-toggle');
	await expect(async () => {
		await trigger.focus();
		await trigger.press('Enter');
		await expect(page.getByTestId('notices-filter-dialog')).toBeVisible({ timeout: 1000 });
	}).toPass();
	const dialog = page.getByTestId('notices-filter-dialog');
	await expect(dialog.locator('label[for="archive-start-date"]')).toHaveCSS('clip-path', 'none');
	await expect(dialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
	for (let i = 0; i < 24; i++) {
		await page.keyboard.press('Tab');
		expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
	}
	const result = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
		.analyze();
	expect(result.violations).toEqual([]);
	await page.getByTestId('notices-start-date').fill('2026-02-01');
	await dialog.getByRole('button', { name: '취소', exact: true }).click();
	await expect(trigger).toBeFocused();
	await trigger.focus();
	await trigger.press('Enter');
	await expect(page.getByTestId('notices-start-date')).toHaveValue('2026-01-01');
	await page.keyboard.press('Escape');
	await page.getByTestId('notices-search-input').fill('위원회');
	await page.getByTestId('notices-search-submit').click();
	await expect(page).toHaveURL(/startDate=2026-01-01/);
	await expect(page).toHaveURL(/limit=10/);
});

for (const width of [320, 390, 820, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		test(`neutral surfaces, header breathing room and section hierarchy at ${width}px in ${theme}`, async ({
			page
		}) => {
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			await page.goto('/notices');
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			const geometry = await page.evaluate(() => {
				const row = document.querySelector('.lc-header-row')!;
				const brand = document.querySelector('[data-testid="site-brand"]')!;
				const r = row.getBoundingClientRect();
				const b = brand.getBoundingClientRect();
				const style = getComputedStyle(row);
				return {
					top: b.top - r.top,
					bottom: r.bottom - b.bottom,
					paddingTop: parseFloat(style.paddingTop),
					paddingBottom: parseFloat(style.paddingBottom)
				};
			});
			for (const gap of Object.values(geometry)) expect(gap).toBeGreaterThanOrEqual(16);
			await expect(page.locator('.lc-page-shell')).toHaveCSS(
				'background-color',
				theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(36, 37, 38)'
			);
			await expect(page.getByTestId('notices-search-submit')).toHaveCSS(
				'background-color',
				'rgb(29, 78, 216)'
			);
			await expect(page.locator('.lc-result-list')).toHaveCSS('border-top-width', '2px');
			await expect(page.locator('.lc-page-heading')).toHaveCSS('border-bottom-width', '2px');
			const first = page.locator('.lc-result-row').first();
			await expect(first).toHaveCSS('padding-left', '0px');
			await expect(first).toHaveCSS('padding-right', '0px');
			await expect(first).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
			await expect(first).toHaveCSS(
				'border-bottom-color',
				theme === 'light' ? 'rgb(215, 216, 212)' : 'rgb(80, 82, 83)'
			);
			await expect(first).toHaveCSS('border-bottom-style', 'solid');
			// Ongoing and ended records keep the same surface and separator hierarchy.
			for (const selector of ['.lc-notice-card-done', '.lc-notice-border-active']) {
				const row = page.locator(`.lc-result-list > ${selector}`).first();
				await expect(row).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
				await expect(row).toHaveCSS(
					'border-bottom-color',
					theme === 'light' ? 'rgb(215, 216, 212)' : 'rgb(80, 82, 83)'
				);
			}
			await expect(first.locator('.agent-summary-card')).toHaveCSS(
				'background-color',
				theme === 'light' ? 'rgb(243, 243, 241)' : 'rgb(51, 52, 53)'
			);
			const inset = await first.evaluate((row) => {
				const bounds = row.getBoundingClientRect();
				const content = row.firstElementChild!.getBoundingClientRect();
				return {
					left: content.left - bounds.left,
					right: bounds.right - content.right,
					overflow: document.documentElement.scrollWidth - innerWidth
				};
			});
			expect(inset.left).toBe(0);
			expect(inset.right).toBe(0);
			expect(inset.overflow).toBeLessThanOrEqual(1);
			if (screenshotDir) {
				await mkdir(screenshotDir, { recursive: true });
				await page
					.locator('.lc-result-row')
					.first()
					.screenshot({ path: join(screenshotDir, `notice-rows-${width}-${theme}.png`) });
			}

			await page.getByTestId('brand-heading').evaluate(async (element) => {
				await Promise.all(
					element
						.getAnimations({ subtree: true })
						.map((animation) => animation.finished.catch(() => {}))
				);
			});
			const accessibility = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
				.analyze();
			expect(accessibility.violations).toEqual([]);
			await expect(first.locator('.agent-summary-card')).toHaveCSS('border-left-width', '2px');
			await expect(first.locator('.agent-summary-card')).toHaveCSS(
				'border-left-color',
				theme === 'light' ? 'rgb(215, 216, 212)' : 'rgb(80, 82, 83)'
			);
			await expect(page.getByTestId('notices-results-summary')).toHaveCSS(
				'background-color',
				theme === 'light' ? 'rgb(243, 243, 241)' : 'rgb(51, 52, 53)'
			);
			const input = page.getByTestId('notices-search-input');
			const contrast = await input.evaluate((element) => {
				const style = getComputedStyle(element);
				const luminance = (color: string) => {
					const rgb = color
						.match(/[\d.]+/g)!
						.slice(0, 3)
						.map(Number);
					const values = rgb.map((n) => {
						const value = n / 255;
						return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
					});
					return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
				};
				const border = luminance(style.borderColor);
				const surface = luminance(style.backgroundColor);
				return (Math.max(border, surface) + 0.05) / (Math.min(border, surface) + 0.05);
			});
			expect(contrast).toBeGreaterThanOrEqual(3);
			await input.focus();
			await expect(input).toBeFocused();
			await expect(input).toHaveCSS('outline-style', 'solid');
			await expect(input).toHaveCSS('outline-width', '2px');

			await page.evaluate(() => window.scrollTo(0, 700));
			await expect(page.getByTestId('site-header')).toHaveClass(/is-scrolled/);
			await expect(page.getByTestId('site-header')).toHaveCSS(
				'background-color',
				theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(40, 41, 42)'
			);
		});
	}
}

test('opinion boundaries stay single for pre-transfer, ongoing and ended notices', async ({
	page
}) => {
	for (const width of [390, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		for (const theme of ['light', 'dark'] as const) {
			await page.emulateMedia({ colorScheme: theme });
			for (const number of [2210013, 2210015, 2210004]) {
				await page.goto(`/notices/${number}`);
				await page.addStyleTag({
					content:
						'.lc-defer-render, .lc-defer-render-sm { content-visibility: visible !important; }'
				});
				await expect(page.getByTestId('notice-opinion-cta')).toHaveCSS(
					'border-bottom-width',
					'0px'
				);
				await expect(page.getByTestId('notice-detail-content')).toHaveCSS(
					'border-top-width',
					'2px'
				);
				const action = page.getByTestId('notice-opinion-submit');
				if (number === 2210015) await expect(action).toBeEnabled();
				else await expect(action).toBeDisabled();
				if (number === 2210013)
					await expect(page.getByTestId('notice-opinion-guidance')).toContainText('이관되기 전');
				expect((await page.evaluate(findSectionDividers)).pairs).toEqual([]);
			}
		}
	}
});

for (const width of [390, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		for (const motion of ['no-preference', 'reduce'] as const) {
			test(`modal motion and icon close at ${width}px in ${theme} with ${motion}`, async ({
				page
			}) => {
				await page.setViewportSize({ width, height: 900 });
				await page.emulateMedia({ reducedMotion: motion });
				await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
				await page.goto('/notices');
				const trigger = page.getByTestId('notices-filter-toggle');
				const dialog = page.getByTestId('notices-filter-dialog');
				await startModalTransitionSample(page, '.lc-filter-dialog[open]');
				await expect(async () => {
					await trigger.focus();
					await trigger.press('Enter');
					await expect(dialog).toBeVisible({ timeout: 1000 });
				}).toPass();
				await expect(dialog).toHaveCSS('opacity', '1');
				await expect(dialog).toHaveCSS('transform', 'none');
				const close = dialog.getByRole('button', { name: '상세 필터 닫기', exact: true });
				await expect(close.locator('svg[data-icon="xmark"]')).toHaveCount(1);
				await expect(close).toHaveText('');
				const closeBox = await close.boundingBox();
				expect(closeBox!.width).toBeGreaterThanOrEqual(44);
				expect(closeBox!.height).toBeGreaterThanOrEqual(44);
				await page.getByTestId('notices-start-date').fill('2026-01-01');
				const axe = await new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
					.analyze();
				expect(axe.violations).toEqual([]);
				if (screenshotDir)
					await page.screenshot({
						path: join(screenshotDir, `filter-modal-${width}-${theme}-${motion}.png`)
					});
				await close.click();
				await expect(dialog).toBeHidden();
				await expect(trigger).toBeFocused();
				await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
				const nativeSample = await readModalTransitionSample(page);
				if (motion === 'reduce') expect(nativeSample.maxAnimationDuration).toBe(0);
				else {
					expect(nativeSample.minDialogOpacity).toBeLessThan(1);
					expect(nativeSample.closingFrames).toBeGreaterThan(0);
					expect(nativeSample.minClosingOpacity).toBeLessThan(1);
					expect(nativeSample.closingLockPreserved).toBe(true);
				}
				await trigger.focus();
				await trigger.press('Enter');
				await expect(dialog).toBeVisible();
				await expect(page.getByTestId('notices-start-date')).toHaveValue('');
				await page.keyboard.press('Escape');
				await expect(dialog).toBeHidden();
				await expect(trigger).toBeFocused();
				await page.goto('/notices/2210001');
				const newThread = page.getByTestId('discussion-new-thread-button');
				const custom = page.getByTestId('discussion-new-thread-modal');
				await startModalTransitionSample(page);
				await expect(async () => {
					await newThread.focus();
					await newThread.press('Enter');
					await expect(custom).toBeVisible({ timeout: 1000 });
				}).toPass();
				await expect.poll(async () => (await readModalTransitionSample(page)).seen).toBe(true);
				await expect(custom).toHaveCSS('opacity', '1');
				await expect(custom).toHaveCSS('transform', 'none');
				await expect(
					custom
						.getByRole('button', { name: '닫기', exact: true })
						.locator('svg[data-icon="xmark"]')
				).toHaveCount(1);
				if (screenshotDir)
					await page.screenshot({
						path: join(screenshotDir, `shared-modal-${width}-${theme}-${motion}.png`)
					});
				const customSample = await readModalTransitionSample(page);
				if (motion === 'reduce') expect(customSample.maxAnimationDuration).toBe(0);
				else expect(customSample.minDialogScale).toBeLessThan(0.99);
				await custom.getByRole('button', { name: '닫기', exact: true }).click();
				await expect(custom).toHaveCount(0);
				await expect(newThread).toBeFocused();
				if (screenshotDir)
					await writeFile(
						join(screenshotDir, `modal-motion-${width}-${theme}-${motion}.json`),
						JSON.stringify({ nativeSample, customSample }, null, 2)
					);
			});
		}
	}
}

for (const width of [390, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		for (const motion of ['no-preference', 'reduce'] as const) {
			test(`disclosure motion at ${width}px in ${theme} with ${motion}`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 });
				await page.emulateMedia({ reducedMotion: motion });
				await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
				await page.goto('/notices/2210004');
				const facts = page.getByTestId('notice-detail-facts');
				await expect(facts).toHaveAttribute('data-disclosure-enhanced', '');
				await expect
					.poll(() => facts.evaluate((node) => (node as HTMLDetailsElement).open))
					.toBe(width >= 1024);
				await facts.evaluate((node) => {
					(node as HTMLDetailsElement).open = false;
				});
				await expect(facts).not.toHaveAttribute('open');
				await page.evaluate(() => {
					const durations: number[] = [];
					(window as unknown as { disclosureDurations: number[] }).disclosureDurations = durations;
					const samples: { from: number; to: number; heights: number[] }[] = [];
					(window as unknown as { disclosureSamples: typeof samples }).disclosureSamples = samples;
					const animate = Element.prototype.animate;
					Element.prototype.animate = function (frames, options) {
						if (this instanceof HTMLDetailsElement && typeof options === 'object')
							durations.push(Number(options.duration));
						const animation = animate.call(this, frames, options);
						if (this instanceof HTMLDetailsElement && animation.effect instanceof KeyframeEffect) {
							const keyframes = animation.effect.getKeyframes();
							const sample = {
								from: parseFloat(String(keyframes[0].height)),
								to: parseFloat(String(keyframes[1].height)),
								heights: [] as number[]
							};
							samples.push(sample);
							const frame = () => {
								sample.heights.push(this.getBoundingClientRect().height);
								if (animation.playState === 'running') requestAnimationFrame(frame);
							};
							requestAnimationFrame(frame);
						}
						return animation;
					};
				});
				const summary = facts.locator(':scope > summary');
				await summary.focus();
				const collapsed = await facts.evaluate((node) => node.getBoundingClientRect().height);
				await page.keyboard.press('Enter');
				await expect(facts).toHaveAttribute('open', '');
				await expect(facts).not.toHaveAttribute('data-disclosure-state');
				expect(await facts.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThan(
					collapsed + 50
				);
				const axe = await new AxeBuilder({ page })
					.include('[data-testid="notice-detail-facts"]')
					.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
					.analyze();
				expect(axe.violations).toEqual([]);
				if (screenshotDir)
					await facts.screenshot({
						path: join(screenshotDir, `facts-expanded-${width}-${theme}-${motion}.png`)
					});
				await page.keyboard.press('Space');
				await expect(facts).not.toHaveAttribute('open');
				await expect(summary).toBeFocused();
				expect(await facts.evaluate((node) => node.style.height)).toBe('');
				const durations = await page.evaluate(
					() => (window as unknown as { disclosureDurations: number[] }).disclosureDurations
				);
				expect(durations).toEqual(motion === 'reduce' ? [] : [240, 180]);
				const samples = await page.evaluate(
					() =>
						(
							window as unknown as {
								disclosureSamples: { from: number; to: number; heights: number[] }[];
							}
						).disclosureSamples
				);
				for (const sample of samples)
					expect(
						sample.heights.some(
							(height) =>
								height > Math.min(sample.from, sample.to) + 1 &&
								height < Math.max(sample.from, sample.to) - 1
						)
					).toBe(true);
				if (screenshotDir)
					await writeFile(
						join(screenshotDir, `disclosure-frames-${width}-${theme}-${motion}.json`),
						JSON.stringify(samples, null, 2)
					);
				if (screenshotDir)
					await facts.screenshot({
						path: join(screenshotDir, `facts-collapsed-${width}-${theme}-${motion}.png`)
					});
				await summary.focus();
				await page.keyboard.press('Enter');
				await page.keyboard.press('Enter');
				await page.keyboard.press('Enter');
				await expect(facts).toHaveAttribute('open', '');
				await expect(facts).not.toHaveAttribute('data-disclosure-state');
				expect(await facts.evaluate((node) => node.style.height)).toBe('');
				await page.keyboard.press('Space');
				await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 900 });
				await expect
					.poll(() => facts.evaluate((node) => (node as HTMLDetailsElement).open))
					.toBe(width === 390);
				await expect(facts).not.toHaveAttribute('data-disclosure-state');
				expect(await facts.evaluate((node) => node.style.height)).toBe('');
			});
		}
	}
}

test('disclosure motion preserves lazy and nested content across routes', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 900 });
	await page.goto('/notices/2210004?timeline=1&cmpFrom=1&cmpTo=2');
	for (const id of ['notice-detail-archive-meta', 'revision-history']) {
		const details = page.getByTestId(id);
		await expect(details).toHaveAttribute('data-disclosure-enhanced', '');
		if (await details.evaluate((node) => (node as HTMLDetailsElement).open)) {
			await details.locator(':scope > summary').click();
			await expect(details).not.toHaveAttribute('open');
		}
		await details.locator(':scope > summary').click();
		await expect(details).toHaveAttribute('open', '');
		await expect(details).not.toHaveAttribute('data-disclosure-state');
		expect(await details.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThan(
			100
		);
		await expect(details.locator(':scope > div').first()).toBeVisible();
		// Mobile comparison mode hides the record list until its tab is selected.
		if (id === 'revision-history' && (await page.getByTestId('history-show-records').isVisible())) {
			await page.getByTestId('history-show-records').click();
			await expect(page.getByTestId('revision-records')).toBeVisible();
		}
		const nested = details.locator('details[data-disclosure-enhanced]').first();
		if (await nested.count()) {
			await nested.locator(':scope > summary').click();
			await expect(nested).toHaveAttribute('open', '');
			await expect(nested).not.toHaveAttribute('data-disclosure-state');
		}
		await details.locator(':scope > summary').click();
		await expect(details).not.toHaveAttribute('open');
		expect(await details.evaluate((node) => node.style.height)).toBe('');
	}
	for (const route of ['/proposals', '/notices/changes', '/announcements/mock-announcement-2']) {
		await page.goto(route);
		const details = page.locator('details[data-disclosure-enhanced]').first();
		await expect(details).toBeVisible();
		await details.locator(':scope > summary').click();
		await expect(details).toHaveAttribute('open', '');
		await expect(details).not.toHaveAttribute('data-disclosure-state');
		await details.locator(':scope > summary').click();
		await expect(details).not.toHaveAttribute('open');
	}
});

for (const width of [320, 390, 640, 820, 1024, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		test(`straight signal dividers at ${width}px in ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			await page.goto('/');
			const grid = page.getByRole('list', { name: '플랫폼 핵심 상태' });
			await expect(grid).toBeVisible();
			await page.evaluate(() => document.fonts.ready);
			const measurements = await grid.locator(':scope > li').evaluateAll((nodes) =>
				nodes.map((node) => {
					const card = getComputedStyle(node),
						rule = getComputedStyle(node, '::before');
					return {
						border: card.borderLeftWidth,
						padding: card.paddingLeft,
						width: node.getBoundingClientRect().width,
						content: rule.content,
						ruleWidth: rule.width,
						radius: rule.borderTopLeftRadius,
						left: rule.left,
						top: rule.top,
						bottom: rule.bottom,
						pointerEvents: rule.pointerEvents
					};
				})
			);
			expect(measurements).toHaveLength(4);
			for (const item of measurements) {
				expect(item.border).toBe('0px');
				expect(item.padding).toBe('0px');
			}
			expect(
				Math.max(...measurements.map((item) => item.width)) -
					Math.min(...measurements.map((item) => item.width))
			).toBeLessThan(1);
			expect(measurements[0].content).toBe('none');
			for (const item of measurements.slice(1)) {
				if (width < 1024) expect(item.content).toBe('none');
				else {
					expect(item.content).toBe('""');
					expect(item.ruleWidth).toBe('1px');
					expect(item.radius).toBe('0px');
					expect(item.left).toBe('-8px');
					expect(item.top).toBe('4px');
					expect(item.bottom).toBe('4px');
					expect(item.pointerEvents).toBe('none');
				}
			}
			const archive = page.getByTestId('home-status-link-archive');
			await archive.focus();
			await expect(archive).toBeFocused();
			await expect(page.getByTestId('home-status-link-changes')).toHaveAttribute(
				'href',
				'/notices/changes'
			);
			await expect(archive).toHaveAttribute('href', '/notices');
			await page.mouse.move(0, 0);
			await archive.evaluate((node) => node.blur());
			// Persistent action copy also identifies these links on touch screens.
			await expect(archive.locator('p').last()).toHaveCSS('visibility', 'visible');
			const axe = await new AxeBuilder({ page })
				.include('.lc-home-signal-grid')
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
				.analyze();
			expect(axe.violations).toEqual([]);
			expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
				false
			);
			if (screenshotDir) {
				await grid.screenshot({
					path: join(screenshotDir, `signal-dividers-${width}-${theme}.png`)
				});
				await writeFile(
					join(screenshotDir, `signal-dividers-${width}-${theme}.json`),
					JSON.stringify({ measurements, violations: axe.violations }, null, 2)
				);
			}
		});
	}
}

for (const width of [320, 390, 820, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		for (const motion of ['no-preference', 'reduce'] as const) {
			test(`home scroll cue at ${width}px in ${theme} with ${motion}`, async ({ page }) => {
				await page.setViewportSize({ width, height: 1000 });
				await page.emulateMedia({ reducedMotion: motion });
				await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
				await page.goto('/');
				await page.evaluate(() => document.fonts.ready);
				const cue = page.getByTestId('home-scroll-cue');
				await expect(cue).toHaveText('최근 입법예고 보기');
				await expect(cue).toHaveAccessibleName('최근 입법예고 보기');
				await expect(cue).toHaveAttribute('href', '#recent-notices');
				await expect(cue.locator('svg[data-icon="chevron-down"]')).toHaveAttribute(
					'aria-hidden',
					'true'
				);
				const cueBox = await cue.boundingBox(),
					heroBox = await page.locator('.lc-home-hero-content').boundingBox();
				expect(cueBox!.height).toBeGreaterThanOrEqual(44);
				expect(cueBox!.width).toBeLessThan(250);
				expect(
					Math.abs(cueBox!.x + cueBox!.width / 2 - heroBox!.x - heroBox!.width / 2)
				).toBeLessThan(1);
				await expect(cue).toHaveCSS('border-top-width', '0px');
				await expect(cue).toHaveCSS('transform', 'none');
				const animationCount = await cue.evaluate(
					(node) => node.getAnimations({ subtree: true }).length
				);
				expect(animationCount).toBe(0);
				const axe = await new AxeBuilder({ page })
					.include('.lc-home-scroll-cue')
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
					.analyze();
				expect(axe.violations).toEqual([]);
				await cue.focus();
				await expect(cue).toBeFocused();
				await expect(cue).toHaveCSS('outline-style', 'solid');
				if (screenshotDir)
					await cue.screenshot({
						path: join(screenshotDir, `scroll-cue-focus-${width}-${theme}-${motion}.png`)
					});
				await page.keyboard.press('Enter');
				await expect(page).toHaveURL(/#recent-notices$/);
				const target = page.getByTestId('recent-notices-region');
				await expect(target).toBeFocused();
				await expect
					.poll(() =>
						page.evaluate(() => {
							const target = document.querySelector('#recent-notices')!.getBoundingClientRect();
							const header = document.querySelector('header')!.getBoundingClientRect();
							return target.top >= header.bottom && target.top < innerHeight / 2;
						})
					)
					.toBe(true);
				await expect(
					target.getByRole('heading', { name: '최근 입법예고', exact: true }).last()
				).toBeInViewport();
				expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
					false
				);
			});
		}
	}
}

test('home scroll cue works without JavaScript', async ({ browser }) => {
	const context = await browser.newContext({
		javaScriptEnabled: false,
		viewport: { width: 390, height: 900 }
	});
	try {
		const page = await context.newPage();
		await page.goto('/');
		await page.getByTestId('home-scroll-cue').click();
		await expect(page).toHaveURL(/#recent-notices$/);
		await expect(page.getByTestId('recent-notices-region')).toBeFocused();
	} finally {
		await context.close();
	}
});

for (const width of [320, 390, 640, 820, 1024, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		test(`landing rhythm at ${width}px in ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			await page.goto('/');
			await page.evaluate(() => document.fonts.ready);
			const hero = page.getByTestId('home-hero');
			const metrics = await hero.evaluate((node) => {
				const rect = (selector: string) => node.querySelector(selector)!.getBoundingClientRect();
				const size = (selector: string) =>
					parseFloat(getComputedStyle(node.querySelector(selector)!).fontSize);
				return {
					badgeGap: rect('h1').top - rect('.lc-home-introduction > div:first-child').bottom,
					title: size('h1'),
					body: size('.lc-home-description'),
					input: size('input'),
					metadata: size('.lc-home-keywords-meta'),
					status: size('.lc-home-signal-desc'),
					keywordGap:
						rect('[data-testid="home-quick-keywords"]').top -
						rect('.lc-home-keywords-heading').bottom,
					columns: getComputedStyle(
						node.querySelector('.lc-home-signal-grid')!
					).gridTemplateColumns.split(' ').length,
					inputBox: rect('input').toJSON(),
					submitBox: rect('button[type="submit"]').toJSON()
				};
			});
			expect(metrics.badgeGap).toBeGreaterThanOrEqual(20);
			expect(metrics.title).toBeGreaterThanOrEqual(30);
			expect(metrics.body).toBeGreaterThanOrEqual(16);
			expect(metrics.input).toBe(16);
			expect(metrics.metadata).toBeGreaterThanOrEqual(13);
			expect(metrics.status).toBeGreaterThanOrEqual(14);
			// Browser engines round fractional layout pixels differently.
			expect(metrics.keywordGap).toBeGreaterThanOrEqual(11.5);
			expect(metrics.columns).toBe(width < 1024 ? 2 : 4);
			expect(metrics.inputBox.height).toBeGreaterThanOrEqual(56);
			expect(metrics.submitBox.height).toBeGreaterThanOrEqual(56);
			if (width < 480) {
				expect(metrics.submitBox.top - metrics.inputBox.bottom).toBeGreaterThanOrEqual(11.5);
				expect(Math.abs(metrics.submitBox.width - metrics.inputBox.width)).toBeLessThan(1);
				expect(metrics.inputBox.bottom).toBeLessThan(720);
			} else expect(Math.abs(metrics.submitBox.top - metrics.inputBox.top)).toBeLessThan(1);
			const axe = await new AxeBuilder({ page })
				.include('.lc-home-hero')
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
				.analyze();
			expect(axe.violations).toEqual([]);
			expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
				false
			);
			if (screenshotDir) {
				const captureHeight =
					Math.ceil(await hero.evaluate((node) => node.getBoundingClientRect().height)) + 300;
				await page.setViewportSize({ width, height: captureHeight });
				await page.evaluate(() => window.scrollTo(0, 0));
				await hero.screenshot({
					path: join(screenshotDir, `landing-rhythm-${width}-${theme}.png`)
				});
				await writeFile(
					join(screenshotDir, `landing-rhythm-${width}-${theme}.json`),
					JSON.stringify({ metrics, violations: axe.violations }, null, 2)
				);
			}
		});
	}
}

for (const width of [390, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		for (const mode of ['keyword', 'semantic']) {
			test(`loading backdrop follows page theme at ${width}px in ${theme} for ${mode}`, async ({
				page
			}) => {
				await page.setViewportSize({ width, height: 900 });
				await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
				const hydrated = page.waitForRequest('**/api/notices/semantic-search/health');
				await page.goto(`/notices?searchMode=${mode}`);
				await hydrated;
				let release!: () => void;
				const pending = new Promise<void>((resolve) => {
					release = resolve;
				});
				await page.route(/\/notices\/__data\.json/, async (route) => {
					await pending;
					await route.fallback();
				});
				try {
					await page.getByTestId('notices-search-input').fill('보호');
					await page.getByTestId('notices-search-input').press('Enter');
					const overlay = page.locator('.lc-loading-overlay');
					await expect(overlay).toBeVisible();
					await expect(overlay).toHaveCSS('border-radius', '0px');
					const surfaces = await overlay.evaluate((element) => {
						const sample = document.createElement('span');
						sample.style.background = 'color-mix(in srgb, var(--lc-body-bg) 55%, transparent)';
						document.body.append(sample);
						const expected = getComputedStyle(sample).backgroundColor;
						sample.remove();
						return { actual: getComputedStyle(element).backgroundColor, expected };
					});
					expect(surfaces.actual).toBe(surfaces.expected);
					await expect(page.locator('.lc-result-row').first()).toHaveCSS(
						'background-color',
						'rgba(0, 0, 0, 0)'
					);
					if (mode === 'semantic')
						await expect(page.getByTestId('open-signal-loader')).toBeVisible();
					else await expect(page.locator('.lc-spinner-ring')).toBeVisible();
					if (screenshotDir) {
						await mkdir(screenshotDir, { recursive: true });
						await page.screenshot({
							path: join(screenshotDir, `loading-${width}-${theme}-${mode}.png`)
						});
					}
				} finally {
					release();
				}
				await expect(page.locator('.lc-loading-overlay')).toHaveCount(0);
				await expect(page.locator('.lc-result-row').first()).toHaveCSS('padding-left', '0px');
			});
		}
	}
}

for (const width of [390, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		for (const target of ['semantic', 'changes', 'proposals'] as const) {
			test(`other page loading palette for ${target} at ${width}px in ${theme}`, async ({
				page
			}) => {
				await page.setViewportSize({ width, height: 900 });
				await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
				const path =
					target === 'semantic'
						? '/notices/semantic-search'
						: target === 'changes'
							? '/notices/changes'
							: '/proposals';
				const hydrated = page.waitForRequest('**/api/notices/semantic-search/health');
				await page.goto(path);
				if (target === 'semantic') await hydrated;
				else hydrated.catch(() => {});
				await page.getByTestId('brand-heading').evaluate(async (node) => {
					await Promise.all(
						node.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))
					);
				});
				let release!: () => void;
				const pending = new Promise<void>((resolve) => {
					release = resolve;
				});
				await page.route(/\/__data\.json/, async (route) => {
					await pending;
					await route.fallback();
				});
				try {
					if (target === 'semantic') {
						await page.getByTestId('semantic-search-input').fill('보호');
						await page.getByTestId('semantic-search-input').press('Enter');
					} else if (target === 'changes') {
						await page.locator('#changes-search').fill('보호');
						await page.locator('#changes-search').press('Enter');
					} else {
						if (!((await page.getByTestId('statistics-settings').getAttribute('open')) !== null))
							await page.locator('[data-testid="statistics-settings"] summary').click();
						await page.getByRole('button', { name: '월별', exact: true }).click();
					}
					const panel =
						target === 'semantic'
							? page.getByTestId('semantic-search-loading-state')
							: page.locator('.lc-loading-overlay');
					await expect(panel).toBeVisible();
					if (target === 'semantic') {
						await expect(panel).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
						await expect(panel).toHaveCSS('border-radius', '0px');
						await expect(panel).toHaveCSS('border-left-width', '0px');
					} else {
						const colors = await panel.evaluate((node) => {
							const probe = document.createElement('span');
							probe.style.background = 'color-mix(in srgb, var(--lc-body-bg) 55%, transparent)';
							document.body.append(probe);
							const result = {
								actual: getComputedStyle(node).backgroundColor,
								expected: getComputedStyle(probe).backgroundColor
							};
							probe.remove();
							return result;
						});
						expect(colors.actual).toBe(colors.expected);
						await expect(panel).toHaveCSS('border-radius', '0px');
						await expect(page.locator('.lc-spinner-ring')).toHaveCSS(
							'border-top-color',
							theme === 'light' ? 'rgb(29, 78, 216)' : 'rgb(155, 185, 217)'
						);
					}
					if (screenshotDir) {
						await mkdir(screenshotDir, { recursive: true });
						await page.screenshot({
							path: join(screenshotDir, `other-loading-${target}-${width}-${theme}.png`)
						});
					}
				} finally {
					release();
				}
				await expect(
					page.locator('.lc-loading-overlay, [data-testid="semantic-search-loading-state"]')
				).toHaveCount(0);
			});
		}
	}
}

for (const theme of ['light', 'dark'] as const) {
	for (const width of [390, 1440]) {
		test(`discussion skeleton retains current palette at ${width}px in ${theme}`, async ({
			browser,
			baseURL
		}) => {
			const context = await browser.newContext({
				javaScriptEnabled: false,
				viewport: { width, height: 900 },
				reducedMotion: 'reduce'
			});
			try {
				const page = await context.newPage();
				await page.goto(`${baseURL}/notices/2210001/discussions/221000101`);
				await page.evaluate(
					(value) => document.documentElement.setAttribute('data-theme', value),
					theme
				);
				const skeleton = page.getByTestId('discussion-thread-skeleton');
				await expect(skeleton).toBeVisible();
				await expect(skeleton).toHaveAttribute('aria-hidden', 'true');
				await expect(skeleton.locator('.lc-skeleton').first()).toHaveCSS(
					'background-color',
					theme === 'light' ? 'rgb(215, 216, 212)' : 'rgb(80, 82, 83)'
				);
				await expect(skeleton.locator('.lc-skeleton').first()).toHaveCSS('animation-name', 'none');
				await expect(page.getByTestId('discussion-skeleton-composer')).toHaveCSS(
					'background-color',
					theme === 'light' ? 'rgb(243, 243, 241)' : 'rgb(51, 52, 53)'
				);
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true
				);
				if (screenshotDir) {
					await mkdir(screenshotDir, { recursive: true });
					await page.screenshot({
						path: join(screenshotDir, `discussion-loading-${width}-${theme}.png`)
					});
				}
			} finally {
				await context.close();
			}
		});
	}
}

for (const width of [320, 390, 820, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		test(`semantic result surface hierarchy at ${width}px in ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			await page.goto(
				'/notices/semantic-search?search=' + encodeURIComponent('임대차 계약에서 세입자 보호')
			);
			const result = page.getByTestId('semantic-result-2220607');
			await expect(result).toBeVisible();
			await expect(result).toHaveCSS(
				'background-color',
				theme === 'light' ? 'rgb(243, 243, 241)' : 'rgb(45, 46, 47)'
			);
			await expect(result.locator('.lc-chip-blue')).toHaveCSS(
				'background-color',
				theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(51, 52, 53)'
			);
			await expect(result.locator('.lc-chip-purple')).toHaveCSS(
				'background-color',
				theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(51, 52, 53)'
			);
			await expect(result).toHaveCSS('border-left-width', '4px');
			await expect(result).toHaveCSS('padding-left', width < 640 ? '16px' : '24px');
			await expect(result.locator('h3 a')).toHaveAttribute('href', '/notices/2220607');
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			await page.getByTestId('brand-heading').evaluate(async (node) => {
				await Promise.all(
					node.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))
				);
			});
			const accessibility = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
				.analyze();
			expect(accessibility.violations).toEqual([]);
			if (screenshotDir) {
				await mkdir(screenshotDir, { recursive: true });
				await page
					.getByTestId('semantic-search-results-region')
					.screenshot({ path: join(screenshotDir, `semantic-results-${width}-${theme}.png`) });
			}
		});
	}
}

for (const theme of ['light', 'dark'] as const) {
	for (const variant of ['fallback', 'weak'] as const) {
		test(`semantic secondary result surface for ${variant} in ${theme}`, async ({ page }) => {
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			const hydrated = page.waitForRequest('**/api/notices/semantic-search/health');
			await page.goto(
				'/notices/semantic-search?search=' +
					encodeURIComponent(variant === 'fallback' ? '키워드 보호' : '약한 보호')
			);
			await hydrated;
			if (variant === 'weak') await page.getByTestId('semantic-search-show-weak').click();
			const result = page.locator('[data-testid="semantic-search-results-list"] article').first();
			await expect(result).toBeVisible();
			await expect(result).toHaveCSS(
				'background-color',
				theme === 'light' ? 'rgb(243, 243, 241)' : 'rgb(45, 46, 47)'
			);
			await expect(result.locator('.lc-chip-blue')).toHaveCSS(
				'background-color',
				theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(51, 52, 53)'
			);
		});
	}
}

for (const width of [390, 1440]) {
	for (const theme of ['light', 'dark'] as const) {
		test(`cross-page content card hierarchy at ${width}px in ${theme}`, async ({ page }) => {
			test.setTimeout(120_000);
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			for (const [name, path, selector] of [
				['proposals', '/proposals', 'main section.lc-panel-card'],
				['changes', '/notices/changes', '[data-testid="changes-results-region"] article'],
				['discussions', '/discussions', '[data-testid="discussions-list"]'],
				['announcements', '/announcements', '[data-testid="admin-notices-list"]'],
				['thread', '/notices/2210001/discussions/221000101', '[data-testid="discussion-comment-1"]']
			]) {
				await page.goto(path);
				await page.mouse.move(0, 0);
				const card = page.locator(selector).first();
				await expect(card).toBeVisible();
				await expect(card).toHaveCSS(
					'background-color',
					name === 'changes' || name === 'discussions'
						? 'rgba(0, 0, 0, 0)'
						: theme === 'light'
							? 'rgb(243, 243, 241)'
							: 'rgb(45, 46, 47)'
				);
				if (name === 'changes' || name === 'discussions') {
					await expect(card).toHaveCSS('border-left-width', '0px');
				} else {
					await expect(card).toHaveCSS(
						'border-color',
						theme === 'light' ? 'rgb(215, 216, 212)' : 'rgb(80, 82, 83)'
					);
				}
				const chips = card.locator('.lc-chip-blue, .lc-chip-muted, .lc-chip-purple');
				if (await chips.count())
					await expect(chips.first()).toHaveCSS(
						'background-color',
						name === 'changes' || name === 'discussions'
							? 'rgba(0, 0, 0, 0)'
							: theme === 'light'
								? 'rgb(255, 255, 255)'
								: 'rgb(51, 52, 53)'
					);
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true
				);
				await page.getByTestId('brand-heading').evaluate(async (node) => {
					await Promise.all(
						node.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))
					);
				});
				const accessibility = await new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
					.analyze();
				expect(accessibility.violations).toEqual([]);
				if (screenshotDir) {
					await mkdir(screenshotDir, { recursive: true });
					await page.screenshot({
						path: join(screenshotDir, `content-cards-${name}-${width}-${theme}.png`)
					});
				}
			}
			const hydrated = page.waitForRequest('**/api/notices/semantic-search/health');
			await page.goto(
				'/notices?searchMode=semantic&search=' + encodeURIComponent('약한 결과 조회')
			);
			await hydrated;
			await page.getByTestId('notices-semantic-show-weak').click();
			const weak = page.locator('[data-testid^="notices-weak-result-"]').first();
			await expect(weak).toBeVisible();
			await expect(weak).toHaveCSS(
				'background-color',
				theme === 'light' ? 'rgb(243, 243, 241)' : 'rgb(45, 46, 47)'
			);
			await page.goto('/notices');
			await expect(page.locator('.lc-result-row').first()).toHaveCSS(
				'background-color',
				'rgba(0, 0, 0, 0)'
			);
			await expect(page.locator('.lc-result-row').first()).toHaveCSS('padding-left', '0px');
			await page.goto('/notices/2210004');
			await expect(page.locator('.lc-reading-content')).toHaveCSS(
				'background-color',
				'rgba(0, 0, 0, 0)'
			);
		});
	}
}

for (const initialTheme of ['light', 'dark'] as const) {
	for (const width of [390, 1440]) {
		test(`theme palette frames and interactive contrast from ${initialTheme} at ${width}px`, async ({
			page
		}) => {
			test.setTimeout(120_000);
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript(
				(value) => localStorage.setItem('lawcast-theme', value),
				initialTheme
			);
			for (const [name, path, target, selectors] of [
				[
					'announcement',
					'/announcements',
					'[data-testid^="admin-notices-list-link-"]',
					['.lc-content-card .lc-list-title', '.lc-content-card .lc-chip-muted']
				],
				[
					'discussion',
					'/discussions',
					'[data-testid^="discussions-list-link-"]',
					[
						'.lc-discussion-list .lc-list-title',
						'.lc-discussion-list .lc-chip-success',
						'.lc-discussion-list .lc-chip-blue'
					]
				],
				[
					'semantic',
					'/notices/semantic-search?search=보호',
					'[data-testid="semantic-search-keyword-link"]',
					[
						'.lc-semantic-result h3 a',
						'.lc-semantic-result .lc-chip-blue',
						'.lc-semantic-result .lc-chip-success',
						'[data-testid="semantic-search-keyword-link"]'
					]
				],
				[
					'comment',
					'/notices/2210001/discussions/221000101',
					'[data-testid="discussion-comment-1"]',
					[
						'[data-testid="discussion-comment-1"]',
						'[data-testid="discussion-comment-1"] .lc-text-muted'
					]
				]
			] as const) {
				await page.goto(path);
				const interactive = page.locator(target).first();
				await expect(interactive).toBeVisible();
				await page.getByTestId('brand-heading').evaluate(async (node) => {
					await Promise.all(
						node.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))
					);
				});
				for (const state of ['hover', 'focus'] as const) {
					if (state === 'hover') await interactive.hover();
					else {
						await page.mouse.move(0, 0);
						if (name !== 'comment') {
							await page.keyboard.press('Tab');
							await interactive.focus();
							await expect(interactive).toHaveCSS('outline-style', 'solid');
							if (name === 'announcement' || name === 'discussion')
								await expect(interactive).toHaveCSS('outline-offset', '-3px');
						}
					}
					await startPaletteSampling(page, [...selectors]);
					// Invoke the actual switch handler without moving the retained pointer/focus state.
					await page
						.getByRole('switch', { includeHidden: true })
						.first()
						.evaluate((button: HTMLButtonElement) => button.click());
					const frames = await readPaletteSamples(page);
					expect(frames.length).toBeGreaterThan(10);
					expect(
						Math.min(...frames.map((frame) => frame.ratio)),
						JSON.stringify(frames.filter((frame) => frame.ratio < 4.5))
					).toBeGreaterThanOrEqual(4.5);
					await expect(page.locator('html')).not.toHaveAttribute('data-theme-changing');
					if (screenshotDir) {
						await mkdir(screenshotDir, { recursive: true });
						await writeFile(
							join(screenshotDir, `theme-frames-${name}-${initialTheme}-${width}-${state}.json`),
							JSON.stringify(frames, null, 2)
						);
						await page.screenshot({
							path: join(screenshotDir, `theme-state-${name}-${initialTheme}-${width}-${state}.png`)
						});
					}
				}
			}
		});
	}
}

for (const initialTheme of ['light', 'dark'] as const) {
	for (const mode of ['keyword', 'semantic']) {
		test(`loading palette stays synchronized from ${initialTheme} for ${mode}`, async ({
			page
		}) => {
			await page.addInitScript(
				(value) => localStorage.setItem('lawcast-theme', value),
				initialTheme
			);
			const hydrated = page.waitForRequest('**/api/notices/semantic-search/health');
			await page.goto(`/notices?searchMode=${mode}`);
			await hydrated;
			let release!: () => void;
			const pending = new Promise<void>((resolve) => {
				release = resolve;
			});
			await page.route(/\/notices\/__data\.json/, async (route) => {
				await pending;
				await route.fallback();
			});
			try {
				await page.getByTestId('notices-search-input').fill('보호');
				await page.getByTestId('notices-search-input').press('Enter');
				await expect(page.locator('.lc-loading-overlay')).toBeVisible();
				for (const next of [initialTheme === 'light' ? 'dark' : 'light', initialTheme]) {
					await startPaletteSampling(page, ['.lc-loading-shell p']);
					await page
						.getByRole('switch', { includeHidden: true })
						.first()
						.evaluate((button: HTMLButtonElement) => button.click());
					const frames = await readPaletteSamples(page);
					expect(Math.min(...frames.map((frame) => frame.ratio))).toBeGreaterThanOrEqual(4.5);
					await expect(page.locator('html')).toHaveAttribute('data-theme', next);
					const color = await page.locator('.lc-loading-overlay').evaluate((node) => {
						const probe = document.createElement('span');
						probe.style.background = 'color-mix(in srgb, var(--lc-body-bg) 55%, transparent)';
						document.body.append(probe);
						const expected = getComputedStyle(probe).backgroundColor;
						probe.remove();
						return { actual: getComputedStyle(node).backgroundColor, expected };
					});
					expect(color.actual).toBe(color.expected);
					if (screenshotDir) {
						await mkdir(screenshotDir, { recursive: true });
						await writeFile(
							join(screenshotDir, `loading-theme-${initialTheme}-${mode}-${next}.json`),
							JSON.stringify(frames, null, 2)
						);
					}
				}
			} finally {
				release();
			}
			await expect(page.locator('.lc-loading-overlay')).toHaveCount(0);
		});
	}
}

test('palette interpolation control reproduces mixed-theme contrast', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('lawcast-theme', 'dark'));
	await page.goto('/notices/semantic-search?search=보호');
	await page.getByTestId('brand-heading').evaluate(async (node) => {
		await Promise.all(node.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})));
	});
	const target = page.getByTestId('semantic-search-keyword-link');
	await target.hover();
	// Restore only the button's original color transitions as an isolated negative control.
	await page.addStyleTag({
		content:
			'html[data-theme-changing] [data-testid="semantic-search-keyword-link"] { transition-property: background-color, border-color, color !important; }'
	});
	await startPaletteSampling(page, ['[data-testid="semantic-search-keyword-link"]']);
	await page
		.getByRole('switch', { includeHidden: true })
		.first()
		.evaluate((button: HTMLButtonElement) => button.click());
	const frames = await readPaletteSamples(page);
	expect(Math.min(...frames.map((frame) => frame.ratio))).toBeLessThan(4.5);
	if (screenshotDir) {
		await mkdir(screenshotDir, { recursive: true });
		await writeFile(join(screenshotDir, 'negative-control.json'), JSON.stringify(frames, null, 2));
	}
});

for (const initialTheme of ['light', 'dark'] as const) {
	for (const reducedMotion of ['reduce', 'no-preference'] as const) {
		test(`mobile touch theme from ${initialTheme} with ${reducedMotion}`, async ({
			page
		}, testInfo) => {
			await page.emulateMedia({ reducedMotion });
			await page.addInitScript(
				(value) => localStorage.setItem('lawcast-theme', value),
				initialTheme
			);
			const hydrated = page.waitForRequest('**/api/notices/semantic-search/health');
			await page.goto('/notices/semantic-search?search=보호');
			await hydrated;
			const capabilities = await page.evaluate(() => ({
				touchPoints: navigator.maxTouchPoints,
				coarse: matchMedia('(pointer: coarse)').matches,
				hover: matchMedia('(hover: hover)').matches
			}));
			testInfo.annotations.push({ type: 'touch-media', description: JSON.stringify(capabilities) });
			expect(capabilities.coarse).toBe(true);
			await page.evaluate(() => {
				Reflect.set(window, '__trustedTouchStarts', 0);
				document.addEventListener(
					'touchstart',
					(event) => {
						if (event.isTrusted)
							Reflect.set(
								window,
								'__trustedTouchStarts',
								Reflect.get(window, '__trustedTouchStarts') + 1
							);
					},
					{ capture: true }
				);
			});
			for (const next of [initialTheme === 'light' ? 'dark' : 'light', initialTheme]) {
				await page.getByRole('button', { name: '메뉴 열기', exact: true }).tap();
				const control = page.getByRole('switch');
				await expect(control).toBeVisible();
				await startPaletteSampling(page, [
					'.lc-semantic-result h3 a',
					'.lc-semantic-result .lc-chip-success',
					'.lc-semantic-result .lc-chip-blue'
				]);
				await control.tap();
				const frames = await readPaletteSamples(page);
				expect(Math.min(...frames.map((frame) => frame.ratio))).toBeGreaterThanOrEqual(4.5);
				await expect(control).toHaveAttribute('aria-checked', String(next === 'dark'));
				await expect(control).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
				await expect(page.locator('html')).toHaveAttribute('data-theme', next);
				await expect(page.locator('html')).not.toHaveAttribute('data-theme-changing');
				await page.getByTestId('mobile-menu-close').tap();
				await expect(page.getByTestId('mobile-navigation')).toHaveCount(0);
				await expect(page.getByTestId('semantic-result-2220607')).toHaveCSS(
					'background-color',
					next === 'dark' ? 'rgb(45, 46, 47)' : 'rgb(243, 243, 241)'
				);
				if (screenshotDir) {
					await mkdir(screenshotDir, { recursive: true });
					await writeFile(
						join(screenshotDir, `touch-frames-${initialTheme}-${reducedMotion}-${next}.json`),
						JSON.stringify(frames, null, 2)
					);
				}
			}
			await page.getByTestId('semantic-search-input').tap();
			await expect(page.getByTestId('semantic-search-input')).toBeFocused();
			expect(
				await page.evaluate(() => Reflect.get(window, '__trustedTouchStarts'))
			).toBeGreaterThan(0);
			await expect(page.getByTestId('semantic-search-input')).toHaveCSS('outline-width', '2px');
			if (screenshotDir)
				await page.screenshot({
					path: join(screenshotDir, `touch-focus-${initialTheme}-${reducedMotion}.png`)
				});
		});
	}
}

for (const width of [320, 390, 820, 1440]) {
	for (const theme of ['light', 'dark']) {
		test(`remaining flat surfaces at ${width}px in ${theme}`, async ({ page }) => {
			test.setTimeout(120_000);
			await page.setViewportSize({ width, height: 1000 });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			const cases = [
				['empty', '/notices?search=약한&searchMode=semantic', 'notices-empty-state'],
				['semantic-empty', '/notices/semantic-search?search=약한', 'semantic-search-empty-state'],
				['changes', '/notices/changes', 'changes-results-region'],
				['discussions', '/discussions?status=closed', 'discussions-list']
			] as const;
			for (const [name, path, id] of cases) {
				await page.goto(path);
				const region = page.getByTestId(id);
				await expect(region).toBeVisible();
				await region.scrollIntoViewIfNeeded();
				await page.evaluate(() => document.fonts.ready);
				if (screenshotDir) {
					await mkdir(screenshotDir, { recursive: true });
					await page.screenshot({
						path: join(screenshotDir, `flat-${name}-${width}-${theme}.png`)
					});
				}
				const surface = name === 'changes' ? region.locator('article').first() : region;
				await expect(surface).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
				await expect(surface).toHaveCSS('border-left-width', '0px');
				await expect(surface).toHaveCSS('border-radius', '0px');
				expect(
					await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
				).toBe(true);
				const audit = await new AxeBuilder({ page })
					.include(`[data-testid="${id}"]`)
					.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
					.analyze();
				expect(audit.violations).toEqual([]);
				if (name === 'empty' || name === 'semantic-empty') {
					await page
						.getByTestId(
							name === 'empty' ? 'notices-semantic-show-weak' : 'semantic-search-show-weak'
						)
						.click();
					await expect(region).toHaveCount(0);
				} else if (name === 'changes') {
					await expect(region.getByRole('link', { name: '이 변경 비교' }).first()).toHaveAttribute(
						'href',
						/cmpFrom=\d+&cmpTo=\d+/
					);
				} else {
					const selected = page.getByTestId('discussions-filter-closed');
					await expect(selected).toHaveAttribute('aria-selected', 'true');
					await expect(selected).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
					await page.getByTestId('discussions-filter-all').click();
					await expect(page.getByTestId('discussions-filter-all')).toHaveAttribute(
						'aria-selected',
						'true'
					);
					const link = page.locator('[data-testid^="discussions-list-link-"]').first();
					await link.focus();
					await expect(link).toBeFocused();
					await link.press('Enter');
					await expect(page).toHaveURL(/\/notices\/\d+\/discussions\/\d+/);
				}
			}
		});
	}
}

for (const width of [320, 390, 820, 1440]) {
	for (const theme of ['light', 'dark']) {
		test(`flat pagination at ${width}px in ${theme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
			await page.goto('/notices?limit=10&page=1');
			const nav = page.getByTestId('notices-pagination');
			await expect(nav).toBeVisible();
			await nav.scrollIntoViewIfNeeded();
			const current = nav.locator('.lc-pagination-active:visible');
			await expect(current).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
			await expect(current).toHaveCSS('border-left-width', '0px');
			await expect(current).toHaveAttribute('aria-current', 'page');
			await expect(current).toHaveCSS('border-bottom-width', '2px');
			for (const control of await nav.locator('a:visible').all()) {
				const bounds = await control.boundingBox();
				expect(bounds!.height).toBeGreaterThanOrEqual(44);
				expect(bounds!.width).toBeGreaterThanOrEqual(44);
			}
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
			).toBe(true);
			const audit = await new AxeBuilder({ page })
				.include('[data-testid="notices-pagination"]')
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
				.analyze();
			expect(audit.violations).toEqual([]);
			if (screenshotDir) {
				await mkdir(screenshotDir, { recursive: true });
				await page.screenshot({ path: join(screenshotDir, `pagination-${width}-${theme}.png`) });
			}
			const next = nav.getByRole('link', { name: '다음 페이지로 이동', exact: true });
			await next.focus();
			await expect(next).toBeFocused();
			await next.press('Enter');
			await expect(page).toHaveURL(/page=2/);
			await expect(nav.locator('[aria-current="page"]:visible')).toHaveText('2');
			await nav.getByRole('link', { name: '1페이지로 이동', exact: true }).click();
			await expect(page).toHaveURL(/page=1/);
			await expect(nav.getByRole('link', { name: '이전 페이지로 이동', exact: true })).toHaveCount(
				0
			);
			await nav.getByRole('link', { name: '2페이지로 이동', exact: true }).click();
			await expect(page).toHaveURL(/page=2/);
			await expect(nav.getByRole('link', { name: '다음 페이지로 이동', exact: true })).toHaveCount(
				0
			);
		});
	}
}

test('flat pagination preserves pending feedback and number width', async ({ page }) => {
	await page.goto('/notices?limit=10&page=1');
	const nav = page.getByTestId('notices-pagination');
	await nav.scrollIntoViewIfNeeded();
	const target = nav.getByRole('link', { name: '2페이지로 이동', exact: true });
	const before = await target.boundingBox();
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route(/\/notices\/__data\.json/, async (route) => {
		await gate;
		await route.continue();
	});
	try {
		await nav.getByRole('link', { name: '다음 페이지로 이동', exact: true }).click();
		await expect(nav).toHaveAttribute('aria-busy', 'true');
		await expect(target.locator('.lc-pagination-spinner')).toBeVisible();
		expect((await target.boundingBox())!.width).toBe(before!.width);
	} finally {
		release();
	}
	await expect(page).toHaveURL(/page=2/);
	await expect(nav).toHaveAttribute('aria-busy', 'false');
	await expect(nav.locator('[aria-current="page"]:visible')).toHaveText('2');
});
