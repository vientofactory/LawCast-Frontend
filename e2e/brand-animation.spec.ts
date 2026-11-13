import { expect, test } from '@playwright/test';
import { measureContrast } from './helpers/contrast';

for (const width of [390, 1440]) {
	for (const theme of ['light', 'dark']) {
		for (const motion of ['no-preference', 'reduce'] as const) {
			test(`traces only the symbol at ${width}px in ${theme} with ${motion}`, async ({
				page
			}, info) => {
				await page.setViewportSize({ width, height: 900 });
				await page.emulateMedia({ reducedMotion: motion });
				await page.addInitScript((value) => localStorage.setItem('lawcast-theme', value), theme);
				await page.goto('/');
				const heading = page.getByTestId('brand-heading');
				await expect(heading).toBeVisible();
				await expect(page.getByTestId('app-route-container')).toBeVisible();
				const symbol = heading.getByTestId('brand-symbol');
				await expect(symbol).toHaveAttribute('data-motion-ready', 'true');
				expect(await symbol.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(
					0
				);
				await page.getByTestId('site-brand').hover();
				if (motion !== 'reduce')
					await expect
						.poll(() => symbol.evaluate((node) => node.getAnimations({ subtree: true }).length))
						.toBe(5);
				const initial = await heading.boundingBox();
				for (const time of [0, 200, 400, 1600, 1840, 2000, 2160, 2400, 3600, 3800, 4000]) {
					await symbol.evaluate((node, time) => {
						for (const animation of node.getAnimations({ subtree: true })) {
							animation.pause();
							animation.currentTime = time;
						}
					}, time);
					for (const part of ['brand-wordmark', 'brand-tagline']) {
						const state = await heading.getByTestId(part).evaluate((node) => {
							const s = getComputedStyle(node);
							return [s.opacity, s.transform, node.getAnimations().length];
						});
						expect(state).toEqual(['1', 'none', 0]);
					}
					const state = await symbol.evaluate((node) => {
						const fill = getComputedStyle(node.querySelector('[data-brand-fill]')!);
						const outline = getComputedStyle(node.querySelector('[data-brand-outline]')!);
						return {
							opacity: fill.opacity,
							clip: fill.clipPath,
							outline: outline.visibility,
							outlineOpacity: Number(outline.opacity),
							outlineWidth: outline.strokeWidth,
							dash: Number.parseFloat(
								getComputedStyle(node.querySelector('[data-testid="brand-contour-0"]')!)
									.strokeDashoffset
							)
						};
					});
					expect(state.outlineWidth).toBe('1.5px');
					expect(Number(state.opacity) + state.outlineOpacity).toBeCloseTo(1, 5);
					expect(state.clip).toBe('none');
					if (motion === 'reduce' || time === 0 || time === 4000) expect(state.opacity).toBe('1');
					else if (time >= 400 && time <= 3600) expect(Number(state.opacity)).toBeCloseTo(0, 6);
					else expect(Number(state.opacity)).toBeCloseTo(0.5, 2);
					if (motion === 'reduce' || time === 4000) {
						expect(state.clip).toBe('none');
						expect(state.outline).toBe('hidden');
					} else {
						expect(state.outline).toBe('visible');
						if (time === 2000) {
							expect(state.dash).toBeGreaterThan(0);
							expect(state.dash).toBeLessThan(82);
						}
						if (time === 0 || time === 3600) expect(state.dash).toBe(0);
						if (time === 1600 || time === 2400) {
							expect(state.dash).toBeGreaterThan(0);
							expect(state.dash).toBeLessThan(100);
						}
					}
					await page
						.getByTestId('site-brand')
						.screenshot({ path: info.outputPath(`frame-${time}.png`), animations: 'allow' });
				}
				const contrast = await measureContrast(page, { selector: '[data-testid="brand-tagline"]' });
				expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
				expect(await heading.boundingBox()).toEqual(initial);
				expect(
					await page
						.getByTestId('footer-brand')
						.evaluate((node) => node.getAnimations({ subtree: true }).length)
				).toBe(0);
			});
		}
	}
}

test('stays static until mouse hover and ignores focus and touch', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.goto('/');
	const brand = page.getByTestId('site-brand');
	const symbol = brand.getByTestId('brand-symbol');
	await expect(symbol).toHaveAttribute('data-motion-ready', 'true');
	await expect(page.getByTestId('app-route-container')).toBeVisible();
	await page.waitForTimeout(300);
	expect(await symbol.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
	await brand.focus();
	await expect(brand).toBeFocused();
	expect(await symbol.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
	await brand.dispatchEvent('pointerenter', { pointerType: 'touch' });
	expect(await symbol.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
	await brand.hover();
	await expect
		.poll(() => symbol.evaluate((node) => node.getAnimations({ subtree: true }).length))
		.toBe(5);
	const start = await symbol.evaluate((node) =>
		Number(node.getAnimations({ subtree: true })[0].currentTime)
	);
	await page.waitForTimeout(200);
	const next = await symbol.evaluate((node) =>
		Number(node.getAnimations({ subtree: true })[0].currentTime)
	);
	expect(next - start).toBeGreaterThan(100);
	await expect
		.poll(() => symbol.evaluate((node) => node.getAnimations({ subtree: true }).length))
		.toBe(0);
	await page.mouse.move(700, 700);
	await brand.hover();
	await expect
		.poll(() => symbol.evaluate((node) => node.getAnimations({ subtree: true }).length))
		.toBe(5);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect
		.poll(() => symbol.evaluate((node) => node.getAnimations({ subtree: true }).length))
		.toBe(0);
	await page.mouse.move(700, 700);
	await brand.hover();
	expect(await symbol.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
});

test('matches the closed perimeter to the original filled symbol', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	const overlap = await page
		.getByTestId('site-brand')
		.getByTestId('brand-symbol')
		.evaluate(async (node) => {
			const render = async (group: Element) => {
				const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64">${group.outerHTML}</svg>`;
				const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
				try {
					const image = new Image();
					image.src = url;
					await image.decode();
					const canvas = document.createElement('canvas');
					canvas.width = canvas.height = 512;
					const context = canvas.getContext('2d')!;
					context.drawImage(image, 0, 0);
					return context.getImageData(0, 0, 512, 512).data;
				} finally {
					URL.revokeObjectURL(url);
				}
			};
			const contour = node.querySelector('[data-brand-outline]')!.cloneNode(true) as SVGGElement;
			contour.setAttribute('fill', 'black');
			contour.setAttribute('stroke', 'none');
			const original = await render(node.querySelector('[data-brand-fill]')!);
			const expanded = await render(contour);
			let intersection = 0;
			let union = 0;
			for (let i = 3; i < original.length; i += 4) {
				if (original[i] > 127 || expanded[i] > 127) union++;
				if (original[i] > 127 && expanded[i] > 127) intersection++;
			}
			return intersection / union;
		});
	expect(overlap).toBeGreaterThan(0.995);
});

test('keeps a contour visible and overlaps reversals without a global pause', async ({ page }) => {
	await page.goto('/');
	const brand = page.getByTestId('site-brand');
	const symbol = brand.getByTestId('brand-symbol');
	await expect(symbol).toHaveAttribute('data-motion-ready', 'true');
	await brand.hover();
	await expect
		.poll(() => symbol.evaluate((node) => node.getAnimations({ subtree: true }).length))
		.toBe(5);
	const frames = await symbol.evaluate((node) => {
		const animations = node.getAnimations({ subtree: true });
		const sample = (time: number) => {
			for (const animation of animations) {
				animation.pause();
				animation.currentTime = time;
			}
			return {
				clip: getComputedStyle(node.querySelector('[data-brand-fill]')!).clipPath,
				opacity: Number(getComputedStyle(node.querySelector('[data-brand-fill]')!).opacity),
				dashes: Array.from(node.querySelectorAll('[data-brand-outline] path')).map((path) =>
					Number.parseFloat(getComputedStyle(path).strokeDashoffset)
				)
			};
		};
		return {
			pairs: [200, 1200, 1600].map((time) => [sample(time), sample(4000 - time)]),
			turns: [1840, 2000, 2160].map((time) => [sample(time - 1), sample(time + 1)]),
			transition: Array.from({ length: 13 }, (_, i) => sample(1760 + i * 40)),
			cycle: Array.from({ length: 100 }, (_, i) => sample(i * 40)),
			durations: animations.map((a) => a.effect!.getTiming().duration),
			contourDurations: animations
				.filter((a) => (a.effect as KeyframeEffect).target instanceof SVGPathElement)
				.map((a) => {
					const frames = (a.effect as KeyframeEffect).getKeyframes();
					return (
						(Number(frames[2].offset) - Number(frames[1].offset)) *
						Number(a.effect!.getTiming().duration)
					);
				}),
			fadingTargets: animations
				.filter((a) =>
					(a.effect as KeyframeEffect).getKeyframes().some((frame) => 'opacity' in frame)
				)
				.map((a) => ((a.effect as KeyframeEffect).target as Element).getAttribute('data-testid')),
			clipping: animations
				.flatMap((a) => (a.effect as KeyframeEffect).getKeyframes())
				.some((frame) => 'clipPath' in frame)
		};
	});
	expect(frames.durations).toEqual([4000, 4000, 4000, 4000, 4000]);
	frames.contourDurations.forEach((duration, index) =>
		expect(duration).toBeCloseTo([1200, 1440, 1680][index], 3)
	);
	expect(frames.fadingTargets).toEqual(['brand-fill', 'brand-outline']);
	expect(frames.clipping).toBe(false);
	for (const [reverse, forward] of frames.pairs) {
		expect(reverse.clip).toBe('none');
		expect(forward.clip).toBe('none');
		expect(reverse.opacity).toBeCloseTo(forward.opacity, 3);
	}
	for (const frame of frames.cycle) expect(frame.dashes[0]).toBeLessThanOrEqual(82.001);
	for (const [before, after] of frames.turns) {
		for (let i = 0; i < 3; i++)
			expect(Math.abs(before.dashes[i] - after.dashes[i])).toBeLessThan(0.3);
	}
	for (let i = 1; i < frames.transition.length; i++) {
		const previous = frames.transition[i - 1].dashes;
		const next = frames.transition[i].dashes;
		expect(
			Math.max(...next.map((value, index) => Math.abs(value - previous[index])))
		).toBeGreaterThan(0.2);
	}
});

test('settles without a thickness snap after the fill-outline handoff', async ({ page }, info) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript(() => localStorage.setItem('lawcast-theme', 'dark'));
	await page.goto('/');
	const symbol = page.getByTestId('site-brand').getByTestId('brand-symbol');
	await expect(symbol).toHaveAttribute('data-motion-ready', 'true');
	await page.getByTestId('site-brand').hover();
	await expect
		.poll(() => symbol.evaluate((node) => node.getAnimations({ subtree: true }).length))
		.toBe(5);
	const seek = (time: number) =>
		symbol.evaluate((node, time) => {
			for (const animation of node.getAnimations({ subtree: true })) {
				animation.pause();
				animation.currentTime = time;
			}
		}, time);
	await seek(3999);
	const outline = symbol.getByTestId('brand-outline');
	expect(await outline.evaluate((node) => Number(getComputedStyle(node).opacity))).toBeLessThan(
		0.0001
	);
	const before = await symbol.screenshot({
		path: info.outputPath('before-completion.png'),
		animations: 'allow'
	});
	await seek(4000);
	const after = await symbol.screenshot({
		path: info.outputPath('after-completion.png'),
		animations: 'allow'
	});
	const difference = await page.evaluate(
		async ({ before, after }) => {
			const decode = async (base64: string) => {
				const image = new Image();
				image.src = `data:image/png;base64,${base64}`;
				await image.decode();
				const canvas = document.createElement('canvas');
				canvas.width = image.width;
				canvas.height = image.height;
				const context = canvas.getContext('2d')!;
				context.drawImage(image, 0, 0);
				return context.getImageData(0, 0, image.width, image.height).data;
			};
			const left = await decode(before);
			const right = await decode(after);
			let max = 0;
			let total = 0;
			for (let i = 0; i < left.length; i++) {
				const delta = Math.abs(left[i] - right[i]);
				max = Math.max(max, delta);
				total += delta;
			}
			return { max, mean: total / left.length };
		},
		{ before: before.toString('base64'), after: after.toString('base64') }
	);
	// Browsers quantize a nearly opaque composited layer by up to one 8-bit step.
	expect(difference.max).toBeLessThanOrEqual(1);
	expect(difference.mean).toBeLessThan(0.5);
	expect(await outline.evaluate((node) => getComputedStyle(node).strokeWidth)).toBe('1.5px');
	await seek(4050);
	const settled = await symbol.screenshot({
		path: info.outputPath('settled.png'),
		animations: 'allow'
	});
	expect(after.equals(settled)).toBe(true);
});
