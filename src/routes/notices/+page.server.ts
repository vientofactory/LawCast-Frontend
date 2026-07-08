import { apiClient } from '$lib/api/client';
import {
	isDiffchainUiMockEnabled,
	getMockArchiveNoticesResponse
} from '$lib/server/diffchain-ui-mock';
import type { PageServerLoad } from '../$types';

function parseNoticeNums(raw: string | null): number[] {
	if (!raw) {
		return [];
	}

	return Array.from(
		new Set(
			raw
				.split(',')
				.map((value) => Number.parseInt(value.trim(), 10))
				.filter((value) => Number.isInteger(value) && value > 0)
		)
	);
}

export const load: PageServerLoad = async ({ fetch, url }) => {
	const requestedPage = Number(url.searchParams.get('page') || '1');
	const requestedLimit = Number(url.searchParams.get('limit') || '10');
	const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
	const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(20, requestedLimit)) : 10;
	const search = (url.searchParams.get('search') || '').trim();
	const startDate = (url.searchParams.get('startDate') || '').trim();
	const endDate = (url.searchParams.get('endDate') || '').trim();
	const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
	const isDoneParam = url.searchParams.get('isDone');
	const isDone = isDoneParam === 'true' ? true : isDoneParam === 'false' ? false : undefined;
	const fullText = url.searchParams.get('fullText') === 'true';
	const noticeNums = parseNoticeNums(url.searchParams.get('noticeNums'));
	const isDigestContext =
		url.searchParams.get('digest') === '1' || url.searchParams.get('digest') === 'true';

	if (isDiffchainUiMockEnabled()) {
		return {
			archive: getMockArchiveNoticesResponse({
				page,
				limit,
				search,
				startDate,
				endDate,
				sortOrder,
				isDone,
				fullText
			}),
			digestContext: {
				isDigestContext,
				noticeNums
			}
		};
	}

	try {
		const archive = await apiClient.getArchivedNotices(
			{
				page,
				limit,
				search,
				startDate,
				endDate,
				sortOrder,
				isDone,
				fullText,
				noticeNums
			},
			fetch
		);

		return {
			archive,
			digestContext: {
				isDigestContext,
				noticeNums
			}
		};
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
				startDate,
				endDate,
				sortOrder,
				stats: {
					cacheCount: 0,
					matchedCacheCount: 0,
					archiveCount: 0,
					totalArchiveCount: 0,
					mergedCount: 0
				}
			},
			digestContext: {
				isDigestContext,
				noticeNums
			},
			error: '입법예고 데이터를 불러오는데 실패했습니다.'
		};
	}
};
