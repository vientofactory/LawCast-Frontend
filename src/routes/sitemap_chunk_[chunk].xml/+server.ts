import { error } from '@sveltejs/kit';
import { cachedSitemap, noticeSitemap } from '$lib/server/sitemap';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ fetch, request, params, url }) =>
	cachedSitemap(`${url.origin}${url.pathname}`, async () => {
		if (!/^(0|[1-9]\d*)$/.test(params.chunk)) {
			error(404, '사이트맵을 찾을 수 없습니다.');
		}
		return noticeSitemap(url.origin, Number(params.chunk), fetch, request);
	});
