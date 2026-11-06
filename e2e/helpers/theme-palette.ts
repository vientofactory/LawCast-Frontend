import type { Page } from '@playwright/test';

export interface PaletteFrame {
	theme: string;
	ratio: number;
	selector: string;
	color: string;
	background: string;
}

export async function startPaletteSampling(page: Page, selectors: string[]) {
	await page.evaluate((selectors) => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		const context = canvas.getContext('2d', { willReadFrequently: true })!;
		const parse = (color: string) => {
			context.clearRect(0, 0, 1, 1);
			context.fillStyle = color;
			context.fillRect(0, 0, 1, 1);
			return Array.from(context.getImageData(0, 0, 1, 1).data);
		};
		const luminance = (rgb: number[]) => {
			const values = rgb.slice(0, 3).map((channel) => {
				const value = channel / 255;
				return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
			});
			return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
		};
		const frames: PaletteFrame[] = [];
		const sample = () => {
			for (const selector of selectors) {
				const node = document.querySelector(selector);
				if (!node || !node.getClientRects().length) continue;
				const chain: Element[] = [];
				for (let parent: Element | null = node; parent; parent = parent.parentElement)
					chain.unshift(parent);
				let background = [255, 255, 255];
				for (const parent of chain) {
					const rgba = parse(getComputedStyle(parent).backgroundColor);
					const alpha = rgba[3] / 255;
					background = background.map((value, index) => rgba[index] * alpha + value * (1 - alpha));
				}
				const color = getComputedStyle(node).color;
				const foreground = parse(color);
				const fg = luminance(foreground),
					bg = luminance(background);
				frames.push({
					theme: document.documentElement.dataset.theme ?? '',
					selector,
					color,
					background: background.join(','),
					ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
				});
			}
		};
		Reflect.set(
			window,
			'__lawcastPaletteSample',
			new Promise<PaletteFrame[]>((resolve) => {
				const started = performance.now();
				const observer = new MutationObserver(sample);
				observer.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ['data-theme']
				});
				const tick = () => {
					sample();
					if (performance.now() - started < 450) requestAnimationFrame(tick);
					else {
						observer.disconnect();
						resolve(frames);
					}
				};
				tick();
			})
		);
	}, selectors);
}

export async function readPaletteSamples(page: Page): Promise<PaletteFrame[]> {
	return page.evaluate(() => Reflect.get(window, '__lawcastPaletteSample'));
}
