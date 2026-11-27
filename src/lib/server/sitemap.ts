import { error } from '@sveltejs/kit';
import {
	buildBackendForwardHeaders,
	getBackendBaseUrl,
	rejectBackendRedirect
} from '#lib/server/client-ip.ts';

export const SITEMAP_CHUNK_SIZE = 500;
interface SitemapSnapshot {
	generatedAt: string;
	total: number;
	items: { num: number; archiveStartedAt: string | null }[];
}
const snapshots = new Map<string, { value: Promise<SitemapSnapshot>; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHED_SITEMAPS = 64;
const XML_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const cache = new Map<string, { xml: Promise<string>; expiresAt: number }>();

type SnapshotStage = 'request' | 'status' | 'body' | 'validation';
type SnapshotFailure = Error & {
	stage?: SnapshotStage;
	upstreamStatus?: number;
	attempt?: number;
	retryable?: boolean;
};

function failureDetails(value: unknown) {
	const failure = value instanceof Error ? (value as SnapshotFailure) : undefined;
	return {
		name: failure?.name ?? 'UnknownError',
		message: failure?.message.slice(0, 400),
		stage: failure?.stage,
		upstreamStatus: failure?.upstreamStatus,
		attempt: failure?.attempt,
		retryable: failure?.retryable,
		stack: failure?.stack?.slice(0, 1500)
	};
}

async function readSnapshot(
	customFetch: typeof fetch,
	request: Request,
	backend: string
): Promise<SitemapSnapshot> {
	const headers = buildBackendForwardHeaders(new Request(request.url), null);
	// Both attempts share the original deadline; retries never extend crawler wait time.
	const signal = AbortSignal.timeout(10_000);
	for (let attempt = 1; ; attempt++) {
		let stage: SnapshotStage = 'request';
		let upstreamStatus: number | undefined;
		try {
			const response = await customFetch(`${backend}/sitemap/notices`, {
				headers,
				redirect: 'manual',
				signal
			});
			upstreamStatus = response.status;
			stage = 'status';
			rejectBackendRedirect(response);
			if (!response.ok) {
				await response.body?.cancel().catch(() => {});
				throw new Error(`Sitemap snapshot returned ${response.status}`);
			}
			stage = 'body';
			return await response.json();
		} catch (value) {
			const failure: SnapshotFailure = Object.assign(
				value instanceof Error ? value : new Error('Sitemap snapshot operation failed'),
				{ stage, upstreamStatus, attempt }
			);
			const transient =
				(stage === 'status' && upstreamStatus !== undefined && upstreamStatus >= 500) ||
				((stage === 'request' || stage === 'body') &&
					(failure.retryable === true || failure.name === 'TypeError'));
			if (attempt >= 2 || signal.aborted || !transient) throw failure;
			// Log only public correlation data and error details, never request headers or credentials.
			console.warn('sitemap: snapshot retry', {
				...failureDetails(failure),
				backendHost: new URL(backend).hostname,
				ray: request.headers.get('cf-ray')?.slice(0, 64)
			});
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
	}
}

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
		['/license', 'monthly', '0.3'],
		['/legal', 'monthly', '0.3']
	];
	return urlset(
		pages.map(
			([path, frequency, priority]) =>
				`  <url><loc>${escapeXml(origin + path)}</loc><changefreq>${frequency}</changefreq><priority>${priority}</priority></url>`
		)
	);
}

export async function fetchSitemapSnapshot(
	customFetch: typeof fetch,
	request: Request
): Promise<SitemapSnapshot> {
	const backend = getBackendBaseUrl();
	let entry = snapshots.get(backend);
	if (!entry || entry.expiresAt <= Date.now()) {
		const value = (async () => {
			const data = await readSnapshot(customFetch, request, backend);
			if (
				!data ||
				!Array.isArray(data.items) ||
				data.total !== data.items.length ||
				!Number.isSafeInteger(data.total) ||
				data.total < 0 ||
				!Number.isFinite(Date.parse(data.generatedAt)) ||
				data.items.some(
					(notice, index) =>
						!Number.isSafeInteger(notice.num) ||
						notice.num <= 0 ||
						(index > 0 && notice.num <= data.items[index - 1].num)
				)
			) {
				throw Object.assign(new Error('Invalid sitemap snapshot'), { stage: 'validation' });
			}
			return data;
		})();
		entry = { value, expiresAt: Date.now() + 300_000 };
		snapshots.set(backend, entry);
	}
	try {
		return await entry.value;
	} catch (err) {
		if (snapshots.get(backend) === entry) snapshots.delete(backend);
		throw err;
	}
}

function noticeTag(escapedOrigin: string, notice: SitemapSnapshot['items'][number]): string {
	if (!Number.isSafeInteger(notice.num) || notice.num <= 0) {
		throw new Error('Invalid notice number in sitemap response');
	}
	const rawDate = notice.archiveStartedAt;
	const date = rawDate ? new Date(rawDate) : null;
	const lastmod =
		date && !Number.isNaN(date.getTime()) ? `<lastmod>${date.toISOString()}</lastmod>` : '';
	return `  <url><loc>${escapedOrigin}/notices/${notice.num}</loc>${lastmod}</url>`;
}

export async function noticeSitemap(
	origin: string,
	chunk: number,
	customFetch: typeof fetch,
	request: Request
): Promise<string> {
	if (!Number.isSafeInteger(chunk) || chunk < 0) error(404, '사이트맵을 찾을 수 없습니다.');
	const snapshot = await fetchSitemapSnapshot(customFetch, request);
	if (chunk >= Math.ceil(snapshot.total / SITEMAP_CHUNK_SIZE)) {
		error(404, '사이트맵을 찾을 수 없습니다.');
	}
	const notices = snapshot.items.slice(
		chunk * SITEMAP_CHUNK_SIZE,
		(chunk + 1) * SITEMAP_CHUNK_SIZE
	);
	const escapedOrigin = escapeXml(origin);
	return urlset(notices.map((notice) => noticeTag(escapedOrigin, notice)));
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
		// Do not renew an old in-memory generation for another full CDN TTL.
		const maxAge = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
		return new Response(xml, {
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
				'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`
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
		console.error('sitemap: generation failed', { key, ...failureDetails(err) });
		// Never cache a partial successful sitemap when an upstream page fails.
		return new Response('사이트맵을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.', {
			status: 503,
			headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' }
		});
	}
}
