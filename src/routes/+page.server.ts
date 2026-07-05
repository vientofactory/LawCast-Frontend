import { apiClient } from '$lib/api/client';
import type { PageServerLoad } from './$types';
import {
	isDiffchainUiMockEnabled,
	getMockRecentNotices,
	getMockQuickKeywordSuggestions,
	getMockSystemStats
} from '$lib/server/diffchain-ui-mock';

const DEFAULT_STATS = {
	webhooks: { total: 0, active: 0, inactive: 0 },
	cache: { size: 0, lastUpdated: null as string | null, maxSize: 10, isInitialized: false },
	archive: { count: 0 },
	changeTracking: { comparableEventTotal: 0, comparableNoticeCount: 0 },
	aiSummaryEnabled: false
};

export const load: PageServerLoad = async ({ fetch }) => {
	if (isDiffchainUiMockEnabled()) {
		return {
			recentNotices: getMockRecentNotices(),
			quickKeywords: getMockQuickKeywordSuggestions(),
			stats: getMockSystemStats()
		};
	}

	const [recentNotices, quickKeywords, stats] = await Promise.all([
		apiClient
			.getRecentNotices(fetch)
			.catch(() => [] as Awaited<ReturnType<typeof apiClient.getRecentNotices>>),
		apiClient.getQuickKeywordSuggestions({ limit: 8 }, fetch).catch(() => ({
			items: [],
			updatedAt: null,
			sourceNoticeCount: 0,
			refreshIntervalMs: 60 * 60 * 1000
		})),
		apiClient.getSystemStats(fetch).catch(() => DEFAULT_STATS)
	]);

	return { recentNotices, quickKeywords, stats };
};
