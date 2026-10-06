import type { Page } from '@playwright/test';

/**
 * WCAG contrast measurement helpers.
 *
 * Reproduces the P15 audit method: foreground/background come from computed
 * styles, backgrounds are alpha-blended up the ancestor chain until an opaque
 * surface is reached, and the WCAG relative-luminance ratio is computed from
 * the blended pair. Use it to re-measure color-token changes on real screens.
 */
export type ContrastTarget =
	{ selector: string; pseudoElement?: string } | { fgVar: string; bgVar: string };

export interface ContrastMeasurement {
	ratio: number;
	fg: string;
	bg: string;
}

export async function measureContrast(
	page: Page,
	target: ContrastTarget
): Promise<ContrastMeasurement> {
	return page.evaluate((t: ContrastTarget) => {
		type Rgba = { r: number; g: number; b: number; a: number };

		function parseColor(value: string): Rgba {
			// Chrome serializes color-mix()/alpha colors as "color(srgb r g b / a)"
			// with 0-1 float components.
			const srgb = value
				.trim()
				.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\)$/);
			if (srgb) {
				return {
					r: Number.parseFloat(srgb[1]) * 255,
					g: Number.parseFloat(srgb[2]) * 255,
					b: Number.parseFloat(srgb[3]) * 255,
					a: srgb[4] ? Number.parseFloat(srgb[4]) : 1
				};
			}

			const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
			if (hex) {
				const int = Number.parseInt(hex[1], 16);
				return {
					r: (int >> 16) & 255,
					g: (int >> 8) & 255,
					b: int & 255,
					a: 1
				};
			}

			const match = value.trim().match(/rgba?\(([^)]+)\)/);
			if (!match) {
				throw new Error(`Unsupported color value: ${value}`);
			}
			const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
			return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
		}

		function relativeLuminance(c: Rgba): number {
			const channel = (v: number): number => {
				const s = v / 255;
				return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
			};
			return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
		}

		function over(fg: Rgba, bg: Rgba): Rgba {
			const a = fg.a;
			return {
				r: fg.r * a + bg.r * (1 - a),
				g: fg.g * a + bg.g * (1 - a),
				b: fg.b * a + bg.b * (1 - a),
				a: 1
			};
		}

		function wcagRatio(fg: Rgba, bg: Rgba): number {
			const l1 = relativeLuminance(fg);
			const l2 = relativeLuminance(bg);
			const hi = Math.max(l1, l2);
			const lo = Math.min(l1, l2);
			return (hi + 0.05) / (lo + 0.05);
		}

		function blendAncestorBackground(el: Element): Rgba {
			const chain: Element[] = [];
			for (let node: Element | null = el; node; node = node.parentElement) {
				chain.push(node);
			}
			let result: Rgba = { r: 255, g: 255, b: 255, a: 1 };
			for (const node of chain.reverse()) {
				const bg = parseColor(getComputedStyle(node).backgroundColor);
				if (bg.a > 0) {
					result = over(bg, result);
				}
			}
			return result;
		}

		if ('fgVar' in t) {
			const styles = getComputedStyle(document.documentElement);
			const fg = parseColor(styles.getPropertyValue(t.fgVar).trim());
			const bg = parseColor(styles.getPropertyValue(t.bgVar).trim());
			return {
				ratio: wcagRatio(fg, bg),
				fg: `${t.fgVar} = ${styles.getPropertyValue(t.fgVar).trim()}`,
				bg: `${t.bgVar} = ${styles.getPropertyValue(t.bgVar).trim()}`
			};
		}

		const el = document.querySelector(t.selector);
		if (!el) {
			throw new Error(`Element not found for contrast measurement: ${t.selector}`);
		}
		const computed = getComputedStyle(el, t.pseudoElement ?? null);
		const fg = parseColor(computed.color);
		const bg = blendAncestorBackground(el);
		return {
			ratio: wcagRatio(fg, bg),
			fg: `color: ${computed.color}`,
			bg: `background: rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`
		};
	}, target);
}
