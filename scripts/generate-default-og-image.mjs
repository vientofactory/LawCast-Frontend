import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@cf-wasm/resvg';

const assets = new URL('../static/og/', import.meta.url);
const source = await readFile(new URL('lawcast-blueprint.svg', assets), 'utf8');
const renderer = await Resvg.async(source);
try {
	await writeFile(new URL('lawcast-blueprint.png', assets), renderer.render().asPng());
} finally {
	renderer.free();
}
console.log('Generated default Open Graph image: 1200x630 PNG');
