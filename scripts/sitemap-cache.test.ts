import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(
	readFileSync(process.env.SITEMAP_SOURCE ?? 'src/lib/server/sitemap.ts', 'utf8'),
	{ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }
).outputText;
interface SitemapModule {
	xmlEscapes: () => number;
	cachedSitemap: (key: string, generate: () => Promise<string>) => Promise<Response>;
	noticeSitemap: (
		origin: string,
		chunk: number,
		customFetch: typeof fetch,
		request: Request
	) => Promise<string>;
}
function fixture() {
	let now = 1_000_000;
	const exports = {};
	runInNewContext(
		`
		let xmlEscapes = 0;
		const originalReplace = String.prototype.replace;
		String.prototype.replace = function(...args) {
			xmlEscapes++;
			return originalReplace.apply(this, args);
		};
		${source}
		exports.xmlEscapes = () => xmlEscapes;
		`,
		{
			exports,
			Request,
			Response,
			Headers,
			Error,
			URL,
			AbortSignal,
			setTimeout,
			console: { warn() {}, error() {} },
			Date: class extends Date {
				static now() {
					return now;
				}
			},
			require(id: string) {
				if (id === '@sveltejs/kit')
					return {
						error(status: number) {
							throw Object.assign(new Error('Not found'), { status });
						}
					};
				if (id === '#lib/server/client-ip.ts')
					return {
						getBackendBaseUrl: () => 'https://backend.example/api',
						buildBackendForwardHeaders: () => new Headers(),
						rejectBackendRedirect() {}
					};
				throw new Error(`Unexpected import: ${id}`);
			}
		}
	);
	return { module: exports as SitemapModule, advance: (ms: number) => (now += ms) };
}

test('warm responses advertise only remaining freshness and regenerate after one hour', async () => {
	const f = fixture();
	const key = 'https://law.example/sitemap.xml';
	const cold = await f.module.cachedSitemap(key, async () => 'complete');
	assert.equal(cold.headers.get('cache-control'), 'public, max-age=3600, s-maxage=3600');
	f.advance(1_800_000);
	const warm = await f.module.cachedSitemap(key, async () => 'unexpected');
	assert.equal(await warm.text(), 'complete');
	assert.equal(warm.headers.get('cache-control'), 'public, max-age=1800, s-maxage=1800');
	f.advance(1_800_001);
	assert.equal(await (await f.module.cachedSitemap(key, async () => 'fresh')).text(), 'fresh');
});

test('escapes the invariant origin once per chunk without changing paths or modification dates', async () => {
	const { module } = fixture();
	const items = Array.from({ length: 500 }, (_, index) => ({
		num: 2200001 + index,
		archiveStartedAt: index === 0 ? '2026-10-23T14:30:00.000Z' : null
	}));
	const backendFetch: typeof fetch = async () =>
		Response.json({
			generatedAt: '2026-11-26T00:00:00.000Z',
			total: items.length,
			items
		});
	const body = await module.noticeSitemap(
		'https://law.example?a=1&b=2',
		0,
		backendFetch,
		new Request('https://law.example')
	);
	assert.equal((body.match(/<url>/g) ?? []).length, 500);
	assert.ok(body.includes('https://law.example?a=1&amp;b=2/notices/2200001'));
	assert.ok(body.includes('<lastmod>2026-10-23T14:30:00.000Z</lastmod>'));
	assert.ok(body.includes('/notices/2200500'));
	assert.equal(module.xmlEscapes(), 1);
});

test('concurrent readers coalesce generation and preserve independent readable bodies', async () => {
	const { module } = fixture();
	let calls = 0;
	const results = await Promise.all(
		Array.from({ length: 5 }, () =>
			module.cachedSitemap('https://law.example/main.xml', async () => {
				calls++;
				return 'complete';
			})
		)
	);
	assert.equal(calls, 1);
	assert.deepEqual(await Promise.all(results.map((r) => r.text())), Array(5).fill('complete'));
});

test('failed generations are not cached and origins remain isolated', async () => {
	const { module } = fixture();
	const key = 'https://law.example/sitemap.xml';
	for (const status of [503, 404]) {
		const response = await module.cachedSitemap(key, async () => {
			throw Object.assign(new Error('failed'), { status });
		});
		assert.equal(response.status, status);
		assert.match(response.headers.get('cache-control')!, /no-store/);
	}
	assert.equal(await (await module.cachedSitemap(key, async () => 'complete')).text(), 'complete');
	assert.equal(
		await (
			await module.cachedSitemap(key.replace('law.example', 'other.example'), async () => 'other')
		).text(),
		'other'
	);
});
