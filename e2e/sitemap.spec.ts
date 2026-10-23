import { expect, test } from '@playwright/test';

const backend = 'http://127.0.0.1:4319';
const origin = 'http://localhost:5189';
const locations = (xml: string) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);

test('index references main and every chunk without embedding individual bills', async ({
	request
}) => {
	await request.get(`${backend}/control`);
	const response = await request.get('/sitemap.xml');
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toContain('application/xml');
	expect(response.headers()['cache-control']).toContain('s-maxage=3600');
	const xml = await response.text();
	expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
	expect(xml).not.toContain('<url>');
	expect(locations(xml)).toEqual([
		`${origin}/main.xml`,
		...Array.from({ length: 14 }, (_, index) => `${origin}/sitemap_chunk_${index}.xml`)
	]);
	const stats = await (await request.get(`${backend}/stats`)).json();
	expect(stats.requests).toHaveLength(1);
});

test('main groups public independent pages and excludes utility and redirected pages', async ({
	request
}) => {
	const response = await request.get('/main.xml');
	expect(response.status()).toBe(200);
	const xml = await response.text();
	expect(locations(xml)).toEqual(
		[
			'/',
			'/notices',
			'/notices/changes',
			'/discussions',
			'/proposals',
			'/announcements',
			'/crawling-transparency',
			'/license'
		].map((path) => origin + path)
	);
	expect(xml).not.toContain('<lastmod>');
});

test('failed upstream page returns uncached 503 and succeeds on retry', async ({ request }) => {
	await request.get(`${backend}/control?fail=32`);
	const failed = await request.get('/sitemap_chunk_6.xml');
	expect(failed.status()).toBe(503);
	expect(failed.headers()['cache-control']).toBe('no-store');
	expect(failed.headers()['retry-after']).toBe('60');
	await request.get(`${backend}/control`);
	const retried = await request.get('/sitemap_chunk_6.xml');
	expect(retried.status()).toBe(200);
	expect(locations(await retried.text())).toHaveLength(500);
});

test('truncated upstream page never becomes a successful partial sitemap', async ({ request }) => {
	await request.get(`${backend}/control?short=37`);
	expect((await request.get('/sitemap_chunk_7.xml')).status()).toBe(503);
	await request.get(`${backend}/control`);
	expect((await request.get('/sitemap_chunk_7.xml')).status()).toBe(200);
});

test('simultaneous requests share generation and strip visitor credentials', async ({
	request
}) => {
	await request.get(`${backend}/control`);
	const responses = await Promise.all(
		Array.from({ length: 3 }, () =>
			request.get('/sitemap_chunk_8.xml', {
				headers: {
					Cookie: 'private=value',
					Authorization: 'Bearer private',
					'x-forwarded-for': '1.2.3.4'
				}
			})
		)
	);
	for (const response of responses) expect(response.status()).toBe(200);
	const stats = await (await request.get(`${backend}/stats`)).json();
	expect(stats.requests).toHaveLength(5);
	expect(stats.maxActive).toBeLessThanOrEqual(2);
	for (const entry of stats.requests) {
		expect(entry.headers.cookie).toBeUndefined();
		expect(entry.headers.authorization).toBeUndefined();
		expect(entry.headers['x-forwarded-for']).toBeUndefined();
		expect(entry.headers['x-lawcast-client-ip']).toBe('sitemap-bot');
	}
});

test('all chunks cover more than 5000 bills exactly once with a partial final chunk', async ({
	request
}) => {
	await request.get(`${backend}/control`);
	const all: string[] = [];
	for (let index = 0; index < 14; index++) {
		const response = await request.get(`/sitemap_chunk_${index}.xml`);
		expect(response.status()).toBe(200);
		const xml = await response.text();
		expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		const entries = locations(xml);
		expect(entries).toHaveLength(index === 13 ? 1 : 500);
		all.push(...entries);
		expect(xml).toContain('<lastmod>2026-10-23T14:30:00.000Z</lastmod>');
		expect(xml).not.toContain('Invalid Date');
	}
	expect(all).toEqual(
		Array.from({ length: 6501 }, (_, index) => `${origin}/notices/${2200001 + index}`)
	);
	expect(new Set(all).size).toBe(6501);
	const stats = await (await request.get(`${backend}/stats`)).json();
	expect(stats.maxActive).toBeLessThanOrEqual(2);
	for (const entry of stats.requests) {
		expect(entry.limit).toBe(100);
		expect(entry.sortOrder).toBe('asc');
		expect(entry.headers['x-lawcast-client-ip']).toBe('sitemap-bot');
	}
});

test('cached chunk does not repeat backend requests', async ({ request }) => {
	await request.get(`${backend}/control`);
	const response = await request.get('/sitemap_chunk_0.xml', {
		headers: { Cookie: 'private=value', Authorization: 'Bearer private' }
	});
	expect(response.status()).toBe(200);
	const stats = await (await request.get(`${backend}/stats`)).json();
	expect(stats.requests).toHaveLength(0);
});

test('invalid and out of range chunk numbers return 404', async ({ request }) => {
	for (const chunk of ['-1', '01', '1.5', 'abc', '14', '999999999999999999999']) {
		const response = await request.get(`/sitemap_chunk_${chunk}.xml`);
		expect(response.status()).toBe(404);
	}
});

test('robots keeps the sitemap index as the crawler entry point', async ({ request }) => {
	const response = await request.get('/robots.txt');
	expect(await response.text()).toContain('Sitemap: https://law.viento.me/sitemap.xml');
});

test('empty archive publishes only main and cache entries stay scoped to their origin', async ({
	request
}) => {
	await request.get(`${backend}/control?total=0`);
	const otherOrigin = 'http://127.0.0.1:5189';
	const response = await request.get(`${otherOrigin}/sitemap.xml`);
	expect(response.status()).toBe(200);
	expect(locations(await response.text())).toEqual([`${otherOrigin}/main.xml`]);
	expect((await request.get(`${otherOrigin}/sitemap_chunk_0.xml`)).status()).toBe(404);
	const main = await request.get(`${otherOrigin}/main.xml`);
	for (const location of locations(await main.text()))
		expect(location.startsWith(otherOrigin)).toBe(true);
	await request.get(`${backend}/control`);
});
