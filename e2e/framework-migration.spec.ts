import { expect, test } from '@playwright/test';

test('renders Korean OG images through the patched font and WASM pipeline', async ({ request }) => {
	const response = await request.get('/notices/2210004/og.png');
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toBe('image/png');
	const png = await response.body();
	expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
	expect(png.readUInt32BE(16)).toBe(1200);
	expect(png.readUInt32BE(20)).toBe(630);
	expect(png.length).toBeGreaterThan(10000);
});

test('serves custom offline and launch documents through platform URL normalization', async ({
	request
}) => {
	for (const path of ['/offline.html', '/pwa-start.html']) {
		const response = await request.get(path);
		expect(response.status(), path).toBe(200);
		expect(response.headers()['content-type'], path).toContain('text/html');
	}
});
