import { error } from '@sveltejs/kit';
import { loadAdminNoticeList } from '$lib/server/announcements';
import type { PageServerLoad } from './$types';

/**
 * Notice body page: resolves the id against the single `GET /api/announcements`
 * list — adding a per-item backend route would break the read-only contract
 * (CRUD stays in Notion).
 */
export const load: PageServerLoad = async ({ params, fetch }) => {
	const { items } = await loadAdminNoticeList(fetch);
	const notice = items.find((item) => item.id === params.id) ?? null;
	if (!notice) {
		throw error(404, '요청한 공지사항을 찾을 수 없습니다.');
	}
	return { notice };
};
