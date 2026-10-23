import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { buildBackendForwardHeaders } from '$lib/server/client-ip';
import type { ArchiveNoticeListResponse, Notice } from '$lib/types/api';

export const SITEMAP_CHUNK_SIZE = 500;
const BATCH_SIZE = 100;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHED_SITEMAPS = 64;
const XML_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const cache = new Map<string, { xml: Promise<string>; expiresAt: number }>();

export function escapeXml(value: string): string {
	return value.replace(/[<>&"']/g, (char) => {
		return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]!;
	});
}

export function urlset(entries: string[]): string {
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${XML_NAMESPACE}">\n${entries.join('\n')}\n</urlset>`;
}

export function sitemapIndex(origin: string, total: number): string {
	const paths = [
		'/main.xml',
		...Array.from(
			{ length: Math.ceil(total / SITEMAP_CHUNK_SIZE) },
			(_, index) => `/sitemap_chunk_${index}.xml`
		)
	];
	return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="${XML_NAMESPACE}">\n${paths.map((path) => `  <sitemap><loc>${escapeXml(origin + path)}</loc></sitemap>`).join('\n')}\n</sitemapindex>`;
}

export function mainSitemap(origin: string): string {
	// Canonical public pages only: utility, test and redirected search routes are excluded.
	const pages = [
		['/', 'daily', '1.0'],
		['/notices', 'hourly', '0.9'],
		['/notices/changes', 'hourly', '0.8'],
		['/discussions', 'daily', '0.7'],
		['/proposals', 'daily', '0.7'],
		['/announcements', 'daily', '0.6'],
		['/crawling-transparency', 'daily', '0.5'],
		['/license', 'monthly', '0.3']
	];
	return urlset(
		pages.map(
			([path, frequency, priority]) =>
				`  <url><loc>${escapeXml(origin + path)}</loc><changefreq>${frequency}</changefreq><priority>${priority}</priority></url>`
		)
	);
}

export async function fetchArchivePage(
	customFetch: typeof fetch,
	request: Request,
	page: number
): Promise<ArchiveNoticeListResponse> {
	const backend = (env.API_BASE_URL || 'http://localhost:3001/api').replace(/\/$/, '');
	// Give crawler work its own bucket and never forward visitor credentials.
	const headers = buildBackendForwardHeaders(new Request(request.url), 'sitemap-bot');
	const response = await customFetch(
		`${backend}/notices/archive?page=${page}&limit=${BATCH_SIZE}&sortOrder=asc&searchMode=keyword`,
		{ headers, signal: AbortSignal.timeout(10_000) }
	);
	if (!response.ok) throw new Error(`Archive page ${page} returned ${response.status}`);
	const body = await response.json();
	const data: ArchiveNoticeListResponse = body.data ?? body;
	if (
		!Array.isArray(data.items) ||
		!Number.isSafeInteger(data.total) ||
		data.total < 0 ||
		data.totalPages !== Math.max(1, Math.ceil(data.total / BATCH_SIZE)) ||
		data.limit !== BATCH_SIZE ||
		data.page !== page ||
		data.items.length !== Math.min(BATCH_SIZE, Math.max(0, data.total - (page - 1) * BATCH_SIZE))
	) {
		throw new Error('Invalid archive pagination in sitemap response');
	}
	return data;
}

function noticeTag(origin: string, notice: Notice): string {
	if (!Number.isSafeInteger(notice.num) || notice.num <= 0) {
		throw new Error('Invalid notice number in sitemap response');
	}
	const rawDate = notice.lastUpdatedAt ?? notice.archiveStartedAt;
	const date = rawDate ? new Date(rawDate) : null;
	const lastmod =
		date && !Number.isNaN(date.getTime()) ? `<lastmod>${date.toISOString()}</lastmod>` : '';
	return `  <url><loc>${escapeXml(`${origin}/notices/${notice.num}`)}</loc>${lastmod}</url>`;
}

export async function noticeSitemap(
	origin: string,
	chunk: number,
	customFetch: typeof fetch,
	request: Request
): Promise<string> {
	const firstPage = (chunk * SITEMAP_CHUNK_SIZE) / BATCH_SIZE + 1;
	// The archive API accepts pages 1 through 10,000.
	if (!Number.isSafeInteger(chunk) || chunk < 0 || firstPage > 10_000) {
		error(404, '사이트맵을 찾을 수 없습니다.');
	}
	const first = await fetchArchivePage(customFetch, request, firstPage);
	if (chunk >= Math.ceil(first.total / SITEMAP_CHUNK_SIZE)) {
		error(404, '사이트맵을 찾을 수 없습니다.');
	}
	const lastPage = Math.min(firstPage + SITEMAP_CHUNK_SIZE / BATCH_SIZE - 1, first.totalPages);
	const notices = [...first.items];
	// Ascending notice numbers keep existing chunks stable as newer bills arrive.
	// At most two archive requests run concurrently, rather than fetching the entire archive.
	for (let page = firstPage + 1; page <= lastPage; page += 2) {
		const pages = await Promise.all(
			Array.from({ length: Math.min(2, lastPage - page + 1) }, (_, offset) =>
				fetchArchivePage(customFetch, request, page + offset)
			)
		);
		for (const result of pages) notices.push(...result.items);
	}
	const expected = Math.min(SITEMAP_CHUNK_SIZE, first.total - chunk * SITEMAP_CHUNK_SIZE);
	if (
		notices.length !== expected ||
		new Set(notices.map((notice) => notice.num)).size !== expected
	) {
		throw new Error('Incomplete archive chunk in sitemap response');
	}
	return urlset(notices.map((notice) => noticeTag(origin, notice)));
}

export async function cachedSitemap(
	key: string,
	generate: () => Promise<string>
): Promise<Response> {
	try {
		let entry = cache.get(key);
		if (!entry || entry.expiresAt <= Date.now()) {
			// Cache the promise too, so simultaneous crawlers share one generation.
			entry = { xml: generate(), expiresAt: Date.now() + CACHE_TTL_MS };
			cache.delete(key);
			cache.set(key, entry);
			if (cache.size > MAX_CACHED_SITEMAPS) cache.delete(cache.keys().next().value!);
		}
		const xml = await entry.xml;
		return new Response(xml, {
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
				'Cache-Control': 'public, max-age=3600, s-maxage=3600'
			}
		});
	} catch (err) {
		cache.delete(key);
		if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
			return new Response('사이트맵을 찾을 수 없습니다.', {
				status: 404,
				headers: { 'Cache-Control': 'no-store' }
			});
		}
		console.error('sitemap: generation failed', err);
		// Never cache a partial successful sitemap when an upstream page fails.
		return new Response('사이트맵을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.', {
			status: 503,
			headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' }
		});
	}
}
