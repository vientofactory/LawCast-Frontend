import { cachedSitemap, fetchArchivePage, sitemapIndex } from '$lib/server/sitemap';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ fetch, request, url }) =>
	cachedSitemap(`${url.origin}/sitemap.xml`, async () => {
		const { total } = await fetchArchivePage(fetch, request, 1);
		return sitemapIndex(url.origin, total);
	});
