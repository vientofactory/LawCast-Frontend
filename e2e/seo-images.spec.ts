import { test, expect } from '@playwright/test';

const DEFAULT_IMAGE_PATH = '/og/lawcast-blueprint.png';
const DEFAULT_IMAGE_ALT = 'LawCast 로고와 국회 입법예고 아카이브 문구';

function metaContents(html: string, name: string): string[] {
	return Array.from(html.matchAll(/<meta\b[^>]*>/g))
		.filter(
			(match) => match[0].includes(`property="${name}"`) || match[0].includes(`name="${name}"`)
		)
		.map((match) => match[0].match(/content="([^"]*)"/)?.[1] ?? '');
}

for (const route of [
	'/',
	'/notices',
	'/notices/changes',
	'/discussions',
	'/proposals',
	'/webhook',
	'/status',
	'/license',
	'/crawling-transparency',
	'/announcements',
	'/announcements/mock-announcement-1',
	'/notices/2210001/discussions/221000101'
]) {
	test(`SSR serves the default share image on ${route}`, async ({ request, baseURL }) => {
		const response = await request.get(route);
		// Package API availability must not change the license page's sharing metadata.
		if (route === '/license') expect([200, 503]).toContain(response.status());
		else expect(response.status()).toBe(200);
		const html = await response.text();
		const expected = new URL(DEFAULT_IMAGE_PATH, baseURL).href;
		expect(metaContents(html, 'og:image')).toEqual([expected]);
		expect(metaContents(html, 'twitter:image')).toEqual([expected]);
		expect(metaContents(html, 'og:image:width')).toEqual(['1200']);
		expect(metaContents(html, 'og:image:height')).toEqual(['630']);
		expect(metaContents(html, 'og:image:alt')).toEqual([DEFAULT_IMAGE_ALT]);
		expect(metaContents(html, 'twitter:image:alt')).toEqual([DEFAULT_IMAGE_ALT]);
	});
}

test('the default share asset is a 1200x630 PNG', async ({ request }) => {
	const response = await request.get(DEFAULT_IMAGE_PATH);
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toContain('image/png');
	const bytes = await response.body();
	expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
	expect(bytes.readUInt32BE(16)).toBe(1200);
	expect(bytes.readUInt32BE(20)).toBe(630);
});

test('bill detail SSR keeps its dynamic image instead of the default', async ({
	request,
	baseURL
}) => {
	const response = await request.get('/notices/2210001');
	expect(response.status()).toBe(200);
	const html = await response.text();
	const expected = new URL('/notices/2210001/og.png', baseURL).href;
	expect(metaContents(html, 'og:image')).toEqual([expected]);
	expect(metaContents(html, 'twitter:image')).toEqual([expected]);
	expect(metaContents(html, 'og:image:alt')).toHaveLength(1);
	expect(metaContents(html, 'og:image:alt')[0]).not.toBe(DEFAULT_IMAGE_ALT);
	const image = await request.get(expected);
	expect(image.status()).toBe(200);
	expect(image.headers()['content-type']).toBe('image/png');
});

test('SPA navigation switches between dynamic and default images without duplicates', async ({
	page,
	baseURL
}) => {
	await page.goto('/notices/2210001');
	const theme = page.getByRole('switch').first();
	const initialChecked = await theme.getAttribute('aria-checked');
	await expect(async () => {
		if ((await theme.getAttribute('aria-checked')) === initialChecked) await theme.click();
		await expect(theme).not.toHaveAttribute('aria-checked', initialChecked!, { timeout: 1000 });
	}).toPass();
	const timeOrigin = await page.evaluate(() => performance.timeOrigin);
	const image = page.locator('meta[property="og:image"]');
	await expect(image).toHaveAttribute('content', new URL('/notices/2210001/og.png', baseURL).href);
	await page.getByTestId('footer-brand').click();
	await expect(page).toHaveURL('/');
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
	await expect(image).toHaveCount(1);
	await expect(image).toHaveAttribute('content', new URL(DEFAULT_IMAGE_PATH, baseURL).href);
	await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
		'content',
		new URL(DEFAULT_IMAGE_PATH, baseURL).href
	);
	await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
	await page.goBack();
	await expect(page).toHaveURL('/notices/2210001');
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
	await expect(page.locator('meta[property="og:image:width"]')).toHaveCount(0);
	await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);
	await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
		'content',
		new URL('/notices/2210001/og.png', baseURL).href
	);
	await expect(image).toHaveCount(1);
	await expect(image).toHaveAttribute('content', new URL('/notices/2210001/og.png', baseURL).href);
});

test('error pages also receive the default share image', async ({ request, baseURL }) => {
	const response = await request.get('/this-route-does-not-exist-for-og');
	expect(response.status()).toBe(404);
	const html = await response.text();
	expect(metaContents(html, 'og:image')).toEqual([new URL(DEFAULT_IMAGE_PATH, baseURL).href]);
	expect(metaContents(html, 'twitter:image')).toEqual([new URL(DEFAULT_IMAGE_PATH, baseURL).href]);
});
