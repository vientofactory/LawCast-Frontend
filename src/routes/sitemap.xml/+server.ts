import { API_BASE_URL } from '$env/static/private';
import type { RequestHandler } from './$types';
import type { Notice, ArchiveNoticeListResponse } from '$lib/types/api';

const BACKEND_URL = API_BASE_URL || 'http://localhost:3001/api';
const BATCH_SIZE = 100;
const MAX_NOTICES = 5000; // Google 권장 상한 50,000 이내
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

let cachedXml: string | null = null;
let cacheExpiresAt = 0;

interface NoticeEntry {
	num: number;
	lastmod: string;
}

async function fetchAllNoticeEntries(customFetch: typeof fetch): Promise<NoticeEntry[]> {
	const entries: NoticeEntry[] = [];

	// 첫 번째 페이지로 전체 개수 파악
	const firstRes = await customFetch(
		`${BACKEND_URL}/notices/archive?page=1&limit=${BATCH_SIZE}&sortOrder=desc`
	);
	if (!firstRes.ok) return entries;

	const firstData = (await firstRes.json()) as {
		data?: ArchiveNoticeListResponse;
	} & ArchiveNoticeListResponse;
	const first: ArchiveNoticeListResponse = firstData.data ?? firstData;

	for (const item of first.items ?? []) {
		entries.push(toEntry(item));
	}

	const totalPages = Math.min(first.totalPages ?? 1, Math.ceil(MAX_NOTICES / BATCH_SIZE));

	if (totalPages <= 1) return entries;

	// 나머지 페이지 병렬 fetch
	const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
	const results = await Promise.all(
		pageNums.map((page) =>
			customFetch(`${BACKEND_URL}/notices/archive?page=${page}&limit=${BATCH_SIZE}&sortOrder=desc`)
				.then((r) => (r.ok ? r.json() : null))
				.catch(() => null)
		)
	);

	for (const result of results) {
		if (!result) continue;
		const pageData =
			(result as { data?: ArchiveNoticeListResponse } & ArchiveNoticeListResponse).data ??
			(result as ArchiveNoticeListResponse);
		for (const item of pageData.items ?? []) {
			entries.push(toEntry(item));
		}
	}

	return entries;
}

function toEntry(item: Notice): NoticeEntry {
	const rawDate = item.lastUpdatedAt ?? item.archiveStartedAt;
	const lastmod = rawDate ? rawDate.split('T')[0] : new Date().toISOString().split('T')[0];
	return { num: item.num, lastmod };
}

function urlTag(loc: string, lastmod: string, changefreq: string, priority: string): string {
	return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export const GET: RequestHandler = async ({ fetch, url }) => {
	const now = Date.now();
	if (cachedXml && now < cacheExpiresAt) {
		return new Response(cachedXml, {
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
				'Cache-Control': 'public, max-age=3600, s-maxage=3600'
			}
		});
	}

	const origin = url.origin;
	const today = new Date().toISOString().split('T')[0];

	const staticEntries = [
		urlTag(`${origin}/`, today, 'daily', '1.0'),
		urlTag(`${origin}/notices`, today, 'hourly', '0.9')
	];

	let noticeEntries: string[] = [];
	try {
		const notices = await fetchAllNoticeEntries(fetch);
		noticeEntries = notices.map((n) =>
			urlTag(`${origin}/notices/${n.num}`, n.lastmod, 'weekly', '0.7')
		);
	} catch (err) {
		console.error('sitemap: failed to fetch notice entries', err);
	}

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...noticeEntries].join('\n')}
</urlset>`;

	cachedXml = xml;
	cacheExpiresAt = now + CACHE_TTL_MS;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, s-maxage=3600'
		}
	});
};
