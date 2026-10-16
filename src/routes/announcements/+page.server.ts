import { error } from '@sveltejs/kit';
import { loadAdminNoticeList } from '$lib/server/announcements';
import type { PageServerLoad } from './$types';

/**
 * Notice list: the backend's single GET returns every published notice in
 * display order (filtering and sorting are the backend contract; CRUD stays
 * in Notion).
 */
export const load: PageServerLoad = async ({ fetch }) => {
	try {
		return { notices: (await loadAdminNoticeList(fetch)).items };
	} catch (err) {
		// Same fast-failure contract as the detail page: a slow or failing
		// Notion fetch answers 503/429 at once instead of holding SSR open.
		const status = (err as { status?: number } | null)?.status;
		if (status === 429) {
			throw error(429, '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
		}
		throw error(503, '공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
	}
};
