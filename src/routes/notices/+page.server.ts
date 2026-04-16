import { apiClient } from '$lib/api/client';
import type { PageServerLoad } from '../$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
	const requestedPage = Number(url.searchParams.get('page') || '1');
	const requestedLimit = Number(url.searchParams.get('limit') || '10');
	const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
	const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(20, requestedLimit)) : 10;
	const search = (url.searchParams.get('search') || '').trim();

	try {
		const archive = await apiClient.getArchivedNotices(
			{
				page,
				limit,
				search
			},
			fetch
		);

		return { archive };
	} catch (err) {
		console.error('Failed to load notices:', err);
		return {
			archive: {
				items: [],
				page,
				limit,
				total: 0,
				totalPages: 1,
				search,
				stats: {
					cacheCount: 0,
					matchedCacheCount: 0,
					archiveCount: 0,
					totalArchiveCount: 0,
					mergedCount: 0
				}
			},
			error: '입법예고 데이터를 불러오는데 실패했습니다.'
		};
	}
};
