import { cachedSitemap, fetchSitemapSnapshot, sitemapIndex } from '#lib/server/sitemap.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ fetch, request, url }) =>
	cachedSitemap(`${url.origin}/sitemap.xml`, async () => {
		const { total } = await fetchSitemapSnapshot(fetch, request);
		return sitemapIndex(url.origin, total);
	});
