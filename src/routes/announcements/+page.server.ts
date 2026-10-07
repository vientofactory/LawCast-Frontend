import { loadAdminNoticeList } from '$lib/server/announcements';
import type { PageServerLoad } from './$types';

/**
 * Notice list: the backend's single GET returns every published notice in
 * display order (filtering and sorting are the backend contract; CRUD stays
 * in Notion).
 */
export const load: PageServerLoad = async ({ fetch }) => ({
	notices: (await loadAdminNoticeList(fetch)).items
});
