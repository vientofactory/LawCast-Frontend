import { apiClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const [recentNotices, stats] = await Promise.all([
			apiClient.getRecentNotices(fetch),
			apiClient.getSystemStats(fetch)
		]);

		return {
			recentNotices,
			stats
		};
	} catch (err) {
		console.error('Failed to load initial data:', err);
		return {
			recentNotices: [],
			stats: {
				webhooks: { total: 0, active: 0, inactive: 0 },
				cache: { size: 0, lastUpdated: null, maxSize: 10, isInitialized: false },
				archive: { count: 0 },
				aiSummaryEnabled: false
			},
			error: '초기 데이터 로딩에 실패했습니다. 페이지를 새로고침해주세요.'
		};
	}
};
