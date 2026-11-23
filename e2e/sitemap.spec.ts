import { expect, test } from '@playwright/test';

const backend = 'http://127.0.0.1:4319';
const origin = 'http://localhost:5189';
const locations = (xml: string) => [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);

test('cold index bounds transport retries without retrying redirects or invalid snapshots', async ({
	request
}) => {
	const failed = await request.get('/sitemap.xml');
	expect(failed.status()).toBe(503);
	expect(failed.headers()['cache-control']).toContain('no-store');
	expect(failed.headers()['retry-after']).toBe('60');
	expect((await (await request.get(`${backend}/stats`)).json()).requests).toHaveLength(2);
	const redirected = await request.get('/sitemap.xml');
	expect(redirected.status()).toBe(503);
	expect((await (await request.get(`${backend}/stats`)).json()).requests).toHaveLength(3);
	const truncated = await request.get('/sitemap.xml');
	expect(truncated.status()).toBe(503);
	expect((await (await request.get(`${backend}/stats`)).json()).requests).toHaveLength(4);
	const forbidden = await request.get('/sitemap.xml');
	expect(forbidden.status()).toBe(503);
	expect((await (await request.get(`${backend}/stats`)).json()).requests).toHaveLength(5);
	const malformed = await request.get('/sitemap.xml');
	expect(malformed.status()).toBe(503);
	expect((await (await request.get(`${backend}/stats`)).json()).requests).toHaveLength(6);
	const [index, ...coldChunks] = await Promise.all(
		['/sitemap.xml', '/sitemap_chunk_0.xml', '/sitemap_chunk_1.xml'].map((path) =>
			request.get(path, {
				headers: { Cookie: 'private=value', Authorization: 'Bearer private' }
			})
		)
	);
	for (const response of coldChunks) expect(response.status()).toBe(200);
	expect(index.status()).toBe(200);
	expect(index.headers()['content-type']).toContain('application/xml');
	const xml = await index.text();
	expect(xml).toContain('<sitemapindex');
	expect(locations(xml)).toEqual([
		`${origin}/main.xml`,
		...Array.from({ length: 46 }, (_, i) => `${origin}/sitemap_chunk_${i}.xml`)
	]);
	const all: string[] = [];
	for (let i = 0; i < 46; i++) {
		const responses = await Promise.all(
			Array.from({ length: 3 }, () => request.get(`/sitemap_chunk_${i}.xml`))
		);
		for (const response of responses) expect(response.status()).toBe(200);
		const body = await responses[0].text();
		const entries = locations(body);
		expect(entries).toHaveLength(i === 45 ? 240 : 500);
		all.push(...entries);
		if (i === 0) expect(body).toContain('<lastmod>2026-10-23T14:30:00.000Z</lastmod>');
		expect(body).not.toContain('Invalid Date');
	}
	expect(all).toEqual(Array.from({ length: 22740 }, (_, i) => `${origin}/notices/${2200001 + i}`));
	expect(new Set(all).size).toBe(22740);
	const stats = await (await request.get(`${backend}/stats`)).json();
	expect(stats.archiveReads).toBe(0);
	expect(stats.requests).toHaveLength(8);
	for (const entry of stats.requests) {
		expect(entry.path).toBe('/api/sitemap/notices');
		expect(entry.headers.cookie).toBeUndefined();
		expect(entry.headers.authorization).toBeUndefined();
		expect(entry.headers['x-lawcast-client-ip']).toBeUndefined();
	}
});

test('main groups canonical public pages without invented modification dates', async ({
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
		].map((p) => origin + p)
	);
	expect(xml).not.toContain('<lastmod>');
});

test('origin isolation and invalid chunk bounds preserve their response contracts', async ({
	request
}) => {
	const other = 'http://127.0.0.1:5189';
	const index = await request.get(`${other}/sitemap.xml`);
	expect(locations(await index.text()).every((p) => p.startsWith(other))).toBe(true);
	for (const chunk of ['-1', '01', '1.5', 'abc', '46', '999999999999999999999']) {
		const response = await request.get(`/sitemap_chunk_${chunk}.xml`);
		expect(response.status()).toBe(404);
		expect(response.headers()['cache-control']).toContain('no-store');
	}
});

test('robots advertises the parent sitemap index', async ({ request }) => {
	expect(await (await request.get('/robots.txt')).text()).toContain(
		'Sitemap: https://law.viento.me/sitemap.xml'
	);
});
