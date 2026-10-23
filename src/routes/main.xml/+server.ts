import { cachedSitemap, mainSitemap } from '$lib/server/sitemap';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) =>
	cachedSitemap(`${url.origin}/main.xml`, async () => mainSitemap(url.origin));
