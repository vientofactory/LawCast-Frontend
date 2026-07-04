import { apiClient } from '$lib/api/client';
import {
	isDiffchainUiMockEnabled,
	getMockRecentNoticeChangesResponse
} from '$lib/server/diffchain-ui-mock';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
	const requestedPage = Number(url.searchParams.get('page') || '1');
	const requestedLimit = Number(url.searchParams.get('limit') || '20');
	const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
	const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(50, requestedLimit)) : 20;

	if (isDiffchainUiMockEnabled()) {
		const changes = getMockRecentNoticeChangesResponse({ page, limit });
		return {
			changes,
			summary: {
				comparableEventTotal: changes.total,
				comparableNoticeCount: 4
			}
		};
	}

	const [changes, summary] = await Promise.all([
		apiClient.getRecentNoticeChanges(
			{
				page,
				limit,
				excludeLegacyGenesisSource: true,
				comparableOnly: true
			},
			fetch
		),
		apiClient.getComparableNoticeChangesSummary(fetch)
	]);

	return { changes, summary };
};
