import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@cf-wasm/resvg';
import { BRAND_ARC, BRAND_LETTER, BRAND_DOT } from '../src/lib/brand-symbol.js';

const staticDir = new URL('../static/brand/v2/', import.meta.url);
const blue = '#1d4ed8';
const symbol = (color) =>
	`<path d="${BRAND_ARC}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"/><path d="${BRAND_LETTER}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${BRAND_DOT.cx}" cy="${BRAND_DOT.cy}" r="${BRAND_DOT.r}" fill="${color}"/>`;
const svg = (content, width = 64, height = 64) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="LawCast">${content}</svg>\n`;
const save = (path, data) => writeFile(new URL(path, staticDir), data);
const raster = async (source, path, width) => {
	const renderer = await Resvg.async(source, { fitTo: { mode: 'width', value: width } });
	await save(path, renderer.render().asPng());
	renderer.free();
};

// Reuse the outlined Pretendard wordmark without reshaping or requiring a local font.
const previous = await readFile(new URL('logo-light.svg', staticDir), 'utf8');
const wordmark = previous.match(/<path\b[^>]*\/>/g)?.at(-1);
if (!wordmark || !wordmark.includes('M80.621')) throw new Error('Missing original wordmark');
for (const [theme, text, mark] of [
	['light', '#0f172a', blue],
	['dark', '#f8fafc', '#60a5fa']
]) {
	const logo = svg(symbol(mark) + wordmark.replace(/fill="[^"]*"/, `fill="${text}"`), 259, 64);
	await save(`logo-${theme}.svg`, logo);
	await raster(logo, `logo-${theme}.png`, 777);
	await save(
		`wordmark-${theme}.svg`,
		svg(
			`<g transform="translate(-80 0)">${wordmark.replace(/fill="[^"]*"/, `fill="${text}"`)}</g>`,
			179,
			64
		)
	);
}
await save('mark.svg', svg(symbol('currentColor')));
await save('symbol.svg', svg(symbol(blue)));

// Opaque padding keeps the mark legible on launcher surfaces and within platform masks.
const icon = svg(
	`<path fill="#fff" d="M0 0h64v64H0z"/><g transform="translate(8 8) scale(.75)">${symbol(blue)}</g>`
);
await save('icon.svg', icon);
await save('favicon.svg', svg(symbol(blue)));
await raster(svg(symbol(blue)), 'favicon.png', 32);
await raster(icon, 'icon-192.png', 192);
await raster(icon, 'icon-512.png', 512);
await raster(icon, 'apple-touch-icon.png', 180);
// Android notification badges use the alpha silhouette, so omit any background or wordmark.
await raster(svg(symbol('#fff')), 'badge-96.png', 96);
console.log(`Generated brand assets in ${fileURLToPath(staticDir)}`);
