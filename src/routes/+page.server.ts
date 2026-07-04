import { apiClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';
import {
	isDiffchainUiMockEnabled,
	getMockRecentNotices,
	getMockSystemStats
} from '$lib/server/diffchain-ui-mock';

const DEFAULT_STATS = {
	webhooks: { total: 0, active: 0, inactive: 0 },
	cache: { size: 0, lastUpdated: null as string | null, maxSize: 10, isInitialized: false },
	archive: { count: 0 },
	aiSummaryEnabled: false
};

export const load: PageServerLoad = async ({ fetch }) => {
	if (isDiffchainUiMockEnabled()) {
		return {
			recentNotices: getMockRecentNotices(),
			stats: getMockSystemStats()
		};
	}

	const [recentNotices, stats] = await Promise.all([
		apiClient
			.getRecentNotices(fetch)
			.catch(() => [] as Awaited<ReturnType<typeof apiClient.getRecentNotices>>),
		apiClient.getSystemStats(fetch).catch(() => DEFAULT_STATS)
	]);

	return { recentNotices, stats };
};
