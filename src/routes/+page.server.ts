import { apiClient } from '$lib/api/client';
import { loadTopAdminNotice } from '$lib/server/announcements';
import { toDiscussionThreadCard, toNoticeCard } from '$lib/server/ssr-cards';
import { DiscussionThreadStatus } from '$lib/types/api';
import type { PageServerLoad } from './$types';
import {
	isDiffchainUiMockEnabled,
	getMockRecentNotices,
	getMockQuickKeywordSuggestions,
	getMockSystemStats,
	getMockAllDiscussionThreads
} from '$lib/server/diffchain-ui-mock';

const DEFAULT_STATS = {
	webhooks: { total: 0, active: 0, inactive: 0 },
	cache: { size: 0, lastUpdated: null as string | null, maxSize: 10, isInitialized: false },
	archive: { count: 0 },
	changeTracking: { comparableEventTotal: 0, comparableNoticeCount: 0 },
	aiSummaryEnabled: false
};

const RECENT_DISCUSSIONS_LIMIT = 5;

/**
 * The home hero renders only these four sections of SystemStats — webhooks,
 * ollama, crawlers, nodeRuntime and the rest belong to /status and stay there.
 */
function toHomeStats(stats: {
	archive?: { count?: number };
	cache?: { lastUpdated?: string | null };
	aiSummaryEnabled?: boolean;
	changeTracking?: { comparableEventTotal?: number };
}) {
	return {
		archive: { count: stats.archive?.count ?? 0 },
		cache: { lastUpdated: stats.cache?.lastUpdated ?? null },
		aiSummaryEnabled: stats.aiSummaryEnabled,
		changeTracking: stats.changeTracking
			? { comparableEventTotal: stats.changeTracking.comparableEventTotal ?? 0 }
			: undefined
	};
}

/**
 * The hero suggestion list renders `keyword` only; scores, match counts and
 * the refresh interval are never displayed.
 */
function toHomeQuickKeywords(keywords: {
	items: { keyword: string }[];
	updatedAt: string | null;
	sourceNoticeCount: number;
}) {
	return {
		items: keywords.items.map((item) => ({ keyword: item.keyword })),
		updatedAt: keywords.updatedAt,
		sourceNoticeCount: keywords.sourceNoticeCount
	};
}

export const load: PageServerLoad = async ({ fetch }) => {
	if (isDiffchainUiMockEnabled()) {
		return {
			recentNotices: getMockRecentNotices().map(toNoticeCard),
			quickKeywords: toHomeQuickKeywords(getMockQuickKeywordSuggestions()),
			stats: toHomeStats(getMockSystemStats()),
			recentDiscussions: getMockAllDiscussionThreads().items.map(toDiscussionThreadCard),
			// Pinned chip: ONE notice (top display order), never the full list.
			pinnedNotice: (await loadTopAdminNotice({}, fetch)).item
		};
	}

	const [recentNotices, quickKeywords, stats, recentDiscussions, pinnedNotice] = await Promise.all([
		apiClient
			.getRecentNotices(fetch)
			.then((items) => items.map(toNoticeCard))
			.catch(() => []),
		apiClient
			.getQuickKeywordSuggestions({ limit: 8 }, fetch)
			.then(toHomeQuickKeywords)
			.catch(() => ({ items: [], updatedAt: null, sourceNoticeCount: 0 })),
		apiClient
			.getSystemStats(fetch)
			.then(toHomeStats)
			.catch(() => toHomeStats(DEFAULT_STATS)),
		apiClient
			.getAllDiscussionThreads(
				{ limit: RECENT_DISCUSSIONS_LIMIT, status: DiscussionThreadStatus.OPEN },
				fetch
			)
			.then((res) => res.items.map(toDiscussionThreadCard))
			.catch(() => []),
		// Pinned chip: ONE notice (top display order) — a failure only hides
		// the chip, so it never pulls the full list into global SSR data.
		loadTopAdminNotice({}, fetch)
			.then(({ item }) => item)
			.catch(() => null)
	]);

	return { recentNotices, quickKeywords, stats, recentDiscussions, pinnedNotice };
};
